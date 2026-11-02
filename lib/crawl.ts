import type { Product } from "./types";

/** 링크 등록을 지원하는 쇼핑몰 (도메인 → 표시 이름) */
const MALLS: [RegExp, string][] = [
  [/coupang\.com$/, "쿠팡"],
  [/musinsa\.com$/, "무신사"],
  [/29cm\.co\.kr$/, "29CM"],
  [/kream\.co\.kr$/, "KREAM"],
  [/oliveyoung\.co\.kr$/, "올리브영"],
  [/smartstore\.naver\.com$|brand\.naver\.com$|shopping\.naver\.com$/, "네이버 스마트스토어"],
  [/gift\.kakao\.com$/, "카카오톡 선물하기"],
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

/** 서버 크롤러(/api/crawl) 응답을 기다리는 최대 시간 (서버 자체 제한 8초 + 왕복 여유) */
const CRAWL_TIMEOUT_MS = 9500;

export type ParsedLink = { url: string; mall: string | null };

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
export type RawMeta = Partial<Pick<Product, "brand" | "name" | "price" | "imageUrl">> & { siteName?: string; description?: string };

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
};

/**
 * 링크에서 상품 정보를 가져온다. 어떤 실패도 throw하지 않고 수동 입력 모드용 결과로 바꾼다.
 * 9.5초 안에 응답이 없으면 요청 자체를 끊고(AbortController) 바로 실패로 돌려준다.
 * signal: 시트를 닫거나 링크를 바꿔 결과가 더 필요 없을 때 진행 중인 요청을 취소
 */
export async function crawlProduct({ url, mall }: ParsedLink, signal?: AbortSignal): Promise<CrawlResult> {
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

  const product: Product = {
    id: `link-${Date.now()}`,
    brand: meta.brand?.trim() ?? "",
    name: cleanTitle(meta.name, [meta.siteName, mall]),
    price: meta.price && meta.price > 0 ? meta.price : 0,
    emoji: "🎁",
    bg: "#EEF3FF",
    imageUrl: meta.imageUrl && /^https?:\/\//.test(meta.imageUrl) ? meta.imageUrl : undefined,
    category: "링크",
    mall: mall ?? meta.siteName ?? "기타 쇼핑몰",
    url,
  };

  // 응답은 왔지만 필수 값(상품명·가격)이 비어 있으면 파싱 실패
  if (!error && (!product.name || !product.price)) error = { code: "parse" };
  const description = meta.description?.trim() || undefined;
  return error ? { ok: false, product, error, description } : { ok: true, product, description };
}
