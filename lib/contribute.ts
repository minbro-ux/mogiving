import type { ContributionSummary, FundingVoucherInfo, StoredContribution } from "./contributionStore";
import type { VoucherType } from "./policy";
import type { Funding, FundingGift, FundingVoucher, GiftStatus, Participant, Phase, Product, Resolution, ShippingAddress } from "./types";

/** 선물 보태기 동기화 (클라이언트 ↔ /api/contribute). 저장은 결제 승인 API에서만 일어난다 */

export type { ContributionSummary };

const DB_PREFIX = "db-";

/** DB 최신 누적 금액·참여 내역. ownerKey가 맞으면 닉네임·메시지 포함 */
export async function fetchContributionSummary(shareId: string, ownerKey?: string | null): Promise<ContributionSummary | null> {
  try {
    const res = await fetch(`/api/contribute?share=${encodeURIComponent(shareId)}`, {
      cache: "no-store",
      headers: ownerKey ? { "x-share-key": ownerKey } : undefined,
    });
    const body = (await res.json().catch(() => null)) as ({ ok: true } & ContributionSummary) | { ok: false; error?: string } | null;
    if (res.ok && body?.ok) return body;
    console.error("[mogiving] 참여 내역 동기화 실패", { shareId, status: res.status, error: body && !body.ok ? body.error : undefined });
    return null;
  } catch (e) {
    console.error("[mogiving] 참여 내역 동기화 요청 실패 (네트워크)", { shareId, error: e });
    return null;
  }
}

const DELIVERY_ERRORS: Record<string, string> = {
  forbidden: "이 선물을 만든 기기에서만 접수할 수 있어요",
  funding_not_achieved: "100% 완성된 선물만 배송을 접수할 수 있어요",
  bad_shipping: "받는 분, 연락처, 주소를 다시 확인해 주세요",
};

/** 배송 접수. 이미 접수됐다면 먼저 접수한 배송지를 돌려준다 */
export async function requestDelivery(shareId: string, key: string, shipping: ShippingAddress): Promise<{ ok: true; address: ShippingAddress } | { ok: false; message: string }> {
  try {
    const res = await fetch("/api/delivery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shareId, key, shipping }) });
    const body = (await res.json().catch(() => null)) as { ok: boolean; error?: string; delivery?: { shipping?: ShippingAddress } } | null;
    if (res.ok && body?.ok) return { ok: true, address: body.delivery?.shipping ?? shipping };
    console.error("[mogiving] 배송 접수 실패", { shareId, status: res.status, code: body?.error });
    return { ok: false, message: (body?.error && DELIVERY_ERRORS[body.error]) || "배송을 접수하지 못했어요. 잠시 후 다시 시도해 주세요" };
  } catch (e) {
    console.error("[mogiving] 배송 접수 요청 실패 (네트워크)", e);
    return { ok: false, message: "네트워크 연결을 확인하고 다시 시도해 주세요" };
  }
}

const VOUCHER_ERRORS: Record<string, string> = {
  forbidden: "이 선물을 만든 기기에서만 신청할 수 있어요",
  voucher_unavailable: "기간이 끝난 미완성 선물만 모바일 상품권으로 받을 수 있어요. 화면을 새로고침해 주세요",
  bad_contact: "받는 분 이름과 휴대폰 번호를 다시 확인해 주세요",
  bad_voucher_type: "상품권 종류를 다시 골라 주세요",
};

/** 모바일 상품권 전환 신청. 이미 신청했다면 먼저 신청한 내용을 돌려준다 */
export async function requestVoucher(
  shareId: string,
  key: string,
  input: { voucherType: VoucherType; name: string; phone: string },
): Promise<{ ok: true; voucher: FundingVoucherInfo } | { ok: false; message: string }> {
  try {
    const res = await fetch("/api/voucher", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shareId, key, ...input }) });
    const body = (await res.json().catch(() => null)) as { ok: boolean; error?: string; voucher?: FundingVoucherInfo } | null;
    if (res.ok && body?.ok && body.voucher) return { ok: true, voucher: body.voucher };
    console.error("[mogiving] 모바일 상품권 전환 신청 실패", { shareId, status: res.status, code: body?.error });
    return { ok: false, message: (body?.error && VOUCHER_ERRORS[body.error]) || "신청하지 못했어요. 잠시 후 다시 시도해 주세요" };
  } catch (e) {
    console.error("[mogiving] 모바일 상품권 전환 요청 실패 (네트워크)", e);
    return { ok: false, message: "네트워크 연결을 확인하고 다시 시도해 주세요" };
  }
}

