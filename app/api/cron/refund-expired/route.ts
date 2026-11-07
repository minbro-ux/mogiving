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
 * 환불에 실패한 펀딩이 있으면 500으로 응답해 실행 기록에서 실패가 드러나게 한다. 시간이 모자라 미룬 펀딩은 실패가 아니다.
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
  const failed: string[] = [];
  const deferred: string[] = [];
  for (const shareId of ids) {
    if (Date.now() > until) {
      deferred.push(shareId);
      continue;
    }
    try {
      const r = await refundFundingOrders(shareId, until);
      if (r.ok && r.finished) finished++;
      else if (r.ok && r.failed === 0) deferred.push(shareId);
      else {
        failed.push(shareId);
        console.error("[api/cron/refund-expired] 자동 환불 미완료 — 다음 실행 때 재시도", { shareId, result: r });
      }
    } catch (e) {
      // 한 펀딩의 오류가 다른 펀딩의 환불을 막지 않게 한다
      failed.push(shareId);
      console.error("[api/cron/refund-expired] 자동 환불 실패", { shareId, error: e instanceof Error ? e.message : String(e), detail: (e as { detail?: unknown }).detail });
    }
  }
  if (deferred.length) console.warn("[api/cron/refund-expired] 시간이 모자라 다음 실행으로 미룸", { deferred });
  if (failed.length) console.error("[api/cron/refund-expired] 환불 실패 펀딩 있음 — 관리자 화면 확인 필요", { failed });
  return NextResponse.json({ ok: failed.length === 0, checked: ids.length, finished, unfinished: [...failed, ...deferred], failed }, { status: failed.length ? 500 : 200 });
}
