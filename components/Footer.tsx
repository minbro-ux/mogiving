import Link from "next/link";
import { COMPANY, LEGAL_LINKS, bizInfoUrl } from "@/lib/company";
import { REFUND_NOTICE, UNDER_GOAL_NOTICE, VOUCHER_ISSUE_NOTICE } from "@/lib/policy";

/**
 * 서비스 공통 하단 사업자 정보 (app/layout.tsx에서 모든 화면에 렌더링).
 * 하단 고정 CTA가 떠 있는 화면에서는 globals.css의 .site-footer 규칙이 그만큼 하단 여백을 늘려 가리지 않게 한다.
 */
export function Footer() {
  const bizUrl = bizInfoUrl(COMPANY.businessNumber);
  const items: { label: string; value: React.ReactNode }[] = [
    { label: "상호명", value: COMPANY.name },
    { label: "대표자", value: COMPANY.ceo },
    {
      label: "사업자등록번호",
      value: COMPANY.businessNumber ? (
        <>
          {COMPANY.businessNumber}
          {bizUrl && (
            <a href={bizUrl} target="_blank" rel="noopener noreferrer" className="ml-1.5 underline underline-offset-2">
              사업자정보확인
            </a>
          )}
        </>
      ) : (
        "발급 예정"
      ),
    },
    { label: "통신판매업신고번호", value: COMPANY.mailOrderNumber || "신고 진행 중" },
    { label: "사업장 주소", value: COMPANY.address },
    {
      label: "고객센터",
      value: <a href={`tel:${COMPANY.phone.replace(/\D/g, "")}`}>{COMPANY.phone}</a>,
    },
    {
      label: "이메일",
      value: <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>,
    },
    { label: "호스팅 서비스 제공자", value: COMPANY.hostingProvider },
  ];

  return (
    <footer className="site-footer w-full border-t border-grey-200 bg-grey-100 text-[12px] leading-relaxed text-grey-500">
      <div className="mx-auto max-w-[430px] px-5 pt-6 md:max-w-3xl md:px-8 md:pt-8">
        <nav aria-label="약관 및 정책">
          <ul className="flex flex-wrap items-center gap-y-1.5 text-[13px] text-grey-600">
            {LEGAL_LINKS.map((l, i) => (
              <li key={l.href} className="flex items-center">
                {i > 0 && <span aria-hidden className="mx-2.5 text-grey-300">|</span>}
                <Link href={l.href} className={`hover:underline ${"emphasize" in l && l.emphasize ? "font-semibold text-grey-800" : ""}`}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <p className="mt-5 font-semibold text-grey-700">
          {COMPANY.name} ({COMPANY.brand})
        </p>
        <dl className="mt-2 flex flex-col gap-y-0.5 md:flex-row md:flex-wrap md:gap-x-4 md:gap-y-1">
          {items.map((it) => (
            <div key={it.label} className="flex gap-1.5">
              <dt className="shrink-0">{it.label}</dt>
              <dd className="text-grey-600">{it.value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-4 space-y-1">
          <p>{VOUCHER_ISSUE_NOTICE} {UNDER_GOAL_NOTICE} {REFUND_NOTICE}</p>
        </div>
        <p className="mt-4 text-grey-400">Copyright © 2026 {COMPANY.name} ({COMPANY.brand}). All rights reserved.</p>
      </div>
    </footer>
  );
}
