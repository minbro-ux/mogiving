import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { PrivacyContent } from "@/components/legal/PrivacyContent";

export const metadata: Metadata = { title: "개인정보처리방침 | 모기빙" };

/** 예전 링크 호환용 단독 페이지. 내용은 /terms#privacy와 같다 */
export default function PrivacyPolicyPage() {
  return (
    <LegalPage title="개인정보처리방침" current="privacy">
      <PrivacyContent />
    </LegalPage>
  );
}
