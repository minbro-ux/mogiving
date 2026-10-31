import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { toAdminView, toOrderCsv } from "@/lib/adminRows";
import { listSharesForAdmin } from "@/lib/shareStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/export → 발주용 CSV (관리자 세션 필요) */
export async function GET() {
  if (!isAdmin()) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rows = (await listSharesForAdmin()).map(toAdminView);
  const stamp = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  return new NextResponse(toOrderCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="mogiving-orders-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
