import type { Metadata } from "next";
import { adminConfigured, isAdmin } from "@/lib/adminAuth";
import { kstDateTime, toAdminView } from "@/lib/adminRows";
import { won } from "@/lib/format";
import { type RefundAttention, listRefundAttention } from "@/lib/paymentStore";
import { listSharesForAdmin } from "@/lib/shareStore";
import { Footer } from "@/components/Footer";
import { CopyButton } from "./CopyButton";

export const dynamic = "force-dynamic";

// 운영자 전용: 검색엔진 색인·미리보기 차단. 앱 어디에도 이 페이지로 가는 링크를 두지 않는다
export const metadata: Metadata = {
  title: "모기빙 관리자",
  robots: { index: false, follow: false, nocache: true },
  openGraph: null,
  twitter: null,
};

const REFUND_ATTENTION_LIMIT = 100;

type Props = { searchParams: { error?: string } };

export default async function AdminPage({ searchParams }: Props) {
  if (!isAdmin()) return <LoginScreen error={searchParams.error === "1"} configured={adminConfigured()} />;

  let rows: ReturnType<typeof toAdminView>[] = [];
  let loadError = false;
  try {
    rows = (await listSharesForAdmin()).map(toAdminView);
  } catch {
    loadError = true;
  }

  // 조회 실패를 "환불 문제 없음"으로 보이지 않게 따로 표시한다
  let refunds: RefundAttention[] = [];
  let refundLoadError = false;
  try {
    refunds = await listRefundAttention(REFUND_ATTENTION_LIMIT);
  } catch (e) {
    refundLoadError = true;
    console.error("[admin] 환불 확인 목록 조회 실패", { error: e instanceof Error ? e.message : String(e), detail: (e as { detail?: unknown }).detail });
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 text-gray-900 sm:px-8">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">모기빙 운영자 대시보드</h1>
          <p className="mt-1 text-sm text-gray-500">펀딩 {rows.length}건 · 최신 등록순</p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/api/admin/export" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            발주용 CSV(엑셀) 다운로드
          </a>
          <form action="/api/admin/logout" method="post">
            <button className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100">잠그기</button>
          </form>
        </div>
      </header>

      {loadError && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">저장소에서 목록을 불러오지 못했어요. 잠시 후 새로고침해 주세요.</p>}

      {refundLoadError && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">환불 상태를 불러오지 못했어요. 실패한 환불이 있을 수 있으니 새로고침해 주세요.</p>}
      {refunds.length > 0 && <RefundAttentionPanel refunds={refunds} />}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-[1250px] text-left text-sm">
          <thead className="bg-gray-100 text-xs uppercase text-gray-600">
            <tr>
              <th className="px-3 py-2 font-semibold">등록 일시</th>
              <th className="px-3 py-2 font-semibold">상품</th>
              <th className="px-3 py-2 font-semibold">구매 링크</th>
              <th className="px-3 py-2 font-semibold">옵션</th>
              <th className="px-3 py-2 font-semibold">펀딩 상태</th>
              <th className="px-3 py-2 font-semibold">배송 정보</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 align-top">
            {rows.length === 0 && !loadError && (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-gray-400">
                  아직 등록된 펀딩이 없어요
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-3 py-3 text-gray-600">
                  {kstDateTime(r.createdAt)}
                  <div className="mt-1">
                    <a href={`/f/${r.id}`} target="_blank" rel="noreferrer" className="font-mono text-xs text-gray-400 hover:underline">
                      /f/{r.id}
                    </a>
                  </div>
                </td>
                <td className="max-w-[280px] px-3 py-3">
                  <div className="font-medium">{r.productName}</div>
                  <div className="text-xs text-gray-500">
                    {[r.mall, r.brand].filter(Boolean).join(" · ")} · {r.owner}님
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-3">
                  {r.productUrl ? (
                    <a
                      href={r.productUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      title={r.productUrl}
                      className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                    >
                      상품 구매하러 가기 ↗
                    </a>
                  ) : (
                    <span className="text-gray-400">링크 없음</span>
                  )}
                </td>
                <td className="px-3 py-3">{r.option || <span className="text-gray-400">-</span>}</td>
                <td className="whitespace-nowrap px-3 py-3">
                  <div className="font-medium">
                    {won(r.raised)} <span className="text-gray-400">/ {won(r.goal)}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-gray-200">
                      <div className={`h-full ${r.rate >= 100 ? "bg-green-500" : "bg-blue-500"}`} style={{ width: `${Math.min(100, r.rate)}%` }} />
                    </div>
                    <span className={`text-xs font-semibold ${r.rate >= 100 ? "text-green-600" : "text-blue-600"}`}>{r.rate}%</span>
                  </div>
                  {r.estimated && <div className="mt-1 text-[11px] text-gray-400">달성률 기준 추정치</div>}
                </td>
                <td className="px-3 py-3">
                  {r.deliveryRequestedAt && (
                    <div className="mb-1.5 inline-block rounded bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">배송 접수 {kstDateTime(r.deliveryRequestedAt)} · 발주 필요</div>
                  )}
                  {r.recipient || r.address ? (
                    <div className="space-y-0.5">
                      <div>
                        <span className="font-medium">{r.recipient || "-"}</span> <span className="text-gray-500">{r.phone}</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="max-w-[320px]">{r.address || "-"}</span>
                        {r.address && <CopyButton text={r.address} />}
                      </div>
                      {r.memo && <div className="text-xs text-gray-500">메모: {r.memo}</div>}
                    </div>
                  ) : (
                    <span className="text-gray-400">미입력</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Footer className="mt-8 pb-4" />
    </main>
  );
}

function RefundAttentionPanel({ refunds }: { refunds: RefundAttention[] }) {
  const failedCount = refunds.filter((r) => r.refundStatus === "failed").length;
  return (
    <section className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
      <h2 className="font-bold">
        환불 확인 필요 {refunds.length}
        {refunds.length >= REFUND_ATTENTION_LIMIT && "건 이상"}
        {refunds.length < REFUND_ATTENTION_LIMIT && "건"} · 실패 {failedCount}건
      </h2>
      <p className="mt-1 text-xs text-red-800">마감이 지난 미달 펀딩은 매일 자동 환불 때 다시 시도해요. 목표를 달성한 펀딩의 초과 금액 환불은 자동으로 다시 시도되지 않으니 토스 결제 내역을 확인해 주세요.</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead className="text-red-700">
            <tr>
              <th className="py-1 pr-3 font-semibold">상태</th>
              <th className="py-1 pr-3 font-semibold">펀딩</th>
              <th className="py-1 pr-3 font-semibold">주문번호</th>
              <th className="py-1 pr-3 font-semibold">환불 금액</th>
              <th className="py-1 font-semibold">마지막 변경</th>
            </tr>
          </thead>
          <tbody>
            {refunds.map((r) => (
              <tr key={r.orderId} className="border-t border-red-100">
                <td className="py-1.5 pr-3 font-semibold">{r.refundStatus === "failed" ? "실패" : "처리 대기"}</td>
                <td className="py-1.5 pr-3">
                  <a href={`/f/${r.shareId}`} target="_blank" rel="noreferrer" className="font-mono hover:underline">
                    {r.shareId}
                  </a>
                </td>
                <td className="py-1.5 pr-3 font-mono">{r.orderId}</td>
                <td className="py-1.5 pr-3">
                  {won(r.refundAmount)} <span className="text-red-700">/ 결제 {won(r.amount)}</span>
                </td>
                <td className="py-1.5">{r.updatedAt ? kstDateTime(r.updatedAt) : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function LoginScreen({ error, configured }: { error: boolean; configured: boolean }) {
  return (
    <main className="flex min-h-screen flex-col bg-gray-50 px-4">
      <form action="/api/admin/login" method="post" className="m-auto w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-bold text-gray-900">🔒 운영자 전용</h1>
        <p className="mt-1 text-sm text-gray-500">관리자 비밀번호를 입력해 주세요.</p>
        {!configured && <p className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-700">ADMIN_PASSWORD 환경변수가 설정되지 않아 잠겨 있어요.</p>}
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          autoFocus
          className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          placeholder="비밀번호"
        />
        {error && <p className="mt-2 text-xs text-red-600">비밀번호가 올바르지 않아요.</p>}
        <button className="mt-4 w-full rounded-lg bg-gray-900 py-2 text-sm font-semibold text-white hover:bg-gray-800">잠금 해제</button>
      </form>
      <Footer className="mt-8 pb-4" />
    </main>
  );
}
