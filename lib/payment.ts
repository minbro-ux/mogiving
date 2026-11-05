import type { StoredContribution } from "./contributionStore";

/**
 * 조각 선물 결제 (브라우저) — 주문 생성 → 토스페이먼츠 결제창 → /pay/success에서 서버 승인.
 * 결제창은 카드·토스페이 등을 함께 보여주는 통합결제창을 쓴다.
 */

const PREPARE_ERRORS: Record<string, string> = {
  funding_closed: "이미 마감된 펀딩이에요. 화면을 새로고침해 주세요",
  amount_over_remaining: "그사이 남은 금액이 줄었어요. 화면을 새로고침한 뒤 다시 선택해 주세요",
  share_not_found: "펀딩 정보를 찾을 수 없어요",
  invalid_amount: "참여 금액을 다시 확인해 주세요",
  bad_nickname: "이름은 1~20자로 입력해 주세요",
  bad_message: "메시지는 300자까지 쓸 수 있어요",
  payment_not_configured: "결제 설정이 아직 완료되지 않았어요. 고객센터로 문의해 주세요",
};
const DEFAULT_ERROR = "결제를 시작하지 못했어요. 잠시 후 다시 시도해 주세요";

/** 결제창을 연다. 실패하면 오류 문구, 구매자가 창을 닫으면 "canceled", 페이지 이동이 시작되면 "redirecting" */
export async function startTossPayment(shareId: string, input: { nickname: string; message: string; amount: number }): Promise<{ status: "redirecting" | "canceled" } | { status: "error"; message: string }> {
  const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
  if (!clientKey) {
    console.error("[mogiving] NEXT_PUBLIC_TOSS_CLIENT_KEY가 설정되지 않았습니다");
    return { status: "error", message: PREPARE_ERRORS.payment_not_configured };
  }

  let order: { orderId: string; orderName: string; amount: number };
  try {
    const res = await fetch("/api/payments/prepare", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shareId, ...input }) });
    const body = (await res.json().catch(() => null)) as ({ ok: true; orderId: string; orderName: string; amount: number } | { ok: false; error?: string }) | null;
    if (!res.ok || !body?.ok) {
      const code = body && !body.ok ? body.error : undefined;
      console.error("[mogiving] 결제 주문 생성 실패", { shareId, status: res.status, code });
      return { status: "error", message: (code && PREPARE_ERRORS[code]) || DEFAULT_ERROR };
    }
    order = body;
  } catch (e) {
    console.error("[mogiving] 결제 주문 요청 실패 (네트워크)", e);
    return { status: "error", message: "네트워크 연결을 확인하고 다시 시도해 주세요" };
  }

  try {
    const { ANONYMOUS, loadTossPayments } = await import("@tosspayments/tosspayments-sdk");
    const toss = await loadTossPayments(clientKey);
    const { origin } = window.location;
    await toss.payment({ customerKey: ANONYMOUS }).requestPayment({
      method: "CARD",
      amount: { currency: "KRW", value: order.amount },
      orderId: order.orderId,
      orderName: order.orderName,
      successUrl: `${origin}/pay/success`,
      failUrl: `${origin}/pay/fail?share=${encodeURIComponent(shareId)}`,
      card: { flowMode: "DEFAULT", useEscrow: false, useCardPoint: false, useAppCardOnly: false },
    });
    return { status: "redirecting" };
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "USER_CANCEL") return { status: "canceled" };
    console.error("[mogiving] 결제창 호출 실패", { code, error: e instanceof Error ? e.message : String(e) });
    return { status: "error", message: "결제창을 열지 못했어요. 잠시 후 다시 시도해 주세요" };
  }
}

export type ConfirmOk = {
  ok: true;
  shareId: string;
  amount: number;
  recordedAmount: number;
  refundAmount: number;
  refundStatus: "none" | "required" | "done" | "failed";
  goal: number | null;
  collected: number;
  count: number;
  contribution: StoredContribution | null;
};
export type ConfirmFail = { ok: false; error?: string; shareId?: string; charged?: boolean; retryable: boolean };

const RETRY_DELAYS_MS = [1500, 3000, 5000];

/** 서버 승인. 일시적인 오류면 몇 번 다시 보낸다 (서버가 주문당 한 번만 처리하므로 안전) */
export async function confirmPayment(input: { paymentKey: string; orderId: string; amount: number }): Promise<ConfirmOk | ConfirmFail> {
  let last: ConfirmFail = { ok: false, error: "network", retryable: true };
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt - 1]));
    try {
      const res = await fetch("/api/payments/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      const body = (await res.json().catch(() => null)) as (ConfirmOk | Omit<ConfirmFail, "retryable">) | null;
      if (res.ok && body?.ok) return body;
      last = { ...(body as Omit<ConfirmFail, "retryable"> | null), ok: false, retryable: res.status >= 500 };
      if (!last.retryable) return last;
    } catch (e) {
      console.error("[mogiving] 결제 승인 요청 실패 (네트워크)", e);
      last = { ok: false, error: "network", retryable: true };
    }
  }
  return last;
}
