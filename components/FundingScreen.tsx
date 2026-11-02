"use client";

import { useState } from "react";
import { Ban, CheckCircle2, ChevronLeft, ChevronRight, Clock, Eye, EyeOff, Lock, Map as MapIcon, MapPin, Plus, Share2, ShieldCheck, Sparkles } from "lucide-react";
import { dDay, percent, shortWon, timeAgo, won } from "@/lib/format";
import { sumAmount } from "@/lib/mock";
import { pieceInfo } from "@/lib/pieces";
import type { Funding, GiftReason, Participant, Resolution, ShippingAddress } from "@/lib/types";
import { NextWishSheet } from "./ShopScreen";
import { StakeCardSheet, StakeMapSheet } from "./StakeMap";
import { Badge, BottomCTA, Button, PieceGrid, ProductThumb, ProgressBar, Segmented, Switch } from "./ui";

export type Role = "owner" | "friend";

export function FundingScreen({
  funding,
  role,
  onRoleChange,
  onBack,
  onParticipate,
  onShare,
  onResolve,
  onToast,
  onCreateNext,
}: {
  funding: Funding;
  role: Role;
  /** 없으면 시점 토글을 숨긴다 (공유 링크 화면) */
  onRoleChange?: (r: Role) => void;
  onBack: () => void;
  onParticipate: () => void;
  onShare: () => void;
  onResolve: () => void;
  onToast: (msg: string) => void;
  /** 1차 펀딩 완판 후 다음 모금함(2탄) 생성 */
  onCreateNext: (f: Funding) => void;
}) {
  const [showAmounts, setShowAmounts] = useState(true);
  const [stakeOpen, setStakeOpen] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const [nextOpen, setNextOpen] = useState(false);
  const raised = sumAmount(funding.participants);
  const pct = percent(raised, funding.goal);
  const pieces = pieceInfo(funding.goal, raised);
  const isOwner = role === "owner";
  const { phase, product, resolution } = funding;
  const cancelled = resolution?.kind === "cancel";
  const hasStakes = funding.participants.length > 0 && !cancelled;
  const canMakeCard = isOwner && phase === "done" && resolution?.kind === "gift";
  const needsChoice = phase === "achieved" || phase === "under";
  // 목표 100% 달성 후 주인공 시점에만 다음 모금함 열기 유도
  const showNextRound = isOwner && (phase === "achieved" || resolution?.kind === "gift");

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

      {/* 시점 전환(개발·테스트용): 수령자 본인 vs 친구. 공유 링크 화면에서는 노출하지 않는다 */}
      {onRoleChange && (
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
      )}

      {/* 선물 정보 */}
      <section className="px-5 pt-4">
        <div className="flex items-center gap-2">
          <PhaseBadge funding={funding} />
          {funding.round > 1 && <Badge tone="grey">{funding.round}탄</Badge>}
          <span className="text-[13px] text-grey-500">{funding.ownerName}님의 펀딩</span>
        </div>
        <h1 className="mt-2 text-[24px] font-bold leading-tight text-grey-900">{funding.title}</h1>

        <div className="mt-5 flex gap-4 rounded-[24px] bg-grey-50 p-4">
          <ProductThumb product={product} size="md" className="!h-24 !w-24 !text-5xl" />
          <div className="min-w-0 flex-1 py-0.5">
            <p className="text-[13px] font-medium text-grey-500">
              {product.mall} · {product.brand}
            </p>
            <p className="mt-0.5 line-clamp-2 text-[15px] font-medium leading-snug text-grey-800">{product.name}</p>
            {product.option && (
              <p className="mt-1 inline-flex max-w-full rounded-md bg-white px-1.5 py-0.5 text-[12px] font-medium text-grey-600 ring-1 ring-grey-200">
                <span className="truncate">옵션 · {product.option}</span>
              </p>
            )}
            <p className="mt-1.5 text-[13px] text-grey-500">
              목표 금액 <b className="text-[15px] text-grey-900">{won(funding.goal)}</b>
            </p>
          </div>
        </div>

        {/* 배송지: 주최자 본인 화면에만 (친구 시점·공유 링크에는 데이터 자체가 없음) */}
        {isOwner && funding.shipping && <ShippingCard shipping={funding.shipping} />}

        {hasStakes && (
          <button
            onClick={() => setStakeOpen(true)}
            className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-grey-200 px-4 py-3 text-left active:bg-grey-50"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-toss-blue-light text-toss-blue">
              <MapIcon size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold text-grey-900">지분 지도 보기</span>
              <span className="block text-[12px] text-grey-500">
                {isOwner ? "누가 선물의 어느 부분을 채웠는지 확인해요" : "선물 위에서 내 자리를 확인해요"}
              </span>
            </span>
            <ChevronRight size={20} className="text-grey-400" />
          </button>
        )}
      </section>

      {/* 모금 현황: 받는 사람은 금액, 친구는 조각 수만 */}
      <section className="px-5 pt-6">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[14px] text-grey-600">{isOwner ? "지금까지 모인 금액" : "지금까지 모인 조각"}</p>
            <p className="mt-0.5 text-[28px] font-bold tracking-tight text-grey-900">
              {isOwner ? (
                won(raised)
              ) : (
                <>
                  {pieces.filled}
                  <span className="text-[18px] font-semibold text-grey-500"> / {pieces.total}조각</span>
                </>
              )}
            </p>
          </div>
          <p className={`text-[26px] font-bold ${pct >= 100 ? "text-toss-green" : "text-toss-blue"}`}>{pct}%</p>
        </div>
        <div className="mt-3">
          {isOwner ? (
            <ProgressBar value={pct} tone={pct >= 100 ? "green" : "blue"} />
          ) : (
            <PieceGrid total={pieces.total} filled={pieces.filled} />
          )}
        </div>
        <div className="mt-2.5 flex justify-between text-[13px] text-grey-500">
          <span>
            {funding.participants.length}명 참여 · 1조각 {shortWon(pieces.unit)}
          </span>
          <span>
            {raised < funding.goal ? (isOwner ? `${won(funding.goal - raised)} 남았어요` : `${pieces.remaining}조각 남았어요`) : "목표 달성! 펀딩 마감"}
          </span>
        </div>
      </section>

      {/* 상태 카드: 마감/달성/예외 */}
      <section className="px-5 pt-6">
        <StatusCard funding={funding} raised={raised} isOwner={isOwner} onResolve={onResolve} />
        {showNextRound && <NextRoundBanner round={funding.round + 1} onClick={() => setNextOpen(true)} />}
      </section>

      {/* 수령자 메시지 */}
      <section className="px-5 pt-6">
        <div className="relative rounded-[20px] bg-toss-blue-light/60 p-4 text-[15px] leading-relaxed text-grey-800">
          <p className="mb-1 text-[13px] font-semibold text-toss-blue">{funding.ownerName}님의 한마디</p>
          {funding.ownerMessage}
        </div>
      </section>

      <div className="mt-8 h-3 bg-grey-50" />

      {/* 롤링페이퍼: 받는 사람만 전체 열람, 친구는 비공개 */}
      <section className="px-5 pt-6">
        {isOwner ? (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-[20px] font-bold text-grey-900">
                롤링페이퍼 <span className="text-toss-blue">{funding.participants.length}</span>
              </h2>
              {funding.participants.length > 0 && (
                <label className="flex items-center gap-2 text-[13px] font-medium text-grey-600">
                  {showAmounts ? <Eye size={15} /> : <EyeOff size={15} />} 금액 보기
                  <Switch checked={showAmounts} onChange={setShowAmounts} />
                </label>
              )}
            </div>
            <p className="mt-1.5 flex items-center gap-1 text-[13px] text-grey-500">
              <Lock size={12} /> 메시지와 참여 금액은 받는 사람인 나에게만 보여요
            </p>

            {showAmounts && funding.participants.length > 0 && <AmountSummary participants={funding.participants} />}

            {funding.participants.length === 0 ? (
              <div className="py-14 text-center">
                <p className="text-4xl">💌</p>
                <p className="mt-3 text-[15px] text-grey-500">링크를 공유하고 첫 축하를 받아보세요</p>
              </div>
            ) : (
              <ul className="mt-4 divide-y divide-grey-100">
                {[...funding.participants].reverse().map((p) => (
                  <FeedItem key={p.id} p={p} showAmount={showAmounts} />
                ))}
              </ul>
            )}
          </>
        ) : (
          <PrivateFeed funding={funding} />
        )}
      </section>

      {/* 하단 CTA */}
      <BottomCTA>
        {isOwner ? (
          needsChoice ? (
            <Button onClick={onResolve}>선물 받는 방법 고르기</Button>
          ) : canMakeCard ? (
            <Button onClick={() => setCardOpen(true)}>
              <Sparkles size={19} /> 지분 인증 카드 공유하기
            </Button>
          ) : (
            <Button onClick={onShare} variant={phase === "done" ? "secondary" : "primary"}>
              <Share2 size={19} /> 친구에게 링크 공유하기
            </Button>
          )
        ) : phase === "active" ? (
          <Button onClick={onParticipate}>🧩 조각 선물하기</Button>
        ) : (
          <Button disabled>{cancelled ? "취소된 펀딩이에요" : "마감된 펀딩이에요"}</Button>
        )}
      </BottomCTA>

      <StakeMapSheet
        open={stakeOpen}
        funding={funding}
        viewerIsOwner={isOwner}
        onClose={() => setStakeOpen(false)}
        onMakeCard={
          canMakeCard
            ? () => {
                setStakeOpen(false);
                setCardOpen(true);
              }
            : undefined
        }
      />
      {showNextRound && (
        <NextWishSheet
          open={nextOpen}
          round={funding.round + 1}
          onClose={() => setNextOpen(false)}
          onCreate={(f) => {
            setNextOpen(false);
            onCreateNext(f);
          }}
        />
      )}
      {canMakeCard && <StakeCardSheet open={cardOpen} funding={funding} onClose={() => setCardOpen(false)} onShared={onToast} />}
    </div>
  );
}

