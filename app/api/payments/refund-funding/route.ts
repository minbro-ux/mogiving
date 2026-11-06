import { NextResponse, type NextRequest } from "next/server";
import { refundFundingOrders } from "@/lib/fundingRefund";
import { SHORT_ID_RE, verifyShareKey } from "@/lib/shareStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 함수 실행 시간 제한 안에서 끝내고, 남은 주문은 클라이언트가 다시 호출해 이어서 처리한다 */
const TIME_BUDGET_MS = 7_000;

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

/** POST /api/payments/refund-funding { shareId, key } : 주최자가 미달 펀딩을 취소한다 */
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
    const r = await refundFundingOrders(shareId, Date.now() + TIME_BUDGET_MS);
    if (!r.ok) return bad(r.error, r.error === "store_unavailable" ? 503 : 409);
    return NextResponse.json(r);
  } catch (e) {
    console.error("[api/payments/refund-funding] 처리 실패", { shareId, error: e instanceof Error ? e.message : String(e), detail: (e as { detail?: unknown }).detail });
    return bad("store_unavailable", 503);
  }
}
