import type { Product } from "./types";

/** 링크 등록을 지원하는 쇼핑몰 (도메인 → 표시 이름) */
const MALLS: [RegExp, string][] = [
  [/coupang\.com$/, "쿠팡"],
  [/musinsa\.com$/, "무신사"],
  [/29cm\.co\.kr$/, "29CM"],
  [/kream\.co\.kr$/, "KREAM"],
  [/oliveyoung\.co\.kr$/, "올리브영"],
  [/smartstore\.naver\.com$|shopping\.naver\.com$/, "네이버 스마트스토어"],
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

/** 봇 차단(WAF)으로 메타데이터 크롤링이 막히는 명품/보안 사이트 */
const BLOCKED_MALLS = new Set(["구찌", "루이비통", "에르메스", "샤넬", "프라다", "디올"]);

/** 크롤링 응답을 기다리는 최대 시간 */
const CRAWL_TIMEOUT_MS = 4000;

export const EXAMPLE_LINKS = [
  { mall: "쿠팡", url: "https://www.coupang.com/vp/products/7334512" },
  { mall: "무신사", url: "https://www.musinsa.com/products/3912455" },
  { mall: "29CM", url: "https://www.29cm.co.kr/products/2287741" },
  { mall: "구찌", url: "https://www.gucci.com/kr/ko/pr/women/handbags/ophidia-small-tote-p-547551" },
];

/** 쇼핑몰별 더미 크롤링 결과 */
const PRESETS: Record<string, Pick<Product, "brand" | "name" | "price" | "emoji" | "bg">[]> = {
  쿠팡: [
    { brand: "Philips", name: "필립스 소닉케어 다이아몬드클린 9000 전동칫솔", price: 289000, emoji: "🪥", bg: "#EAF4FB" },
    { brand: "LG", name: "LG 스탠바이미 Go 27인치 포터블 스크린", price: 1090000, emoji: "📺", bg: "#EEF0F4" },
  ],
  무신사: [
    { brand: "adidas", name: "아디다스 삼바 OG 클라우드 화이트", price: 139000, emoji: "👟", bg: "#F1F1F1" },
    { brand: "Carhartt WIP", name: "칼하트 WIP 디트로이트 재킷 블랙", price: 329000, emoji: "🧥", bg: "#EFEDEA" },
  ],
  "29CM": [
    { brand: "Le Labo", name: "르라보 상탈 33 오 드 퍼퓸 50ml", price: 298000, emoji: "🧴", bg: "#F4EFE8" },
    { brand: "Marhen.J", name: "마르헨제이 리커버 백 크림", price: 89000, emoji: "👜", bg: "#F6EFEA" },
  ],
};

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

/** og:title / product:price 등에서 뽑아낸 원본 메타데이터 (일부만 있을 수 있음) */
type RawMeta = Partial<Pick<Product, "brand" | "name" | "price" | "emoji" | "bg" | "imageUrl">>;

/**
 * 서버 크롤러 호출을 흉내내는 더미 (네트워크 호출 없음).
 * 실제처럼 403 에러를 던지거나, 응답이 오지 않거나, 메타 태그가 비어 있을 수 있다.
 */
function fetchMeta(url: string, mall: string | null): Promise<RawMeta> {
  return new Promise((resolve, reject) => {
    if (/timeout/i.test(url)) return; // 응답 없음 → 타임아웃으로 처리
    setTimeout(() => {
      if (mall && BLOCKED_MALLS.has(mall)) return reject(new CrawlError("blocked", "403 Forbidden", 403));
      const pool = mall ? PRESETS[mall] : undefined;
      if (!pool) return resolve({}); // 지원하지 않는 쇼핑몰: 상품 메타 태그 없음
      const hash = [...url].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
      resolve(pool[hash % pool.length]);
    }, 1100);
  });
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new CrawlError("timeout", `${ms}ms timeout`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

export type CrawlResult =
  | { ok: true; product: Product }
  /** 실패해도 크래시 없이, 부분적으로 파싱된 값을 담은 수동 입력용 초기값을 돌려준다 */
  | { ok: false; product: Product; error: { code: CrawlErrorCode; status?: number } };

/** 링크에서 상품 정보를 가져온다. 어떤 실패도 throw하지 않고 수동 입력 모드용 결과로 바꾼다 */
export async function crawlProduct({ url, mall }: ParsedLink): Promise<CrawlResult> {
  let meta: RawMeta = {};
  let error: { code: CrawlErrorCode; status?: number } | null = null;
  try {
    meta = await withTimeout(fetchMeta(url, mall), CRAWL_TIMEOUT_MS);
  } catch (e) {
    error = e instanceof CrawlError ? { code: e.code, status: e.status } : { code: "network" };
  }

  const product: Product = {
    id: `link-${Date.now()}`,
    brand: meta.brand ?? (mall && BLOCKED_MALLS.has(mall) ? mall : ""),
    name: meta.name?.trim() ?? "",
    price: meta.price && meta.price > 0 ? meta.price : 0,
    emoji: meta.emoji ?? "🎁",
    bg: meta.bg ?? "#EEF3FF",
    imageUrl: meta.imageUrl,
    category: "링크",
    mall: mall ?? "기타 쇼핑몰",
    url,
  };

  // 응답은 왔지만 필수 값(상품명·가격)이 비어 있으면 파싱 실패
  if (!error && (!product.name || !product.price)) error = { code: "parse" };
  return error ? { ok: false, product, error } : { ok: true, product };
}