function PhaseBadge({ funding: { phase, deadline, resolution } }: { funding: Funding }) {
  if (phase === "active")
    return (
      <Badge tone="blue">
        <Clock size={12} /> {dDay(deadline)}
      </Badge>
    );
  if (phase === "achieved") return <Badge tone="green">100% 달성</Badge>;
  if (phase === "done") return resolution?.kind === "cancel" ? <Badge tone="grey">취소됨</Badge> : <Badge tone="green">완료</Badge>;
  return (
    <Badge tone="orange">
      <Clock size={12} /> 마감
    </Badge>
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

/** 친구 시점: 다른 사람의 메시지·금액은 숨기고 참여 인원과 내 메시지만 */
function PrivateFeed({ funding }: { funding: Funding }) {
  const n = funding.participants.length;
  const mine = funding.participants.filter((p) => p.isMe);
  return (
    <>
      <h2 className="text-[20px] font-bold text-grey-900">롤링페이퍼</h2>
      <div className="mt-4 rounded-[20px] bg-grey-50 px-5 py-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-grey-500">
          <Lock size={22} />
        </div>
        <p className="mt-3 text-[16px] font-bold text-grey-900">{n > 0 ? `${n}명이 마음을 보냈어요` : "아직 도착한 마음이 없어요"}</p>
        <p className="mt-1 text-[13px] leading-relaxed text-grey-500">
          친구들의 메시지와 참여 금액은
          <br />
          {funding.ownerName}님만 볼 수 있어요
        </p>
      </div>
      {mine.length > 0 && (
        <>
          <p className="mt-6 text-[14px] font-semibold text-grey-600">내가 보낸 마음</p>
          <ul className="divide-y divide-grey-100">
            {mine.map((p) => (
              <FeedItem key={p.id} p={p} showAmount />
            ))}
          </ul>
        </>
      )}
    </>
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

function ShippingCard({ shipping: s }: { shipping: ShippingAddress }) {
  return (
    <div className="mt-3 rounded-2xl border border-grey-200 px-4 py-3">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1 text-[14px] font-semibold text-grey-800">
          <MapPin size={15} /> 선물 받을 배송지
        </p>
        <span className="flex items-center gap-1 text-[12px] text-grey-500">
          <Lock size={12} /> 나만 볼 수 있어요
        </span>
      </div>
      <p className="mt-1.5 text-[14px] text-grey-800">
        {s.name} · {s.phone}
      </p>
      <p className="mt-0.5 text-[13px] leading-snug text-grey-600">
        {s.address} {s.detail}
      </p>
      {s.memo && <p className="mt-0.5 text-[12px] text-grey-500">메모: {s.memo}</p>}
    </div>
  );
}

function StatusCard({ funding, raised, isOwner, onResolve }: { funding: Funding; raised: number; isOwner: boolean; onResolve: () => void }) {
  const { phase, resolution } = funding;

  if (phase === "active") return null;

  if (phase === "done" && resolution) return <ResolutionCard resolution={resolution} ownerName={funding.ownerName} isOwner={isOwner} />;

  const under = phase === "under";
  return (
    <div className={`rounded-[20px] p-5 ${under ? "bg-toss-orange-light" : "bg-toss-green-light"}`}>
      <p className="text-[17px] font-bold text-grey-900">{under ? "펀딩이 마감됐어요" : "목표 금액 100% 달성! 🎉"}</p>
      <p className="mt-1 text-[14px] leading-relaxed text-grey-700">
        {isOwner
          ? under
            ? `목표까지 ${won(funding.goal - raised)}이 부족해요. 차액을 결제하고 받거나, 전액 결제를 취소할 수 있어요.`
            : "펀딩이 마감됐어요. 배송지를 입력하면 쇼핑몰에 바로 주문을 넣어드려요."
          : under
            ? `${funding.ownerName}님이 선물 받을 방법을 고르고 있어요.`
            : `펀딩이 마감됐어요. ${funding.ownerName}님이 배송지를 입력하고 있어요.`}
      </p>
      {isOwner && (
        <Button size="md" className="mt-4" onClick={onResolve}>
          {under ? "선물 받는 방법 고르기" : "배송지 입력하기"}
        </Button>
      )}
    </div>
  );
}

const REASON_TEXT: Record<GiftReason, string> = {
  achieved: "목표 금액 100% 달성",
  topup: "부족한 차액을 내가 결제",
};

function ResolutionCard({ resolution: r, ownerName, isOwner }: { resolution: Resolution; ownerName: string; isOwner: boolean }) {
  if (r.kind === "cancel") {
    return (
      <div className="rounded-[20px] bg-grey-50 p-5">
        <div className="flex items-center gap-2 text-grey-700">
          <Ban size={20} />
          <span className="text-[15px] font-bold">펀딩이 취소됐어요</span>
        </div>
        <p className="mt-2 text-[14px] leading-relaxed text-grey-600">
          {isOwner
            ? `참여한 ${r.count}명의 결제 ${won(r.amount)}가 모두 승인 취소됐어요. 카드사에 따라 3~5영업일 안에 반영돼요.`
            : "펀딩이 취소되어 내 결제는 자동으로 승인 취소됐어요."}
        </p>
      </div>
    );
  }

  // 친구 시점: 금액은 숨기고 전달 완료만 안내
  if (!isOwner)
    return (
      <div className="rounded-[20px] bg-toss-green-light p-5 text-center">
        <p className="text-4xl">🎉</p>
        <p className="mt-2 text-[17px] font-bold text-grey-900">모두의 마음이 {ownerName}님께 선물로 전달됐어요</p>
        <p className="mt-1 text-[14px] text-grey-600">선물 배송이 시작됐어요 · 함께해주셔서 고마워요</p>
      </div>
    );

  const steps = ["펀딩 완료", "배송 접수", "배송 중", "배송 완료"];

  return (
    <div className="overflow-hidden rounded-[20px] border border-grey-200">
      <div className="bg-toss-blue px-5 pb-5 pt-6 text-white">
        <div className="flex h-12 w-12 animate-pop items-center justify-center rounded-full bg-white/20">
          <CheckCircle2 size={28} />
        </div>
        <p className="mt-4 text-[20px] font-bold leading-snug">
          {r.reason === "achieved" ? "축하해요! 펀딩이 100% 달성됐어요 🎉" : "선물 받을 준비가 끝났어요"}
        </p>
        <p className="mt-1.5 text-[14px] leading-relaxed text-white/85">
          {r.product.mall}에 주문하고 배송을 접수했어요.
        </p>
      </div>

      <div className="p-5">
        {/* 진행 단계 */}
        <div className="flex items-start">
          {steps.map((s, i) => {
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

        <div className="mt-4 flex gap-2.5 rounded-xl bg-grey-50 p-3.5 text-[13px] text-grey-700">
          <MapPin size={16} className="mt-0.5 shrink-0 text-grey-500" />
          <div>
            <p className="font-semibold text-grey-900">
              {r.address.name} · {r.address.phone}
            </p>
            <p className="mt-0.5">
              {r.address.address} {r.address.detail}
            </p>
          </div>
        </div>

        <dl className="mt-4 space-y-2 rounded-xl bg-grey-50 p-3.5 text-[13px]">
          <PayRow k="친구들이 모아준 금액" v={won(r.collected)} />
          {r.extraPaid ? <PayRow k="내가 결제한 차액" v={won(r.extraPaid)} /> : null}
          <PayRow k="선물 가격" v={won(r.product.price)} />
        </dl>

        <p className="mt-3 flex items-center justify-center gap-1 text-[12px] text-grey-500">
          <ShieldCheck size={13} /> 모인 금액은 현금이 아닌 선물 구매에만 쓰여요
        </p>
      </div>
    </div>
  );
}

function PayRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between text-grey-600">
      <dt>{k}</dt>
      <dd className="font-bold text-grey-900">{v}</dd>
    </div>
  );
}

/** 1순위 선물 완판 후 다음 위시리스트 모금함(2탄) 열기 유도 */
function NextRoundBanner({ round, onClick }: { round: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mt-3 flex w-full items-center gap-3.5 rounded-[20px] bg-grey-900 p-4 text-left text-white transition active:scale-[0.99]"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15">
        <Plus size={22} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] text-white/70">친구들이 아직 더 남아있나요?</span>
        <span className="mt-0.5 block text-[16px] font-bold">다음 위시리스트 모금함 열기 · {round}탄</span>
      </span>
      <ChevronRight size={20} className="shrink-0 text-white/60" />
    </button>
  );
}
