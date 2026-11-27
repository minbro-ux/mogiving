"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ChevronDown, ChevronRight, Gift, Link2, MessageCircleHeart, Share2, Sparkles, Wallet } from "lucide-react";
import { CTA_HREF, FAQS, STORIES, TAGS } from "./content";

/* ------------------------------------------------------------------ */
/* 공통 조각                                                            */
/* ------------------------------------------------------------------ */

/** 화면에 들어올 때 아래에서 살짝 떠오르는 등장 애니메이션. 동작 줄이기 설정이면 바로 보인다 */
function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: shown ? `${delay}ms` : undefined }}
      className={`transition duration-700 ease-out motion-reduce:transition-none ${
        shown ? "translate-y-0 opacity-100" : "motion-safe:translate-y-6 motion-safe:opacity-0"
      } ${className}`}
    >
      {children}
    </div>
  );
}

function CtaButton({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <Link
      href={CTA_HREF}
      className={`flex h-14 w-full items-center justify-center gap-1 rounded-2xl bg-toss-blue text-[17px] font-bold text-white shadow-[0_8px_20px_-6px_rgba(0,100,255,0.55)] transition active:scale-[0.98] active:bg-toss-blue-dark ${className}`}
    >
      {children}
    </Link>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-[14px] font-bold text-toss-blue">{children}</p>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-2 text-[25px] font-extrabold leading-[1.36] tracking-[-0.02em] text-grey-900">{children}</h2>;
}

/* ------------------------------------------------------------------ */
/* 1. 히어로                                                            */
/* ------------------------------------------------------------------ */

function PhoneMockup() {
  const percent = 85;
  return (
    <div className="relative mx-auto w-[272px]">
      {/* 은은한 배경 광 */}
      <div aria-hidden className="absolute -inset-8 rounded-full bg-toss-blue/15 blur-3xl" />

      <div className="relative rounded-[42px] bg-grey-900 p-[9px] shadow-[0_30px_60px_-20px_rgba(25,31,40,0.45)]">
        <div className="relative overflow-hidden rounded-[34px] bg-grey-50">
          {/* 노치 */}
          <div aria-hidden className="absolute left-1/2 top-2 z-10 h-[22px] w-[86px] -translate-x-1/2 rounded-full bg-grey-900" />

          <div className="px-4 pb-5 pt-11">
            <p className="text-center text-[11px] font-semibold text-grey-500">민지님의 위시리스트</p>

            {/* 상품 카드 */}
            <div className="mt-3 rounded-2xl bg-white p-3.5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-toss-blue-light to-white text-[30px]">
                  🤖
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-bold text-grey-900">신혼집 로봇청소기</p>
                  <p className="text-[12px] font-medium text-grey-500">선물 총액 1,000,000원</p>
                </div>
              </div>

              <div className="mt-3.5 flex items-end justify-between">
                <span className="text-[22px] font-extrabold text-toss-blue">{percent}%</span>
                <span className="text-[11px] font-semibold text-grey-600">850,000원 모였어요</span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-grey-100">
                <div className="intro-bar h-full rounded-full bg-gradient-to-r from-[#4D94FF] to-toss-blue" style={{ width: `${percent}%` }} />
              </div>

              <div className="mt-3 flex items-center gap-2">
                <div className="flex -space-x-1.5">
                  {["bg-[#FFD9A8]", "bg-[#C9E4FF]", "bg-[#D4F2E2]", "bg-[#FFD1D6]"].map((c, i) => (
                    <span key={i} className={`h-5 w-5 rounded-full border-2 border-white ${c}`} />
                  ))}
                </div>
                <p className="text-[10.5px] leading-tight text-grey-600">
                  대학 동기 민수 · 회사 지영 · 동네 친구 현우 등 <b className="text-grey-900">17명 참여</b>
                </p>
              </div>
            </div>

            {/* 축하 메시지 말풍선 */}
            <div className="mt-3 space-y-2">
              <Bubble who="대학 동기 민수" text="결혼 축하해! 우리 과 애들 마음 다 모았다 🎉" />
              <Bubble who="회사 지영" text="청소는 이제 로봇한테 맡기세요 ✨" right />
            </div>
          </div>
        </div>
      </div>

      {/* 떠 있는 알림 칩 */}
      <div className="intro-float absolute -right-4 top-[92px] rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-grey-800 shadow-lg">
        🎁 현우님이 3만 원 보탰어요
      </div>
      <p className="mt-3 text-center text-[11px] text-grey-400">* 이해를 돕기 위한 예시 화면입니다</p>
    </div>
  );
}

function Bubble({ who, text, right = false }: { who: string; text: string; right?: boolean }) {
  return (
    <div className={`flex flex-col ${right ? "items-end" : "items-start"}`}>
      <span className="mb-0.5 px-1 text-[9.5px] font-semibold text-grey-500">{who}</span>
      <p
        className={`max-w-[88%] rounded-2xl px-3 py-2 text-[11.5px] leading-snug ${
          right ? "rounded-tr-md bg-toss-blue text-white" : "rounded-tl-md bg-white text-grey-800 shadow-sm"
        }`}
      >
        {text}
      </p>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-toss-blue-light via-white to-white px-6 pb-16 pt-14">
      <Reveal>
        <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-[13px] font-bold text-toss-blue shadow-sm">
          <Gift size={14} strokeWidth={2.5} /> 링크 하나로 모으는 위시리스트
        </span>
        <h1 className="mt-5 text-[30px] font-extrabold leading-[1.32] tracking-[-0.03em] text-grey-900">
          25만 원짜리 선물 4개 대신,
          <br />
          <span className="text-toss-blue">진짜 갖고 싶던</span>
          <br />
          100만 원짜리 선물 1개.
        </h1>
        <p className="mt-4 text-[16px] leading-[1.6] text-grey-600">
          서로 모르는 단톡방 친구들의 마음까지
          <br />
          링크 하나로 모으는 위시리스트, <b className="text-grey-800">모기빙</b>.
        </p>
      </Reveal>

      <Reveal delay={150} className="mt-12">
        <PhoneMockup />
      </Reveal>

      <Reveal delay={250} className="mt-10">
        <CtaButton>1분 만에 내 위시리스트 만들기</CtaButton>
        <p className="mt-3 text-center text-[13px] text-grey-500">개설 무료 · 친구는 회원가입 없이 참여</p>
      </Reveal>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 2. 공감 & Before vs After                                            */
/* ------------------------------------------------------------------ */

const ROOMS = ["대학 동기방", "회사 동료방", "동네 친구방", "모임·지인방"];

function Compare() {
  return (
    <section className="bg-grey-50 px-6 py-16">
      <Reveal>
        <Eyebrow>왜 늘 그럴까요?</Eyebrow>
        <SectionTitle>
          축하해 줄 친구는 20명인데,
          <br />왜 늘 비슷한 가격대 선물만
          <br />
          받게 될까요?
        </SectionTitle>
        <p className="mt-3 text-[15.5px] leading-[1.65] text-grey-600">
          대학 동기, 회사 동료, 동네 친구… 서로 모르는 사이라 각자 따로 선물을 고르기 때문이에요.
        </p>
      </Reveal>

      {/* Before */}
      <Reveal className="mt-8">
        <div className="rounded-3xl border border-grey-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-grey-100 px-2 py-0.5 text-[12px] font-bold text-grey-600">BEFORE</span>
            <span className="text-[15px] font-bold text-grey-800">따로 받을 때</span>
          </div>
          <ul className="mt-4 space-y-2">
            {ROOMS.map((room) => (
              <li key={room} className="flex items-center justify-between rounded-xl bg-grey-50 px-3.5 py-3">
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-grey-800">{room}</p>
                  <p className="text-[12px] text-grey-500">5명 × 5만 원</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[18px] grayscale">🎁</span>
                  <span className="text-[14px] font-bold text-grey-600">25만 원 선물</span>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 rounded-xl bg-grey-100 px-4 py-3 text-center text-[14.5px] font-semibold text-grey-600">
            결국 어중간한 <b className="text-grey-800">25만 원짜리 선물 4개</b>
          </p>
        </div>
      </Reveal>

      <div className="my-4 flex justify-center text-toss-blue" aria-hidden>
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-md">
          <ArrowDown size={20} strokeWidth={2.6} />
        </span>
      </div>

      {/* After */}
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl bg-toss-blue p-5 text-white shadow-[0_16px_40px_-12px_rgba(0,100,255,0.55)]">
          <div aria-hidden className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
          <div className="relative flex items-center gap-2">
            <span className="rounded-md bg-white/20 px-2 py-0.5 text-[12px] font-bold">AFTER</span>
            <span className="text-[15px] font-bold">모기빙으로 합칠 때</span>
          </div>

          <div className="relative mt-5 flex flex-wrap justify-center gap-1.5">
            {ROOMS.map((room) => (
              <span key={room} className="rounded-full bg-white/15 px-3 py-1 text-[12.5px] font-semibold">
                {room}
              </span>
            ))}
          </div>
          <div className="relative my-3 flex flex-col items-center">
            <span aria-hidden className="h-5 w-px bg-white/50" />
            <span className="flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-[13px] font-bold text-toss-blue">
              <Link2 size={14} strokeWidth={2.6} /> 4개 단톡방에 링크 하나로 통합!
            </span>
            <span aria-hidden className="h-5 w-px bg-white/50" />
          </div>

          <div className="relative rounded-2xl bg-white p-4 text-center text-grey-900">
            <p className="text-[13px] font-semibold text-grey-500">총 20명의 마음이 모여</p>
            <p className="mt-1 text-[21px] font-extrabold leading-snug tracking-[-0.02em]">
              <span className="text-toss-blue">100만 원짜리</span>
              <br />
              진짜 갖고 싶던 선물 1개!
            </p>
            <div className="mt-3 text-[34px]">🎁</div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 3. 해결책 (차별점 3가지)                                             */
/* ------------------------------------------------------------------ */

const POINTS = [
  {
    icon: Link2,
    tone: "bg-toss-blue-light text-toss-blue",
    title: "그룹 경계 없이 하나로 통합",
    body: "단톡방마다 따로 말할 필요 없이, 링크 하나만 공유하면 모든 지인의 마음이 하나로 모여요.",
  },
  {
    icon: Wallet,
    tone: "bg-toss-green-light text-toss-green",
    title: "주는 사람은 부담 Zero",
    body: "친구는 앱 설치·회원가입 없이 1만 원, 3만 원, 5만 원 원하는 만큼만 30초 만에 보탤 수 있어요.",
    chips: ["1만 원", "3만 원", "5만 원"],
  },
  {
    icon: Gift,
    tone: "bg-toss-orange-light text-toss-orange",
    title: "모인 마음 그대로 선물 교환",
    body: "모인 모바일 선물 교환권으로 평소 눈여겨보던 고가 선물을 기분 좋게 받아보세요.",
  },
];

function Solution() {
  return (
    <section className="bg-white px-6 py-16">
      <Reveal>
        <Eyebrow>모기빙이 다른 점</Eyebrow>
        <SectionTitle>
          서로 모르는 지인들도,
          <br />내 링크 하나면
          <br />
          한 팀이 됩니다.
        </SectionTitle>
      </Reveal>

      <div className="mt-8 space-y-3">
        {POINTS.map((p, i) => (
          <Reveal key={p.title} delay={i * 90}>
            <div className="rounded-3xl bg-grey-50 p-5">
              <div className="flex items-center gap-3">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${p.tone}`}>
                  <p.icon size={22} strokeWidth={2.3} />
                </span>
                <div>
                  <p className="text-[12px] font-bold text-grey-400">POINT {i + 1}</p>
                  <h3 className="text-[17px] font-bold text-grey-900">{p.title}</h3>
                </div>
              </div>
              <p className="mt-3 text-[15px] leading-[1.65] text-grey-600">{p.body}</p>
              {p.chips && (
                <div className="mt-3 flex gap-1.5">
                  {p.chips.map((c) => (
                    <span key={c} className="rounded-full border border-grey-200 bg-white px-3 py-1 text-[13px] font-semibold text-grey-700">
                      {c}
                    </span>
                  ))}
                  <span className="rounded-full bg-toss-green px-3 py-1 text-[13px] font-semibold text-white">30초</span>
                </div>
              )}
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 4. 이용 방법                                                         */
/* ------------------------------------------------------------------ */

const STEPS = [
  { icon: Sparkles, title: "진짜 갖고 싶은 선물 등록하고", sub: "내 전용 링크 만들기" },
  { icon: Share2, title: "여러 단톡방, 인스타 스토리,", sub: "모바일 청첩장에 링크 공유하기" },
  { icon: MessageCircleHeart, title: "각기 다른 지인들의 축하 메시지와", sub: "모인 선물 교환권 받기" },
];

function HowTo() {
  return (
    <section className="bg-grey-50 px-6 py-16">
      <Reveal>
        <Eyebrow>이용 방법</Eyebrow>
        <SectionTitle>딱 3단계면 끝나요</SectionTitle>
      </Reveal>

      <ol className="relative mt-8">
        <span aria-hidden className="absolute bottom-8 left-[21px] top-8 w-0.5 bg-toss-blue/20" />
        {STEPS.map((s, i) => (
          <li key={s.title} className="relative pb-5 last:pb-0">
            <Reveal delay={i * 110} className="flex gap-4">
              <span className="z-[1] flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-toss-blue text-white shadow-[0_6px_14px_-4px_rgba(0,100,255,0.6)]">
                <s.icon size={20} strokeWidth={2.4} />
              </span>
              <div className="flex-1 rounded-2xl bg-white px-4 py-3.5 shadow-sm">
                <p className="text-[12.5px] font-bold text-toss-blue">STEP {i + 1}</p>
                <p className="mt-0.5 text-[15.5px] font-semibold leading-snug text-grey-800">
                  {s.title}
                  <br />
                  <b className="text-grey-900">{s.sub}</b>
                </p>
              </div>
            </Reveal>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 5. 활용 상황 & 예시 사례                                             */
/* ------------------------------------------------------------------ */

function Stories() {
  return (
    <section className="bg-white py-16">
      <Reveal className="px-6">
        <Eyebrow>이럴 때 쓰세요</Eyebrow>
        <SectionTitle>
          흩어지던 축하가
          <br />
          하나의 큰 선물로
        </SectionTitle>
        <div className="mt-5 flex flex-wrap gap-2">
          {TAGS.map((t) => (
            <span key={t} className="rounded-full bg-toss-blue-light px-3.5 py-1.5 text-[14px] font-semibold text-toss-blue">
              {t}
            </span>
          ))}
        </div>
      </Reveal>

      <div className="no-scrollbar mt-7 flex snap-x snap-mandatory gap-3 overflow-x-auto px-6 pb-2">
        {STORIES.map((s, i) => (
          <Reveal key={s.title} delay={i * 90} className="w-[84%] max-w-[340px] shrink-0 snap-center">
            <article className="flex h-full flex-col rounded-3xl border border-grey-200 bg-white p-5 shadow-[0_6px_20px_-12px_rgba(25,31,40,0.25)]">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold text-toss-blue">{s.tag}</span>
                {s.isExample && <span className="rounded-md bg-grey-100 px-1.5 py-0.5 text-[11px] font-semibold text-grey-500">예시</span>}
              </div>
              <div className="mt-3 text-[36px]">{s.emoji}</div>
              <p className="mt-2 text-[16.5px] font-bold leading-[1.45] text-grey-900">“{s.title}”</p>
              <p className="mt-2 flex-1 text-[14px] leading-[1.6] text-grey-600">{s.body}</p>
              <p className="mt-4 text-[13px] font-medium text-grey-400">— {s.who}</p>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 6. FAQ & 마무리                                                      */
/* ------------------------------------------------------------------ */

function Faq() {
  return (
    <section className="bg-grey-50 px-6 py-16">
      <Reveal>
        <Eyebrow>자주 묻는 질문</Eyebrow>
        <SectionTitle>궁금한 점을 모았어요</SectionTitle>
      </Reveal>

      <div className="mt-7 space-y-2.5">
        {FAQS.map((f, i) => (
          <Reveal key={f.q} delay={i * 70}>
            <details className="group rounded-2xl bg-white px-5 shadow-sm [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center gap-3 py-[18px]">
                <span className="text-[15px] font-extrabold text-toss-blue">Q{i + 1}.</span>
                <span className="flex-1 text-[15.5px] font-semibold leading-snug text-grey-900">{f.q}</span>
                <ChevronDown size={20} className="shrink-0 text-grey-400 transition-transform duration-200 group-open:rotate-180" />
              </summary>
              <div className="space-y-2 border-t border-grey-100 pb-5 pt-4 text-[14.5px] leading-[1.7] text-grey-600">
                {f.a.map((line, j) => (
                  <p key={j} className={j === 0 ? "font-medium text-grey-800" : ""}>
                    {line}
                  </p>
                ))}
              </div>
            </details>
          </Reveal>
        ))}
      </div>

      <Reveal className="mt-4">
        <Link href="/terms#refund" className="inline-flex items-center gap-0.5 text-[13px] font-medium text-grey-500 underline-offset-2 hover:underline">
          환불 및 취소 정책 전문 보기 <ChevronRight size={14} />
        </Link>
      </Reveal>
    </section>
  );
}

function Closing() {
  return (
    <section className="bg-white px-6 pb-14 pt-16 text-center">
      <Reveal>
        <div className="text-[44px]">🎁</div>
        <h2 className="mt-3 text-[24px] font-extrabold leading-[1.4] tracking-[-0.02em] text-grey-900">
          다가오는 내 기념일,
          <br />
          흩어지던 마음을 하나로 모아
          <br />
          <span className="text-toss-blue">진짜 원하는 선물</span>을 받아보세요.
        </h2>
        <CtaButton className="mt-8">무료로 위시리스트 열기</CtaButton>
      </Reveal>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 하단 고정 CTA                                                        */
/* ------------------------------------------------------------------ */

/**
 * data-bottom-cta: globals.css 규칙이 이 요소를 보고 공통 푸터 하단 여백을 늘려 버튼이 푸터 끝을 가리지 않게 한다.
 * 높이(그라데이션 24px + 버튼 56px + pb-safe)는 그 규칙의 계산값과 맞춰 둔다
 */
function StickyCta() {
  return (
    <div data-bottom-cta className="pointer-events-none fixed bottom-0 left-1/2 z-30 w-full max-w-[520px] -translate-x-1/2">
      <div className="h-6 bg-gradient-to-t from-white to-transparent" />
      <div className="pointer-events-auto bg-white px-5 pb-safe">
        <CtaButton>1분 만에 내 위시리스트 만들기</CtaButton>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function IntroLanding() {
  return (
    <>
      <main className="mx-auto w-full max-w-[520px] flex-1 overflow-x-hidden bg-white md:shadow-[0_0_40px_-20px_rgba(25,31,40,0.25)]">
        <Hero />
        <Compare />
        <Solution />
        <HowTo />
        <Stories />
        <Faq />
        <Closing />
      </main>
      <StickyCta />
      <style>{`
        @keyframes intro-bar { from { width: 0 } }
        @keyframes intro-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }
        .intro-bar { animation: intro-bar 1.4s cubic-bezier(0.22, 1, 0.36, 1) 0.4s both; }
        .intro-float { animation: intro-float 3s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .intro-bar, .intro-float { animation: none; } }
      `}</style>
    </>
  );
}
