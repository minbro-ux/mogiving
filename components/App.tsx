"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FundingScreen, type Role } from "@/components/FundingScreen";
import { ParticipateSheet, ShareSheet } from "@/components/FundingSheets";
import { ResolutionSheet } from "@/components/ResolutionSheet";
import { ShopScreen } from "@/components/ShopScreen";
import { Toast } from "@/components/ui";
import { sumAmount } from "@/lib/mock";
import { recallUploadedImage, rememberUploadedImage, uploadImage } from "@/lib/image";
import { applySummary, fetchContributionSummary, recallMyContributions, requestDelivery, requestVoucher } from "@/lib/contribute";
import { startTopupPayment, startTossPayment } from "@/lib/payment";
import type { VoucherType } from "@/lib/policy";
import { type ShortLink, fundingShareUrl, recallOwnerKey, registerShortLink, shareFunding, shortShareUrl, toStoredPayload } from "@/lib/share";
import type { Funding, Phase, Resolution, ShippingAddress } from "@/lib/types";

type Screen = "shop" | "funding";
type Sheet = "participate" | "share" | "resolve" | null;

const needsChoice = (p?: Phase) => p === "achieved" || p === "under";

/** 공동 선물 상세 화면을 보고 있는 동안 DB 최신 누적 금액·참여 내역을 다시 불러오는 주기 */
const SYNC_INTERVAL_MS = 15_000;

/**
 * initialFunding: 공유 링크(/f/[token])로 들어온 경우 해당 공동 선물 상세 화면부터 시작
 * initialShareId: 짧은 공유 링크로 들어왔다면 그 id (친구가 다시 공유할 때 같은 링크를 쓴다)
 */
