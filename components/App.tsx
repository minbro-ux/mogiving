"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Footer } from "@/components/Footer";
import { FundingScreen, type Role } from "@/components/FundingScreen";
import { ParticipateSheet, ShareSheet } from "@/components/FundingSheets";
import { ResolutionSheet } from "@/components/ResolutionSheet";
import { ShopScreen } from "@/components/ShopScreen";
import { Toast } from "@/components/ui";
import { sumAmount } from "@/lib/mock";
import { recallUploadedImage, rememberUploadedImage } from "@/lib/image";
import { applySummary, fetchContributionSummary, participantFromStored, postContribution, recallMyContributions, rememberMyContribution } from "@/lib/contribute";
import { type ShortLink, fundingShareUrl, registerShortLink, shareFunding, shortShareUrl, toStoredPayload } from "@/lib/share";
import type { Funding, Participant, Phase, Resolution } from "@/lib/types";

type Screen = "shop" | "funding";
type Sheet = "participate" | "share" | "resolve" | null;

const needsChoice = (p?: Phase) => p === "achieved" || p === "under";

/** 펀딩 상세 화면을 보고 있는 동안 DB 최신 누적 금액·참여 내역을 다시 불러오는 주기 */
const SYNC_INTERVAL_MS = 15_000;

/**
 * initialFunding: 공유 링크(/f/[token])로 들어온 경우 해당 펀딩 상세 화면부터 시작
 * initialShareId: 짧은 공유 링크로 들어왔다면 그 id (친구가 다시 공유할 때 같은 링크를 쓴다)
 */
