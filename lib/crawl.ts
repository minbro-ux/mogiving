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
];

export const EXAMPLE_LINKS = [
  { mall: "쿠팡", url: "https://www.coupang.com/vp/products/7334512" },
  { mall: "무신사", url: "https://www.musinsa.com/products/3912455" },
  { mall: "29CM", url: "https://www.29cm.co.kr/products/2287741" },
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
const GENERIC = [
  { brand: "", name: "선물 상품", price: 150000, emoji: "🎁", bg: "#EEF3FF" },
];

export function parseLink(raw: string): { url: string; mall: string | null } | null {
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

export type CrawlResult = {
  ok: boolean;
  product: Product;
};

/** 링크에서 상품 정보를 가져오는 척하는 더미 크롤러 (네트워크 호출 없음) */
export function mockCrawl(url: string, mall: string | null): Promise<CrawlResult> {
  const hash = [...url].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const pool = (mall && PRESETS[mall]) || GENERIC;
  const pick = pool[hash % pool.length];
  const ok = mall !== null;
  const product: Product = {
    id: `link-${Date.now()}`,
    ...pick,
    // 지원하지 않는 쇼핑몰은 사용자가 직접 입력하도록 비워둠
    name: ok ? pick.name : "",
    price: ok ? pick.price : 0,
    category: "링크",
    mall: mall ?? "기타 쇼핑몰",
    url,
  };
  return new Promise((resolve) => setTimeout(() => resolve({ ok, product }), 1300));
}
