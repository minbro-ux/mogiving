"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, Check } from "lucide-react";
import { Footer } from "@/components/Footer";
import { Spinner } from "@/components/ui";
import { rememberMyContribution } from "@/lib/contribute";
import { won } from "@/lib/format";
import { type ConfirmFail, type ConfirmOk, confirmPayment } from "@/lib/payment";

const SUPPORT_EMAIL = "idmin.official@gmail.com";

const FAIL_TEXT: Record<string, string> = {
  funding_closed: "결제를 진행하는 사이 펀딩이 마감됐어요. 결제는 청구되지 않았어요.",
  amount_over_remaining: "그사이 남은 금액이 줄었어요. 결제는 청구되지 않았으니 금액을 다시 선택해 주세요.",
  payment_rejected: "결제가 승인되지 않았어요. 결제는 청구되지 않았어요.",
  amount_mismatch: "결제 금액이 주문과 달라 승인하지 않았어요.",
  order_failed: "이미 실패 처리된 결제예요. 처음부터 다시 시도해 주세요.",
};

function Result({ tone, title, children, shareId }: { tone: "ok" | "warn"; title: string; children: React.ReactNode; shareId?: string }) {
  return (
    <div className="flex flex-col items-center px-5 py-16 text-center">
      <div className={`flex h-16 w-16 items-center justify-center rounded-full text-white ${tone === "ok" ? "animate-pop bg-toss-blue" : "bg-toss-orange"}`}>
        {tone === "ok" ? <Check size={34} strokeWidth={3} /> : <AlertCircle size={34} />}
      </div>
      <h1 className="mt-6 text-[22px] font-bold text-grey-900">{title}</h1>
      <div className="mt-2 text-[15px] leading-relaxed text-grey-600">{children}</div>
      <a href={shareId ? `/f/${encodeURIComponent(shareId)}` : "/"} className="mt-8 flex h-14 w-full items-center justify-center rounded-2xl bg-toss-blue text-[17px] font-bold text-white">
        {shareId ? "펀딩으로 돌아가기" : "처음으로"}
      </a>
    </div>
  );
}

function PaySuccess() {
  const params = useSearchParams();
  const paymentKey = params.get("paymentKey") ?? "";
  const orderId = params.get("orderId") ?? "";
  const amount = Number(params.get("amount"));
  const [result, setResult] = useState<ConfirmOk | ConfirmFail | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!paymentKey || !orderId || !Number.isInteger(amount)) {
      setResult({ ok: false, error: "bad_request", retryable: false });
      return;
    }
    void confirmPayment({ paymentKey, orderId, amount }).then((r) => {
      if (r.ok && r.contribution) rememberMyContribution(r.shareId, r.contribution);
      setResult(r);
    });
  }, [paymentKey, orderId, amount]);

  if (!result)
    return (
      <div className="flex flex-col items-center py-24">
        <Spinner className="!h-10 !w-10 !border-4" />
        <p className="mt-6 text-[20px] font-bold text-grey-900">결제를 확인하고 있어요</p>
        <p className="mt-1.5 text-[15px] text-grey-500">창을 닫지 말고 잠시만 기다려 주세요</p>
      </div>
    );

  if (!result.ok) {
    // 일시 오류가 계속된 경우: 승인 여부를 확정할 수 없으므로 청구되지 않았다고 말하지 않는다
    if (result.retryable)
      return (
        <Result tone="warn" title="결제 확인이 늦어지고 있어요" shareId={result.shareId}>
          <p>이 화면을 새로고침하면 안전하게 다시 확인해요. 중복 결제되지 않아요.</p>
          <p className="mt-2 text-[13px] text-grey-500">
            계속 안 되면 {SUPPORT_EMAIL}로 주문번호를 보내 주세요
            <br />
            {orderId}
          </p>
        </Result>
      );
    return (
      <Result tone="warn" title="선물을 완료하지 못했어요" shareId={result.shareId}>
        {(result.error && FAIL_TEXT[result.error]) || "결제를 확인하지 못했어요. 고객센터로 문의해 주세요."}
      </Result>
    );
  }

  const { refundAmount, refundStatus, recordedAmount, shareId } = result;
  // 나중에 이 화면을 다시 열었을 때: 주최자가 미달 펀딩을 취소한 결제
  if (recordedAmount > 0 && refundAmount >= result.amount)
    return (
      <Result tone="warn" title="펀딩이 취소됐어요" shareId={shareId}>
        {refundStatus === "done" ? `결제한 ${won(result.amount)}이 수수료까지 전액 취소됐어요. 카드사에 따라 3~5영업일 안에 반영돼요.` : `결제한 ${won(result.amount)}을 전액 취소하고 있어요.`}
      </Result>
    );
  if (refundAmount > 0 && refundStatus !== "done")
    return (
      <Result tone="warn" title="환불 처리가 필요해요" shareId={shareId}>
        <p>펀딩이 먼저 마감돼 {won(refundAmount)}을 자동으로 취소하지 못했어요. 이 화면을 새로고침하면 다시 시도해요.</p>
        <p className="mt-2 text-[13px] text-grey-500">
          계속 안 되면 {SUPPORT_EMAIL}로 주문번호를 보내 주세요
          <br />
          {orderId}
        </p>
      </Result>
    );
  if (recordedAmount === 0)
    return (
      <Result tone="warn" title="펀딩이 먼저 마감됐어요" shareId={shareId}>
        결제한 {won(refundAmount)}은 자동으로 취소됐어요. 카드사에 따라 3~5영업일 안에 반영돼요.
      </Result>
    );
  return (
    <Result tone="ok" title="조각을 선물했어요" shareId={shareId}>
      <p>{won(recordedAmount)}이 펀딩에 담기고 축하 메시지가 전달됐어요.</p>
      {refundAmount > 0 && <p className="mt-2">목표 금액을 넘은 {won(refundAmount)}은 자동으로 취소됐어요.</p>}
      <p className="mt-2 text-[13px] text-grey-500">참여 금액과 메시지는 받는 분에게만 보여요.</p>
    </Result>
  );
}

/** 토스페이먼츠 결제창 성공 후 돌아오는 화면 (?paymentKey&orderId&amount). 여기서 서버 승인을 호출해야 결제가 완료된다 */
export default function PaySuccessPage() {
  return (
    <main className="relative mx-auto min-h-dvh max-w-[430px] bg-white shadow-[0_0_40px_rgba(0,0,0,0.06)]">
      <Suspense fallback={null}>
        <PaySuccess />
      </Suspense>
      <Footer />
    </main>
  );
}
