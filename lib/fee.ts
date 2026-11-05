/** 플랫폼 수수료. 화면과 서버가 같은 계산을 쓰도록 여기에만 둔다 */
export const FEE_PERCENT = 5;

/**
 * 선물 원가(base_price) → 최종 목표 금액(goal): 수수료 5%를 더해 100원 단위로 올림.
 * 금액 계산에 소수(1.05)를 쓰지 않도록 정수로 곱한 뒤 나눈다
 */
export const goalWithFee = (basePrice: number) => (basePrice > 0 ? Math.ceil((basePrice * (100 + FEE_PERCENT)) / 10_000) * 100 : 0);

/** 화면에 보여줄 수수료. 올림분을 포함해 '선물 금액 + 수수료 = 목표 금액'이 항상 맞게 한다 */
export const feeAmount = (basePrice: number) => goalWithFee(basePrice) - Math.max(0, basePrice);
