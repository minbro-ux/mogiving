/** 펀딩 운영 규칙. 화면 문구와 서버 판단이 같은 값을 쓰도록 여기에만 둔다 */

/** 미달 펀딩을 주최자가 처리하지 않으면 마감 후 이 기간이 지나 자동으로 전액 환불한다 */
export const AUTO_REFUND_DAYS = 3;
export const AUTO_REFUND_AFTER_MS = AUTO_REFUND_DAYS * 24 * 60 * 60 * 1000;

/** 펀딩 개설 때 고를 수 있는 모금 기간(일) */
export const FUNDING_PERIOD_DAYS = [3, 7, 14];

/** 저장할 수 있는 마감일의 상한. 기기 시계 오차로 정상 개설이 줄어들지 않게 하루 여유를 둔다 */
export const maxDeadline = (now = Date.now()) => now + (Math.max(...FUNDING_PERIOD_DAYS) + 1) * 24 * 60 * 60 * 1000;

/** 일반 참여 최소 금액 */
export const MIN_AMOUNT = 1000;
/** 마지막 남은 금액을 채울 때의 최소 금액 (토스 카드 결제 최소 금액) */
export const MIN_LAST_AMOUNT = 100;

/**
 * 이 금액으로 참여할 수 있는지. 문제가 없으면 null.
 * 남은 금액이 1,000원 미만이어도 그 금액 그대로 결제해 100%를 채울 수 있어야 하고,
 * 결제 후 카드로 결제할 수 없는 금액(100원 미만)이 남으면 펀딩이 끝나지 못하므로 막는다
 */
export function amountProblem(amount: number, remaining: number): "too_small" | "leaves_too_little" | null {
  if (amount < MIN_AMOUNT && !(amount === remaining && amount >= MIN_LAST_AMOUNT)) return "too_small";
  const rest = remaining - amount;
  return rest > 0 && rest < MIN_LAST_AMOUNT ? "leaves_too_little" : null;
}
