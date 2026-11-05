/**
 * 토스페이먼츠 결제 API 호출 — 서버 전용. 시크릿 키(TOSS_SECRET_KEY)는 브라우저로 나가면 안 된다.
 * 멱등키를 주문번호로 고정해, 재시도해도 승인·취소가 한 번만 처리되게 한다 (멱등키 유효 기간 15일).
 */

const API = "https://api.tosspayments.com/v1";
const TIMEOUT_MS = 25_000;

export type TossPayment = { paymentKey: string; orderId: string; status: string; totalAmount: number };
export type TossResult = { ok: true; payment: TossPayment } | { ok: false; status: number; code: string; message: string };

export const isTossConfigured = () => !!process.env.TOSS_SECRET_KEY;

async function call(path: string, init: { method: "GET" } | { method: "POST"; body: unknown; idempotencyKey: string }): Promise<TossResult> {
  const secret = process.env.TOSS_SECRET_KEY;
  if (!secret) return { ok: false, status: 503, code: "payment_not_configured", message: "TOSS_SECRET_KEY is not set" };
  try {
    const res = await fetch(`${API}${path}`, {
      method: init.method,
      headers: {
        // 시크릿 키 뒤에 콜론을 붙여 base64로 인코딩한다
        Authorization: `Basic ${Buffer.from(`${secret}:`).toString("base64")}`,
        ...(init.method === "POST" ? { "Content-Type": "application/json", "Idempotency-Key": init.idempotencyKey } : {}),
      },
      ...(init.method === "POST" ? { body: JSON.stringify(init.body) } : {}),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = (await res.json().catch(() => null)) as (TossPayment & { code?: string; message?: string }) | null;
    if (res.ok && body) return { ok: true, payment: body };
    return { ok: false, status: res.status, code: body?.code ?? `http_${res.status}`, message: body?.message ?? "" };
  } catch (e) {
    // 응답을 받지 못한 경우 승인 여부를 알 수 없으므로 실패로 확정하지 않는다
    return { ok: false, status: 503, code: "toss_unreachable", message: e instanceof Error ? e.message : String(e) };
  }
}

export const confirmTossPayment = (paymentKey: string, orderId: string, amount: number) =>
  call("/payments/confirm", { method: "POST", body: { paymentKey, orderId, amount }, idempotencyKey: `confirm-${orderId}` });

export const getTossPayment = (paymentKey: string) => call(`/payments/${encodeURIComponent(paymentKey)}`, { method: "GET" });

export const cancelTossPayment = (paymentKey: string, orderId: string, cancelAmount: number, cancelReason: string) =>
  call(`/payments/${encodeURIComponent(paymentKey)}/cancel`, { method: "POST", body: { cancelReason, cancelAmount }, idempotencyKey: `cancel-${orderId}` });
