import type { Product } from "./types";

/**
 * 사진이 없는 링크 상품에 자동으로 보여 주는 쇼핑몰별 기본 썸네일 카드.
 * 링크 상품은 서버에서 사진을 가져오지 않으므로, 사용자가 캡처 사진을 올리지 않았을 때 이 카드를 쓴다.
 * 쇼핑몰 로고는 쓰지 않고, 쇼핑몰 이름과 그 쇼핑몰을 떠올리게 하는 색만 쓴다.
 */
export type MallThemeKey = "coupang" | "naver" | "musinsa" | "29cm" | "kakao" | "etc";

export type MallTheme = {
  key: MallThemeKey;
  /** 카드에 적는 쇼핑몰 이름 */
  label: string;
  /** 카드 배경 */
  bg: string;
  /** 선물 상자 색 */
  accent: string;
  /** 리본 색 */
  ribbon: string;
  /** 쇼핑몰 이름 글자색 */
  ink: string;
};

const THEMES: Record<MallThemeKey, Omit<MallTheme, "key" | "label">> = {
  coupang: { bg: "#FFF1EC", accent: "#F2552C", ribbon: "#FFD9CC", ink: "#B8361A" },
  naver: { bg: "#E8F8EE", accent: "#03C75A", ribbon: "#C9F0D8", ink: "#02873D" },
  musinsa: { bg: "#F2F2F2", accent: "#1A1A1A", ribbon: "#D9D9D9", ink: "#1A1A1A" },
  "29cm": { bg: "#F4F1EB", accent: "#3A3631", ribbon: "#E3DCCF", ink: "#3A3631" },
  kakao: { bg: "#FFF8D6", accent: "#FEE500", ribbon: "#3C1E1E", ink: "#3C1E1E" },
  etc: { bg: "#EEF3FF", accent: "#3D82FF", ribbon: "#D3E3FF", ink: "#0050CC" },
};

const RULES: [RegExp, MallThemeKey][] = [
  [/쿠팡|coupang/i, "coupang"],
  [/네이버|naver/i, "naver"],
  [/무신사|musinsa/i, "musinsa"],
  [/29\s*cm/i, "29cm"],
  [/카카오|kakao/i, "kakao"],
];

/** 쇼핑몰 이름(또는 도메인) → 카드 테마. 모르는 쇼핑몰은 '기타' 테마에 그 이름을 그대로 적는다 */
export function mallTheme(mall?: string | null): MallTheme {
  const name = mall?.trim() ?? "";
  const key = RULES.find(([re]) => re.test(name))?.[1] ?? "etc";
  const label = !name || name === "기타 쇼핑몰" ? "쇼핑몰" : name;
  return { key, label, ...THEMES[key] };
}

/** 링크로 가져온 상품의 기본 이모지. 사용자가 다른 기본 이미지(👜 등)를 직접 고르지 않았다는 뜻이다 */
export const LINK_DEFAULT_EMOJI = "🎁";

/** 사진이 없을 때 이모지 대신 쇼핑몰 카드를 보여 줄 상품인지 (운영자 큐레이션 상품·직접 고른 기본 이미지는 제외) */
export const usesMallThumb = (p: Pick<Product, "curated" | "emoji">) => !p.curated && p.emoji === LINK_DEFAULT_EMOJI;
