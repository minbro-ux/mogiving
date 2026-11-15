import { type ImageType, MAX_IMAGE_BYTES, sniffImageType } from "./imageStore";
import { isPublicHttpUrl } from "./publicUrl";

/**
 * 쇼핑몰 크롤링이 막혀 대표 사진을 못 가져왔을 때, 상품명으로 카카오 이미지 검색을 해 가장 그럴듯한 사진 한 장을 고르고
 * 서버가 직접 내려받는다. 받은 사진은 우리 저장소(/api/image/[id])에 넣어 내보내므로 브라우저 핫링크 차단과 무관하게 보인다.
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

/** 핫링크(Referer)를 막는 네이버 블로그·카페 이미지 서버: 후보에서 뺀다 */
const HOTLINK_BLOCKED_HOSTS = ["postfiles.pstatic.net", "blogfiles.pstatic.net", "cafeptthumb-phinf.pstatic.net"];

/** 쇼핑몰 공식 상품 사진 CDN (호스트가 이것이거나 이것의 하위 도메인이면 1순위 후보) */
const OFFICIAL_CDN_HOSTS = [
  "shopping-phinf.pstatic.net",
  "shop-phinf.pstatic.net",
  "coupangcdn.com",
  "image.musinsa.com",
  "img.29cm.co.kr",
  "cf.product-image.s.zigzag.kr",
  "sitem.ssgcdn.com",
  "ssgcdn.com",
  "lotteon.com",
  "gmarket.co.kr",
  "11st.co.kr",
  "auction.co.kr",
  "oliveyoung.co.kr",
  "wconcept.co.kr",
  "kream.co.kr",
];

const SEARCH_URL = "https://dapi.kakao.com/v2/search/image";
/** 카카오 검색 API 응답을 기다리는 최대 시간 */
const SEARCH_TIMEOUT_MS = 2500;
/** 사진 한 장을 내려받는 최대 시간 (원본 실패 시 썸네일까지 두 번) */
const DOWNLOAD_TIMEOUT_MS = 2000;
const MAX_REDIRECTS = 3;

/** 이미지 서버가 봇 요청으로 보고 막지 않도록 실제 크롬 브라우저처럼 요청한다 */
const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

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

const hostOf = (url: string | undefined) => {
  try {
    return url ? new URL(url).hostname.toLowerCase() : "";
  } catch {
    return "";
  }
};
const matchesHost = (host: string, list: readonly string[]) => !!host && list.some((h) => host === h || host.endsWith(`.${h}`));

export const isHotlinkBlocked = (url: string | undefined) => matchesHost(hostOf(httpsUrl(url)), HOTLINK_BLOCKED_HOSTS);
export const isOfficialCdn = (url: string | undefined) => matchesHost(hostOf(httpsUrl(url)), OFFICIAL_CDN_HOSTS);

/**
 * 검색 결과 중 대표 사진 하나를 고른다. 네이버 블로그·카페 이미지(핫링크 차단)는 처음부터 뺀다.
 * 1순위: 쇼핑몰 공식 상품 사진 CDN이면서 정사각형에 가까운 것 (가로/세로 0.7~1.4)
 * 2순위: 배너·아이콘처럼 너무 길쭉한 것(2.0 초과 또는 0.5 미만)을 뺀 첫 번째 이미지
 */
export function pickKakaoImage(docs: readonly KakaoImageDoc[] | undefined): KakaoImageDoc | undefined {
  const valid = (docs ?? []).filter((d) => (httpsUrl(d.image_url) || httpsUrl(d.thumbnail_url)) && !isHotlinkBlocked(d.image_url));
  const first = valid.find((d) => {
    const r = ratioOf(d);
    return isOfficialCdn(d.image_url) && r !== undefined && r >= 0.7 && r <= 1.4;
  });
  if (first) return first;
  return valid.find((d) => {
    const r = ratioOf(d);
    return r === undefined || (r <= 2.0 && r >= 0.5);
  });
}

/** 검색어: 상품명 + ' 상품' (너무 긴 상품명은 앞부분만) */
export const kakaoImageQuery = (title: string) => `${title.replace(/\s+/g, " ").trim().slice(0, 60)} 상품`;

