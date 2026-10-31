"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Link2, Lock, MessageCircle, Minus, Plus, Send } from "lucide-react";
import { shortWon, won } from "@/lib/format";
import { pieceInfo, piecesAmount } from "@/lib/pieces";
import { copyText, fundingShareUrl } from "@/lib/share";
import type { Funding, Participant } from "@/lib/types";
import { BottomSheet, Button, PieceGrid, ProductThumb, Segmented, Spinner } from "./ui";

/* ------------------------------- 펀딩 참여 시트 ------------------------------- */

const QUICK = [5000, 10000, 30000, 50000];
const PIECE_QUICK = [1, 2, 3, 5];
const MESSAGE_PRESETS = ["생일 축하해! 🎂", "늘 고마워 💙", "행복한 하루 보내!"];

export function ParticipateSheet({
  open,
  funding,
  remaining,
  onClose,
  onPaid,
}: {
  open: boolean;
  funding: Funding;
  remaining: number;
  onClose: () => void;
  onPaid: (p: Omit<Participant, "id" | "createdAt">) => void;
}) {
  const [step, setStep] = useState<"form" | "paying" | "done">("form");
  const [mode, setMode] = useState<"piece" | "free">("piece");
  const [count, setCount] = useState(1);
  const [freeAmount, setFreeAmount] = useState(0);
  const [nickname, setNickname] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (open) {
      setStep("form");
      setMode("piece");
      setCount(1);
      setFreeAmount(0);
      setNickname("");
      setMessage("");
    }
  }, [open]);

  const pieces = pieceInfo(funding.goal, funding.goal - remaining);
  const amount = mode === "piece" ? piecesAmount(count, pieces.unit, remaining) : freeAmount;
  const valid = amount >= 1000 && nickname.trim() && message.trim();

  const pay = () => {
    setStep("paying");
    setTimeout(() => setStep("done"), 1400);
  };

  const finish = () => {
    onPaid({ nickname: nickname.trim(), message: message.trim(), amount, isMe: true });
  };

  if (step === "paying")
    return (
      <BottomSheet open={open} onClose={() => {}} hideClose>
        <div className="flex flex-col items-center py-12">
          <Spinner className="!h-10 !w-10 !border-4" />
          <p className="mt-6 text-[20px] font-bold text-grey-900">토스페이로 결제하고 있어요</p>
          <p className="mt-1.5 text-[15px] text-grey-500">
            {mode === "piece" && `${count}조각 · `}
            {won(amount)}
          </p>
        </div>
      </BottomSheet>
    );

  if (step === "done")
    return (
      <BottomSheet open={open} onClose={finish} hideClose footer={<Button onClick={finish}>확인</Button>}>
        <div className="flex flex-col items-center py-8 text-center">
          <div className="flex h-16 w-16 animate-pop items-center justify-center rounded-full bg-toss-blue text-white">
            <Check size={34} strokeWidth={3} />
          </div>
          <p className="mt-6 text-[22px] font-bold text-grey-900">{mode === "piece" ? `${count}조각을 선물했어요` : "마음을 보냈어요"}</p>
          <p className="mt-2 text-[15px] leading-relaxed text-grey-600">
            {funding.ownerName}님에게 축하 메시지가 전달됐어요.
            <br />
            참여 금액과 메시지는 받는 분에게만 보여요.
          </p>
        </div>
      </BottomSheet>
    );

  const maxCount = pieces.remaining;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="얼마나 보탤까요?"
      description={`총 ${pieces.total}조각 중 ${pieces.remaining}조각 남았어요`}
      footer={
        <Button onClick={pay} disabled={!valid}>
          {mode === "piece" ? (
            `총 ${pieces.total}조각 중 ${count}조각 선물하기`
          ) : (
            <>
              <span className="rounded bg-white px-1 text-[11px] font-black tracking-tight text-toss-blue">toss pay</span>
              {amount > 0 ? `${won(amount)} 결제하기` : "결제하기"}
            </>
          )}
        </Button>
      }
    >
      <div className="mt-3 flex items-center gap-3 rounded-2xl bg-grey-50 p-3">
        <ProductThumb product={funding.product} size="sm" />
        <p className="line-clamp-2 text-[14px] text-grey-700">{funding.product.name}</p>
      </div>

      <div className="mt-5">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: "piece", label: "🧩 조각으로 선물" },
            { value: "free", label: "✏️ 금액 직접 입력" },
          ]}
        />
      </div>

      {mode === "piece" ? (
        <>
          <div className="mt-4 rounded-2xl bg-grey-50 p-4">
            <div className="mb-3 flex items-center justify-between text-[13px]">
              <span className="font-bold text-grey-800">1조각 {shortWon(pieces.unit)}</span>
              <span className="text-grey-500">
                <span className="mr-1 inline-block h-2.5 w-2.5 rounded-[3px] bg-toss-blue align-middle" />
                모인 조각 {pieces.filled}
              </span>
            </div>
            <PieceGrid total={pieces.total} filled={pieces.filled} selected={count} />
          </div>

          <div className="mt-5 flex items-center justify-between">
            <div>
              <p className="text-[14px] text-grey-600">선물할 조각</p>
              <p className="mt-0.5 text-[26px] font-bold text-grey-900">
                {count}조각 <span className="text-[16px] font-semibold text-toss-blue">{won(amount)}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StepButton label="조각 빼기" disabled={count <= 1} onClick={() => setCount((c) => Math.max(1, c - 1))}>
                <Minus size={18} />
              </StepButton>
              <StepButton label="조각 더하기" disabled={count >= maxCount} onClick={() => setCount((c) => Math.min(maxCount, c + 1))}>
                <Plus size={18} />
              </StepButton>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {PIECE_QUICK.filter((n) => n <= maxCount).map((n) => (
              <button
                key={n}
                onClick={() => setCount(n)}
                className={`rounded-full px-3.5 py-2 text-[13px] font-semibold ${count === n ? "bg-grey-900 text-white" : "bg-grey-100 text-grey-700 active:bg-grey-200"}`}
              >
                {n}조각
              </button>
            ))}
            {maxCount > 1 && (
              <button onClick={() => setCount(maxCount)} className="rounded-full bg-toss-blue-light px-3.5 py-2 text-[13px] font-semibold text-toss-blue">
                남은 {maxCount}조각 전부
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="mt-6 border-b-2 border-grey-200 pb-2 focus-within:border-toss-blue">
            <input
              inputMode="numeric"
              value={freeAmount ? freeAmount.toLocaleString("ko-KR") : ""}
              onChange={(e) => setFreeAmount(Math.min(remaining, Number(e.target.value.replace(/\D/g, "")) || 0))}
              placeholder="금액 입력"
              className="w-full bg-transparent text-[28px] font-bold text-grey-900 outline-none placeholder:text-grey-300"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {QUICK.map((q) => (
              <button key={q} onClick={() => setFreeAmount((a) => Math.min(remaining, a + q))} className="rounded-full bg-grey-100 px-3.5 py-2 text-[13px] font-semibold text-grey-700 active:bg-grey-200">
                +{q >= 10000 ? `${q / 10000}만` : `${q / 1000}천`}
              </button>
            ))}
            {remaining > 0 && (
              <button onClick={() => setFreeAmount(remaining)} className="rounded-full bg-toss-blue-light px-3.5 py-2 text-[13px] font-semibold text-toss-blue">
                남은 금액 전부
              </button>
            )}
          </div>
          {freeAmount === remaining && (
            <p className="mt-2 text-[13px] text-toss-blue">남은 금액을 모두 채우면 펀딩이 바로 성공으로 마감돼요.</p>
          )}
          {freeAmount > 0 && freeAmount < 1000 && <p className="mt-2 text-[13px] text-toss-red">1,000원부터 참여할 수 있어요</p>}
          <p className="mt-2 text-[12px] text-grey-500">목표 금액을 넘는 금액은 결제되지 않아요 · 최대 {won(remaining)}</p>
        </>
      )}

      {/* 닉네임 & 메시지 */}
      <p className="mb-2 mt-7 text-[14px] font-semibold text-grey-600">닉네임</p>
      <input
        value={nickname}
        maxLength={10}
        onChange={(e) => setNickname(e.target.value)}
        placeholder="받는 분이 알아볼 수 있는 이름"
        className="h-12 w-full rounded-xl bg-grey-100 px-4 text-[16px] outline-none placeholder:text-grey-400 focus:ring-2 focus:ring-toss-blue"
      />
      <p className="mb-2 mt-5 text-[14px] font-semibold text-grey-600">축하 메시지</p>
      <textarea
        value={message}
        rows={3}
        maxLength={80}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="받는 분에게만 보이는 롤링페이퍼 메시지예요"
        className="w-full resize-none rounded-xl bg-grey-100 px-4 py-3 text-[16px] outline-none placeholder:text-grey-400 focus:ring-2 focus:ring-toss-blue"
      />
      <div className="mt-2 flex flex-wrap gap-2">
        {MESSAGE_PRESETS.map((m) => (
          <button key={m} onClick={() => setMessage(m)} className="rounded-full border border-grey-200 px-3 py-1.5 text-[13px] text-grey-600 active:bg-grey-50">
            {m}
          </button>
        ))}
      </div>
      <p className="mt-4 flex items-center gap-1 text-[12px] text-grey-500">
        <Lock size={12} /> 다른 친구들에게는 내 금액과 메시지가 보이지 않아요
      </p>
    </BottomSheet>
  );
}

function StepButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-11 w-11 items-center justify-center rounded-full bg-grey-100 text-grey-800 active:bg-grey-200 disabled:text-grey-300"
    >
      {children}
    </button>
  );
}

/* --------------------------------- 공유 시트 --------------------------------- */

export function ShareSheet({ open, funding, onClose, onCopied }: { open: boolean; funding: Funding; onClose: () => void; onCopied: () => void }) {
  const link = fundingShareUrl(funding);

  const copy = async () => {
    await copyText(link);
    onCopied();
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="친구에게 공유하기" description="링크를 받은 친구는 토스에서 바로 조각을 선물할 수 있어요.">
      <div className="mt-4 flex items-center gap-2 rounded-xl bg-grey-100 py-1.5 pl-4 pr-1.5">
        <Link2 size={17} className="shrink-0 text-grey-500" />
        <span className="flex-1 truncate text-[15px] text-grey-700">{link}</span>
        <Button size="sm" full={false} variant="weak" onClick={copy}>
          <Copy size={14} /> 복사
        </Button>
      </div>
      <ShareTargets onPick={copy} />
    </BottomSheet>
  );
}

/** 카카오톡 / 토스 친구 / 링크 복사 공유 버튼 3종 */
export function ShareTargets({ onPick }: { onPick: () => void }) {
  return (
    <div className="mt-6 grid grid-cols-3 gap-3 pb-4">
      {[
        { label: "카카오톡", icon: <MessageCircle size={24} className="fill-[#3A1D1D] text-[#3A1D1D]" />, bg: "#FEE500" },
        { label: "토스 친구", icon: <Send size={22} className="text-white" />, bg: "#0064FF" },
        { label: "링크 복사", icon: <Copy size={22} className="text-grey-700" />, bg: "#F2F4F6" },
      ].map((s) => (
        <button key={s.label} onClick={onPick} className="flex flex-col items-center gap-2 rounded-2xl py-2 active:bg-grey-50">
          <span className="flex h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: s.bg }}>
            {s.icon}
          </span>
          <span className="text-[13px] font-medium text-grey-700">{s.label}</span>
        </button>
      ))}
    </div>
  );
}
