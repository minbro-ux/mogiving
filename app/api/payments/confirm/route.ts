import { NextResponse, type NextRequest } from "next/server";
import { type FinalizeResult, type PaymentOrder, PaymentStoreError, finalizePayment, fundingAvailability, getPaymentOrder, markOrderApproved, markOrderFailed, setRefundStatus } from "@/lib/paymentStore";
import { cancelTossPayment, confirmTossPayment, getTossPayment } from "@/lib/tossServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORDER_ID_RE = /^[A-Za-z0-9_=-]{6,64}$/;

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

/** 자동 환불. 실패하면 상태를 남겨 두고, 같은 주문을 다시 확인할 때 재시도한다 */
async function settleRefund(order: PaymentOrder, paymentKey: string, r: FinalizeResult): Promise<FinalizeResult> {
  if (r.refundAmount <= 0 || r.refundStatus === "done") return r;
  const res = await cancelTossPayment(paymentKey, order.orderId, r.refundAmount, "펀딩 마감 또는 목표 금액 초과로 자동 취소");
  const done = res.ok || res.code === "ALREADY_CANCELED_PAYMENT";
  if (!done) console.error("[api/payments/confirm] 자동 환불 실패 — 수동 확인 필요", { orderId: order.orderId, refundAmount: r.refundAmount, code: !res.ok ? res.code : undefined });
  const refundStatus = done ? "done" : "failed";
  await setRefundStatus(order.orderId, refundStatus);
  return { ...r, refundStatus };
}

function respond(order: PaymentOrder, r: FinalizeResult) {
  return NextResponse.json({
    ok: true,
    shareId: r.shareId,
    amount: order.amount,
    recordedAmount: r.recordedAmount,
    refundAmount: r.refundAmount,
    refundStatus: r.refundStatus,
    goal: r.goal,
    collected: r.collected,
    count: r.count,
    // 결제한 본인에게만 돌려주는 값 (이 기기에 기억해 두었다가 내 메시지로 보여준다)
    contribution: r.contributionId ? { id: r.contributionId, nickname: order.nickname, message: order.message, amount: r.recordedAmount, createdAt: r.contributedAt ?? Date.now() } : null,
  });
}

/**
 * POST /api/payments/confirm { paymentKey, orderId, amount }
 * 결제창 성공 후 호출: 금액 검증 → 토스 승인 → mogiving_finalize_payment()로 모금액 반영 → 필요하면 자동 환불.
 * 새로고침·재시도해도 승인과 반영은 주문당 한 번만 일어난다.
 */
export async function POST(req: NextRequest) {
  let body: { paymentKey?: unknown; orderId?: unknown; amount?: unknown };
  try {
    body = await req.json();
  } catch {
    return bad("bad_json");
  }
  const paymentKey = typeof body.paymentKey === "string" ? body.paymentKey : "";
  const orderId = typeof body.orderId === "string" ? body.orderId : "";
  if (!paymentKey || paymentKey.length > 200 || !ORDER_ID_RE.test(orderId) || typeof body.amount !== "number") return bad("bad_request");

  try {
    const order = await getPaymentOrder(orderId);
    if (!order) return bad("order_not_found", 404);
    // 주문 때 서버에 저장한 금액과 다르면 승인하지 않는다
    if (body.amount !== order.amount) {
      console.error("[api/payments/confirm] 결제 금액 불일치", { orderId, expected: order.amount, received: body.amount });
      return bad("amount_mismatch");
    }
    if (order.status === "failed") return bad("order_failed", 409);
    if (order.paymentKey && order.paymentKey !== paymentKey) return bad("payment_key_mismatch", 403);

    if (order.status === "pending") {
      // 청구되기 전에 마감·잔여 금액을 확인한다. 펀딩을 읽지 못했을 때는 실패로 확정하지 않고 재시도하게 한다
      const funding = await fundingAvailability(order.shareId);
      if (!funding) return bad("store_unavailable", 503);
      if (!funding.open || order.amount > funding.remaining) {
        await markOrderFailed(orderId, funding.open ? "amount_over_remaining" : "funding_closed");
        return NextResponse.json({ ok: false, error: funding.open ? "amount_over_remaining" : "funding_closed", shareId: order.shareId, charged: false }, { status: 409 });
      }

      let toss = await confirmTossPayment(paymentKey, orderId, order.amount);
      // 응답을 받지 못한 사이 승인이 끝난 경우: 실제 결제를 조회해 주문과 맞는지 확인한다
      if (!toss.ok && toss.code === "ALREADY_PROCESSED_PAYMENT") toss = await getTossPayment(paymentKey);

      if (!toss.ok) {
        if (toss.status >= 500 || toss.code === "ALREADY_PROCESSING_REQUEST" || toss.code === "IDEMPOTENT_REQUEST_PROCESSING") {
          console.error("[api/payments/confirm] 토스 승인 일시 오류", { orderId, status: toss.status, code: toss.code });
          return bad("payment_processing", 503);
        }
        console.error("[api/payments/confirm] 토스 승인 거절", { orderId, status: toss.status, code: toss.code });
        await markOrderFailed(orderId, toss.code);
        return NextResponse.json({ ok: false, error: "payment_rejected", code: toss.code, message: toss.message, shareId: order.shareId, charged: false }, { status: 402 });
      }

      const p = toss.payment;
      if (p.status !== "DONE" || p.orderId !== orderId || p.totalAmount !== order.amount) {
        // 주문과 다른 결제이므로 반영하지 않는다. 운영자가 확인해야 하는 경우라 로그를 남긴다
        console.error("[api/payments/confirm] 승인 결과가 주문과 다름", { orderId, status: p.status, respOrderId: p.orderId, total: p.totalAmount, expected: order.amount });
        return bad("payment_mismatch", 409);
      }
      await markOrderApproved(orderId, paymentKey);
    }

    // 여기까지 오면 승인된 결제. 저장에 실패해도 approved로 남으므로 같은 요청을 다시 보내면 이어서 처리된다
    const result = await finalizePayment(orderId, paymentKey);
    return respond(order, await settleRefund(order, paymentKey, result));
  } catch (e) {
    const code = e instanceof PaymentStoreError ? e.code : "store_unavailable";
    console.error("[api/payments/confirm] 결제 처리 실패", { orderId, code, error: e instanceof Error ? e.message : String(e), detail: (e as { detail?: unknown }).detail });
    if (code === "payment_key_mismatch") return bad(code, 403);
    if (code === "order_not_found") return bad(code, 404);
    if (code === "order_failed") return bad(code, 409);
    return bad("store_unavailable", 503);
  }
}
