import { NextResponse, type NextRequest } from "next/server";
import { finalizePayment, fundingAvailability, listRefundableOrders, markOrderFullRefund, refundStateOf, setRefundStatus } from "@/lib/paymentStore";
import { SHORT_ID_RE, verifyShareKey } from "@/lib/shareStore";
import { cancelTossPaymentFully, getTossPayment } from "@/lib/tossServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 함수 실행 시간 제한 안에서 끝내고, 남은 주문은 클라이언트가 다시 호출해 이어서 처리한다 */
const TIME_BUDGET_MS = 7_000;
const CANCEL_REASON = "목표 금액 미달로 펀딩 취소 (수수료 포함 전액 환불)";

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

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

/**
 * POST /api/payments/refund-funding { shareId, key }
 * 주최자가 미달 펀딩을 취소: 참여자가 결제한 금액 그대로(수수료 포함 100%) 토스 결제를 전액 취소한다.
 * 주문마다 상태를 남기므로 실패·중단돼도 같은 요청을 다시 보내면 남은 주문만 이어서 처리한다.
 */
export async function POST(req: NextRequest) {
  let body: { shareId?: unknown; key?: unknown };
  try {
    body = await req.json();
  } catch {
    return bad("bad_json");
  }
  const shareId = typeof body.shareId === "string" ? body.shareId : "";
  const key = typeof body.key === "string" ? body.key : "";
  if (!SHORT_ID_RE.test(shareId) || !key) return bad("bad_request");

  try {
    if (!(await verifyShareKey(shareId, key))) return bad("forbidden", 403);

    let orders = await listRefundableOrders(shareId);
    // 이미 취소가 시작됐으면 조건을 다시 따지지 않고 이어서 처리한다
    if (refundStateOf(orders).state === "none") {
      const funding = await fundingAvailability(shareId);
      if (!funding) return bad("store_unavailable", 503);
      if (funding.achieved) return bad("funding_achieved", 409);
      if (!funding.closedByDeadline) return bad("funding_active", 409);
    }

    // 승인됐지만 저장이 끝나지 않은 주문도 빠뜨리지 않는다 (마감 후라 모금액에 반영되지 않고 환불 대상이 된다)
    for (const o of orders) if (o.status === "approved" && o.paymentKey) await finalizePayment(o.orderId, o.paymentKey);
    orders = await listRefundableOrders(shareId);

    // 토스를 호출하기 전에 전부 환불 대상으로 표시해, 중간에 끊겨도 새 결제가 들어오지 않게 한다
    for (const o of orders) {
      if (o.recordedAmount > 0 && o.refundAmount < o.amount) await markOrderFullRefund(o.orderId, o.amount);
    }
    orders = await listRefundableOrders(shareId);

    const started = Date.now();
    const failed: string[] = [];
    let remaining = 0;
    for (const o of orders) {
      const needsCancel = o.refundStatus === "required" || o.refundStatus === "failed";
      if (!needsCancel) continue;
      if (Date.now() - started > TIME_BUDGET_MS) {
        remaining++;
        continue;
      }
      if (!o.paymentKey) {
        console.error("[api/payments/refund-funding] 결제 키 없는 주문 — 수동 확인 필요", { shareId, orderId: o.orderId });
        failed.push(o.orderId);
        continue;
      }
      const r = await cancelFully(o.paymentKey, o.orderId);
      if (r.done) {
        await setRefundStatus(o.orderId, "done");
      } else {
        console.error("[api/payments/refund-funding] 전액 취소 실패 — 재시도 필요", { shareId, orderId: o.orderId, code: r.code });
        await setRefundStatus(o.orderId, "failed");
        failed.push(o.orderId);
      }
    }

    const state = refundStateOf(await listRefundableOrders(shareId));
    const finished = failed.length === 0 && remaining === 0;
    return NextResponse.json({ ok: true, finished, failed: failed.length, remaining, amount: state.amount, count: state.count });
  } catch (e) {
    console.error("[api/payments/refund-funding] 처리 실패", { shareId, error: e instanceof Error ? e.message : String(e), detail: (e as { detail?: unknown }).detail });
    return bad("store_unavailable", 503);
  }
}
