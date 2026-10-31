import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

/** POST /api/admin/logout → 세션 쿠키 삭제 후 잠금 화면으로 */
export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/admin", req.url), 303);
  res.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
