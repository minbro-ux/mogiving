"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Link2, MessageCircle, Send } from "lucide-react";
import { won } from "@/lib/format";
import type { Funding, Participant } from "@/lib/types";
import { BottomSheet, Button, ProductThumb, Spinner } from "./ui";

/* ------------------------------- 펀딩 참여 시트 ------------------------------- */

const QUICK = [5000, 10000, 30000, 50000];
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
  const [amount, setAmount] = useState(0);
  const [nickname, setNickname] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (open) {
      setStep("form");
      setAmount(0);
      setNickname("");
      setMessage("");
    }
  }, [open]);

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
          <p className="mt-1.5 text-[15px] text-grey-500">{won(amount)}</p>
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
          <p className="mt-6 text-[22px] font-bold text-grey-900">마음을 보냈어요</p>
          <p className="mt-2 text-[15px] leading-relaxed text-grey-600">
            {funding.ownerName}님에게 축하 메시지가 전달됐어요.
            <br />
            참여 금액은 받는 분에게만 보여요.
          </p>
        </div>
      </BottomSheet>
    );

  const willOverflow = amount > remaining && remaining > 0;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="얼마나 보탤까요?"
      description={`목표까지 ${won(remaining)} 남았어요`}
      footer={
        <Button onClick={pay} disabled={!valid}>
          <span className="rounded bg-white px-1 text-[11px] font-black tracking-tight text-toss-blue">toss pay</span>
          {amount > 0 ? `${won(amount)} 결제하기` : "결제하기"}
        </Button>
      }
    >
      <div className="mt-3 flex items-center gap-3 rounded-2xl bg-grey-50 p-3">
        <ProductThumb product={funding.product} size="sm" />
        <p className="line-clamp-2 text-[14px] text-grey-700">{funding.product.name}</p>
      </div>

      {/* 금액 입력 */}
      <div className="mt-6 border-b-2 border-grey-200 pb-2 focus-within:border-toss-blue">
        <input
          inputMode="numeric"
          value={amount ? amount.toLocaleString("ko-KR") : ""}
          onChange={(e) => setAmount(Math.min(10_000_000, Number(e.target.value.replace(/\D/g, "")) || 0))}
          placeholder="금액 입력"
          className="w-full bg-transparent text-[28px] font-bold text-grey-900 outline-none placeholder:text-grey-300"
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {QUICK.map((q) => (
          <button key={q} onClick={() => setAmount((a) => a + q)} className="rounded-full bg-grey-100 px-3.5 py-2 text-[13px] font-semibold text-grey-700 active:bg-grey-200">
            +{q >= 10000 ? `${q / 10000}만` : `${q / 1000}천`}
          </button>
        ))}
        {remaining > 0 && (
          <button onClick={() => setAmount(remaining)} className="rounded-full bg-toss-blue-light px-3.5 py-2 text-[13px] font-semibold text-toss-blue">
            남은 금액 전부
          </button>
        )}
      </div>
      {willOverflow && (
        <p className="mt-2 text-[13px] text-toss-orange">목표 금액을 넘으면 펀딩이 바로 마감되고, 받는 분이 사용처를 골라요.</p>
      )}
      {amount > 0 && amount < 1000 && <p className="mt-2 text-[13px] text-toss-red">1,000원부터 참여할 수 있어요</p>}

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
        placeholder="모두에게 공개되는 메시지예요"
        className="w-full resize-none rounded-xl bg-grey-100 px-4 py-3 text-[16px] outline-none placeholder:text-grey-400 focus:ring-2 focus:ring-toss-blue"
      />
      <div className="mt-2 flex flex-wrap gap-2">
        {MESSAGE_PRESETS.map((m) => (
          <button key={m} onClick={() => setMessage(m)} className="rounded-full border border-grey-200 px-3 py-1.5 text-[13px] text-grey-600 active:bg-grey-50">
            {m}
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}

/* --------------------------------- 공유 시트 --------------------------------- */

export function ShareSheet({ open, funding, onClose, onCopied }: { open: boolean; funding: Funding; onClose: () => void; onCopied: () => void }) {
  const link = `https://mogiving.toss.im/f/${funding.id.slice(-6)}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      /* 웹뷰 등 클립보드 권한이 없는 환경 */
    }
    onCopied();
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="친구에게 공유하기" description="링크를 받은 친구는 토스에서 바로 참여할 수 있어요.">
      <div className="mt-4 flex items-center gap-2 rounded-xl bg-grey-100 py-1.5 pl-4 pr-1.5">
        <Link2 size={17} className="shrink-0 text-grey-500" />
        <span className="flex-1 truncate text-[15px] text-grey-700">{link}</span>
        <Button size="sm" full={false} variant="weak" onClick={copy}>
          <Copy size={14} /> 복사
        </Button>
      </div>
      <div className="mt-6 grid grid-cols-3 gap-3 pb-4">
        {[
          { label: "카카오톡", icon: <MessageCircle size={24} className="fill-[#3A1D1D] text-[#3A1D1D]" />, bg: "#FEE500" },
          { label: "토스 친구", icon: <Send size={22} className="text-white" />, bg: "#0064FF" },
          { label: "링크 복사", icon: <Copy size={22} className="text-grey-700" />, bg: "#F2F4F6" },
        ].map((s) => (
          <button key={s.label} onClick={copy} className="flex flex-col items-center gap-2 rounded-2xl py-2 active:bg-grey-50">
            <span className="flex h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: s.bg }}>
              {s.icon}
            </span>
            <span className="text-[13px] font-medium text-grey-700">{s.label}</span>
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}
