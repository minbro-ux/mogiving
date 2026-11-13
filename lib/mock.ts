import { goalWithFee } from "./fee";
import { LEGACY_PURPOSE, presetTitle, purposePreset } from "./purpose";
import type { Funding, Participant, Product, ShippingAddress } from "./types";

/** 운영자 추천 큐레이션 (구매처 링크 포함) */
export const PRODUCTS: Product[] = [
  {
    id: "p16",
    brand: "Apple",
    name: "Apple AirPods Pro 3 (MagSafe 충전 케이스 USB-C)",
    price: 369000,
    emoji: "🎧",
    bg: "#F5F5F7",
    category: "디지털/가전",
    mall: "Apple Store",
    url: "https://www.apple.com/kr/shop/buy-airpods/airpods-pro-3",
    // Apple 스토어 CDN (CORS 허용, Referer 검사 없음). 실패해도 ProductThumb가 이모지로 대체한다
    imageUrl: "https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/airpods-pro-3-hero-select-202509?wid=600&hei=600&fmt=jpeg&qlt=90",
  },
  {
    id: "p17",
    brand: "Apple",
    name: "Apple AirPods Max 2 (USB-C)",
    price: 849000,
    emoji: "🎧",
    bg: "#F5F5F7",
    category: "디지털/가전",
    mall: "Apple Store",
    url: "https://www.apple.com/kr/shop/buy-airpods/airpods-max-2",
    // AirPods Max 2 구입 페이지의 대표 이미지 (전 색상). Apple CDN, CORS 허용·Referer 검사 없음
    imageUrl: "https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/airpods-max-hero-select-202409?wid=600&hei=600&fmt=jpeg&qlt=90",
  },
  {
    id: "p18",
    brand: "Gucci",
    name: "구찌 웹(Web) 디테일 와이드 반지 925 스털링 실버",
    price: 730000,
    emoji: "💍",
    bg: "#FFFFFF",
    category: "주얼리/패션",
    mall: "Gucci",
    url: "https://www.gucci.com/kr/ko/pr/jewelry-watches/silver-jewelry/silver-jewelry-for-men/wide-ring-with-web-detail-p-853849J89L08518",
    // gucci.com·media.gucci.com은 Akamai 봇 차단(서버/크롤러 요청 403·타임아웃)이라 공식 이미지(800x800)를 직접 저장해 사용
    imageUrl: "/images/gucci-web-detail-wide-ring.jpg",
  },
  {
    id: "p19",
    brand: "DJI",
    name: "DJI 오즈모 포켓 4P Osmo Pocket 4P 브이로그 콤보",
    price: 999000,
    emoji: "📷",
    bg: "#FFFFFF",
    category: "디지털/가전",
    mall: "DJI 공식스토어",
    url: "https://brand.naver.com/dji/products/13641244812",
    // 네이버 쇼핑 CDN(shop-phinf.pstatic.net)은 핫링크 정책이 바뀔 수 있어 대표 이미지(1000x1000)를 직접 저장해 사용
    imageUrl: "/images/dji-osmo-pocket-4p-vlog-combo.jpg",
  },
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
  opts: { ownerName: string; title?: string; message?: string; days?: number; round?: number; option?: string; shipping?: ShippingAddress },
): Funding {
  const round = opts.round ?? 1;
  const option = opts.option?.trim();
  return {
    id: `f-${Date.now()}`,
    product: option ? { ...product, option } : product,
    ...(opts.shipping ? { shipping: opts.shipping } : {}),
    // product.price는 선물 원가(base_price), goal은 수수료를 더한 최종 목표 금액
    goal: goalWithFee(product.price),
    // 제목·한마디를 넘기지 않으면(목적 선택 이전의 예전 공유 링크 등) 당시 기본값이던 생일 문구로 채운다
    title: opts.title?.trim() || presetTitle(LEGACY_PURPOSE, round),
    ownerName: opts.ownerName.trim(),
    ownerMessage: opts.message?.trim() || purposePreset(LEGACY_PURPOSE).message,
    deadline: Date.now() + (opts.days ?? 7) * DAY,
    participants: [],
    phase: "active",
    round,
  };
}
