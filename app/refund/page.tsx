import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { RefundContent } from "@/components/legal/RefundContent";

export const metadata: Metadata = { title: "환불 및 취소 정책 | 모기빙" };

/** 예전 링크 호환용 단독 페이지. 내용은 /terms#refund와 같다 */
export default function RefundPolicyPage() {
  return (
    <LegalPage title="환불 및 취소 정책" current="refund">
      <RefundContent />
    </LegalPage>
  );
}
