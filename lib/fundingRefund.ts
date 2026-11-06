import { finalizePayment, fundingAvailability, listRefundableOrders, markOrderFullRefund, refundStateOf, setRefundStatus } from "./paymentStore";
import { cancelTossPaymentFully, getTossPayment } from "./tossServer";

const CANCEL_REASON = "목표 금액 미달로 펀딩 취소 (수수료 포함 전액 환불)";

/** 토스에서 남은 금액 전부가 취소된 것까지 확인해야 완료로 본다. 이미 취소된 결제면 다시 요청하지 않는다 */
async function cancelFully(paymentKey: string, orderId: string) {
  const current = await getTossPayment(paymentKey);
  if (current.ok && current.payment.orderId !== orderId) return { done: false, code: "payment_mismatch" };
  if (current.ok && current.payment.status === "CANCELED") return { done: true };
  const res = await cancelTossPaymentFully(paymentKey, orderId, CANCEL_REASON);
  if (!res.ok) return { done: res.code === "ALREADY_CANCELED_PAYMENT", code: res.code };
  const fully = res.payment.status === "CANCELED" && (res.payment.balanceAmount === undefined || res.payment.balanceAmount === 0);
  return { done: fully, code: fully ? undefined : `unexpected_status_${res.payment.status}` };
}

export type RefundOutcome =
  | { ok: true; finished: boolean; failed: number; remaining: number; amount: number; count: number }
  | { ok: false; error: "store_unavailable" | "funding_achieved" | "funding_active" };

/**
 * 미달 펀딩의 결제를 참여자가 결제한 금액 그대로(수수료 포함 100%) 전액 취소한다. 권한 확인은 호출하는 쪽에서 한다.
 * 주문마다 상태를 남기므로 실패·중단돼도 다시 호출하면 남은 주문만 이어서 처리한다.
 * until 시각이 지나면 새 주문을 처리하지 않고 remaining으로 돌려준다.
 */
export async function refundFundingOrders(shareId: string, until: number): Promise<RefundOutcome> {
  let orders = await listRefundableOrders(shareId);
  // 이미 취소가 시작됐으면 조건을 다시 따지지 않고 이어서 처리한다
  if (refundStateOf(orders).state === "none") {
    const funding = await fundingAvailability(shareId);
    if (!funding) return { ok: false, error: "store_unavailable" };
    if (funding.achieved) return { ok: false, error: "funding_achieved" };
    if (!funding.closedByDeadline) return { ok: false, error: "funding_active" };
  }

  // 승인됐지만 저장이 끝나지 않은 주문도 빠뜨리지 않는다 (마감 후라 모금액에 반영되지 않고 환불 대상이 된다)
  for (const o of orders) if (o.status === "approved" && o.paymentKey) await finalizePayment(o.orderId, o.paymentKey);
  orders = await listRefundableOrders(shareId);

  // 토스를 호출하기 전에 전부 환불 대상으로 표시해, 중간에 끊겨도 새 결제가 들어오지 않게 한다
  for (const o of orders) {
    if (o.recordedAmount > 0 && o.refundAmount < o.amount) await markOrderFullRefund(o.orderId, o.amount);
  }
  orders = await listRefundableOrders(shareId);

  const failed: string[] = [];
  let remaining = 0;
  for (const o of orders) {
    const needsCancel = o.refundStatus === "required" || o.refundStatus === "failed";
    if (!needsCancel) continue;
    if (Date.now() > until) {
      remaining++;
      continue;
    }
    if (!o.paymentKey) {
      console.error("[fundingRefund] 결제 키 없는 주문 — 수동 확인 필요", { shareId, orderId: o.orderId });
      failed.push(o.orderId);
      continue;
    }
    const r = await cancelFully(o.paymentKey, o.orderId);
    if (r.done) {
      await setRefundStatus(o.orderId, "done");
    } else {
      console.error("[fundingRefund] 전액 취소 실패 — 재시도 필요", { shareId, orderId: o.orderId, code: r.code });
      await setRefundStatus(o.orderId, "failed");
      failed.push(o.orderId);
    }
  }

  const state = refundStateOf(await listRefundableOrders(shareId));
  return { ok: true, finished: failed.length === 0 && remaining === 0, failed: failed.length, remaining, amount: state.amount, count: state.count };
}
