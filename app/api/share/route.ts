import { NextResponse, type NextRequest } from "next/server";
import { isSharePayload, isShippingAddress } from "@/lib/share";
import { saveShare } from "@/lib/shareStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 원본 구매 링크(최대 4KB)가 잘리거나 거절되지 않도록 여유를 둔다
const MAX_BODY = 16 * 1024;

/** POST /api/share { payload, shipping?, prev? } → { id, key } : 펀딩 공유용 짧은 링크 발급·갱신 */
export async function POST(req: NextRequest) {
  const text = await req.text();
  if (text.length > MAX_BODY) return NextResponse.json({ error: "too large" }, { status: 413 });
  let body: { payload?: unknown; shipping?: unknown; prev?: { id?: unknown; key?: unknown } };
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  if (!isSharePayload(body.payload)) return NextResponse.json({ error: "bad payload" }, { status: 400 });
  if (body.shipping !== undefined && !isShippingAddress(body.shipping)) return NextResponse.json({ error: "bad shipping" }, { status: 400 });
  const prev = typeof body.prev?.id === "string" && typeof body.prev?.key === "string" ? { id: body.prev.id, key: body.prev.key } : undefined;
  try {
    // 응답에는 id·key만 담는다 (배송지는 되돌려주지 않음)
    return NextResponse.json(await saveShare(body.payload, prev, body.shipping));
  } catch {
    // 저장소 장애 시 클라이언트는 긴 링크(/f/eyJ…)로 대체해 공유한다
    return NextResponse.json({ error: "store unavailable" }, { status: 503 });
  }
}
