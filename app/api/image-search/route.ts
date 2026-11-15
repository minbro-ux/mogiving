import { NextResponse, type NextRequest } from "next/server";
import { getGlobalRateLimiter } from "@/lib/globalRateLimit";
import { searchProductImage } from "@/lib/kakaoImage";
import { clientIp, createRateLimiter } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 상품명이 이보다 길면 검색어로 쓰지 않는다 (남용 방지) */
const MAX_QUERY = 120;

/**
 * 카카오 API 할당량 보호 (같은 서버 인스턴스 기준).
 * - IP당 10분에 20회: 펀딩 하나 만들 때 보통 1~2회(다시 불러오기 포함)라 정상 사용엔 걸리지 않는다
 * - 인스턴스 전체 1시간에 300회: IP를 바꿔 가며 호출해도 한 인스턴스가 쓰는 양에 상한을 둔다
 */
const perIp = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 20 });
const overall = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 300, maxKeys: 1 });

/**
 * 모든 인스턴스를 합친 하루 상한 (Supabase 카운터, 매일 0시 KST에 새로 셈).
 * KAKAO_IMAGE_SEARCH_DAILY_LIMIT로 바꿀 수 있고, 잘못된 값이면 기본값을 쓴다
 */
const DEFAULT_DAILY_LIMIT = 3000;
const dailyLimit = () => {
  // 빈 값("")은 Number로 0이 되어 전부 막히므로 숫자만 받는다
  const raw = process.env.KAKAO_IMAGE_SEARCH_DAILY_LIMIT?.trim() ?? "";
  return /^\d+$/.test(raw) ? Number(raw) : DEFAULT_DAILY_LIMIT;
};
const DAY_SECONDS = 24 * 60 * 60;

export type ImageSearchResponse = { imageUrl?: string };

const empty = (status = 200) => NextResponse.json<ImageSearchResponse>({}, { status, headers: { "Cache-Control": "no-store" } });

/**
 * GET /api/image-search?q=상품명 → { imageUrl? }
 * 크롤링이 막혀 대표 사진이 없을 때 카카오 이미지 검색으로 보완한다.
 * KAKAO_REST_API_KEY가 없거나, 호출 제한에 걸리거나, 실패하면 빈 응답 → 화면은 쇼핑몰 기본 썸네일 카드 그대로.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q || q.length > MAX_QUERY || !process.env.KAKAO_REST_API_KEY) return empty();
  // 실제로 카카오를 호출할 요청만 센다. 제한에 걸려도 본문은 빈 결과라 화면은 기본 썸네일로 자연스럽게 넘어간다
  if (perIp(clientIp(req.headers)) || overall("all")) return empty(429);
  // 전체 상한은 메모리 제한을 통과한 요청만 센다. Supabase를 못 쓰면("unknown") 막지 않고 메모리 제한만 적용된다
  if ((await getGlobalRateLimiter()("kakao-image-search", DAY_SECONDS, dailyLimit())) === "limited") return empty(429);
  const imageUrl = await searchProductImage(q, { signal: req.signal });
  if (!imageUrl) return empty();
  // 같은 상품명은 하루 동안 CDN 캐시를 써 카카오 API 호출을 아낀다 (캐시 응답은 이 함수를 거치지 않아 제한에도 세지 않음)
  return NextResponse.json<ImageSearchResponse>({ imageUrl }, { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } });
}
