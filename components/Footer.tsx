const SUPPORT_EMAIL = "idmin.official@gmail.com";

/** 앱인토스·결제사 심사용 법적 고지. 하단 고정 버튼이 있는 화면은 className으로 충분한 하단 패딩을 넘긴다 */
export function Footer({ className = "pb-10" }: { className?: string }) {
  return (
    <footer className={`border-t border-gray-200 px-5 pt-6 text-xs leading-relaxed text-gray-500 ${className}`}>
      <div className="space-y-0.5">
        <p>서비스명: 모기빙 (MOGIVING)</p>
        <p>대표자: 조성민</p>
        <p>
          고객센터 문의:{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="underline underline-offset-2">
            {SUPPORT_EMAIL}
          </a>
        </p>
        <p>사업자등록번호: 등록 준비 중 (통신판매업신고 준비 중)</p>
      </div>
      <div className="mt-3 space-y-1">
        <p>모기빙은 펀딩 개설 및 조각 모금 중개 플랫폼입니다.</p>
        <p>목표 금액 미달성 시 모인 금액은 전액 환불됩니다. 펀딩 성공 후 상품 발주가 시작된 이후에는 단순 변심으로 인한 환불이 제한될 수 있습니다.</p>
      </div>
      <p className="mt-3">이용약관 / 개인정보처리방침은 고객센터로 문의해 주세요.</p>
      <p className="mt-3">© 2026 MOGIVING. All rights reserved.</p>
    </footer>
  );
}