export function App({ initialFunding, initialRole = "owner", initialShareId }: { initialFunding?: Funding; initialRole?: Role; initialShareId?: string }) {
  const [screen, setScreen] = useState<Screen>(initialFunding ? "funding" : "shop");
  const [funding, setFunding] = useState<Funding | null>(initialFunding ?? null);
  const [role, setRole] = useState<Role>(initialRole);
  /** 이 기기에서 만든 선물을 링크로 다시 연 수령인의 비밀 key. 기간 종료 후 수령 방식 선택·배송 접수는 여기서 이어간다 */
  const [restoredKey, setRestoredKey] = useState<string | null>(null);
  const restoredKeyRef = useRef(restoredKey);
  restoredKeyRef.current = restoredKey;
  /** 공유 링크로 들어온 방문자: 시점 토글을 숨기고 친구 시점으로 고정 */
  const sharedVisit = !!initialFunding && initialRole === "friend" && !restoredKey;
  const [sheet, setSheet] = useState<Sheet>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  const showToast = useCallback((msg: string) => {
    clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }, []);

  const raised = funding ? sumAmount(funding.participants) : 0;

  // localStorage는 브라우저에만 있으므로 화면이 뜬 뒤에 확인한다
  useEffect(() => {
    if (!initialShareId || initialRole !== "friend") return;
    const key = recallOwnerKey(initialShareId);
    if (!key) return;
    setRestoredKey(key);
    setRole("owner");
  }, [initialShareId, initialRole]);

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

  /*
   * 이 기기에서 방금 만든 공동 선물의 직접 올린 사진(data URL)은 서버에 올려 공개 주소로 바꾼다.
   * 그래야 공유 링크를 다른 기기에서 열어도 사진이 보인다. 업로드가 끝날 때까지 짧은 링크 발급을 미뤄
   * 사진 없는 링크가 먼저 만들어졌다가 같은 공동 선물에 링크가 두 개 생기는 일을 막는다 (실패·10초 초과 시 사진 없이 발급)
   */
  const ownCreated = !!funding && funding.id !== initialFunding?.id;
  const dataImage = ownCreated && funding?.product.imageUrl?.startsWith("data:") ? funding.product.imageUrl : null;
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const imageUploadPending = !!dataImage && dataImage !== failedImage;
  const uploadingImage = useRef<string | null>(null);
  useEffect(() => {
    if (!imageUploadPending || !dataImage || !funding || uploadingImage.current === dataImage) return;
    const id = funding.id;
    uploadingImage.current = dataImage;
    uploadImage(dataImage).then((url) => {
      uploadingImage.current = null;
      if (!url) return setFailedImage(dataImage);
      setFunding((f) => (f && f.id === id && f.product.imageUrl === dataImage ? { ...f, product: { ...f.product, imageUrl: url } } : f));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataImage, imageUploadPending]);

  // 공유 버튼을 누르는 순간 바로 공유 시트를 띄울 수 있게, 선물이 열리거나 완성도가 바뀔 때 미리 발급·갱신해 둔다
  const sharePayloadKey = funding ? JSON.stringify(toStoredPayload(funding)) : null;
  useEffect(() => {
    if (!funding || imageUploadPending) return;
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
  }, [sharePayloadKey, imageUploadPending]);

  /** 모든 공유 버튼이 쓰는 링크. 발급 전이면 null, 발급 실패 시에만 긴 링크로 대체 */
  const shareUrl =
    funding && shortLink?.fundingId === funding.id ? shortShareUrl(shortLink.id) : funding && shortLinkFailed ? fundingShareUrl(funding) : null;

  // 직접 올린 사진은 공유 링크에 담을 수 없으므로, 공동 선물 id로 보관해 두었다가 공유 링크(친구 시점)에서 복원
  const fundingId = funding?.id;
  const imageUrl = funding?.product.imageUrl;
  useEffect(() => {
    if (!fundingId) return;
    if (imageUrl) return rememberUploadedImage(fundingId, imageUrl);
    const saved = recallUploadedImage(fundingId);
    if (saved) setFunding((f) => (f && f.id === fundingId && !f.product.imageUrl ? { ...f, product: { ...f.product, imageUrl: saved } } : f));
  }, [fundingId, imageUrl]);

  // 수령인 본인 화면에서 100% 완성 또는 수령 방식 선택 대기가 되면 수령 모달을 바로 띄움
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

  /**
   * 선물 보태기 결제: 주문 생성 → 토스페이먼츠 결제창.
   * 선물 교환권 발행은 결제창에서 돌아온 /pay/success의 서버 승인에서 일어난다. 저장할 곳(짧은 공유 링크)이 없으면 결제를 시작하지 않는다.
   */
  const startPayment = async (p: { nickname: string; message: string; amount: number }) => {
    if (!funding || funding.phase !== "active") return { status: "error", message: "이미 완성되었거나 기간이 끝난 선물이에요" } as const;
    const shareId = shortLink?.fundingId === funding.id ? shortLink.id : null;
    if (!shareId) return { status: "error", message: "선물 링크를 준비하고 있어요. 잠시 후 다시 시도해 주세요" } as const;
    return startTossPayment(shareId, p);
  };

  /* ------------------------- DB 최신 데이터로 동기화 ------------------------- */

  const syncShareId = funding && shortLink?.fundingId === funding.id ? shortLink.id : null;
  useEffect(() => {
    if (!syncShareId || screen !== "funding") return;
    let cancelled = false;
    const sync = async () => {
      if (document.visibilityState === "hidden") return;
      const summary = await fetchContributionSummary(syncShareId, shortLinkRef.current?.key ?? restoredKeyRef.current);
      if (cancelled || !summary) return;
      const fundingId = currentFundingId.current;
      setFunding((f) => (f && f.id === fundingId ? applySummary(f, summary, recallMyContributions(syncShareId)) : f));
    };
    void sync();
    const timer = setInterval(sync, SYNC_INTERVAL_MS);
    document.addEventListener("visibilitychange", sync);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [syncShareId, screen, restoredKey]);

  const share = async () => {
    if (!funding) return;
    let url = shareUrl;
    // 사진 업로드가 끝나면 링크가 바로 발급된다. 여기서 따로 발급하면 같은 공동 선물에 링크가 두 개 생긴다
    if (!url && imageUploadPending) return showToast("사진을 올리고 있어요. 잠시 후 다시 눌러주세요");
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
    setFunding({ ...funding, phase: "done", resolution: r, ...(r.kind === "gift" ? { shipping: r.address } : {}) });
    setSheet(null);
    showToast(r.kind === "voucher" ? "🎁 모바일 상품권 전환을 신청했어요" : "🚚 배송 접수가 완료됐어요");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /** 수령인 비밀 key가 있는 짧은 링크 (이 기기에서 만든 선물일 때만) */
  const ownerLink = () => {
    const link = funding && shortLink?.fundingId === funding.id ? shortLink : null;
    const key = link?.key ?? restoredKey;
    return link && key ? { id: link.id, key } : null;
  };

  /** A. 차액 결제하고 실물 받기: 남은 차액 결제창을 연다 */
  const startTopup = async () => {
    const link = ownerLink();
    if (!link) return { status: "error", message: "이 선물을 만든 기기에서만 결제할 수 있어요" } as const;
    return startTopupPayment(link.id, link.key);
  };

  /** B. 모바일 상품권으로 받기: 서버에 저장돼야 운영자가 발송할 수 있으므로 저장에 성공했을 때만 완료로 표시한다 */
  const submitVoucher = async (input: { voucherType: VoucherType; name: string; phone: string }) => {
    const link = ownerLink();
    if (!link) return { ok: false, message: "이 선물을 만든 기기에서만 신청할 수 있어요" } as const;
    return requestVoucher(link.id, link.key, input);
  };

  /** 100% 완성 선물 배송 접수: 서버에 저장돼야 운영자가 발주할 수 있으므로 저장에 성공했을 때만 완료로 표시한다 */
  const submitDelivery = async (address: ShippingAddress) => {
    const link = ownerLink();
    if (!link) return { ok: false, message: "이 선물을 만든 기기에서만 접수할 수 있어요" } as const;
    return requestDelivery(link.id, link.key, address);
  };

  /* -------------------------------- render -------------------------------- */

  return (
    <main className="relative mx-auto w-full max-w-[430px] flex-1 bg-white shadow-[0_0_40px_rgba(0,0,0,0.06)]">
      {screen === "shop" || !funding ? (
        <ShopScreen onCreate={handleCreate} onBack={funding ? () => setScreen("funding") : undefined} onToast={showToast} />
      ) : (
        <>
          <FundingScreen
            funding={funding}
            // 공유받은 공동 선물은 항상 친구 시점 (방문자가 직접 만든 공동 선물은 본인 시점)
            role={sharedVisit && funding.id === initialFunding?.id ? "friend" : role}
            onRoleChange={
              sharedVisit
                ? undefined
                : (r) => {
                    setRole(r);
                    showToast(r === "owner" ? "받는 사람(나)의 화면이에요" : "링크를 받은 친구의 화면이에요");
                  }
            }
            onBrowse={() => {
              setScreen("shop");
              window.scrollTo({ top: 0 });
            }}
            onParticipate={() => setSheet("participate")}
            onShare={share}
            onResolve={() => setSheet("resolve")}
            onToast={showToast}
            onCreateNext={(f) => {
              handleCreate(f);
              showToast(`${f.round}탄 선물 위시를 만들었어요`);
            }}
          />
          <ParticipateSheet
            open={sheet === "participate"}
            funding={funding}
            remaining={Math.max(0, funding.goal - raised)}
            onClose={() => setSheet(null)}
            onPay={startPayment}
          />
          <ShareSheet open={sheet === "share"} link={shareUrl} onClose={() => setSheet(null)} onShare={share} onCopied={() => showToast("링크를 복사했어요")} />
          {needsChoice(funding.phase) && (
            <ResolutionSheet
              open={sheet === "resolve"}
              funding={funding}
              raised={raised}
              onClose={() => setSheet(null)}
              onResolve={resolve}
              onTopup={startTopup}
              onRequestVoucher={submitVoucher}
              onRequestDelivery={submitDelivery}
            />
          )}
        </>
      )}

      <Toast message={toast} />
    </main>
  );
}
