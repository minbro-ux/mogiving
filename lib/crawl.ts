import { toOptionItems, toProductOptions } from "./options";
import { parseShareText } from "./shareText";
import { linkOrigin } from "./site";
import type { Product } from "./types";

/** 링크 등록을 지원하는 쇼핑몰 (도메인 → 표시 이름) */
const MALLS: [RegExp, string][] = [
  [/coupang\.com$/, "쿠팡"],
  [/musinsa\.com$/, "무신사"],
  [/29cm\.co\.kr$/, "29CM"],
  [/kream\.co\.kr$/, "KREAM"],
  [/oliveyoung\.co\.kr$/, "올리브영"],
  // naver.me: 네이버 쇼핑 앱 [공유하기]가 만드는 짧은 링크
  [/smartstore\.naver\.com$|brand\.naver\.com$|shopping\.naver\.com$|^naver\.me$/, "네이버 스마트스토어"],
  [/gift\.kakao\.com$/, "카카오톡 선물하기"],
  [/store\.kakao\.com$/, "카카오톡 쇼핑하기"],
  [/ssg\.com$/, "SSG.COM"],
  [/11st\.co\.kr$/, "11번가"],
  [/wconcept\.co\.kr$/, "W컨셉"],
  [/gucci\.com$/, "구찌"],
  [/louisvuitton\.com$/, "루이비통"],
  [/hermes\.com$/, "에르메스"],
  [/chanel\.com$/, "샤넬"],
  [/prada\.com$/, "프라다"],
  [/dior\.com$/, "디올"],
];

/**
 * 입력창 내용 → 링크. 주소만 넣었든 쇼핑몰 [공유하기 → 복사] 글을 통째로 넣었든 받는다.
 * - 글 안의 첫 http(s) 주소를 링크로, 도메인으로 쇼핑몰을 정하고 모르면 [쿠팡] 같은 표기를 쓴다
 * - 글에 상품명·가격이 있으면 seed로 함께 넘긴다
 * - http 주소가 없으면 예전처럼 "coupang.com/vp/…" 같은 주소 한 줄만 받는다
 */
export function parseLinkInput(raw: string): ParsedLink | null {
  const share = parseShareText(raw);
  if (!share.url) return /\s/.test(raw.trim()) ? null : parseLink(raw);
  const link = parseLink(share.url);
  if (!link) return null;
  const seed = { ...(share.name ? { name: share.name } : {}), ...(share.price ? { price: share.price } : {}) };
  return { url: link.url, mall: link.mall ?? share.mall ?? null, ...(seed.name || seed.price ? { seed } : {}) };
}

/** 같은 입력인지 비교하는 키 (링크·쇼핑몰·글에서 뽑은 값까지) */
export const linkKey = (l: ParsedLink) => [l.url, l.mall ?? "", l.seed?.name ?? "", l.seed?.price ?? ""].join("|");

/** 서버 크롤러(/api/crawl) 응답을 기다리는 최대 시간 (서버 자체 제한 8초 + 왕복 여유) */
const CRAWL_TIMEOUT_MS = 9500;

/** 링크에서 가져온 옵션 칩 최대 개수 (너무 많으면 직접 입력이 낫다) */
export const MAX_OPTIONS = 30;

export type ParsedLink = {
  url: string;
  mall: string | null;
  /**
   * 공유 텍스트를 통째로 붙여넣었을 때 글에서 뽑은 상품명·가격.
   * 크롤링 결과보다 우선하고, 크롤링이 막혀도 그대로 남는다 (크롤링은 빈 칸만 채움)
   */
  seed?: { name?: string; price?: number };
};

export function parseLink(raw: string): ParsedLink | null {
  const text = raw.trim();
  if (!text) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    if (!url.hostname.includes(".")) return null;
    const host = url.hostname.replace(/^(www|m)\./, "");
    const hit = MALLS.find(([re]) => re.test(host));
    return { url: url.toString(), mall: hit ? hit[1] : null };
  } catch {
    return null;
  }
}

/* --------------------------------- 크롤링 --------------------------------- */

export type CrawlErrorCode = "blocked" | "timeout" | "parse" | "network";

