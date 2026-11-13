import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { LEGAL_LINKS, POLICY_EFFECTIVE_DATE } from "@/lib/company";

/** 약관·개인정보처리방침·환불 정책 공통 틀 (앱과 같은 430px 흰 컬럼) */
export function LegalPage({ title, intro, current, children }: { title: string; intro?: React.ReactNode; current: string; children: React.ReactNode }) {
  return (
    <main className="relative mx-auto w-full max-w-[430px] flex-1 bg-white shadow-[0_0_40px_rgba(0,0,0,0.06)]">
      <header className="sticky top-0 z-20 flex h-14 items-center bg-white/95 px-2 backdrop-blur">
        <Link href="/" aria-label="모기빙 처음으로" className="flex h-10 w-10 items-center justify-center rounded-full text-grey-800 active:bg-grey-100">
          <ChevronLeft size={24} />
        </Link>
        <span className="text-[15px] font-semibold text-grey-800">{title}</span>
      </header>

      <nav aria-label="다른 정책 보기" className="no-scrollbar flex gap-2 overflow-x-auto px-5 pb-2">
        {LEGAL_LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={l.href === current ? "page" : undefined}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium ${l.href === current ? "bg-grey-900 text-white" : "bg-grey-100 text-grey-600"}`}
          >
            {l.label}
          </Link>
        ))}
      </nav>

      <article className="px-5 pb-12 pt-5 text-[14px] leading-[1.75] text-grey-700">
        <h1 className="text-[22px] font-bold text-grey-900">{title}</h1>
        <p className="mt-1 text-[13px] text-grey-500">시행일: {POLICY_EFFECTIVE_DATE}</p>
        {intro && <div className="mt-5 rounded-2xl bg-grey-50 p-4 text-[13px] leading-relaxed text-grey-600">{intro}</div>}
        <div className="mt-6 space-y-8">{children}</div>
      </article>
    </main>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-[16px] font-bold text-grey-900">{title}</h2>
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
