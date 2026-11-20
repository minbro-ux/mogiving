/** 공동 선물 운영 규칙. 화면 문구와 서버 판단이 같은 값을 쓰도록 여기에만 둔다 */

/**
 * PG 심사·이용자 안내용 핵심 고지. 상품 상세·결제 화면·약관에 같은 문장을 쓴다
 */
export const VOUCHER_ISSUE_NOTICE = "결제 즉시 수령인의 지정 선물 전용 교환권이 발행(구매 확정)됩니다.";
export const UNDER_GOAL_NOTICE =
  "목표 금액 100% 도달 시 실물 상품이 발송되며, 기간 내 미도달 시에도 결제가 취소되지 않고 ① 수령인이 남은 차액을 결제해 실물 상품을 수령하거나 ② 적립된 교환권 금액(원가 기준)만큼 모바일 상품권으로 즉시 전환 수령할 수 있습니다.";

/** 수령인이 고를 수 있는 모바일 상품권 종류 */
export const VOUCHER_TYPES = ["신세계 모바일상품권", "컬쳐랜드 문화상품권", "스타벅스 e카드", "배달의민족 상품권"] as const;
export type VoucherType = (typeof VOUCHER_TYPES)[number];
export const isVoucherType = (v: unknown): v is VoucherType => typeof v === "string" && (VOUCHER_TYPES as readonly string[]).includes(v);

/** 모바일 상품권 전환 신청 후 입력한 연락처로 발송하기까지의 기한 (영업일). 운영자가 직접 발송하므로 이 약속을 지킬 수 있게 정한다 */
export const VOUCHER_SEND_BUSINESS_DAYS = 1;

/** 공동 선물을 만들 때 고를 수 있는 선물 기간(일) */
export const FUNDING_PERIOD_DAYS = [3, 7, 14];

/** 저장할 수 있는 마감일의 상한. 기기 시계 오차로 정상 개설이 줄어들지 않게 하루 여유를 둔다 */
export const maxDeadline = (now = Date.now()) => now + (Math.max(...FUNDING_PERIOD_DAYS) + 1) * 24 * 60 * 60 * 1000;

/** 선물 보태기 최소 금액 */
export const MIN_AMOUNT = 1000;
/** 마지막 남은 금액을 채울 때의 최소 금액 (토스 카드 결제 최소 금액) */
export const MIN_LAST_AMOUNT = 100;

/**
 * 이 금액으로 참여할 수 있는지. 문제가 없으면 null.
 * 남은 금액이 1,000원 미만이어도 그 금액 그대로 결제해 100%를 채울 수 있어야 하고,
 * 결제 후 카드로 결제할 수 없는 금액(100원 미만)이 남으면 선물을 완성할 수 없으므로 막는다
 */
export function amountProblem(amount: number, remaining: number): "too_small" | "leaves_too_little" | null {
  if (amount < MIN_AMOUNT && !(amount === remaining && amount >= MIN_LAST_AMOUNT)) return "too_small";
  const rest = remaining - amount;
  return rest > 0 && rest < MIN_LAST_AMOUNT ? "leaves_too_little" : null;
}
