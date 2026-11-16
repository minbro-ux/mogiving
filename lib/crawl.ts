import { parseShareText } from "./shareText";
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

export type ParsedLink = {
  url: string;
  mall: string | null;
  /** 공유 텍스트를 통째로 붙여넣었을 때 글에서 뽑은 상품명·가격 (서버 상품명보다 우선) */
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

/* ------------------------------- 상품명 가져오기 ------------------------------- */

/** /api/crawl 응답. 상품명을 못 찾으면 빈 객체 */
export type TitleResponse = { name?: string };

/** 상품명 요청을 기다리는 최대 시간 (서버 자체 제한 2.5초 + 왕복 여유) */
const TITLE_TIMEOUT_MS = 3000;

/**
 * 링크의 상품명(og:title)만 서버(/api/crawl)에서 가볍게 받아 온다.
 * 차단·시간 초과·네트워크 오류는 모두 빈 문자열 (화면은 경고 없이 빈 칸으로 두고 사용자가 직접 입력)
 */
export async function fetchProductName(url: string, signal?: AbortSignal): Promise<string> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener("abort", cancel);
  const timer = setTimeout(cancel, TITLE_TIMEOUT_MS);
  try {
    const res = await fetch(`/api/crawl?url=${encodeURIComponent(url)}`, { signal: controller.signal });
    const body = (await res.json()) as TitleResponse;
    return typeof body?.name === "string" ? body.name.trim().slice(0, 60) : "";
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
}

/** 링크 → 입력 폼 초기값. 공유 글에서 뽑은 상품명·가격만 미리 채우고, 사진은 쇼핑몰 기본 이미지 */
export function linkProduct({ url, mall, seed }: ParsedLink): Product {
  return {
    id: `link-${Date.now()}`,
    brand: "",
    name: seed?.name ?? "",
    price: seed?.price ?? 0,
    emoji: "🎁",
    bg: "#EEF3FF",
    category: "링크",
    mall: mall ?? "기타 쇼핑몰",
    url,
  };
}
