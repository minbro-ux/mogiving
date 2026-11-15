import { NextResponse, type NextRequest } from "next/server";
import { searchProductImage } from "@/lib/kakaoImage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 상품명이 이보다 길면 검색어로 쓰지 않는다 (남용 방지) */
const MAX_QUERY = 120;

export type ImageSearchResponse = { imageUrl?: string };

/**
 * GET /api/image-search?q=상품명 → { imageUrl? }
 * 크롤링이 막혀 대표 사진이 없을 때 카카오 이미지 검색으로 보완한다.
 * KAKAO_REST_API_KEY가 없거나 실패하면 빈 응답 → 화면은 쇼핑몰 기본 썸네일 카드 그대로.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q || q.length > MAX_QUERY || !process.env.KAKAO_REST_API_KEY) return NextResponse.json<ImageSearchResponse>({});
  const imageUrl = await searchProductImage(q, { signal: req.signal });
  return NextResponse.json<ImageSearchResponse>(imageUrl ? { imageUrl } : {}, {
    // 같은 상품명은 하루 동안 CDN 캐시를 써 카카오 API 호출을 아낀다
    headers: imageUrl ? { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } : { "Cache-Control": "no-store" },
  });
}
