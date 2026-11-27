import { goalWithFee } from "./fee";
import { type FundingPurpose, LEGACY_PURPOSE, presetTitle, purposePreset } from "./purpose";
import type { Funding, Participant, Product, ShippingAddress } from "./types";

/** 운영자 추천 큐레이션 (구매처 링크 포함) */
export const PRODUCTS: Product[] = [
  {
    id: "p23",
    brand: "STONE ISLAND",
    name: "스톤아일랜드 래글런 슬리브 오버사이즈 핏 크루넥 스웨트셔츠 (6100008 오가닉 코튼 플리스)",
    // 공식몰 국내 판매가. stoneisland.com은 WAF 봇 차단(403)이라 운영자가 공식몰에서 확인한 값 (2026-11-28). 모델 코드 L2S156100008S0051V0029
    price: 630000,
    emoji: "👕",
    bg: "#F1F1F1",
    category: "패션/의류",
    mall: "STONE ISLAND",
    url: "https://www.stoneisland.com/ko-kr/collection/%ED%94%8C%EB%A6%AC%EC%8A%A4%EC%9B%A8%EC%96%B4/%EB%9E%98%EA%B8%80%EB%9F%B0-%EC%8A%AC%EB%A6%AC%EB%B8%8C-%EC%98%A4%EB%B2%84%EC%82%AC%EC%9D%B4%EC%A6%88-%ED%95%8F-%ED%81%AC%EB%A3%A8%EB%84%A5-%EC%8A%A4%EC%9B%A8%ED%8A%B8%EC%85%94%EC%B8%A0-6100008-organic-cotton-fleece-L2S156100008S0051V0029.html",
    // 옵션 칩이 한 줄 단일 선택이라 색상 × 사이즈를 묶었다. 색상 3종·사이즈 M/L/XL/XXL, XL 품절은 운영자가 공식몰에서 확인한 값
    options: [
      "블랙 / M", "블랙 / L", { label: "블랙 / XL", soldOut: true }, "블랙 / XXL",
      "콜 그레이 / M", "콜 그레이 / L", { label: "콜 그레이 / XL", soldOut: true }, "콜 그레이 / XXL",
      "아이보리 / M", "아이보리 / L", { label: "아이보리 / XL", soldOut: true }, "아이보리 / XXL",
    ],
  },
  {
    id: "p22",
    brand: "PRADA",
    name: "프라다 리에디션 2008 리나일론 미니백",
    // 공식몰 국내 정가 (6개 색상 모두 schema.org offers.price 1,570,000원, InStock. 2026-11-28 확인). 모델 코드 1NE075_RDH0_F0002(블랙)
    price: 1570000,
    emoji: "👜",
    bg: "#ECECEC",
    category: "패션/의류",
    mall: "PRADA",
    url: "https://www.prada.com/kr/ko/p/%ED%94%84%EB%9D%BC%EB%8B%A4-%EB%A6%AC%EC%97%90%EB%94%94%EC%85%98-2008-%EB%A6%AC%EB%82%98%EC%9D%BC%EB%A1%A0-%EB%AF%B8%EB%8B%88%EB%B0%B1/1NE075_RDH0_F0002",
    // 공식 상품 페이지의 다른 색상(1NE075_RDH0_ F0002·F0134·F0216·F0638·F0K74·F0S73) 기준. 기본 블랙을 맨 앞에 둬 개설 화면에서 먼저 골라지게 한다
    options: ["블랙", "브랜디", "발틱 블루", "베고니아 핑크", "초크 화이트", "파파야"],
    // 공식 대표 이미지(블랙, 2400x3000 _SLF)를 상품이 카드(정사각형)에 차도록 가운데 1800x1800으로 잘라 800x800 JPEG로 저장해 사용.
    // 큐레이션 썸네일은 mix-blend-multiply라 회색(#ECECEC) 배경을 흰색으로 올려 두었다. 곱해지면 bg와 같은 #ECECEC가 돼 사진 경계가 안 보인다
    imageUrl: "/images/prada-re-edition-2008-mini-bag-black.jpg",
  },
  {
    id: "p21",
    brand: "THOME",
    name: "톰 더 글로우 베이직",
    // 공식몰 판매가 (product:price·product:sale_price 모두 999,000원, 상품 할인가 없음. 2026-11-16 확인)
    price: 999000,
    emoji: "✨",
    bg: "#FFFFFF",
    category: "뷰티/향수",
    mall: "THOME 공식몰",
    url: "https://thome.kr/product/%ED%86%B0-%EB%8D%94-%EA%B8%80%EB%A1%9C%EC%9A%B0-%EB%B2%A0%EC%9D%B4%EC%A7%81/137/category/94/display/1/",
    // 단품 (카페24 has_option = 'F', 옵션 선택 상자 없음)이라 options 없음
    // 카페24 이미지 CDN(cafe24img.poxo.com)은 핫링크 정책이 바뀔 수 있어 공식 대표 이미지(700x877 PNG)를
    // 카드(정사각형)를 꽉 채우도록 위 85px부터 700x700으로 잘라 JPEG로 저장해 사용
    imageUrl: "/images/thome-the-glow-basic.jpg",
  },
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
    // Apple 구입 페이지의 색상 선택지 (dimensionColor) 기준. 품절 표시된 색상 없음
    options: ["미드나이트", "스타라이트", "블루", "퍼플", "오렌지"],
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
    category: "주얼리",
    mall: "Gucci",
    url: "https://www.gucci.com/kr/ko/pr/jewelry-watches/silver-jewelry/silver-jewelry-for-men/wide-ring-with-web-detail-p-853849J89L08518",
    // 10~26호 전체. 품절(10·11·17·25·26호)은 운영자가 공식몰에서 확인한 값 (gucci.com은 봇 차단으로 자동 확인 불가)
    options: [{ label: "10호", soldOut: true }, { label: "11호", soldOut: true }, "12호", "13호", "14호", "15호", "16호", { label: "17호", soldOut: true }, "18호", "19호", "20호", "21호", "22호", "23호", "24호", { label: "25호", soldOut: true }, { label: "26호", soldOut: true }],
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
  {
    id: "p20",
    brand: "K2",
    name: "K2 에어로스피어(AEROSPHERE) ZERO 구스다운 (Blue GRAY)",
    price: 359000,
    emoji: "🧥",
    bg: "#FFFFFF",
    category: "패션/의류",
    mall: "K-Village",
    url: "https://www.k-village.co.kr/goods/KMU26543BH",
    // 케이빌리지 사이즈 재고 API(/goods/api/order/size) 기준. 120은 온라인·매장 재고 모두 0이라 품절
    options: ["95(M)", "100(L)", "105(XL)", "110(2XL)", "115(3XL)", { label: "120(4XL)", soldOut: true }],
    // 원본 이미지가 3MB(1500x2000)라 케이빌리지 CDN의 800x800 리사이즈본을 직접 저장해 사용
    imageUrl: "/images/k2-aerosphere-zero-blue-gray.jpg",
  },
  { id: "p13", brand: "PANDORA", name: "판도라 모먼트 스네이크 체인 실버 팔찌", price: 129000, emoji: "💎", bg: "#F3F1F7", category: "주얼리", mall: "29CM", url: "https://www.29cm.co.kr/products/1840221" },
  { id: "p2", brand: "Dyson", name: "다이슨 에어랩 멀티 스타일러 컴플리트 롱", price: 699000, emoji: "💨", bg: "#F6EEF3", category: "디지털/가전", mall: "SSG.COM", url: "https://www.ssg.com/item/itemView.ssg?itemId=1000542" },
  { id: "p4", brand: "Jo Malone", name: "조말론 우드 세이지 앤 씨 솔트 코롱 100ml", price: 218000, emoji: "🌿", bg: "#EEF4EF", category: "뷰티/향수", mall: "29CM", url: "https://www.29cm.co.kr/products/993120" },
  { id: "p14", brand: "SWAROVSKI", name: "스와로브스키 밀레니아 펜던트 목걸이", price: 189000, emoji: "💍", bg: "#EFF4FA", category: "주얼리", mall: "W컨셉", url: "https://www.wconcept.co.kr/Product/301822" },
  { id: "p5", brand: "Nintendo", name: "닌텐도 스위치 OLED 화이트", price: 398000, emoji: "🎮", bg: "#FDEDED", category: "디지털/가전", mall: "쿠팡", url: "https://www.coupang.com/vp/products/6033412" },
  { id: "p3", brand: "Aesop", name: "이솝 레저렉션 핸드 듀오 기프트 세트", price: 89000, emoji: "🧴", bg: "#F3F0E8", category: "뷰티/향수", mall: "29CM", url: "https://www.29cm.co.kr/products/772310" },
  { id: "p9", brand: "New Balance", name: "뉴발란스 993 메이드 인 USA 그레이", price: 289000, emoji: "👟", bg: "#EFEFF1", category: "패션/의류", mall: "무신사", url: "https://www.musinsa.com/products/2210934" },
  { id: "p12", brand: "Diptyque", name: "딥티크 베이 캔들 190g", price: 112000, emoji: "🕯️", bg: "#F7F1EA", category: "리빙/키친", mall: "29CM", url: "https://www.29cm.co.kr/products/451287" },
  { id: "p7", brand: "BALMUDA", name: "발뮤다 더 토스터 프로 블랙", price: 369000, emoji: "🍞", bg: "#F1F1F1", category: "리빙/키친", mall: "쿠팡", url: "https://www.coupang.com/vp/products/7120934" },
  { id: "p11", brand: "Samsung", name: "갤럭시 버즈3 프로 실버", price: 269000, emoji: "🎵", bg: "#EDF2F7", category: "디지털/가전", mall: "11번가", url: "https://www.11st.co.kr/products/7012345" },
  { id: "p15", brand: "Tamburins", name: "탬버린즈 퍼퓸 핸드크림 3종 세트", price: 72000, emoji: "🫧", bg: "#F2F0EC", category: "뷰티/향수", mall: "무신사", url: "https://www.musinsa.com/products/3301145" },
  { id: "p10", brand: "Le Creuset", name: "르크루제 시그니처 원형 무쇠냄비 20cm", price: 459000, emoji: "🍲", bg: "#FCEFE6", category: "리빙/키친", mall: "SSG.COM", url: "https://www.ssg.com/item/itemView.ssg?itemId=1000871" },
  { id: "p8", brand: "Apple", name: "아이패드 에어 11 M2 Wi-Fi 128GB", price: 899000, emoji: "📱", bg: "#ECEFF8", category: "디지털/가전", mall: "쿠팡", url: "https://www.coupang.com/vp/products/8012230" },
].map((p) => ({ ...p, curated: true }));

export const CATEGORIES = ["전체", "주얼리", "패션/의류", "디지털/가전", "뷰티/향수", "리빙/키친"];

const DAY = 86_400_000;

export const sumAmount = (ps: Participant[]) => ps.reduce((s, p) => s + p.amount, 0);

export function createFunding(
  product: Product,
  opts: { ownerName: string; title?: string; message?: string; purpose?: FundingPurpose; days?: number; round?: number; option?: string; shipping?: ShippingAddress },
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
    ...(opts.purpose ? { purpose: opts.purpose } : {}),
    deadline: Date.now() + (opts.days ?? 7) * DAY,
    participants: [],
    phase: "active",
    round,
  };
}
