import { randomUUID } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { goalWithFee } from "@/lib/fee";
import { createPaymentOrder, fundingAvailability } from "@/lib/paymentStore";
import { MIN_LAST_AMOUNT, amountProblem } from "@/lib/policy";
import { SHORT_ID_RE } from "@/lib/shareStore";
import { isTossConfigured } from "@/lib/tossServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 선물 원가 입력 한도(1천만 원)에 수수료를 더한 금액까지 한 번에 결제할 수 있다 */
const MAX_AMOUNT = goalWithFee(10_000_000);

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

/**
 * POST /api/payments/prepare { shareId, nickname, message, amount } → { orderId, orderName, amount }
 * 결제창을 열기 전에 주문을 저장한다. 승인할 때 이 금액과 비교하므로 브라우저에서 금액을 바꿔도 통과하지 못한다.
 */
export async function POST(req: NextRequest) {
  if (!isTossConfigured()) return bad("payment_not_configured", 503);

  let body: { shareId?: unknown; nickname?: unknown; message?: unknown; amount?: unknown };
  try {
    body = await req.json();
  } catch {
    return bad("bad_json");
  }
  const shareId = typeof body.shareId === "string" ? body.shareId : "";
  const nickname = typeof body.nickname === "string" ? body.nickname.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const amount = typeof body.amount === "number" && Number.isInteger(body.amount) ? body.amount : NaN;

  if (!SHORT_ID_RE.test(shareId)) return bad("bad_share_id");
  if (nickname.length < 1 || nickname.length > 20) return bad("bad_nickname");
  if (message.length > 300) return bad("bad_message");
  if (!Number.isFinite(amount) || amount < MIN_LAST_AMOUNT || amount > MAX_AMOUNT) return bad("invalid_amount");

  try {
    const funding = await fundingAvailability(shareId);
    if (!funding) return bad("share_not_found", 404);
    if (!funding.open) return bad("funding_closed", 409);
    if (amount > funding.remaining) return bad("amount_over_remaining", 409);
    const problem = amountProblem(amount, funding.remaining);
    if (problem) return bad(problem === "too_small" ? "invalid_amount" : "amount_leaves_too_little");

    const orderId = `mg_${randomUUID().replace(/-/g, "")}`;
    await createPaymentOrder({ orderId, shareId, nickname, message, amount });
    return NextResponse.json({ ok: true, orderId, orderName: `모기빙 조각 선물 · ${funding.productName}`.slice(0, 100), amount });
  } catch (e) {
    console.error("[api/payments/prepare] 주문 생성 실패", { shareId, amount, error: e instanceof Error ? e.message : String(e), detail: (e as { detail?: unknown }).detail });
    return bad("store_unavailable", 503);
  }
}