/** 서버에 접수된 배송을 화면 상태로. 친구 시점에는 배송지가 오지 않으므로 빈 값이 된다 */
export function giftFromDelivery(product: Product, participants: Participant[], shipping?: ShippingAddress): FundingGift {
  const extraPaid = participants.filter((p) => p.nickname === TOPUP_LABEL).reduce((s, p) => s + p.amount, 0);
  const collected = participants.reduce((s, p) => s + p.amount, 0) - extraPaid;
  return { kind: "gift", product, reason: extraPaid > 0 ? "topup" : "achieved", address: shipping ?? { name: "", phone: "", address: "", detail: "" }, collected, ...(extraPaid ? { extraPaid } : {}) };
}

export function voucherFromInfo(v: FundingVoucherInfo): FundingVoucher {
  return { kind: "voucher", requestedAt: v.requestedAt, amount: v.amount, voucherType: v.type };
}

/** 서버 상태 → 화면 단계와 결과 */
export function phaseFromStatus(status: GiftStatus, s: Pick<ContributionSummary, "delivery" | "voucher">, product: Product, participants: Participant[]): { phase: Phase; resolution?: Resolution } {
  if (status === "CONVERTED_VOUCHER") return { phase: "done", resolution: voucherFromInfo(s.voucher ?? { requestedAt: Date.now() }) };
  if (s.delivery) return { phase: "done", resolution: giftFromDelivery(product, participants, s.delivery.shipping) };
  if (status === "COMPLETED_FULL") return { phase: "achieved" };
  if (status === "PENDING_CHOICE") return { phase: "under" };
  return { phase: "active" };
}

/* ---------------------- 내가 보낸 선물 (이 브라우저에만 보관) ---------------------- */

const mineKey = (shareId: string) => `mogiving:my-contributions:${shareId}`;

/** 다른 친구의 메시지는 서버가 돌려주지 않으므로, 내가 쓴 메시지는 이 기기에 기억해 두었다가 다시 보여준다 */
export function rememberMyContribution(shareId: string, c: StoredContribution) {
  try {
    const list = recallMyContributions(shareId).filter((x) => x.id !== c.id);
    localStorage.setItem(mineKey(shareId), JSON.stringify([...list, c].slice(-50)));
  } catch {
    /* 저장 공간이 막힌 환경에서는 생략 */
  }
}

export function recallMyContributions(shareId: string): StoredContribution[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(mineKey(shareId)) ?? "[]");
    return Array.isArray(v) ? (v as StoredContribution[]) : [];
  } catch {
    return [];
  }
}

/* ------------------------------ 화면 상태에 반영 ------------------------------ */

/** 서버의 차액 결제 참여 이름 (contributionStore.TOPUP_NICKNAME과 같음) */
const TOPUP_LABEL = "차액 결제";

export function participantFromStored(c: StoredContribution, isMe = false): Participant {
  return { id: `${DB_PREFIX}${c.id}`, nickname: c.nickname, message: c.message, amount: c.amount, createdAt: c.createdAt, isMe };
}

export function participantsFromSummary(s: ContributionSummary, mine: StoredContribution[] = []): Participant[] {
  const myById = new Map(mine.map((c) => [c.id, c]));
  return s.contributions.map((c, i) => {
    const my = myById.get(c.id);
    if (my) return participantFromStored({ ...c, nickname: c.nickname || my.nickname, message: c.message || my.message }, true);
    // 친구 화면에는 다른 친구 이름이 오지 않는다. 지분 지도가 닉네임으로 묶으므로 서로 다른 자리 표시 이름을 준다
    return participantFromStored(c.nickname ? c : { ...c, nickname: `친구 ${i + 1}` });
  });
}

/** DB 요약을 선물 상태에 합친다 */
export function applySummary(f: Funding, s: ContributionSummary, mine: StoredContribution[]): Funding {
  const goal = s.goal && s.goal > 0 ? s.goal : f.goal;
  const participants = participantsFromSummary(s, mine).sort((a, b) => a.createdAt - b.createdAt);
  const raised = participants.reduce((sum, p) => sum + p.amount, 0);
  const status: GiftStatus = s.status ?? (raised >= goal ? "COMPLETED_FULL" : f.deadline <= Date.now() ? "PENDING_CHOICE" : "ACTIVE");
  const { phase, resolution } = phaseFromStatus(status, s, f.product, participants);
  return { ...f, goal, participants, phase, resolution };
}
