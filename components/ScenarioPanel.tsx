"use client";

import { useState } from "react";
import { FlaskConical, RotateCcw, TimerOff, UserPlus } from "lucide-react";
import type { ScenarioKey } from "@/lib/mock";
import { BottomSheet, Button, OptionRow } from "./ui";

const PRESETS: { key: ScenarioKey; emoji: string; title: string; desc: string }[] = [
  { key: "active", emoji: "⏳", title: "모금 진행 중", desc: "약 70% 모인 상태 · 참여/마감 테스트용" },
  { key: "achieved", emoji: "🎯", title: "100% 달성 (즉시 마감)", desc: "배송지 입력 · 다음 모금함(2탄) 열기" },
  { key: "under", emoji: "😢", title: "미달 마감", desc: "차액 결제 후 원래 선물 / 전액 승인 취소" },
  { key: "done", emoji: "🗺️", title: "배송 접수 완료", desc: "지분 지도 · 지분 인증 카드 · 2탄 열기" },
];

/** 기획 검증용 시뮬레이터: 상태를 즉시 바꿔 예외 시나리오를 확인 */
export function ScenarioPanel({
  hasFunding,
  canAct,
  onPreset,
  onRandomJoin,
  onCloseNow,
  onReset,
}: {
  hasFunding: boolean;
  canAct: boolean;
  onPreset: (k: ScenarioKey) => void;
  onRandomJoin: () => void;
  onCloseNow: () => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const run = (fn: () => void) => () => {
    fn();
    setOpen(false);
  };

  return (
    <>
      <div className="pointer-events-none fixed bottom-28 left-1/2 z-40 flex w-full max-w-[430px] -translate-x-1/2 justify-end px-4">
        <button
          onClick={() => setOpen(true)}
          className="pointer-events-auto flex h-12 items-center gap-1.5 rounded-full bg-grey-900 px-4 text-[14px] font-semibold text-white shadow-lg active:scale-95"
        >
          <FlaskConical size={18} /> 시나리오
        </button>
      </div>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="시나리오 테스트" description="데모용 패널이에요. 실제 서비스에는 노출되지 않아요.">
        <p className="mb-2 mt-4 text-[13px] font-semibold text-grey-500">상태 프리셋</p>
        <div className="space-y-2">
          {PRESETS.map((p) => (
            <OptionRow key={p.key} icon={<span className="text-xl">{p.emoji}</span>} title={p.title} description={p.desc} onClick={run(() => onPreset(p.key))} />
          ))}
        </div>

        {hasFunding && (
          <>
            <p className="mb-2 mt-6 text-[13px] font-semibold text-grey-500">현재 펀딩에 액션</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="weak" size="md" disabled={!canAct} onClick={run(onRandomJoin)}>
                <UserPlus size={17} /> 친구 참여
              </Button>
              <Button variant="weak" size="md" disabled={!canAct} onClick={run(onCloseNow)}>
                <TimerOff size={17} /> 지금 마감
              </Button>
            </div>
          </>
        )}

        <Button variant="secondary" size="md" className="mb-4 mt-6" onClick={run(onReset)}>
          <RotateCcw size={17} /> 처음부터 (선물 등록하기)
        </Button>
      </BottomSheet>
    </>
  );
}
