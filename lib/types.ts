export type Product = {
  id: string;
  brand: string;
  name: string;
  price: number;
  originalPrice?: number;
  emoji: string;
  bg: string;
  category: string;
  /** 구매처 쇼핑몰 이름 (쿠팡, 무신사, 29CM …) */
  mall: string;
  /** 원본 상품 링크 */
  url?: string;
  /** 사용자가 올린 상품 이미지 (없으면 emoji 썸네일) */
  imageUrl?: string;
  /** 운영자 추천 큐레이션 상품 여부 */
  curated?: boolean;
  rating?: number;
  reviews?: number;
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
  address: string;
  detail: string;
};

/**
 * achieved: 목표 금액 100% 달성
 * topup:    미달 → 부족한 차액을 받는 사람이 직접 결제하고 원래 선물
 */
export type GiftReason = "achieved" | "topup";

/**
 * 펀딩 이후 정산 방식.
 * 현금 송금·포인트·교환권 없이, 원래 쇼핑몰 상품을 실물 배송하거나 전액 승인 취소만 한다.
 */
export type Resolution =
  | {
      kind: "gift";
      product: Product;
      reason: GiftReason;
      address: ShippingAddress;
      /** 친구들이 모아준 금액 */
      collected: number;
      /** 수령자가 부족분으로 직접 결제한 금액 */
      extraPaid?: number;
    }
  | { kind: "cancel"; amount: number; count: number };

/**
 * active:   모금 중 (목표 금액을 넘는 결제는 받지 않음)
 * achieved: 목표 100% 달성 → 즉시 마감, 수령자가 배송지 입력
 * under:    기간 만료로 마감됐지만 목표 미달 → 차액 결제 또는 전액 취소
 * done:     배송 접수 또는 취소 완료 (resolution 존재)
 */
export type Phase = "active" | "achieved" | "under" | "done";

export type Funding = {
  id: string;
  product: Product;
  goal: number;
  title: string;
  ownerName: string;
  ownerMessage: string;
  deadline: number;
  participants: Participant[];
  phase: Phase;
  resolution?: Resolution;
  /** 몇 번째 모금함인지 (1차 완판 후 2탄, 3탄 …) */
  round: number;
};
