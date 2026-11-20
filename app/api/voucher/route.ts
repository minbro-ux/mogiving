import { NextResponse, type NextRequest } from "next/server";
import { alertVoucherRequested } from "@/lib/opsAlerts";
import { getFundingSummary } from "@/lib/paymentStore";
import { isVoucherType } from "@/lib/policy";
import { SHORT_ID_RE, convertShareVoucher, getShare, verifyShareKey } from "@/lib/shareStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

const PHONE_RE = /^[0-9-]{9,20}$/;

/**
 * POST /api/voucher { shareId, key, voucherType, name, phone }
 * 기간 내 미도달 선물의 수령인이 적립된 교환권 금액(원가 기준)을 모바일 상품권으로 전환 신청한다 (CONVERTED_VOUCHER).
 * 금액은 서버가 적립 금액에서 플랫폼 수수료를 빼서 정한다. 신청이 저장되면 운영자에게 텔레그램으로 알린다.
 */
export async function POST(req: NextRequest) {
  let body: { shareId?: unknown; key?: unknown; voucherType?: unknown; name?: unknown; phone?: unknown };
  try {
    body = await req.json();
  } catch {
    return bad("bad_json");
  }
  const shareId = typeof body.shareId === "string" ? body.shareId : "";
  const key = typeof body.key === "string" ? body.key : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  if (!SHORT_ID_RE.test(shareId) || !key) return bad("bad_request");
  if (!isVoucherType(body.voucherType)) return bad("bad_voucher_type");
  if (name.length < 1 || name.length > 20 || !PHONE_RE.test(phone)) return bad("bad_contact");

  try {
    if (!(await verifyShareKey(shareId, key))) return bad("forbidden", 403);
    const r = await convertShareVoucher(shareId, { type: body.voucherType, name, phone });
    if (!("request" in r)) return r.result === "not_found" ? bad("share_not_found", 404) : bad("voucher_unavailable", 409);
    const request = r.request;
    if (r.result === "converted") {
      const share = await getShare(shareId);
      await alertVoucherRequested(shareId, share?.p.name ?? "", request);
    }
    const summary = await getFundingSummary(shareId, key);
    return NextResponse.json({ ok: true, voucher: summary?.voucher ?? { requestedAt: request.requestedAt, type: request.type, amount: request.amount } });
  } catch (e) {
    console.error("[api/voucher] 모바일 상품권 전환 신청 실패", { shareId, error: e instanceof Error ? e.message : String(e) });
    return bad("store_unavailable", 503);
  }
}
