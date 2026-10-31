/** 1조각 단위 후보: 총 조각 수가 50개를 넘지 않는 가장 작은 단위를 고른다 */
const UNITS = [1000, 2000, 5000, 10000, 20000, 30000, 50000, 100000, 200000, 500000];
const MAX_PIECES = 50;

export function pieceUnit(goal: number) {
  return UNITS.find((u) => Math.ceil(goal / u) <= MAX_PIECES) ?? Math.ceil(goal / MAX_PIECES / 1000) * 1000;
}

/**
 * 목표 금액을 N조각으로 나눈 현황.
 * 마지막 조각은 단위보다 작을 수 있어서, 남은 조각을 모두 사면 정확히 목표 금액이 된다.
 */
export function pieceInfo(goal: number, raised: number) {
  const unit = pieceUnit(goal);
  const total = Math.ceil(goal / unit);
  const filled = raised >= goal ? total : Math.min(total, Math.floor(raised / unit));
  return { unit, total, filled, remaining: total - filled };
}

/** n조각 결제 금액. Hard Cap: 마지막 조각은 남은 목표 금액에 딱 맞춰 결제 */
export const piecesAmount = (n: number, unit: number, remainingAmount: number) => Math.min(n * unit, remainingAmount);
