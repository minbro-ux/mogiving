import { NextResponse } from "next/server";
import { loadImage } from "@/lib/imageStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/image/[id] : 저장된 상품 사진. 한 번 저장한 사진은 바뀌지 않으므로 오래 캐시한다 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const img = await loadImage(params.id);
    if (!img) return NextResponse.json({ error: "not found" }, { status: 404 });
    return new NextResponse(new Uint8Array(img.bytes), {
      headers: {
        "Content-Type": img.type,
        "Content-Length": String(img.bytes.byteLength),
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'",
      },
    });
  } catch (e) {
    console.error("[api/image] 사진 조회 실패", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "store unavailable" }, { status: 503 });
  }
}
