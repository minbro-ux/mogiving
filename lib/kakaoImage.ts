import { isPublicHttpUrl } from "./publicUrl";

/**
 * 쇼핑몰 크롤링이 막혀 대표 사진을 못 가져왔을 때, 상품명으로 카카오 이미지 검색을 해 가장 그럴듯한 사진 한 장을 고른다.
 * 서버 전용 (KAKAO_REST_API_KEY). 어떤 실패도 throw하지 않고 undefined를 돌려준다 → 화면은 쇼핑몰 기본 썸네일 카드 그대로.
 */

/** 카카오 이미지 검색 결과 한 건 (https://developers.kakao.com/docs/latest/ko/daum-search/dev-guide#search-image) */
export type KakaoImageDoc = {
  image_url?: string;
  thumbnail_url?: string;
  width?: number;
  height?: number;
  display_sitename?: string;
  doc_url?: string;
};

/** 쇼핑몰 상품 사진 CDN (이미지 주소의 호스트에 포함되면 실제 상품 사진일 가능성이 높다) */
const MALL_CDN = ["coupangcdn", "pstatic.net", "musinsa", "29cm", "zigzag", "ssgcdn", "lotteon", "gmarket", "11st", "auction", "oliveyoung", "wconcept", "kream"];

const SEARCH_URL = "https://dapi.kakao.com/v2/search/image";
/** 카카오 검색 API 응답을 기다리는 최대 시간 */
const SEARCH_TIMEOUT_MS = 3000;
/** 고른 원본 이미지가 실제로 열리는지 확인하는 최대 시간 (넘으면 카카오 썸네일을 쓴다) */
const PROBE_TIMEOUT_MS = 1500;

const ratioOf = (d: KakaoImageDoc) => (d.width && d.height && d.width > 0 && d.height > 0 ? d.width / d.height : undefined);

/** 혼합 콘텐츠로 막히지 않게 https로 바꾼 절대 주소 (http(s)가 아니면 undefined) */
function httpsUrl(raw: string | undefined) {
  if (!raw) return undefined;
  try {
    const u = new URL(raw.startsWith("//") ? `https:${raw}` : raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return undefined;
    u.protocol = "https:";
    return u.toString();
  } catch {
    return undefined;
  }
}

const isMallCdn = (url: string) => {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return MALL_CDN.some((k) => host.includes(k));
  } catch {
    return false;
  }
};

/**
 * 검색 결과 중 대표 사진 하나를 고른다.
 * 1순위: 쇼핑몰 CDN 이미지이면서 정사각형에 가까운 것 (가로/세로 0.7~1.4)
 * 2순위: 배너·아이콘처럼 너무 길쭉한 것(2.0 초과 또는 0.5 미만)을 뺀 첫 번째 이미지
 */
export function pickKakaoImage(docs: readonly KakaoImageDoc[] | undefined): KakaoImageDoc | undefined {
  const valid = (docs ?? []).filter((d) => httpsUrl(d.image_url) || httpsUrl(d.thumbnail_url));
  const first = valid.find((d) => {
    const r = ratioOf(d);
    const url = httpsUrl(d.image_url);
    return !!url && isMallCdn(url) && r !== undefined && r >= 0.7 && r <= 1.4;
  });
  if (first) return first;
  return valid.find((d) => {
    const r = ratioOf(d);
    return r === undefined || (r <= 2.0 && r >= 0.5);
  });
}

/** 검색어: 상품명 + ' 상품' (너무 긴 상품명은 앞부분만) */
export const kakaoImageQuery = (title: string) => `${title.replace(/\s+/g, " ").trim().slice(0, 60)} 상품`;

/** 원본 이미지가 핫링크 차단·삭제 없이 실제 이미지로 열리는지 확인한다 (본문은 받지 않고 바로 끊음) */
async function isReachableImage(url: string, fetchImpl: typeof fetch) {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (!isPublicHttpUrl(u)) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    // 화면의 <img referrerPolicy="no-referrer">와 같은 조건(리퍼러 없음)으로 확인
    const res = await fetchImpl(u, { signal: controller.signal, redirect: "follow", cache: "no-store" });
    const ok = res.ok && /^image\//i.test(res.headers.get("content-type") ?? "");
    controller.abort();
    return ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** 고른 결과에서 화면에 쓸 주소: 원본(image_url)이 열리면 원본, 아니면 카카오 썸네일(thumbnail_url) */
export async function resolveKakaoImageUrl(doc: KakaoImageDoc, fetchImpl: typeof fetch = fetch) {
  const original = httpsUrl(doc.image_url);
  const thumbnail = httpsUrl(doc.thumbnail_url);
  if (original && (await isReachableImage(original, fetchImpl))) return original;
  return thumbnail;
}

/**
 * 상품명으로 카카오 이미지 검색 → 대표 사진 주소.
 * 키가 없거나, 결과가 없거나, 호출이 실패하면 undefined.
 */
export async function searchProductImage(title: string, opts: { apiKey?: string; fetchImpl?: typeof fetch; signal?: AbortSignal } = {}): Promise<string | undefined> {
  const apiKey = opts.apiKey ?? process.env.KAKAO_REST_API_KEY;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const name = title?.trim();
  if (!apiKey || !name) return undefined;

  const controller = new AbortController();
  const abort = () => controller.abort();
  opts.signal?.addEventListener("abort", abort);
  const timer = setTimeout(abort, SEARCH_TIMEOUT_MS);
  try {
    const res = await fetchImpl(`${SEARCH_URL}?query=${encodeURIComponent(kakaoImageQuery(name))}&size=10&sort=accuracy`, {
      headers: { Authorization: `KakaoAK ${apiKey}` },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) return undefined;
    const body = (await res.json()) as { documents?: KakaoImageDoc[] };
    clearTimeout(timer);
    const doc = pickKakaoImage(Array.isArray(body?.documents) ? body.documents : undefined);
    return doc ? await resolveKakaoImageUrl(doc, fetchImpl) : undefined;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener("abort", abort);
  }
}
