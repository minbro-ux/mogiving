"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FundingScreen, type Role } from "@/components/FundingScreen";
import { ParticipateSheet, ShareSheet } from "@/components/FundingSheets";
import { ResolutionSheet } from "@/components/ResolutionSheet";
import { ScenarioPanel } from "@/components/ScenarioPanel";
import { ShopScreen } from "@/components/ShopScreen";
import { Toast } from "@/components/ui";
import { won } from "@/lib/format";
import { type ScenarioKey, scenarioFunding, sumAmount } from "@/lib/mock";
import type { Funding, Participant, Phase, Resolution } from "@/lib/types";

type Screen = "shop" | "funding";
type Sheet = "participate" | "share" | "resolve" | null;

const RANDOM_FRIENDS = [
  { nickname: "예린", message: "생일 축하해~ 선물 잘 받아!" },
  { nickname: "준호", message: "작은 마음 보탭니다 🙌" },
  { nickname: "소율", message: "언제나 응원해 💙" },
  { nickname: "태민", message: "다음엔 내 차례다 ㅋㅋ" },
];
const RANDOM_AMOUNTS = [10000, 20000, 30000, 50000];

/** 참여 금액이 바뀐 직후의 상태 전이: 정확히 100%면 즉시 송금, 초과면 즉시 마감 */
function phaseAfterJoin(f: Funding, raised: number): Pick<Funding, "phase" | "resolution"> {
  if (raised === f.goal) return { phase: "done", resolution: { kind: "gift", product: f.product, reason: "achieved", payout: raised } };
  if (raised > f.goal) return { phase: "over" };
  return { phase: "active" };
}

/** 마감 시점의 상태 전이 */
function phaseAtDeadline(f: Funding, raised: number): Pick<Funding, "phase" | "resolution"> {
  if (raised === f.goal) return phaseAfterJoin(f, raised);
  return { phase: raised > f.goal ? "over" : "under" };
}

export default function Page() {
  const [screen, setScreen] = useState<Screen>("shop");
  const [funding, setFunding] = useState<Funding | null>(null);
  const [role, setRole] = useState<Role>("owner");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  const showToast = useCallback((msg: string) => {
    clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }, []);

  const raised = funding ? sumAmount(funding.participants) : 0;

  // 수령자 본인 화면에서 미달/초과 상태가 되면 선택 모달을 바로 띄움
  const phase: Phase | undefined = funding?.phase;
  useEffect(() => {
    if (screen === "funding" && role === "owner" && (phase === "under" || phase === "over")) setSheet("resolve");
  }, [phase, role, screen]);

  /* ------------------------------- handlers ------------------------------- */

  const handleCreate = (f: Funding) => {
    setFunding(f);
    setRole("owner");
    setScreen("funding");
    setSheet("share");
    window.scrollTo(0, 0);
  };

  const addParticipant = (p: Omit<Participant, "id" | "createdAt">) => {
    if (!funding || funding.phase !== "active") return;
    const participants = [...funding.participants, { ...p, id: `u-${Date.now()}`, createdAt: Date.now() }];
    const total = sumAmount(participants);
    const next = { ...funding, participants, ...phaseAfterJoin(funding, total) };
    setFunding(next);

    if (next.phase === "done") showToast("🎉 100% 달성! 토스머니로 송금 완료됐어요");
    else if (next.phase === "over") showToast(`목표를 ${won(total - funding.goal)} 넘겨 펀딩이 마감됐어요`);
    else showToast(`${p.nickname}님이 펀딩에 참여했어요`);
  };

  const randomJoin = () => {
    const f = RANDOM_FRIENDS[Math.floor(Math.random() * RANDOM_FRIENDS.length)];
    const amount = RANDOM_AMOUNTS[Math.floor(Math.random() * RANDOM_AMOUNTS.length)];
    addParticipant({ ...f, amount });
  };

  const closeNow = () => {
    if (!funding || funding.phase !== "active") return;
    setFunding({ ...funding, deadline: Date.now() - 1000, ...phaseAtDeadline(funding, raised) });
    showToast("펀딩 기간이 끝났어요");
  };

  const resolve = (r: Resolution) => {
    if (!funding) return;
    setFunding({ ...funding, phase: "done", resolution: r });
    setSheet(null);
    showToast(`${won(r.kind === "gift" ? r.payout : r.amount)}을 받았어요`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const loadPreset = (k: ScenarioKey) => {
    setFunding(scenarioFunding(k, funding?.product));
    setRole("owner");
    setSheet(null);
    setScreen("funding");
    window.scrollTo(0, 0);
  };

  // 데모 링크용: /?scenario=active|achieved|under|over
  useEffect(() => {
    const k = new URLSearchParams(window.location.search).get("scenario");
    if (k === "active" || k === "achieved" || k === "under" || k === "over") loadPreset(k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reset = () => {
    setFunding(null);
    setSheet(null);
    setScreen("shop");
    window.scrollTo(0, 0);
  };

  /* -------------------------------- render -------------------------------- */

  return (
    <main className="relative mx-auto min-h-dvh max-w-[430px] bg-white shadow-[0_0_40px_rgba(0,0,0,0.06)]">
      {screen === "shop" || !funding ? (
        <ShopScreen onCreate={handleCreate} onBack={funding ? () => setScreen("funding") : undefined} />
      ) : (
        <>
          <FundingScreen
            funding={funding}
            role={role}
            onRoleChange={(r) => {
              setRole(r);
              showToast(r === "owner" ? "받는 사람(나)의 화면이에요" : "링크를 받은 친구의 화면이에요");
            }}
            onBack={() => setScreen("shop")}
            onParticipate={() => setSheet("participate")}
            onShare={() => setSheet("share")}
            onResolve={() => setSheet("resolve")}
          />
          <ParticipateSheet
            open={sheet === "participate"}
            funding={funding}
            remaining={Math.max(0, funding.goal - raised)}
            onClose={() => setSheet(null)}
            onPaid={(p) => {
              setSheet(null);
              addParticipant(p);
            }}
          />
          <ShareSheet open={sheet === "share"} funding={funding} onClose={() => setSheet(null)} onCopied={() => showToast("링크를 복사했어요")} />
          {(funding.phase === "under" || funding.phase === "over") && (
            <ResolutionSheet open={sheet === "resolve"} funding={funding} raised={raised} onClose={() => setSheet(null)} onResolve={resolve} />
          )}
        </>
      )}

      <ScenarioPanel
        hasFunding={!!funding && screen === "funding"}
        canAct={funding?.phase === "active"}
        onPreset={loadPreset}
        onRandomJoin={randomJoin}
        onCloseNow={closeNow}
        onReset={reset}
      />
      <Toast message={toast} />
    </main>
  );
}
