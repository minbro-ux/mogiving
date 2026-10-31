"use client";

import { useEffect, useState } from "react";
import { Copy, Link2 } from "lucide-react";
import { ShareTargets } from "./FundingSheets";
import { BottomSheet, Button } from "./ui";

const OCCASIONS = [
  { emoji: "🎂", label: "생일" },
  { emoji: "💍", label: "결혼" },
  { emoji: "🏠", label: "이사·집들이" },
  { emoji: "👶", label: "출산" },
  { emoji: "🎓", label: "졸업·취업" },
];

/**
 * 역발상 진입 플로우: 축하받을 친구에게 "원하는 선물 링크를 보내줘"라고 요청하는 초대 링크 생성.
 * 친구가 링크에서 상품 URL을 등록하면 그 친구 명의의 펀딩이 열리는 구조 (현재는 더미 링크).
 */
export function WishRequestSheet({ open, onClose, onCopied }: { open: boolean; onClose: () => void; onCopied: (msg: string) => void }) {
  const [occasion, setOccasion] = useState(OCCASIONS[0].label);
  const [friend, setFriend] = useState("");
  const [code, setCode] = useState("");

  useEffect(() => {
    if (!open) return;
    setOccasion(OCCASIONS[0].label);
    setFriend("");
    setCode(Math.random().toString(36).slice(2, 8));
  }, [open]);

  const o = OCCASIONS.find((x) => x.label === occasion) ?? OCCASIONS[0];
  const link = `https://mogiving.toss.im/r/${code}`;
  const name = friend.trim() || "친구";
  const message = `${name}님, ${o.label} 정말 축하해요! ${o.emoji}\n받고 싶은 선물 링크를 남겨주면 친구들이랑 마음 모아 선물할게요.`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${message}\n${link}`);
    } catch {
      /* 웹뷰 등 클립보드 권한이 없는 환경 */
    }
    onCopied("초대 링크를 복사했어요. 카톡이나 토스로 보내보세요");
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="위시리스트 요청하기" description="친구가 원하는 선물 링크를 등록하면 바로 함께 모을 수 있어요.">
      <p className="mb-2 mt-4 text-[14px] font-semibold text-grey-600">어떤 축하인가요?</p>
      <div className="flex flex-wrap gap-2">
        {OCCASIONS.map((x) => (
          <button
            key={x.label}
            onClick={() => setOccasion(x.label)}
            className={`rounded-full px-3.5 py-2 text-[14px] font-semibold transition ${
              occasion === x.label ? "bg-grey-900 text-white" : "bg-grey-100 text-grey-600"
            }`}
          >
            {x.emoji} {x.label}
          </button>
        ))}
      </div>

      <p className="mb-2 mt-5 text-[14px] font-semibold text-grey-600">축하받을 친구</p>
      <input
        value={friend}
        maxLength={10}
        onChange={(e) => setFriend(e.target.value)}
        placeholder="이름 또는 닉네임"
        className="h-12 w-full rounded-xl bg-grey-100 px-4 text-[16px] outline-none placeholder:text-grey-400 focus:ring-2 focus:ring-toss-blue"
      />

      {/* 보낼 메시지 미리보기 */}
      <p className="mb-2 mt-5 text-[14px] font-semibold text-grey-600">이렇게 보내져요</p>
      <div className="rounded-2xl bg-[#B2C7DA] p-3.5">
        <div className="max-w-[88%] rounded-2xl rounded-tl-sm bg-[#FEE500] px-3.5 py-3 text-[14px] leading-relaxed text-[#191919]">
          <p className="whitespace-pre-line">{message}</p>
          <div className="mt-2.5 rounded-xl bg-white p-3">
            <p className="text-[12px] font-black tracking-[0.1em] text-toss-blue">MOGIVING</p>
            <p className="mt-0.5 text-[13px] font-semibold text-grey-900">🎁 받고 싶은 선물 링크 남기기</p>
            <p className="mt-0.5 truncate text-[12px] text-grey-500">{link}</p>
          </div>
        </div>
      </div>

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
