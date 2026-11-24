/** 공동 선물 운영 규칙. 화면 문구와 서버 판단이 같은 값을 쓰도록 여기에만 둔다 */

/**
 * PG 심사·이용자 안내용 핵심 고지. 상품 상세·결제 화면·약관에 같은 문장을 쓴다
 */
export const VOUCHER_ISSUE_NOTICE = "결제 즉시 수령인의 지정 선물 전용 교환권이 발행(구매 확정)됩니다.";
export const UNDER_GOAL_NOTICE =
  "선물 총액이 모두 채워지면 실물 상품이 발송되며, 선물 기간이 끝날 때까지 다 채워지지 않아도 그 이유로 결제가 취소되지 않고 ① 수령인이 남은 차액을 결제해 실물 상품을 수령하거나 ② 적립된 교환권 금액(원가 기준)만큼 모바일 상품권으로 즉시 전환 수령할 수 있습니다.";

/** 청약철회 요약 고지 (푸터·결제 안내). 상세 조항은 REFUND_CLAUSES */
export const REFUND_NOTICE =
  "구매자는 교환권이 사용(실물 선물 교환 신청 또는 모바일 상품권 전환)되기 전까지 결제일로부터 7일 이내에 청약철회 및 전액 환불을 요청할 수 있으며, 사용된 이후에는 디지털 재화의 특성상 청약철회 및 환불이 제한됩니다.";

/** 교환권 발급 후 수령인이 실물 선물을 고르지 않으면 모바일 상품권으로 전환하는 기한(일) */
export const UNCHOSEN_CONVERT_DAYS = 30;

/** 청약철회·환불 핵심 조항. 이용약관 제10조와 환불 정책에 같은 문장을 쓴다 */
export const REFUND_CLAUSES = [
  "본 서비스를 통해 구매한 전용 선물 교환권(디지털 바우처)은 결제 완료 즉시 수령인에게 확정 발급·전달됩니다.",
  "구매자는 교환권이 수령인에게 전달되어 사용(실물 선물 교환 신청 또는 모바일 상품권 전환)되기 전까지 결제일로부터 7일 이내에 청약철회 및 전액 환불을 요청할 수 있습니다.",
  "수령인이 교환권을 사용하여 실물 선물 배송이 시작되었거나 모바일 상품권이 발급 완료된 이후에는 디지털 재화의 특성상 청약철회 및 환불이 제한됩니다.",
  `교환권 발급 후 ${UNCHOSEN_CONVERT_DAYS}일 이내에 수령인이 실물 선물을 선택하지 않거나 잔여 교환권이 발생한 경우, 해당 교환권 금액에 상응하는 모바일 상품권(기프티콘)으로 정상 전환·지급되며 미사용을 사유로 한 임의 취소는 발생하지 않습니다.`,
] as const;

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
