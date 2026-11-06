import { NextResponse, type NextRequest } from "next/server";
import { fundingAvailability, getFundingSummary } from "@/lib/paymentStore";
import { isShippingAddress } from "@/lib/share";
import { SHORT_ID_RE, requestDelivery, verifyShareKey } from "@/lib/shareStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

/**
 * POST /api/delivery { shareId, key, shipping }
 * 목표를 달성한 펀딩의 주최자가 배송을 접수한다. 접수되면 운영자 화면에 발주 대상으로 표시된다.
 * 발주가 시작됐을 수 있으므로 이미 접수한 배송지는 덮어쓰지 않는다.
 */
export async function POST(req: NextRequest) {
  let body: { shareId?: unknown; key?: unknown; shipping?: unknown };
  try {
    body = await req.json();
  } catch {
    return bad("bad_json");
  }
  const shareId = typeof body.shareId === "string" ? body.shareId : "";
  const key = typeof body.key === "string" ? body.key : "";
  if (!SHORT_ID_RE.test(shareId) || !key) return bad("bad_request");
  const s = body.shipping;
  if (!isShippingAddress(s) || !s.name.trim() || !s.phone.trim() || !s.address.trim()) return bad("bad_shipping");

  try {
    if (!(await verifyShareKey(shareId, key))) return bad("forbidden", 403);
    const funding = await fundingAvailability(shareId);
    if (!funding) return bad("store_unavailable", 503);
    if (!funding.achieved) return bad("funding_not_achieved", 409);

    await requestDelivery(shareId, key, s);
    // 이미 접수된 경우까지 포함해 실제로 저장된 값을 돌려준다
    const summary = await getFundingSummary(shareId, key);
    if (!summary?.delivery) return bad("store_unavailable", 503);
    return NextResponse.json({ ok: true, delivery: summary.delivery });
  } catch (e) {
    console.error("[api/delivery] 배송 접수 실패", { shareId, error: e instanceof Error ? e.message : String(e) });
    return bad("store_unavailable", 503);
  }
}
