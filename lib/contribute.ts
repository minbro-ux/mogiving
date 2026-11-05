import type { ContributionSummary, StoredContribution } from "./contributionStore";
import type { Funding, Participant } from "./types";

/**
 * 조각 선물 저장·동기화 (클라이언트 ↔ /api/contribute).
 * DB에서 온 참여 내역은 id를 "db-"로 시작해 로컬 데모 참여와 구분한다.
 */

export type { ContributionSummary };

export type ContributeOk = { ok: true; contribution: StoredContribution; goal: number; collected: number; count: number };
export type ContributeFail = { ok: false; code: string; message: string };

const ERROR_TEXT: Record<string, string> = {
  funding_closed: "이미 마감된 펀딩이에요. 화면을 새로고침해 주세요",
  share_not_found: "펀딩 정보를 찾을 수 없어요",
  invalid_amount: "참여 금액을 다시 확인해 주세요",
  bad_nickname: "이름은 1~20자로 입력해 주세요",
  bad_message: "메시지는 300자까지 쓸 수 있어요",
};
const DEFAULT_ERROR = "선물 내역을 저장하지 못했어요. 잠시 후 다시 시도해 주세요";

const DB_PREFIX = "db-";
export const isDbParticipant = (p: Participant) => p.id.startsWith(DB_PREFIX);

/** 결제 완료 후 참여 내역·메시지를 서버에 저장 */
export async function postContribution(shareId: string, input: { nickname: string; message: string; amount: number }): Promise<ContributeOk | ContributeFail> {
  try {
    const res = await fetch("/api/contribute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shareId, ...input }),
    });
    const body = (await res.json().catch(() => null)) as (ContributeOk | { ok: false; error?: string }) | null;
    if (res.ok && body?.ok) return body;
    const code = (body && !body.ok && body.error) || `http_${res.status}`;
    console.error("[mogiving] 조각 선물 DB 저장 실패", { shareId, status: res.status, code, amount: input.amount });
    return { ok: false, code, message: ERROR_TEXT[code] ?? DEFAULT_ERROR };
  } catch (e) {
    console.error("[mogiving] 조각 선물 저장 요청 실패 (네트워크)", { shareId, error: e });
    return { ok: false, code: "network", message: "네트워크 연결을 확인하고 다시 시도해 주세요" };
  }
}

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

/**
 * DB 요약을 펀딩 상태에 합친다.
 * keepLocal: 공유 링크 발급 전에 이 기기 화면에만 반영된 참여처럼 DB에 없는 로컬 참여를 남길지
 */
export function applySummary(f: Funding, s: ContributionSummary, mine: StoredContribution[], keepLocal: boolean): Funding {
  const goal = s.goal && s.goal > 0 ? s.goal : f.goal;
  const participants = [...participantsFromSummary(s, mine), ...(keepLocal ? f.participants.filter((p) => !isDbParticipant(p)) : [])].sort(
    (a, b) => a.createdAt - b.createdAt,
  );
  const raised = participants.reduce((sum, p) => sum + p.amount, 0);
  const phase = f.phase === "active" && raised >= goal ? "achieved" : f.phase;
  return { ...f, goal, participants, phase };
}
