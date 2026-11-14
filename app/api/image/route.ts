import { NextResponse, type NextRequest } from "next/server";
import { MAX_IMAGE_BYTES, saveImage } from "@/lib/imageStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 같은 서버 인스턴스 기준 IP당 업로드 제한 (서버리스라 완벽하진 않지만 단순 반복 업로드는 막는다) */
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 30;
const hits = new Map<string, number[]>();

function limited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return false;
}

/** POST /api/image (본문: 이미지 바이너리) → { path: "/api/image/<id>" } : 직접 올린 상품 사진을 서버에 저장 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (limited(ip)) return NextResponse.json({ error: "too many" }, { status: 429 });
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_IMAGE_BYTES) return NextResponse.json({ error: "too large" }, { status: 413 });
  const bytes = new Uint8Array(await req.arrayBuffer());
  try {
    const r = await saveImage(bytes);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.error === "too large" ? 413 : 415 });
    return NextResponse.json({ path: `/api/image/${r.id}` });
  } catch (e) {
    console.error("[api/image] 사진 저장 실패", e instanceof Error ? e.message : String(e));
    // 저장에 실패해도 주최자 기기에는 사진이 남아 있으므로 클라이언트는 그대로 진행한다
    return NextResponse.json({ error: "store unavailable" }, { status: 503 });
  }
}
