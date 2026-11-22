import type { FundingPurpose } from "./purpose";

/** 상품 옵션 항목. 문자열(구매 가능) 또는 품절 여부를 담은 객체 */
export type ProductOption = string | { label: string; soldOut?: boolean };
export type Product = {
  id: string;
  brand: string;
  name: string;
  price: number;
  emoji: string;
  bg: string;
  category: string;
  /** 구매처 쇼핑몰 이름 (쿠팡, 무신사, 29CM …) */
  mall: string;
  /** 원본 상품 링크 */
  url?: string;
  /** 선택한 옵션 (색상 / 사이즈 / 용량 등). 친구 화면에도 보인다 */
  option?: string;
  /**
   * 고를 수 있는 옵션 목록. 있으면 개설 화면에서 칩으로 고르고, 없으면 큐레이션 상품은 옵션 칸을 숨기고 링크 상품은 직접 입력한다.
   * 문자열은 구매 가능한 옵션, { label, soldOut: true }는 화면에 보이지만 고를 수 없는 품절 옵션
   */
  options?: ProductOption[];
  /** 사용자가 올린 상품 이미지 (없으면 emoji 썸네일) */
  imageUrl?: string;
  /** 운영자 추천 큐레이션 상품 여부 */
  curated?: boolean;
};

export type Participant = {
  id: string;
  nickname: string;
  message: string;
  amount: number;
  createdAt: number;
  isMe?: boolean;
};

/** 실물 배송지 */
export type ShippingAddress = {
  name: string;
  phone: string;
  /** 우편번호 (카카오 우편번호 검색으로 입력. 이 필드가 생기기 전에 저장된 배송지에는 없다) */
  zonecode?: string;
  address: string;
  detail: string;
  /** 배송 메모 (부재 시 문 앞 등) */
  memo?: string;
};

/**
 * achieved: 목표 금액 100% 완성 (친구들의 선물 교환권으로 완성)
 * topup:    기간 종료 후 남은 차액을 수령인이 직접 결제해 완성
 */
export type GiftReason = "achieved" | "topup";

/** 실물 선물 수령: 원래 쇼핑몰 상품을 실물로 배송한다 */
export type FundingGift = {
  kind: "gift";
  product: Product;
  reason: GiftReason;
  address: ShippingAddress;
  /** 친구들이 선물 교환권으로 적립해 준 금액 */
  collected: number;
  /** 수령인이 차액으로 직접 결제한 금액 */
  extraPaid?: number;
};

/** 모바일 상품권 전환 신청: 기간 내 미도달 선물의 적립 금액(원가 기준)을 모바일 상품권으로 받는다 */
export type FundingVoucher = {
  kind: "voucher";
  /** 전환되는 원가 상당액 (적립 금액에서 플랫폼 수수료 제외). 수령인 화면에만 있다 */
  amount?: number;
  voucherType?: string;
  requestedAt: number;
};

export type Resolution = FundingGift | FundingVoucher;

/**
 * 공동 선물 상태 (DB mogiving_shares.gift_status와 같은 이름)
 * ACTIVE:            선물 적립 중 (목표 금액을 넘는 결제는 받지 않음)
 * COMPLETED_FULL:    100% 완성 → 실물 발주 대기 (수령인이 배송지를 접수하면 발주)
 * PENDING_CHOICE:    기간 종료·미도달 → 수령인의 수령 방식 선택 대기 (차액 결제 또는 모바일 상품권 전환). 결제는 취소되지 않는다
 * CONVERTED_VOUCHER: 모바일 상품권 전환 신청 완료
 */
export type GiftStatus = "ACTIVE" | "COMPLETED_FULL" | "PENDING_CHOICE" | "CONVERTED_VOUCHER";

/**
 * 화면 단계
 * active:   ACTIVE
 * achieved: COMPLETED_FULL, 배송지 접수 전
 * under:    PENDING_CHOICE (수령 방식 선택 대기)
 * done:     배송 접수 또는 모바일 상품권 전환 신청 완료 (resolution 존재)
 */
export type Phase = "active" | "achieved" | "under" | "done";

export type Funding = {
  id: string;
  product: Product;
  goal: number;
  title: string;
  ownerName: string;
  ownerMessage: string;
  /** 선물 목적. 목적 선택 기능 이전에 만든 선물에는 없다 (생일로 간주) */
  purpose?: FundingPurpose;
  deadline: number;
  participants: Participant[];
  phase: Phase;
  resolution?: Resolution;
  /** 몇 번째 선물 위시인지 (1차 완성 후 2탄, 3탄 …) */
  round: number;
  /** 주최자가 등록한 선물 수령 배송지. 주최자 화면·서버에만 두고 공유 링크·친구 화면에는 절대 담지 않는다 */
  shipping?: ShippingAddress;
};