export class CrawlError extends Error {
  constructor(
    public code: CrawlErrorCode,
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}

export const CRAWL_ERROR_TEXT: Record<CrawlErrorCode, string> = {
  blocked: "쇼핑몰 보안 정책으로 접근이 차단됐어요",
  timeout: "쇼핑몰 응답이 너무 늦어요",
  parse: "페이지에서 상품 정보를 찾지 못했어요",
  network: "네트워크 오류로 페이지를 열지 못했어요",
};

/** og:title / og:image / product:price 등에서 뽑아낸 원본 메타데이터 (일부만 있을 수 있음) */
export type RawMeta = Partial<Pick<Product, "brand" | "name" | "price" | "imageUrl" | "options">> & { siteName?: string; description?: string };

/** /api/crawl 응답 */
export type CrawlResponse = { ok: true; meta: RawMeta } | { ok: false; code: CrawlErrorCode; status?: number };

/** 서버 라우트가 실제 상품 페이지 HTML을 받아 OG·JSON-LD 메타 태그를 파싱한다 (브라우저는 CORS로 직접 못 읽음) */
async function fetchMeta(url: string, signal: AbortSignal): Promise<RawMeta> {
  let body: CrawlResponse;
  try {
    const res = await fetch(`/api/crawl?url=${encodeURIComponent(url)}`, { signal });
    body = (await res.json()) as CrawlResponse;
  } catch {
    if (signal.aborted) throw new CrawlError("timeout", `${CRAWL_TIMEOUT_MS}ms timeout`);
    throw new CrawlError("network", "crawl api unreachable");
  }
  if (!body.ok) throw new CrawlError(body.code, `crawl failed: ${body.code}`, body.status);
  return body.meta;
}

/** "상품명 | 쇼핑몰" 처럼 제목 끝에 붙은 사이트 이름을 걷어낸다 */
function cleanTitle(title: string | undefined, siteNames: (string | null | undefined)[]) {
  let t = title?.trim() ?? "";
  for (const site of siteNames) {
    if (!site) continue;
    const esc = site.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    t = t.replace(new RegExp(`\\s*[|\\-–:·]\\s*${esc}\\s*$`, "i"), "").trim();
  }
  return t;
}

export type CrawlResult = (
  | { ok: true; product: Product }
  /** 실패해도 가짜 상품을 채우지 않고, 실제로 파싱된 값만 담은 수동 입력용 초기값을 돌려준다 */
  | { ok: false; product: Product; error: { code: CrawlErrorCode; status?: number } }
) & {
  /** og:description (미리보기 카드 보조 문구) */
  description?: string;
  /** 쇼핑몰에서 사진을 못 가져와 상품명 이미지 검색으로 채운 사진 (실제 상품과 다를 수 있어 안내용) */
  searchedImageUrl?: string;
};

/** 상품명 이미지 검색(/api/image-search)을 기다리는 최대 시간 (검색 2.5초 + 내려받기 최대 4초 + 저장·여유) */
const IMAGE_SEARCH_TIMEOUT_MS = 9000;

/**
 * 크롤링이 막혀 대표 사진이 없을 때 상품명으로 찾은 사진 주소. 실패·키 없음·결과 없음은 모두 undefined
 * (화면은 쇼핑몰 기본 썸네일 카드 그대로)
 */
export async function searchImageByName(name: string, signal?: AbortSignal): Promise<string | undefined> {
  const q = name.trim();
  if (!q) return undefined;
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener("abort", cancel);
  const timer = setTimeout(cancel, IMAGE_SEARCH_TIMEOUT_MS);
  try {
    const res = await fetch(`/api/image-search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
    const body = (await res.json()) as { imageUrl?: unknown };
    // 서버가 우리 저장소에 넣은 사진(/api/image/<id>)만 받는다. 공유 링크·다른 기기에서도 열리게 절대 주소로 바꾼다
    const path = body?.imageUrl;
    return typeof path === "string" && /^\/api\/image\/[A-Za-z0-9]+$/.test(path) ? new URL(path, linkOrigin()).toString() : undefined;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
}

/**
 * 링크에서 상품 정보를 가져온다. 어떤 실패도 throw하지 않고 수동 입력 모드용 결과로 바꾼다.
 * 9.5초 안에 응답이 없으면 요청 자체를 끊고(AbortController) 바로 실패로 돌려준다.
 * signal: 시트를 닫거나 링크를 바꿔 결과가 더 필요 없을 때 진행 중인 요청을 취소
 */
export async function crawlProduct({ url, mall, seed }: ParsedLink, signal?: AbortSignal): Promise<CrawlResult> {
  let meta: RawMeta = {};
  let error: { code: CrawlErrorCode; status?: number } | null = null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CRAWL_TIMEOUT_MS);
  const cancel = () => controller.abort();
  signal?.addEventListener("abort", cancel);
  try {
    meta = await fetchMeta(url, controller.signal);
  } catch (e) {
    error = e instanceof CrawlError ? { code: e.code, status: e.status } : { code: "network" };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }

  // 서버 응답을 그대로 믿지 않고 { label, soldOut } 형태만, 길이·개수 제한을 걸어 쓴다
  const options = toProductOptions(toOptionItems(meta.options).slice(0, MAX_OPTIONS));
  const product: Product = {
    id: `link-${Date.now()}`,
    brand: meta.brand?.trim() ?? "",
    // 붙여넣은 글에서 뽑은 상품명·가격이 우선이고, 크롤링 값은 빈 칸만 채운다
    name: seed?.name || cleanTitle(meta.name, [meta.siteName, mall]),
    price: seed?.price || (meta.price && meta.price > 0 ? meta.price : 0),
    emoji: "🎁",
    bg: "#EEF3FF",
    imageUrl: meta.imageUrl && /^https?:\/\//.test(meta.imageUrl) ? meta.imageUrl : undefined,
    category: "링크",
    mall: mall ?? meta.siteName ?? "기타 쇼핑몰",
    url,
    ...(options.length ? { options } : {}),
  };

  // 응답은 왔지만 필수 값(상품명·가격)이 비어 있으면 파싱 실패
  if (!error && (!product.name || !product.price)) error = { code: "parse" };
  // 쿠팡처럼 크롤링이 막혀도 붙여넣은 글에 상품명·가격이 다 있었으면 그대로 진행한다 (사진은 직접 고르면 된다)
  if (error && seed?.name && seed.price) error = null;
  const description = meta.description?.trim() || undefined;

  // 쿠팡처럼 사진을 못 가져왔어도 상품명(크롤링 또는 붙여넣은 글)이 있으면 이미지 검색으로 사진을 채운다
  let searchedImageUrl: string | undefined;
  if (!product.imageUrl && product.name && !signal?.aborted) {
    searchedImageUrl = await searchImageByName(product.name, signal);
    if (searchedImageUrl) product.imageUrl = searchedImageUrl;
  }
  const extra = { description, ...(searchedImageUrl ? { searchedImageUrl } : {}) };
  return error ? { ok: false, product, error, ...extra } : { ok: true, product, ...extra };
}
