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

/**
 * 펀딩 이후 정산 방식.
 * 오픈형 링크 모델이므로 모든 결과는 수령자 토스머니/계좌로의 송금으로 끝나고,
 * 수령자가 원래 쇼핑몰에서 직접 구매한다.
 */
export type Resolution =
  | {
      kind: "gift";
      product: Product;
      reason: "achieved" | "recommend" | "topup" | "refund" | "upgrade";
      /** 수령자에게 송금된 총액 */
      payout: number;
      /** 수령자가 부족분으로 직접 보탠 금액 */
      extraPaid?: number;
      /** 선물 구매 후 남는 금액 */
      leftover?: number;
    }
  | { kind: "cash"; amount: number; method: "toss-money" | "toss-point" };

/**
 * active: 모금 중
 * under:  마감됐지만 목표 미달 → 수령자 선택 필요
 * over:   목표 초과 → 수령자 선택 필요
 * done:   선물 수령 방식 확정 (resolution 존재)
 */
export type Phase = "active" | "under" | "over" | "done";

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
};
