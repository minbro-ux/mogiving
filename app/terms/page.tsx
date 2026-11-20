import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { PrivacyContent } from "@/components/legal/PrivacyContent";
import { RefundContent } from "@/components/legal/RefundContent";
import { TermsContent } from "@/components/legal/TermsContent";

export const metadata: Metadata = { title: "이용약관 · 개인정보처리방침 · 환불 정책 | 모기빙" };

/** 세 정책을 한 페이지에 모은다. 앵커: #terms, #privacy, #refund */
export default function TermsPage() {
  return (
    <LegalPage title="약관 및 정책">
      <TermsContent />
      <PrivacyContent />
      <RefundContent />
    </LegalPage>
  );
}
