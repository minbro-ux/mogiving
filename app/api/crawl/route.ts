import { NextResponse, type NextRequest } from "next/server";
import type { TitleResponse } from "@/lib/crawl";
import { fetchProductHtml } from "@/lib/pageFetch";
import { extractTitle } from "@/lib/productTitle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 리다이렉트·본문 읽기까지 포함한 전체 제한 시간. 넘기면 빈 응답 (사용자가 바로 직접 입력) */
const DEADLINE_MS = 2500;
/** og:title은 <head>에 있으므로 앞부분만 읽는다 */
const MAX_BYTES = 512 * 1024;

/**
 * GET /api/crawl?url=… → { name?: string }
 * 상품명(og:title)만 가볍게 뽑는다. 차단·시간 초과·파싱 실패는 모두 빈 응답이라 화면은 조용히 빈 칸으로 둔다.
 * 옵션 목록은 본문 전체가 필요해 느리므로 /api/crawl/options에서 따로 받는다.
 */
export async function GET(req: NextRequest) {
  const html = await fetchProductHtml(req.nextUrl.searchParams.get("url"), { deadlineMs: DEADLINE_MS, maxBytes: MAX_BYTES });
  const name = html ? extractTitle(html) : undefined;
  return NextResponse.json<TitleResponse>(name ? { name } : {}, { headers: { "Cache-Control": "no-store" } });
}
