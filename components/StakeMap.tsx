"use client";

import { useMemo, useState } from "react";
import { Download, Instagram, MessageCircle, Sparkles } from "lucide-react";
import { won } from "@/lib/format";
import { sumAmount } from "@/lib/mock";
import { pieceInfo } from "@/lib/pieces";
import type { Funding, Product } from "@/lib/types";
import { Badge, BottomSheet, Button, ProductThumb, Switch } from "./ui";

const STAKE_COLORS = ["#0064FF", "#F04452", "#03B26C", "#FE9800", "#8B5CF6", "#06B6D4", "#EC4899", "#65A30D"];

export type Stake = { key: string; name: string; amount: number; ratio: number; color: string; isMe?: boolean; isOwner?: boolean };

/**
 * 참여자별 금액을 닉네임 단위로 합산해 지분 비율 계산. 받는 사람이 직접 낸 차액도 지분에 포함.
 * 비율의 분모는 '모인 금액'이 아니라 선물 목표 금액 (69만 원 중 3만 원 → 4.3%)
 */
export function computeStakes(f: Funding): Stake[] {
  const byName = new Map<string, { amount: number; isMe?: boolean }>();
  for (const p of f.participants) {
    const prev = byName.get(p.nickname);
    byName.set(p.nickname, { amount: (prev?.amount ?? 0) + p.amount, isMe: prev?.isMe || p.isMe });
  }
  const rows = [...byName].map(([name, v]) => ({ key: name, name, ...v, isOwner: false }));
  if (f.resolution?.kind === "gift" && f.resolution.extraPaid)
    rows.push({ key: "__owner", name: f.ownerName, amount: f.resolution.extraPaid, isMe: false, isOwner: true });

  const total = Math.max(f.goal, rows.reduce((s, r) => s + r.amount, 0)) || 1;
  return rows
    .sort((a, b) => b.amount - a.amount)
    .map((r, i) => ({ ...r, ratio: r.amount / total, color: STAKE_COLORS[i % STAKE_COLORS.length] }));
}

/** 목표 금액 대비 비율 → "4.3", "12", "<0.1" (10% 미만은 소수 첫째 자리까지) */
export function ratioPct(ratio: number) {
  const pct = ratio * 100;
  if (pct > 0 && pct < 0.1) return "<0.1";
  return pct < 10 ? String(Math.round(pct * 10) / 10) : String(Math.round(pct));
}

export const stakePct = (s: Stake) => ratioPct(s.ratio);

/** 아직 모이지 않은 잔여 지분 (목표 금액 대비) */
export function remainingStake(f: Funding) {
  const paid = sumAmount(f.participants) + (f.resolution?.kind === "gift" ? f.resolution.extraPaid ?? 0 : 0);
  const amount = Math.max(0, f.goal - paid);
  return { amount, ratio: f.goal > 0 ? amount / f.goal : 0, pieces: pieceInfo(f.goal, paid).remaining };
}

/* ------------------------------ 트리맵 레이아웃 ------------------------------ */

type Rect = { x: number; y: number; w: number; h: number };

/** 큰 지분부터 금액 합이 절반이 되는 지점에서 긴 변 방향으로 반복 분할 (단위: %) */
function treemap(values: number[], r: Rect): Rect[] {
  if (values.length === 0) return [];
  if (values.length === 1) return [r];
  const total = values.reduce((a, b) => a + b, 0);
  let split = 1;
  let acc = 0;
  let best = Infinity;
  for (let k = 1; k < values.length; k++) {
    acc += values[k - 1];
    const diff = Math.abs(acc - total / 2);
    if (diff < best) {
      best = diff;
      split = k;
    }
  }
  const a = values.slice(0, split);
  const ratio = a.reduce((s, v) => s + v, 0) / total;
  const [ra, rb]: Rect[] =
    r.w >= r.h
      ? [
          { ...r, w: r.w * ratio },
          { ...r, x: r.x + r.w * ratio, w: r.w * (1 - ratio) },
        ]
      : [
          { ...r, h: r.h * ratio },
          { ...r, y: r.y + r.h * ratio, h: r.h * (1 - ratio) },
        ];
  return [...treemap(a, ra), ...treemap(values.slice(split), rb)];
}