/** 본문을 maxBytes까지만 읽는다. 넘으면 null (큰 파일을 끝까지 받지 않음) */
async function readCapped(res: Response, maxBytes: number): Promise<Uint8Array | null> {
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > maxBytes) return null;
  if (!res.body) {
    const buf = new Uint8Array(await res.arrayBuffer());
    return buf.byteLength > maxBytes ? null : buf;
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
}

export type DownloadedImage = { bytes: Uint8Array; type: ImageType; source: "original" | "thumbnail" };

/**
 * 사진을 서버에서 직접 받는다 (브라우저 User-Agent + 원문 페이지 Referer).
 * 리다이렉트마다 사설망 주소를 다시 막고, 저장 가능한 크기(MAX_IMAGE_BYTES)·형식(JPEG·PNG·WebP)인지 내용으로 확인한다.
 */
export async function downloadImage(url: string, referer: string | undefined, fetchImpl: typeof fetch = fetch): Promise<{ bytes: Uint8Array; type: ImageType } | undefined> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    let target = new URL(url);
    for (let i = 0; i <= MAX_REDIRECTS; i++) {
      if (!isPublicHttpUrl(target)) return undefined;
      const res = await fetchImpl(target, {
        redirect: "manual",
        signal: controller.signal,
        cache: "no-store",
        headers: {
          "User-Agent": BROWSER_UA,
          Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
          "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
          ...(referer ? { Referer: referer } : {}),
        },
      });
      const location = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && location) {
        target = new URL(location, target);
        continue;
      }
      if (!res.ok) return undefined;
      const bytes = await readCapped(res, MAX_IMAGE_BYTES);
      const type = bytes && sniffImageType(bytes);
      return bytes && type ? { bytes, type } : undefined;
    }
    return undefined;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

/** Referer로 보낼 주소: 카카오가 알려준 원문 페이지, 없으면 이미지 서버 자신 */
function refererFor(doc: KakaoImageDoc, imageUrl: string) {
  const page = httpsUrl(doc.doc_url);
  if (page) return page;
  try {
    return `${new URL(imageUrl).origin}/`;
  } catch {
    return undefined;
  }
}

/** 고른 결과를 내려받는다: 원본(image_url) → 안 되면(차단·너무 큼·GIF 등) 카카오 썸네일(thumbnail_url) */
export async function downloadKakaoImage(doc: KakaoImageDoc, fetchImpl: typeof fetch = fetch): Promise<DownloadedImage | undefined> {
  const original = httpsUrl(doc.image_url);
  if (original) {
    const img = await downloadImage(original, refererFor(doc, original), fetchImpl);
    if (img) return { ...img, source: "original" };
  }
  const thumbnail = httpsUrl(doc.thumbnail_url);
  if (thumbnail) {
    const img = await downloadImage(thumbnail, undefined, fetchImpl);
    if (img) return { ...img, source: "thumbnail" };
  }
  return undefined;
}

/**
 * 상품명으로 카카오 이미지 검색 → 고른 사진을 내려받은 결과.
 * 키가 없거나, 결과가 없거나, 호출·다운로드가 실패하면 undefined.
 */
export async function findProductImage(title: string, opts: { apiKey?: string; fetchImpl?: typeof fetch; signal?: AbortSignal } = {}): Promise<DownloadedImage | undefined> {
  const apiKey = opts.apiKey ?? process.env.KAKAO_REST_API_KEY;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const name = title?.trim();
  if (!apiKey || !name) return undefined;

  const controller = new AbortController();
  const abort = () => controller.abort();
  opts.signal?.addEventListener("abort", abort);
  const timer = setTimeout(abort, SEARCH_TIMEOUT_MS);
  let doc: KakaoImageDoc | undefined;
  try {
    const res = await fetchImpl(`${SEARCH_URL}?query=${encodeURIComponent(kakaoImageQuery(name))}&size=10&sort=accuracy`, {
      headers: { Authorization: `KakaoAK ${apiKey}` },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) return undefined;
    const body = (await res.json()) as { documents?: KakaoImageDoc[] };
    doc = pickKakaoImage(Array.isArray(body?.documents) ? body.documents : undefined);
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener("abort", abort);
  }
  return doc ? downloadKakaoImage(doc, fetchImpl) : undefined;
}
