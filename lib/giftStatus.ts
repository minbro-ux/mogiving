import type { GiftStatus } from "./types";

export const GIFT_STATUSES: readonly GiftStatus[] = ["ACTIVE", "COMPLETED_FULL", "PENDING_CHOICE", "CONVERTED_VOUCHER"];
export const isGiftStatus = (v: unknown): v is GiftStatus => typeof v === "string" && (GIFT_STATUSES as readonly string[]).includes(v);

/**
 * 공동 선물의 현재 상태.
 * DB에 저장된 상태(stored)를 따르되, 완성·기간 종료는 금액과 마감일로도 판단한다.
 * 그래서 매일 도는 크론(PENDING_CHOICE 전환)이 늦거나 저장된 상태가 없는 로컬 저장소에서도 화면과 결제 판단이 같다
 */
export function giftStatusOf(a: { stored?: GiftStatus | null; collected: number; goal: number; deadline: number; now?: number }): GiftStatus {
  if (a.stored === "CONVERTED_VOUCHER") return "CONVERTED_VOUCHER";
  if (a.stored === "COMPLETED_FULL" || (a.goal > 0 && a.collected >= a.goal)) return "COMPLETED_FULL";
  if (a.stored === "PENDING_CHOICE" || a.deadline <= (a.now ?? Date.now())) return "PENDING_CHOICE";
  return "ACTIVE";
}

/** 운영자 화면 표시용 이름 */
export const GIFT_STATUS_LABEL: Record<GiftStatus, string> = {
  ACTIVE: "선물 적립 중",
  COMPLETED_FULL: "100% 완성 · 실물 발주 대기",
  PENDING_CHOICE: "수령 방식 선택 대기",
  CONVERTED_VOUCHER: "모바일 상품권 전환 신청",
};
