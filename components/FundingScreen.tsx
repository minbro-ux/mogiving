"use client";

import { useState } from "react";
import { CheckCircle2, ChevronLeft, Clock, ExternalLink, Eye, EyeOff, Lock, Share2, ShieldCheck, Wallet } from "lucide-react";
import { dDay, percent, timeAgo, won } from "@/lib/format";
import { sumAmount } from "@/lib/mock";
import type { Funding, Participant, Resolution } from "@/lib/types";
import { Badge, BottomCTA, Button, ProductThumb, ProgressBar, Segmented, Switch } from "./ui";

export type Role = "owner" | "friend";

export function FundingScreen({
  funding,
  role,
  onRoleChange,
  onBack,
  onParticipate,
  onShare,
  onResolve,
}: {
  funding: Funding;
  role: Role;
  onRoleChange: (r: Role) => void;
  onBack: () => void;
  onParticipate: () => void;
  onShare: () => void;
  onResolve: () => void;
}) {
  const [showAmounts, setShowAmounts] = useState(true);
  const raised = sumAmount(funding.participants);
  const pct = percent(raised, funding.goal);
  const isOwner = role === "owner";
  const { phase, product } = funding;

  return (
    <div className="min-h-dvh bg-white pb-36">
      {/* 상단 내비게이션 */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between bg-white/95 px-2 backdrop-blur">
        <button onClick={onBack} className="rounded-full p-2 text-grey-800 active:bg-grey-100" aria-label="선물 고르기로">
          <ChevronLeft size={26} />
        </button>
        <span className="text-[17px] font-bold text-grey-900">모기빙</span>
        <button onClick={onShare} className="rounded-full p-2.5 text-grey-800 active:bg-grey-100" aria-label="공유">
          <Share2 size={21} />
        </button>
      </header>

      {/* 시점 전환: 수령자 본인 vs 친구 */}
      <div className="px-5 pb-2">
        <Segmented
          value={role}
          onChange={onRoleChange}
          options={[
            { value: "owner", label: "🙋 받는 사람(나)" },
            { value: "friend", label: "👥 친구 시점" },
          ]}
        />
      </div>

      {/* 선물 정보 */}
      <section className="px-5 pt-4">
        <div className="flex items-center gap-2">
          <Badge tone={phase === "active" ? "blue" : phase === "done" ? "green" : "orange"}>
            <Clock size={12} />
            {phase === "active" ? dDay(funding.deadline) : phase === "done" ? "완료" : "마감"}
          </Badge>
          <span className="text-[13px] text-grey-500">{funding.ownerName}님의 펀딩</span>
        </div>
        <h1 className="mt-2 text-[24px] font-bold leading-tight text-grey-900">{funding.title}</h1>

        <div className="mt-5 flex gap-4 rounded-[24px] bg-grey-50 p-4">
          <ProductThumb product={product} size="md" className="!h-24 !w-24 !text-5xl" />
          <div className="min-w-0 flex-1 py-0.5">
            <p className="text-[13px] font-medium text-grey-500">{product.mall} · {product.brand}</p>
            <p className="mt-0.5 line-clamp-2 text-[15px] font-medium leading-snug text-grey-800">{product.name}</p>
            <p className="mt-1.5 text-[13px] text-grey-500">
              목표 금액 <b className="text-[15px] text-grey-900">{won(funding.goal)}</b>
            </p>
          </div>
        </div>
      </section>

      {/* 모금 현황 */}
      <section className="px-5 pt-6">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[14px] text-grey-600">지금까지 모인 금액</p>
            <p className="mt-0.5 text-[28px] font-bold tracking-tight text-grey-900">{won(raised)}</p>
          </div>
          <p className={`text-[26px] font-bold ${pct >= 100 ? "text-toss-green" : "text-toss-blue"}`}>{pct}%</p>
        </div>
        <div className="mt-3">
          <ProgressBar value={pct} tone={pct > 100 ? "orange" : pct === 100 ? "green" : "blue"} />
        </div>
        <div className="mt-2.5 flex justify-between text-[13px] text-grey-500">
          <span>{funding.participants.length}명 참여</span>
          <span>
            {raised < funding.goal
              ? `${won(funding.goal - raised)} 남았어요`
              : raised > funding.goal
                ? `${won(raised - funding.goal)} 초과 달성`
                : "목표 달성!"}
          </span>
        </div>
      </section>

      {/* 상태 카드: 마감/달성/예외 */}
      <section className="px-5 pt-6">
        <StatusCard funding={funding} raised={raised} isOwner={isOwner} onResolve={onResolve} />
      </section>

      {/* 수령자 메시지 */}
      <section className="px-5 pt-6">
        <div className="relative rounded-[20px] bg-toss-blue-light/60 p-4 text-[15px] leading-relaxed text-grey-800">
          <p className="mb-1 text-[13px] font-semibold text-toss-blue">{funding.ownerName}님의 한마디</p>
          {funding.ownerMessage}
        </div>
      </section>

      <div className="mt-8 h-3 bg-grey-50" />

      {/* 소셜 피드 */}
      <section className="px-5 pt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-[20px] font-bold text-grey-900">
            축하 메시지 <span className="text-toss-blue">{funding.participants.length}</span>
          </h2>
          {isOwner && funding.participants.length > 0 && (
            <label className="flex items-center gap-2 text-[13px] font-medium text-grey-600">
              {showAmounts ? <Eye size={15} /> : <EyeOff size={15} />} 금액 보기
              <Switch checked={showAmounts} onChange={setShowAmounts} />
            </label>
          )}
        </div>
        <p className="mt-1.5 flex items-center gap-1 text-[13px] text-grey-500">
          <Lock size={12} />
          {isOwner ? "참여 금액은 받는 사람인 나에게만 보여요" : "참여 금액은 받는 사람에게만 공개돼요"}
        </p>

        {isOwner && showAmounts && funding.participants.length > 0 && <AmountSummary participants={funding.participants} />}

        {funding.participants.length === 0 ? (
          <div className="py-14 text-center">
            <p className="text-4xl">💌</p>
            <p className="mt-3 text-[15px] text-grey-500">
              {isOwner ? "링크를 공유하고 첫 축하를 받아보세요" : "첫 번째로 축하를 전해보세요"}
            </p>
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-grey-100">
            {[...funding.participants].reverse().map((p) => (
              <FeedItem key={p.id} p={p} showAmount={isOwner && showAmounts} />
            ))}
          </ul>
        )}
      </section>

      {/* 하단 CTA */}
      <BottomCTA>
        {isOwner ? (
          phase === "under" || phase === "over" ? (
            <Button onClick={onResolve}>선물 받는 방법 고르기</Button>
          ) : (
            <Button onClick={onShare} variant={phase === "done" ? "secondary" : "primary"}>
              <Share2 size={19} /> 친구에게 링크 공유하기
            </Button>
          )
        ) : phase === "active" ? (
          <Button onClick={onParticipate}>🎁 선물 펀딩 참여하기</Button>
        ) : (
          <Button disabled>마감된 펀딩이에요</Button>
        )}
      </BottomCTA>
    </div>
  );
}

const AVATAR_COLORS = ["#E8F1FF", "#FFEEEE", "#E5F8EF", "#FFF3E0", "#F3EEFF", "#E9F7FB"];

function FeedItem({ p, showAmount }: { p: Participant; showAmount: boolean }) {
  const color = AVATAR_COLORS[p.nickname.charCodeAt(0) % AVATAR_COLORS.length];
  return (
    <li className="flex gap-3 py-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[15px] font-bold text-grey-700" style={{ backgroundColor: color }}>
        {p.nickname.slice(0, 1)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[15px] font-semibold text-grey-900">{p.nickname}</span>
          {p.isMe && <Badge tone="blue">나</Badge>}
          <span className="text-[12px] text-grey-400">{timeAgo(p.createdAt)}</span>
        </div>
        <p className="mt-1 text-[15px] leading-relaxed text-grey-700">{p.message}</p>
      </div>
      {showAmount && <span className="shrink-0 pt-0.5 text-[15px] font-bold text-toss-blue">+{won(p.amount)}</span>}
    </li>
  );
}

function AmountSummary({ participants }: { participants: Participant[] }) {
  const amounts = participants.map((p) => p.amount);
  const total = amounts.reduce((a, b) => a + b, 0);
  return (
    <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-grey-50 p-4 text-center">
      {[
        ["총 후원", won(total)],
        ["평균", won(Math.round(total / amounts.length / 100) * 100)],
        ["최고", won(Math.max(...amounts))],
      ].map(([k, v]) => (
        <div key={k}>
          <p className="text-[12px] text-grey-500">{k}</p>
          <p className="mt-0.5 text-[14px] font-bold text-grey-900">{v}</p>
        </div>
      ))}
    </div>
  );
}

/* --------------------------------- 상태 카드 --------------------------------- */

function StatusCard({ funding, raised, isOwner, onResolve }: { funding: Funding; raised: number; isOwner: boolean; onResolve: () => void }) {
  const { phase, resolution } = funding;

  if (phase === "active") return null;

  if (phase === "done" && resolution) return <ResolutionCard resolution={resolution} ownerName={funding.ownerName} isOwner={isOwner} />;

  const under = phase === "under";
  return (
    <div className={`rounded-[20px] p-5 ${under ? "bg-toss-orange-light" : "bg-toss-green-light"}`}>
      <p className="text-[17px] font-bold text-grey-900">
        {under ? "펀딩이 마감됐어요" : "목표보다 더 많이 모였어요! 🎉"}
      </p>
      <p className="mt-1 text-[14px] leading-relaxed text-grey-700">
        {under
          ? `목표까지 ${won(funding.goal - raised)}이 부족해요.`
          : `목표 금액보다 ${won(raised - funding.goal)}이 더 모였어요.`}{" "}
        {isOwner ? "선물을 어떻게 받을지 골라주세요." : `${funding.ownerName}님이 선물 받는 방법을 고르고 있어요.`}
      </p>
      {isOwner && (
        <Button size="md" variant={under ? "primary" : "primary"} className="mt-4" onClick={onResolve}>
          선물 받는 방법 고르기
        </Button>
      )}
    </div>
  );
}

const PAYOUT_STEPS = ["펀딩 마감", "토스머니 송금", "직접 구매"];

const REASON_TEXT: Record<Extract<Resolution, { kind: "gift" }>["reason"], string> = {
  achieved: "목표 금액 100% 달성",
  recommend: "모인 금액에 맞춘 추천 선물로 변경",
  topup: "부족한 금액을 내가 보태서 구매",
  refund: "원래 선물 구매 + 남은 금액 보관",
  upgrade: "초과 금액으로 선물 업그레이드",
};

function ResolutionCard({ resolution: r, ownerName, isOwner }: { resolution: Resolution; ownerName: string; isOwner: boolean }) {
  if (r.kind === "cash") {
    return (
      <div className="rounded-[20px] bg-grey-50 p-5">
        <div className="flex items-center gap-2 text-toss-blue">
          <Wallet size={20} />
          <span className="text-[15px] font-bold">{r.method === "toss-money" ? "토스머니로 받았어요" : "토스포인트로 받았어요"}</span>
        </div>
        <p className="mt-2 text-[26px] font-bold text-grey-900">{won(r.amount)}</p>
        <p className="mt-1 text-[13px] text-grey-500">
          {isOwner ? "토스 홈 > 내 자산에서 바로 확인할 수 있어요" : "모인 마음이 잘 전달됐어요"}
        </p>
      </div>
    );
  }

  // 친구 시점: 금액은 숨기고 전달 완료만 안내
  if (!isOwner)
    return (
      <div className="rounded-[20px] bg-toss-green-light p-5 text-center">
        <p className="text-4xl">🎉</p>
        <p className="mt-2 text-[17px] font-bold text-grey-900">모두의 마음이 {ownerName}님께 전달됐어요</p>
        <p className="mt-1 text-[14px] text-grey-600">함께해주셔서 고마워요</p>
      </div>
    );

  return (
    <div className="overflow-hidden rounded-[20px] border border-grey-200">
      <div className="bg-toss-blue px-5 pb-5 pt-6 text-white">
        <div className="flex h-12 w-12 animate-pop items-center justify-center rounded-full bg-white/20">
          <CheckCircle2 size={28} />
        </div>
        <p className="mt-4 text-[20px] font-bold leading-snug">
          {r.reason === "achieved" ? "축하해요! 펀딩이 100% 달성됐어요 🎉" : "정산이 완료됐어요"}
        </p>
        <p className="mt-1.5 text-[14px] leading-relaxed text-white/85">
          펀딩 금액이 {ownerName}님의 토스머니(계좌)로
          <br />
          즉시 안전하게 송금 완료되었어요.
        </p>
        <p className="mt-4 text-[13px] text-white/70">송금된 금액</p>
        <p className="text-[30px] font-bold tracking-tight">{won(r.payout)}</p>
      </div>

      <div className="p-5">
        {/* 정산 단계 */}
        <div className="flex items-start">
          {PAYOUT_STEPS.map((s, i) => {
            const done = i <= 1;
            return (
              <div key={s} className="relative flex flex-1 flex-col items-center">
                {i > 0 && <span className={`absolute right-1/2 top-[11px] h-[2px] w-full ${done ? "bg-toss-blue" : "bg-grey-200"}`} />}
                <span className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full ${done ? "bg-toss-blue text-white" : "bg-grey-200 text-grey-400"}`}>
                  {done ? <CheckCircle2 size={16} /> : <span className="h-2 w-2 rounded-full bg-white" />}
                </span>
                <span className={`mt-1.5 text-[12px] font-medium ${done ? "text-grey-900" : "text-grey-400"}`}>{s}</span>
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex items-center gap-3">
          <ProductThumb product={r.product} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold text-grey-900">{r.product.name}</p>
            <p className="text-[13px] text-grey-500">{REASON_TEXT[r.reason]}</p>
          </div>
        </div>

        <dl className="mt-4 space-y-2 rounded-xl bg-grey-50 p-3.5 text-[13px]">
          <PayRow k="친구들이 모아준 금액" v={won(r.payout - (r.extraPaid ?? 0))} />
          {r.extraPaid ? <PayRow k="내가 보탠 금액" v={won(r.extraPaid)} /> : null}
          <PayRow k="선물 가격" v={won(r.product.price)} />
          {r.leftover ? <PayRow k="구매 후 남는 금액" v={won(r.leftover)} highlight /> : null}
        </dl>

        {r.product.url && (
          <a
            href={r.product.url}
            target="_blank"
            rel="noreferrer"
            className="mt-4 flex h-12 w-full items-center justify-center gap-1.5 rounded-xl bg-toss-blue-light text-[15px] font-semibold text-toss-blue active:bg-[#D6E6FF]"
          >
            {r.product.mall}에서 선물 구매하기 <ExternalLink size={16} />
          </a>
        )}
        <p className="mt-3 flex items-center justify-center gap-1 text-[12px] text-grey-500">
          <ShieldCheck size={13} /> 본인 인증된 수령자 계좌로만 정산돼요
        </p>
      </div>
    </div>
  );
}

function PayRow({ k, v, highlight }: { k: string; v: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between text-grey-600">
      <dt>{k}</dt>
      <dd className={`font-bold ${highlight ? "text-toss-blue" : "text-grey-900"}`}>{v}</dd>
    </div>
  );
}
