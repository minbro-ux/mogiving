import { NextResponse, type NextRequest } from "next/server";
import { ContributeError, getContributionSummary, saveContribution } from "@/lib/contributionStore";
import { SHORT_ID_RE } from "@/lib/shareStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_AMOUNT = 10_000_000;
const STATUS: Record<string, number> = { share_not_found: 404, funding_closed: 409, invalid_amount: 400, goal_missing: 422, store_unavailable: 503 };

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

/**
 * POST /api/contribute { shareId, nickname, message, amount }
 * 조각 선물 결제 완료 후 참여 내역·롤링페이퍼 메시지를 저장하고 누적 금액·조각 수를 갱신한다 (Service Role, 서버 전용).
 */
export async function POST(req: NextRequest) {
  let body: { shareId?: unknown; nickname?: unknown; message?: unknown; amount?: unknown };
  try {
    body = await req.json();
  } catch {
    return bad("bad_json");
  }
  const shareId = typeof body.shareId === "string" ? body.shareId : "";
  const nickname = typeof body.nickname === "string" ? body.nickname.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const amount = typeof body.amount === "number" ? Math.round(body.amount) : NaN;

  if (!SHORT_ID_RE.test(shareId)) return bad("bad_share_id");
  if (nickname.length < 1 || nickname.length > 20) return bad("bad_nickname");
  if (message.length > 300) return bad("bad_message");
  if (!Number.isFinite(amount) || amount < 1000 || amount > MAX_AMOUNT) return bad("invalid_amount");

  try {
    const r = await saveContribution(shareId, { nickname, message, amount });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    const code = e instanceof ContributeError ? e.code : "store_unavailable";
    // Vercel 함수 로그에서 바로 원인을 볼 수 있게 상세를 남긴다 (메시지 본문·닉네임은 기록하지 않음)
    console.error("[api/contribute] 참여 저장 실패", {
      shareId,
      amount,
      code,
      error: e instanceof Error ? e.message : String(e),
      detail: e instanceof ContributeError ? e.detail : undefined,
    });
    return bad(code, STATUS[code] ?? 500);
  }
}

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
