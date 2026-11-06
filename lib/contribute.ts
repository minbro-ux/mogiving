import type { ContributionSummary, StoredContribution } from "./contributionStore";
import type { Funding, FundingGift, Participant, Product, ShippingAddress } from "./types";

/** 조각 선물 동기화 (클라이언트 ↔ /api/contribute). 저장은 결제 승인 API에서만 일어난다 */

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
  forbidden: "이 펀딩을 만든 기기에서만 접수할 수 있어요",
  funding_not_achieved: "목표 금액을 달성한 펀딩만 배송을 접수할 수 있어요",
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

/** 서버에 접수된 배송을 화면 상태로. 친구 시점에는 배송지가 오지 않으므로 빈 값이 된다 */
export function giftFromDelivery(product: Product, collected: number, shipping?: ShippingAddress): FundingGift {
  return { kind: "gift", product, reason: "achieved", address: shipping ?? { name: "", phone: "", address: "", detail: "" }, collected };
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

/** DB 요약을 펀딩 상태에 합친다 */
export function applySummary(f: Funding, s: ContributionSummary, mine: StoredContribution[]): Funding {
  const goal = s.goal && s.goal > 0 ? s.goal : f.goal;
  const participants = participantsFromSummary(s, mine).sort((a, b) => a.createdAt - b.createdAt);
  const raised = participants.reduce((sum, p) => sum + p.amount, 0);
  // 서버에서 전액 취소가 끝난 펀딩은 어느 화면에서든 취소됨으로 보여준다
  if (s.refund?.state === "done") return { ...f, goal, participants, phase: "done", resolution: { kind: "cancel", amount: s.refund.amount, count: s.refund.count } };
  // 배송 접수도 서버 기준으로 복원한다
  if (s.delivery) return { ...f, goal, participants, phase: "done", resolution: giftFromDelivery(f.product, raised, s.delivery.shipping) };
  const phase = f.phase === "active" && raised >= goal ? "achieved" : f.phase;
  return { ...f, goal, participants, phase };
}
