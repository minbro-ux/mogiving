import { createHash, timingSafeEqual } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { refundFundingOrders } from "@/lib/fundingRefund";
import { listExpiredUnderFundings } from "@/lib/paymentStore";
import { AUTO_REFUND_AFTER_MS } from "@/lib/policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 함수 실행 시간 제한 안에서 끝낸다. 남은 펀딩은 다음 실행 때 이어서 처리한다 */
const TIME_BUDGET_MS = 7_000;
const BATCH = 50;

const digest = (s: string) => createHash("sha256").update(s).digest();

/**
 * GET /api/cron/refund-expired (Vercel Cron, Authorization: Bearer CRON_SECRET)
 * 주최자가 처리하지 않은 미달 펀딩을 마감 후 일정 기간이 지나면 전액 환불한다.
 * CRON_SECRET이 없으면 실행하지 않는다.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[api/cron/refund-expired] CRON_SECRET이 설정되지 않아 자동 환불을 실행하지 못했습니다");
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }
  if (!timingSafeEqual(digest(req.headers.get("authorization") ?? ""), digest(`Bearer ${secret}`))) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const until = Date.now() + TIME_BUDGET_MS;
  let ids: string[];
  try {
    ids = await listExpiredUnderFundings(Date.now() - AUTO_REFUND_AFTER_MS, BATCH);
  } catch (e) {
    console.error("[api/cron/refund-expired] 대상 조회 실패", { error: e instanceof Error ? e.message : String(e), detail: (e as { detail?: unknown }).detail });
    return NextResponse.json({ ok: false, error: "store_unavailable" }, { status: 503 });
  }

  let finished = 0;
  const unfinished: string[] = [];
  for (const shareId of ids) {
    if (Date.now() > until) {
      unfinished.push(shareId);
      continue;
    }
    try {
      const r = await refundFundingOrders(shareId, until);
      if (r.ok && r.finished) finished++;
      else {
        unfinished.push(shareId);
        console.error("[api/cron/refund-expired] 자동 환불 미완료 — 다음 실행 때 재시도", { shareId, result: r });
      }
    } catch (e) {
      // 한 펀딩의 오류가 다른 펀딩의 환불을 막지 않게 한다
      unfinished.push(shareId);
      console.error("[api/cron/refund-expired] 자동 환불 실패", { shareId, error: e instanceof Error ? e.message : String(e), detail: (e as { detail?: unknown }).detail });
    }
  }
  return NextResponse.json({ ok: true, checked: ids.length, finished, unfinished });
}
