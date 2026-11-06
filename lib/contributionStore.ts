import { createHash, randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

/**
 * 조각 선물(참여) 저장소 — 서버 전용.
 * Supabase: mogiving_contributions 테이블 + mogiving_shares 누적 컬럼, 저장은 mogiving_contribute() 함수 한 번으로 원자적으로 처리.
 * 환경변수가 없으면 로컬 개발용 JSON 파일(.data/contributions.json)을 쓴다.
 */

export type StoredContribution = { id: string; nickname: string; message: string; amount: number; createdAt: number };

export type ContributionSummary = {
  goal: number | null;
  collected: number;
  count: number;
  /** includePrivate가 아니면 nickname·message는 빈 문자열 (다른 친구의 메시지·이름은 주최자에게만) */
  contributions: StoredContribution[];
  /** 미달 펀딩 전액 취소 진행 상태. amount는 참여자들이 결제한 금액 합계 */
  refund?: FundingRefundState;
};

export type FundingRefundState = { state: "none" | "in_progress" | "done"; amount: number; count: number };

export type ContributeResult = { contribution: StoredContribution; goal: number; collected: number; count: number };

/** 클라이언트에 그대로 돌려줄 수 있는 실패 사유 */
export type ContributeErrorCode = "share_not_found" | "funding_closed" | "invalid_amount" | "goal_missing" | "store_unavailable";

export class ContributeError extends Error {
  constructor(
    public code: ContributeErrorCode,
    message: string,
    public detail?: unknown,
  ) {
    super(message);
  }
}

const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");
const KNOWN_DB_ERRORS: ContributeErrorCode[] = ["share_not_found", "funding_closed", "invalid_amount", "goal_missing"];

interface ContributionStore {
  contribute(shareId: string, input: { nickname: string; message: string; amount: number }): Promise<ContributeResult>;
  /** ownerKey가 맞으면 닉네임·메시지까지 포함 */
  summary(shareId: string, ownerKey?: string): Promise<ContributionSummary | null>;
}

/* ------------------------------ Supabase (배포용) ------------------------------ */

function supabaseStore(url: string, serviceKey: string): ContributionStore {
  const base = `${url.replace(/\/$/, "")}/rest/v1`;
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" };
  const call = (p: string, init: RequestInit = {}) => fetch(`${base}${p}`, { ...init, headers: { ...headers, ...init.headers }, cache: "no-store" });

  /** PostgREST 오류 본문을 읽어 서버 로그에 남길 수 있게 만든다 */
  const readError = async (res: Response) => {
    const text = await res.text().catch(() => "");
    try {
      return JSON.parse(text) as { code?: string; message?: string; hint?: string; details?: string };
    } catch {
      return { message: text.slice(0, 500) };
    }
  };

  return {
    async contribute(shareId, { nickname, message, amount }) {
      const res = await call("/rpc/mogiving_contribute", {
        method: "POST",
        body: JSON.stringify({ p_share_id: shareId, p_nickname: nickname, p_message: message, p_amount: amount }),
      });
      if (!res.ok) {
        const err = await readError(res);
        const known = KNOWN_DB_ERRORS.find((c) => err.message === c);
        if (known) throw new ContributeError(known, known, err);
        // 404 PGRST202: 함수 없음 → 마이그레이션(20261102000000_mogiving_contributions.sql) 미적용
        throw new ContributeError("store_unavailable", `supabase rpc mogiving_contribute ${res.status}`, { status: res.status, ...err });
      }
      const rows = (await res.json()) as { contribution_id: string; amount: number; collected_amount: number; contribution_count: number; goal: number; created_at: string }[];
      const r = rows[0];
      if (!r) throw new ContributeError("store_unavailable", "supabase rpc returned no row");
      return {
        contribution: { id: r.contribution_id, nickname, message, amount: r.amount, createdAt: Date.parse(r.created_at) },
        goal: r.goal,
        collected: r.collected_amount,
        count: r.contribution_count,
      };
    },

    async summary(shareId, ownerKey) {
      const shareRes = await call(`/mogiving_shares?id=eq.${encodeURIComponent(shareId)}&select=goal,collected_amount,contribution_count,key_hash`);
      if (!shareRes.ok) throw new ContributeError("store_unavailable", `supabase shares ${shareRes.status}`, await readError(shareRes));
      const share = ((await shareRes.json()) as { goal: number | null; collected_amount: number; contribution_count: number; key_hash: string }[])[0];
      if (!share) return null;
      const isOwner = !!ownerKey && hashKey(ownerKey) === share.key_hash;
      const listRes = await call(`/mogiving_contributions?share_id=eq.${encodeURIComponent(shareId)}&select=id,nickname,message,amount,created_at&order=created_at.asc&limit=1000`);
      if (!listRes.ok) throw new ContributeError("store_unavailable", `supabase contributions ${listRes.status}`, await readError(listRes));
      const rows = (await listRes.json()) as { id: string; nickname: string; message: string; amount: number; created_at: string }[];
      return {
        goal: share.goal,
        collected: share.collected_amount,
        count: share.contribution_count,
        contributions: rows.map((r) => ({
          id: r.id,
          nickname: isOwner ? r.nickname : "",
          message: isOwner ? r.message : "",
          amount: r.amount,
          createdAt: Date.parse(r.created_at),
        })),
      };
    },
  };
}

/* ------------------------------ 로컬 파일 (개발용) ------------------------------ */

function fileStore(): ContributionStore {
  const dir = process.env.SHARE_STORE_DIR ?? path.join(process.cwd(), ".data");
  const file = path.join(dir, "contributions.json");
  const sharesFile = path.join(dir, "shares.json");
  const readJson = async <T,>(f: string, fallback: T): Promise<T> => {
    try {
      return JSON.parse(await readFile(f, "utf8")) as T;
    } catch {
      return fallback;
    }
  };
  type Share = { keyHash: string; payload: { d: number; p: { price: number }; x?: { g?: number } } };
  const goalOf = (s: Share) => s.payload.x?.g || s.payload.p.price;

  return {
    async contribute(shareId, { nickname, message, amount }) {
      const share = (await readJson<Record<string, Share>>(sharesFile, {}))[shareId];
      if (!share) throw new ContributeError("share_not_found", "share_not_found");
      const all = await readJson<Record<string, StoredContribution[]>>(file, {});
      const list = all[shareId] ?? [];
      const goal = goalOf(share);
      const collected = list.reduce((s, c) => s + c.amount, 0);
      if (collected >= goal || share.payload.d < Date.now()) throw new ContributeError("funding_closed", "funding_closed");
      const contribution = { id: randomUUID(), nickname, message, amount: Math.min(amount, goal - collected), createdAt: Date.now() };
      all[shareId] = [...list, contribution];
      await mkdir(dir, { recursive: true });
      await writeFile(file, JSON.stringify(all));
      return { contribution, goal, collected: collected + contribution.amount, count: list.length + 1 };
    },
    async summary(shareId, ownerKey) {
      const share = (await readJson<Record<string, Share>>(sharesFile, {}))[shareId];
      if (!share) return null;
      const isOwner = !!ownerKey && hashKey(ownerKey) === share.keyHash;
      const list = (await readJson<Record<string, StoredContribution[]>>(file, {}))[shareId] ?? [];
      return {
        goal: goalOf(share),
        collected: list.reduce((s, c) => s + c.amount, 0),
        count: list.length,
        contributions: list.map((c) => (isOwner ? c : { ...c, nickname: "", message: "" })),
      };
    },
  };
}

const store: ContributionStore =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? supabaseStore(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    : fileStore();

/** 파일 저장소에서 동시 저장이 서로 덮어쓰지 않도록 (Supabase는 DB 행 잠금으로 처리) */
let queue: Promise<unknown> = Promise.resolve();
export function saveContribution(shareId: string, input: { nickname: string; message: string; amount: number }) {
  const run = queue.then(
    () => store.contribute(shareId, input),
    () => store.contribute(shareId, input),
  );
  queue = run.catch(() => undefined);
  return run;
}

export function getContributionSummary(shareId: string, ownerKey?: string) {
  return store.summary(shareId, ownerKey);
}