/* ------------------------------ 제품 위 지분 라인 ------------------------------ */

type StakeLabel = { name: string; pct?: string } | null;

export function StakeOverlay({
  product,
  stakes,
  label,
  muted,
  remaining = 0,
  remainingLabel,
  className = "",
}: {
  product: Product;
  stakes: Stake[];
  label: (s: Stake) => StakeLabel;
  muted?: (s: Stake) => boolean;
  /** 아직 모이지 않은 금액. 사진에서 이만큼은 흑백·회색 영역으로 남긴다 */
  remaining?: number;
  remainingLabel?: string;
  className?: string;
}) {
  // 사진 전체 = 목표 금액. 참여 지분을 큰 순서로 채우고, 남은 금액은 마지막(오른쪽·아래) 영역으로 둔다
  const rects = useMemo(
    () => treemap([...stakes.map((s) => s.amount), ...(remaining > 0 ? [remaining] : [])], { x: 0, y: 0, w: 100, h: 100 }),
    [stakes, remaining],
  );
  const restRect = remaining > 0 ? rects[stakes.length] : undefined;
  return (
    <div className={`relative ${className}`}>
      <ProductThumb product={product} size="xl" className="!rounded-[24px]" />
      <div className="absolute inset-0 animate-fade-in overflow-hidden rounded-[24px]">
        {stakes.map((s, i) => {
          const r = rects[i];
          const off = muted?.(s);
          const l = label(s);
          const area = r.w * r.h;
          const wide = r.w > 34 && area > 1200;
          return (
            <div
              key={s.key}
              className="absolute flex items-center justify-center p-1"
              style={{
                left: `${r.x}%`,
                top: `${r.y}%`,
                width: `${r.w}%`,
                height: `${r.h}%`,
                backgroundColor: off ? "rgba(255,255,255,0.45)" : `${s.color}24`,
                boxShadow: `inset 0 0 0 1.5px ${off ? "rgba(139,149,161,0.5)" : s.color}`,
              }}
            >
              {l && area > 80 && (
                <span
                  className="max-w-full truncate rounded-full px-2 py-0.5 text-center text-[11px] font-bold leading-tight text-white shadow-sm"
                  style={{ backgroundColor: s.color }}
                >
                  {wide && l.pct ? `지분 ${l.pct}% - ${l.name}` : l.pct ? `${l.pct}% ${l.name}` : l.name}
                </span>
              )}
            </div>
          );
        })}
        {restRect && (
          <div
            className="absolute flex items-center justify-center p-1"
            style={{
              left: `${restRect.x}%`,
              top: `${restRect.y}%`,
              width: `${restRect.w}%`,
              height: `${restRect.h}%`,
              // 남은 조각: 사진을 흑백으로 바래게 해서 아직 채워지지 않은 자리임을 보여준다
              backdropFilter: "grayscale(1)",
              WebkitBackdropFilter: "grayscale(1)",
              backgroundColor: "rgba(229,232,235,0.72)",
              boxShadow: "inset 0 0 0 1.5px rgba(139,149,161,0.55)",
              backgroundImage: "repeating-linear-gradient(135deg, rgba(139,149,161,0.16) 0 6px, transparent 6px 12px)",
            }}
          >
            {remainingLabel && restRect.w * restRect.h > 80 && (
              <span className="max-w-full truncate rounded-full bg-white/90 px-2 py-0.5 text-center text-[11px] font-bold leading-tight text-grey-600 shadow-sm">
                {remainingLabel}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* --------------------------------- 지분 지도 --------------------------------- */

export function StakeMapSheet({
  open,
  funding,
  viewerIsOwner,
  onClose,
  onMakeCard,
}: {
  open: boolean;
  funding: Funding;
  viewerIsOwner: boolean;
  onClose: () => void;
  /** 펀딩 완료 후 받는 사람에게만 전달 */
  onMakeCard?: () => void;
}) {
  const stakes = useMemo(() => computeStakes(funding), [funding]);
  const rest = remainingStake(funding);
  const me = stakes.find((s) => s.isMe);
  const filledPct = ratioPct(1 - rest.ratio);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="지분 지도"
      description={viewerIsOwner ? "친구들이 보탠 만큼 선물 위에 자리를 나눴어요" : "다른 친구의 지분은 가려지고, 내 자리만 보여요"}
      footer={
        viewerIsOwner && onMakeCard ? (
          <Button onClick={onMakeCard}>
            <Sparkles size={19} /> 지분 인증 카드 만들기
          </Button>
        ) : undefined
      }
    >
      <StakeOverlay
        className="mt-4"
        product={funding.product}
        stakes={stakes}
        label={(s) => (viewerIsOwner ? { name: s.name, pct: stakePct(s) } : s.isMe ? { name: "나", pct: stakePct(s) } : null)}
        muted={viewerIsOwner ? undefined : (s) => !s.isMe}
        remaining={rest.amount}
        remainingLabel={`남은 ${rest.pieces}조각 · ${ratioPct(rest.ratio)}%`}
      />

      <div className="mt-3 flex items-center justify-between text-[13px]">
        <span className="font-semibold text-grey-800">목표 {won(funding.goal)} 중 {filledPct}% 채워졌어요</span>
        {rest.amount > 0 && (
          <span className="flex items-center gap-1.5 text-grey-500">
            <span className="h-2.5 w-2.5 rounded-[3px] border border-grey-400 bg-grey-200" />
            남은 조각 {rest.pieces}개
          </span>
        )}
      </div>

      {viewerIsOwner ? (
        <>
          <ul className="mt-5 space-y-3">
            {stakes.map((s) => (
              <li key={s.key} className="flex items-center gap-3">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="flex min-w-0 flex-1 items-center gap-1.5 text-[15px] font-semibold text-grey-900">
                  <span className="truncate">{s.name}</span>
                  {s.isOwner && <Badge tone="grey">내가 낸 차액</Badge>}
                </span>
                <span className="text-[13px] text-grey-500">{won(s.amount)}</span>
                <span className="w-12 text-right text-[15px] font-bold" style={{ color: s.color }}>
                  {stakePct(s)}%
                </span>
              </li>
            ))}
            {rest.amount > 0 && (
              <li className="flex items-center gap-3 border-t border-dashed border-grey-200 pt-3">
                <span className="h-3 w-3 shrink-0 rounded-full border border-grey-400 bg-grey-200" />
                <span className="min-w-0 flex-1 text-[15px] font-semibold text-grey-500">남은 조각 {rest.pieces}개</span>
                <span className="text-[13px] text-grey-400">{won(rest.amount)}</span>
                <span className="w-12 text-right text-[15px] font-bold text-grey-400">{ratioPct(rest.ratio)}%</span>
              </li>
            )}
          </ul>
          {!onMakeCard && <p className="pb-2 pt-5 text-[13px] text-grey-500">펀딩이 완료되면 공유용 지분 인증 카드를 만들 수 있어요.</p>}
        </>
      ) : (
        <div className="mb-2 mt-5 rounded-2xl bg-grey-50 p-4 text-center">
          {me ? (
            <>
              <p className="text-[13px] text-grey-500">선물 목표 금액 중 내 지분</p>
              <p className="mt-0.5 text-[24px] font-bold" style={{ color: me.color }}>
                {stakePct(me)}%
              </p>
            </>
          ) : (
            <p className="text-[14px] leading-relaxed text-grey-600">
              아직 참여하지 않았어요.
              <br />
              조각을 선물하면 지도 위에 내 자리가 생겨요.
            </p>
          )}
        </div>
      )}
    </BottomSheet>
  );
}

/* ------------------------------- 지분 인증 카드 ------------------------------- */

export function StakeCardSheet({
  open,
  funding,
  onClose,
  onShared,
}: {
  open: boolean;
  funding: Funding;
  onClose: () => void;
  onShared: (msg: string) => void;
}) {
  const [showPct, setShowPct] = useState(true);
  const stakes = useMemo(() => computeStakes(funding), [funding]);
  const rest = remainingStake(funding);
  const product = funding.product;
  const friends = stakes.filter((s) => !s.isOwner).length;
  const top = stakes.slice(0, 4);

  return (
    <BottomSheet open={open} onClose={onClose} title="지분 인증 카드" description="인스타 스토리나 카톡으로 함께한 친구들에게 자랑해보세요">
      <div className="mt-4 rounded-[28px] bg-gradient-to-br from-[#0064FF] via-[#5B5BFF] to-[#B04CFF] p-3.5">
        <div className="rounded-[22px] bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-black tracking-[0.14em] text-toss-blue">MOGIVING</span>
            <span className="rounded-full bg-grey-100 px-2 py-0.5 text-[11px] font-semibold text-grey-600">지분 인증서</span>
          </div>
          <p className="mt-2 text-[19px] font-bold leading-snug text-grey-900">
            이 선물, 친구 {friends}명이
            <br />
            함께 채워줬어요 🎁
          </p>
          <p className="mt-1 line-clamp-1 text-[12px] text-grey-500">{product.name}</p>

          <StakeOverlay
            className="mt-3"
            product={product}
            stakes={stakes}
            label={(s) => ({ name: s.name, pct: showPct ? stakePct(s) : undefined })}
            remaining={rest.amount}
            remainingLabel={showPct ? `남은 ${ratioPct(rest.ratio)}%` : "남은 조각"}
          />

          <ul className="mt-3 space-y-1.5">
            {top.map((s) => (
              <li key={s.key} className="flex items-center gap-2 text-[13px]">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="font-semibold text-grey-800">{s.name}</span>
                {showPct && <span className="ml-auto font-bold text-grey-900">지분 {stakePct(s)}%</span>}
              </li>
            ))}
          </ul>
          {stakes.length > top.length && <p className="mt-1.5 text-[12px] text-grey-500">외 {stakes.length - top.length}명</p>}

          <div className="mt-3 flex items-center justify-between border-t border-dashed border-grey-200 pt-3 text-[11px] text-grey-500">
            <span>{funding.ownerName}님의 선물 · {new Date().toLocaleDateString("ko-KR")}</span>
            <span>#모기빙 #지분인증</span>
          </div>
        </div>
      </div>

      <label className="mt-4 flex items-center justify-between rounded-2xl bg-grey-50 px-4 py-3 text-[14px] font-medium text-grey-700">
        지분 비율(%) 표시하기
        <Switch checked={showPct} onChange={setShowPct} />
      </label>

      <div className="mt-4 grid grid-cols-3 gap-3 pb-4">
        {[
          {
            label: "인스타 스토리",
            icon: <Instagram size={24} className="text-white" />,
            bg: "linear-gradient(135deg,#FEDA75,#FA7E1E,#D62976,#962FBF,#4F5BD5)",
            msg: "인스타그램 스토리로 공유할 카드를 준비했어요",
          },
          {
            label: "카카오톡",
            icon: <MessageCircle size={24} className="fill-[#3A1D1D] text-[#3A1D1D]" />,
            bg: "#FEE500",
            msg: "카카오톡으로 지분 인증 카드를 보냈어요",
          },
          { label: "이미지 저장", icon: <Download size={22} className="text-grey-700" />, bg: "#F2F4F6", msg: "카드 이미지를 앨범에 저장했어요" },
        ].map((s) => (
          <button key={s.label} onClick={() => onShared(s.msg)} className="flex flex-col items-center gap-2 rounded-2xl py-2 active:bg-grey-50">
            <span className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: s.bg }}>
              {s.icon}
            </span>
            <span className="text-[13px] font-medium text-grey-700">{s.label}</span>
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}
