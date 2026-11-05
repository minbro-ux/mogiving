import { NextResponse, type NextRequest } from "next/server";
import { ContributeError, getContributionSummary } from "@/lib/contributionStore";
import { SHORT_ID_RE } from "@/lib/shareStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

/* 참여 저장은 결제 승인(/api/payments/confirm)에서만 일어난다. 결제 없이 모금액을 올리는 경로를 두지 않는다 */

/**
 * GET /api/contribute?share={id}  (헤더 x-share-key: 주최자 비밀 key → 닉네임·메시지 포함)
 * 펀딩 상세 화면이 DB 최신 누적 금액·조각 수·참여 내역으로 동기화할 때 사용
 */
export async function GET(req: NextRequest) {
  const shareId = req.nextUrl.searchParams.get("share") ?? "";
  if (!SHORT_ID_RE.test(shareId)) return bad("bad_share_id");
  try {
    const s = await getContributionSummary(shareId, req.headers.get("x-share-key") ?? undefined);
    if (!s) return bad("share_not_found", 404);
    return NextResponse.json({ ok: true, ...s }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[api/contribute] 참여 내역 조회 실패", {
      shareId,
      error: e instanceof Error ? e.message : String(e),
      detail: e instanceof ContributeError ? e.detail : undefined,
    });
    return bad("store_unavailable", 503);
  }
}
