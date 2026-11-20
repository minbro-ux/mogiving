import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { LEGAL_LINKS, POLICY_EFFECTIVE_DATE } from "@/lib/company";

/**
 * 약관·개인정보처리방침·환불 정책 공통 틀 (앱과 같은 430px 흰 컬럼).
 * /terms는 세 정책을 PolicyBlock으로 한 페이지에 모두 담고, 상단 탭은 각 앵커(#terms, #privacy, #refund)로 이동한다.
 * current를 주면 그 탭을 선택 상태로 표시한다 (단독 페이지용).
 */
export function LegalPage({ title, current, children }: { title: string; current?: "terms" | "privacy" | "refund"; children: React.ReactNode }) {
  return (
    <main className="relative mx-auto w-full max-w-[430px] flex-1 bg-white shadow-[0_0_40px_rgba(0,0,0,0.06)]">
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur">
        <header className="flex h-14 items-center px-2">
          <Link href="/" aria-label="모기빙 처음으로" className="flex h-10 w-10 items-center justify-center rounded-full text-grey-800 active:bg-grey-100">
            <ChevronLeft size={24} />
          </Link>
          <span className="text-[15px] font-semibold text-grey-800">{title}</span>
        </header>

        <nav aria-label="정책 바로가기" className="no-scrollbar flex gap-2 overflow-x-auto border-b border-grey-100 px-5 pb-2.5">
          {LEGAL_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={l.anchor === current ? "page" : undefined}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium ${l.anchor === current ? "bg-grey-900 text-white" : "bg-grey-100 text-grey-600"}`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="divide-y divide-grey-100 px-5 pb-12 text-[14px] leading-[1.75] text-grey-700">{children}</div>
    </main>
  );
}

/** 정책 하나(이용약관/개인정보처리방침/환불 정책). id가 앵커가 되며, 고정 헤더+탭(약 104px)에 제목이 가리지 않게 띄운다 */
export function PolicyBlock({ id, title, intro, children }: { id: string; title: string; intro?: React.ReactNode; children: React.ReactNode }) {
  return (
    <article id={id} aria-labelledby={`${id}-title`} className="scroll-mt-[112px] py-8 first:pt-6">
      <h2 id={`${id}-title`} className="text-[22px] font-bold text-grey-900">
        {title}
      </h2>
      <p className="mt-1 text-[13px] text-grey-500">시행일: {POLICY_EFFECTIVE_DATE}</p>
      {intro && <div className="mt-5 rounded-2xl bg-grey-50 p-4 text-[13px] leading-relaxed text-grey-600">{intro}</div>}
      <div className="mt-6 space-y-8">{children}</div>
    </article>
  );
}

/** id를 주면 그 조항으로 바로 가는 앵커가 된다 (예: /terms#voucher) */
export function Section({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className={id ? "scroll-mt-[112px]" : undefined}>
      <h3 className="mb-2 text-[16px] font-bold text-grey-900">{title}</h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

/** 번호 목록 (①②③ 대신 1. 2. 3.) */
export function Ol({ children }: { children: React.ReactNode }) {
  return <ol className="list-decimal space-y-1.5 pl-5 marker:text-grey-500">{children}</ol>;
}

export function Ul({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-5 marker:text-grey-400">{children}</ul>;
}

/** 표 대신 쓰는 정보 카드. 모바일에서 가로 스크롤 없이 읽히게 한다 */
export function InfoCard({ title, rows }: { title: string; rows: [string, React.ReactNode][] }) {
  return (
    <div className="rounded-2xl border border-grey-200 p-4">
      <p className="font-semibold text-grey-900">{title}</p>
      <dl className="mt-2 space-y-1 text-[13px]">
        {rows.map(([k, v]) => (
          <div key={k} className="flex gap-3">
            <dt className="w-[72px] shrink-0 text-grey-500">{k}</dt>
            <dd className="min-w-0 flex-1 text-grey-700">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