export function App({ initialFunding, initialRole = "owner", initialShareId }: { initialFunding?: Funding; initialRole?: Role; initialShareId?: string }) {
  const [screen, setScreen] = useState<Screen>(initialFunding ? "funding" : "shop");
  const [funding, setFunding] = useState<Funding | null>(initialFunding ?? null);
  const [role, setRole] = useState<Role>(initialRole);
  /** 공유 링크로 들어온 방문자: 시점 토글을 숨기고 친구 시점으로 고정 */
  const sharedVisit = !!initialFunding && initialRole === "friend";
  const [sheet, setSheet] = useState<Sheet>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  const showToast = useCallback((msg: string) => {
    clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }, []);

  const raised = funding ? sumAmount(funding.participants) : 0;

  /* --------------------------- 짧은 공유 링크 (/f/[shortId]) --------------------------- */

  type FundingShortLink = ShortLink & { fundingId: string };
  const [shortLink, setShortLink] = useState<FundingShortLink | null>(
    initialFunding && initialShareId ? { fundingId: initialFunding.id, id: initialShareId, key: null } : null,
  );
  const [shortLinkFailed, setShortLinkFailed] = useState(false);
  const shortLinkRef = useRef(shortLink);
  shortLinkRef.current = shortLink;
  const currentFundingId = useRef(funding?.id);
  currentFundingId.current = funding?.id;

  // 공유 버튼을 누르는 순간 바로 공유 시트를 띄울 수 있게, 펀딩이 열리거나 달성률이 바뀔 때 미리 발급·갱신해 둔다
  const sharePayloadKey = funding ? JSON.stringify(toStoredPayload(funding)) : null;
  useEffect(() => {
    if (!funding) return;
    const prev = shortLinkRef.current?.fundingId === funding.id ? shortLinkRef.current : null;
    // 짧은 링크로 들어온 친구 화면: 남의 링크는 갱신 권한(key)이 없으니 받은 링크를 그대로 쓴다
    if (prev && !prev.key) return;
    setShortLinkFailed(false);
    registerShortLink(funding, prev).then((r) => {
      if (currentFundingId.current !== funding.id) return;
      if (r) setShortLink({ ...r, fundingId: funding.id });
      else setShortLinkFailed(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharePayloadKey]);

  /** 모든 공유 버튼이 쓰는 링크. 발급 전이면 null, 발급 실패 시에만 긴 링크로 대체 */
  const shareUrl =
    funding && shortLink?.fundingId === funding.id ? shortShareUrl(shortLink.id) : funding && shortLinkFailed ? fundingShareUrl(funding) : null;

  // 직접 올린 사진은 공유 링크에 담을 수 없으므로, 펀딩 id로 보관해 두었다가 공유 링크(친구 시점)에서 복원
  const fundingId = funding?.id;
  const imageUrl = funding?.product.imageUrl;
  useEffect(() => {
    if (!fundingId) return;
    if (imageUrl) return rememberUploadedImage(fundingId, imageUrl);
    const saved = recallUploadedImage(fundingId);
    if (saved) setFunding((f) => (f && f.id === fundingId && !f.product.imageUrl ? { ...f, product: { ...f.product, imageUrl: saved } } : f));
  }, [fundingId, imageUrl]);

  // 수령자 본인 화면에서 달성/미달 상태가 되면 수령 모달을 바로 띄움
  const phase: Phase | undefined = funding?.phase;
  useEffect(() => {
    if (screen === "funding" && role === "owner" && needsChoice(phase)) setSheet("resolve");
  }, [phase, role, screen]);

  /* ------------------------------- handlers ------------------------------- */

  const handleCreate = (f: Funding) => {
    setFunding(f);
    setRole("owner");
    setScreen("funding");
    setSheet("share");
    window.scrollTo(0, 0);
  };

  /** Hard Cap: 남은 금액까지만 결제되고, 100%에 닿는 순간 펀딩 성공으로 마감 */
  const addParticipant = (p: Omit<Participant, "id" | "createdAt">) => {
    if (!funding || funding.phase !== "active") return;
    const amount = Math.min(p.amount, funding.goal - sumAmount(funding.participants));
    if (amount <= 0) return;
    const participants = [...funding.participants, { ...p, amount, id: `u-${Date.now()}`, createdAt: Date.now() }];
    const achieved = sumAmount(participants) >= funding.goal;
    setFunding({ ...funding, participants, phase: achieved ? "achieved" : "active" });

    showToast(achieved ? "🎉 100% 달성! 펀딩이 성공적으로 마감됐어요" : `${p.nickname}님이 펀딩에 참여했어요`);
  };

  /** 결제 성공 후 완료 화면에서 '확인'을 누르면 화면 상태에 반영할 작업 */
  const pendingApply = useRef<(() => void) | null>(null);

  /**
   * 조각 선물 결제 → /api/contribute로 DB 저장 (참여 내역·롤링페이퍼 메시지·누적 금액).
   * 짧은 공유 링크가 없는 펀딩(발급 전·저장소 장애 시 긴 링크)은 저장할 곳이 없어 이 기기 화면에만 반영한다.
   */
  const submitContribution = async (p: Omit<Participant, "id" | "createdAt">): Promise<string | null> => {
    if (!funding || funding.phase !== "active") return "이미 마감된 펀딩이에요";
    const shareId = shortLink?.fundingId === funding.id ? shortLink.id : null;
    if (!shareId) {
      console.warn("[mogiving] 공유 링크(짧은 id)가 없어 참여 내역을 DB에 저장하지 못하고 이 화면에만 반영합니다", { fundingId: funding.id });
      pendingApply.current = () => addParticipant(p);
      return null;
    }
    const r = await postContribution(shareId, { nickname: p.nickname, message: p.message, amount: p.amount });
    if (!r.ok) return r.message;
    rememberMyContribution(shareId, r.contribution);
    const fundingId = funding.id;
    pendingApply.current = () => {
      const achieved = r.collected >= r.goal;
      setFunding((f) => {
        if (!f || f.id !== fundingId) return f;
        const me = participantFromStored(r.contribution, true);
        return { ...f, participants: [...f.participants.filter((x) => x.id !== me.id), me], phase: achieved && f.phase === "active" ? "achieved" : f.phase };
      });
      showToast(achieved ? "🎉 100% 달성! 펀딩이 성공적으로 마감됐어요" : `${p.nickname}님의 선물이 전달됐어요`);
      void syncNow.current?.();
    };
    return null;
  };

  /* ------------------------- DB 최신 데이터로 동기화 ------------------------- */

  const syncNow = useRef<(() => Promise<void>) | null>(null);
  const syncShareId = funding && shortLink?.fundingId === funding.id ? shortLink.id : null;
  // 공유 링크로 들어와 본 펀딩: 화면의 참여 내역을 DB 데이터로만 채운다 (주최자 화면은 이 기기에만 반영된 참여도 유지)
  const isSharedFunding = !!initialFunding && funding?.id === initialFunding.id && initialRole === "friend";
  useEffect(() => {
    if (!syncShareId || screen !== "funding") return;
    let cancelled = false;
    const sync = async () => {
      if (document.visibilityState === "hidden") return;
      const summary = await fetchContributionSummary(syncShareId, shortLinkRef.current?.key);
      if (cancelled || !summary) return;
      const fundingId = currentFundingId.current;
      setFunding((f) => (f && f.id === fundingId ? applySummary(f, summary, recallMyContributions(syncShareId), !isSharedFunding) : f));
    };
    syncNow.current = sync;
    void sync();
    const timer = setInterval(sync, SYNC_INTERVAL_MS);
    document.addEventListener("visibilitychange", sync);
    return () => {
      cancelled = true;
      syncNow.current = null;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [syncShareId, screen, isSharedFunding]);

  const share = async () => {
    if (!funding) return;
    let url = shareUrl;
    if (!url) {
      const r = await registerShortLink(funding);
      url = r ? shortShareUrl(r.id) : fundingShareUrl(funding);
      if (r) setShortLink({ ...r, fundingId: funding.id });
    }
    const result = await shareFunding(funding, url);
    if (result === "copied") showToast("링크를 복사했어요. 친구에게 붙여넣어 보내보세요");
    else if (result === "failed") showToast("링크를 복사하지 못했어요. 잠시 후 다시 시도해주세요");
  };

  const resolve = (r: Resolution) => {
    if (!funding) return;
    setFunding({ ...funding, phase: "done", resolution: r });
    setSheet(null);
    showToast(r.kind === "cancel" ? "모든 참여 결제가 승인 취소됐어요" : "🚚 배송 접수가 완료됐어요");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /* -------------------------------- render -------------------------------- */

  return (
    <main className="relative mx-auto min-h-dvh max-w-[430px] bg-white shadow-[0_0_40px_rgba(0,0,0,0.06)]">
      {screen === "shop" || !funding ? (
        <ShopScreen onCreate={handleCreate} onBack={funding ? () => setScreen("funding") : undefined} onToast={showToast} />
      ) : (
        <>
          <FundingScreen
            funding={funding}
            // 공유받은 펀딩은 항상 친구 시점 (방문자가 직접 만든 펀딩은 본인 시점)
            role={sharedVisit && funding.id === initialFunding?.id ? "friend" : role}
            onRoleChange={
              sharedVisit
                ? undefined
                : (r) => {
                    setRole(r);
                    showToast(r === "owner" ? "받는 사람(나)의 화면이에요" : "링크를 받은 친구의 화면이에요");
                  }
            }
            onBack={() => setScreen("shop")}
            onParticipate={() => setSheet("participate")}
            onShare={share}
            onResolve={() => setSheet("resolve")}
            onToast={showToast}
            onCreateNext={(f) => {
              handleCreate(f);
              showToast(`${f.round}탄 모금함을 열었어요`);
            }}
          />
          <ParticipateSheet
            open={sheet === "participate"}
            funding={funding}
            remaining={Math.max(0, funding.goal - raised)}
            onClose={() => setSheet(null)}
            onPay={submitContribution}
            onDone={() => {
              setSheet(null);
              pendingApply.current?.();
              pendingApply.current = null;
            }}
          />
          <ShareSheet open={sheet === "share"} link={shareUrl} onClose={() => setSheet(null)} onShare={share} onCopied={() => showToast("링크를 복사했어요")} />
          {needsChoice(funding.phase) && (
            <ResolutionSheet open={sheet === "resolve"} funding={funding} raised={raised} onClose={() => setSheet(null)} onResolve={resolve} />
          )}
        </>
      )}

      {/* 고정 CTA(최대 약 114px)에 가려지지 않는 패딩 */}
      <Footer className="pb-32" />

      <Toast message={toast} />
    </main>
  );
}
