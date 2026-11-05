import type { Funding, Participant, Product, ShippingAddress } from "./types";

/** 운영자 추천 큐레이션 (구매처 링크 포함) */
export const PRODUCTS: Product[] = [
  { id: "p1", brand: "Apple", name: "에어팟 프로 2세대 USB-C", price: 329000, originalPrice: 359000, emoji: "🎧", bg: "#EEF1F5", category: "디지털/가전", mall: "쿠팡", url: "https://www.coupang.com/vp/products/7581203", rating: 4.9, reviews: 12840 },
  { id: "p13", brand: "PANDORA", name: "판도라 모먼트 스네이크 체인 실버 팔찌", price: 129000, emoji: "💎", bg: "#F3F1F7", category: "주얼리/패션", mall: "29CM", url: "https://www.29cm.co.kr/products/1840221", rating: 4.8, reviews: 2140 },
  { id: "p2", brand: "Dyson", name: "다이슨 에어랩 멀티 스타일러 컴플리트 롱", price: 699000, originalPrice: 749000, emoji: "💨", bg: "#F6EEF3", category: "디지털/가전", mall: "SSG.COM", url: "https://www.ssg.com/item/itemView.ssg?itemId=1000542", rating: 4.8, reviews: 5320 },
  { id: "p4", brand: "Jo Malone", name: "조말론 우드 세이지 앤 씨 솔트 코롱 100ml", price: 218000, emoji: "🌿", bg: "#EEF4EF", category: "뷰티/향수", mall: "29CM", url: "https://www.29cm.co.kr/products/993120", rating: 4.8, reviews: 3980 },
  { id: "p14", brand: "SWAROVSKI", name: "스와로브스키 밀레니아 펜던트 목걸이", price: 189000, emoji: "💍", bg: "#EFF4FA", category: "주얼리/패션", mall: "W컨셉", url: "https://www.wconcept.co.kr/Product/301822", rating: 4.7, reviews: 1630 },
  { id: "p5", brand: "Nintendo", name: "닌텐도 스위치 OLED 화이트", price: 398000, originalPrice: 415000, emoji: "🎮", bg: "#FDEDED", category: "디지털/가전", mall: "쿠팡", url: "https://www.coupang.com/vp/products/6033412", rating: 4.9, reviews: 8710 },
  { id: "p3", brand: "Aesop", name: "이솝 레저렉션 핸드 듀오 기프트 세트", price: 89000, emoji: "🧴", bg: "#F3F0E8", category: "뷰티/향수", mall: "29CM", url: "https://www.29cm.co.kr/products/772310", rating: 4.9, reviews: 2210 },
  { id: "p9", brand: "New Balance", name: "뉴발란스 993 메이드 인 USA 그레이", price: 289000, emoji: "👟", bg: "#EFEFF1", category: "주얼리/패션", mall: "무신사", url: "https://www.musinsa.com/products/2210934", rating: 4.8, reviews: 2760 },
  { id: "p12", brand: "Diptyque", name: "딥티크 베이 캔들 190g", price: 112000, emoji: "🕯️", bg: "#F7F1EA", category: "리빙/키친", mall: "29CM", url: "https://www.29cm.co.kr/products/451287", rating: 4.9, reviews: 3050 },
  { id: "p7", brand: "BALMUDA", name: "발뮤다 더 토스터 프로 블랙", price: 369000, emoji: "🍞", bg: "#F1F1F1", category: "리빙/키친", mall: "쿠팡", url: "https://www.coupang.com/vp/products/7120934", rating: 4.8, reviews: 1890 },
  { id: "p11", brand: "Samsung", name: "갤럭시 버즈3 프로 실버", price: 269000, originalPrice: 319000, emoji: "🎵", bg: "#EDF2F7", category: "디지털/가전", mall: "11번가", url: "https://www.11st.co.kr/products/7012345", rating: 4.7, reviews: 4410 },
  { id: "p15", brand: "Tamburins", name: "탬버린즈 퍼퓸 핸드크림 3종 세트", price: 72000, emoji: "🫧", bg: "#F2F0EC", category: "뷰티/향수", mall: "무신사", url: "https://www.musinsa.com/products/3301145", rating: 4.8, reviews: 6920 },
  { id: "p10", brand: "Le Creuset", name: "르크루제 시그니처 원형 무쇠냄비 20cm", price: 459000, originalPrice: 520000, emoji: "🍲", bg: "#FCEFE6", category: "리빙/키친", mall: "SSG.COM", url: "https://www.ssg.com/item/itemView.ssg?itemId=1000871", rating: 4.9, reviews: 1320 },
  { id: "p8", brand: "Apple", name: "아이패드 에어 11 M2 Wi-Fi 128GB", price: 899000, originalPrice: 929000, emoji: "📱", bg: "#ECEFF8", category: "디지털/가전", mall: "쿠팡", url: "https://www.coupang.com/vp/products/8012230", rating: 4.9, reviews: 6420 },
].map((p) => ({ ...p, curated: true }));

export const CATEGORIES = ["전체", "주얼리/패션", "디지털/가전", "뷰티/향수", "리빙/키친"];

const DAY = 86_400_000;

export const sumAmount = (ps: Participant[]) => ps.reduce((s, p) => s + p.amount, 0);

export function createFunding(
  product: Product,
  opts?: { title?: string; message?: string; days?: number; round?: number; option?: string; shipping?: ShippingAddress },
): Funding {
  const round = opts?.round ?? 1;
  const option = opts?.option?.trim();
  return {
    id: `f-${Date.now()}`,
    product: option ? { ...product, option } : product,
    ...(opts?.shipping ? { shipping: opts.shipping } : {}),
    goal: product.price,
    title: opts?.title || (round > 1 ? `내 생일 선물 펀딩 ${round}탄` : "내 생일 선물 펀딩"),
    ownerName: "김토스",
    ownerMessage: opts?.message || "올해 생일엔 이 선물이 정말 갖고 싶어요! 마음 모아주시면 감사히 받을게요 🙏",
    deadline: Date.now() + (opts?.days ?? 7) * DAY,
    participants: [],
    phase: "active",
    round,
  };
}
