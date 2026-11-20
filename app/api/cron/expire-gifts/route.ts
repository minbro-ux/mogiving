import { createHash, timingSafeEqual } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { markExpiredPendingChoice } from "@/lib/shareStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BATCH = 500;

const digest = (s: string) => createHash("sha256").update(s).digest();

/**
 * GET /api/cron/expire-gifts (Vercel Cron, Authorization: Bearer CRON_SECRET)
 * 기간이 끝난 미도달 공동 선물을 PENDING_CHOICE(수령인의 수령 방식 선택 대기)로 바꾼다. 결제는 취소하지 않는다.
 * 화면과 결제 판단은 마감일로도 같은 상태를 계산하므로, 이 크론은 DB 상태 컬럼을 맞추는 일만 한다.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[api/cron/expire-gifts] CRON_SECRET이 설정되지 않아 실행하지 않았습니다");
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }
  if (!timingSafeEqual(digest(req.headers.get("authorization") ?? ""), digest(`Bearer ${secret}`))) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const ids = await markExpiredPendingChoice(Date.now(), BATCH);
    return NextResponse.json({ ok: true, pendingChoice: ids.length, ids });
  } catch (e) {
    console.error("[api/cron/expire-gifts] 상태 전환 실패", { error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ ok: false, error: "store_unavailable" }, { status: 503 });
  }
}
