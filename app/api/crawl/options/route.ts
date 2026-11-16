import { NextResponse, type NextRequest } from "next/server";
import type { OptionsResponse } from "@/lib/crawl";
import { fetchProductHtml } from "@/lib/pageFetch";
import { extractOptions } from "@/lib/productOptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 옵션 select는 <body> 안쪽에 있어 상품명보다 오래 걸린다. 화면은 기다리지 않으므로 넘기면 빈 응답 */
const DEADLINE_MS = 4000;
const MAX_BYTES = 2 * 1024 * 1024;

/**
 * GET /api/crawl/options?url=… → { options?: ProductOption[] }
 * 상품 페이지에서 고를 수 있는 옵션(색상·사이즈 등) 목록만 뽑는다.
 * 단품·차단·시간 초과·파싱 실패는 모두 빈 응답이라 화면은 옵션 직접 입력칸만 그대로 보여준다.
 */
export async function GET(req: NextRequest) {
  const html = await fetchProductHtml(req.nextUrl.searchParams.get("url"), { deadlineMs: DEADLINE_MS, maxBytes: MAX_BYTES });
  const options = html ? extractOptions(html) : [];
  return NextResponse.json<OptionsResponse>(options.length ? { options } : {}, { headers: { "Cache-Control": "no-store" } });
}
