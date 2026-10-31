import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, ADMIN_SESSION_SECONDS, checkPassword, createSessionToken } from "@/lib/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const redirect = (req: NextRequest, query = "") => NextResponse.redirect(new URL(`/admin${query}`, req.url), 303);

/** POST /api/admin/login (form: password) → 성공 시 세션 쿠키 발급 */
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const input = form?.get("password");
  if (typeof input !== "string" || !checkPassword(input)) {
    // 무작위 대입을 늦추기 위한 지연
    await new Promise((r) => setTimeout(r, 1000));
    return redirect(req, "?error=1");
  }
  const res = redirect(req);
  res.cookies.set(ADMIN_COOKIE, createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: ADMIN_SESSION_SECONDS,
  });
  return res;
}
