import { createHash, randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { isGiftStatus } from "./giftStatus";
import type { GiftStatus, ShippingAddress } from "./types";

/**
 * 선물 보태기(선물 교환권 적립) 저장소 — 서버 전용.
 * Supabase: mogiving_contributions 테이블 + mogiving_shares 누적 컬럼, 저장은 mogiving_contribute() 함수 한 번으로 원자적으로 처리.
 * 환경변수가 없으면 로컬 개발용 JSON 파일(.data/contributions.json)을 쓴다.
 */

export type StoredContribution = { id: string; nickname: string; message: string; amount: number; createdAt: number };

/** 모바일 상품권 전환 신청. type·amount는 수령인에게만 내보낸다 */
export type FundingVoucherInfo = { requestedAt: number; type?: string; amount?: number };

export type ContributionSummary = {
  goal: number | null;
  collected: number;
  count: number;
  /** includePrivate가 아니면 nickname·message는 빈 문자열 (다른 친구의 메시지·이름은 수령인에게만) */
  contributions: StoredContribution[];
  /** 공동 선물 상태. getFundingSummary가 마감일까지 반영해 채운다 */
  status?: GiftStatus;
  /** 모바일 상품권 전환 신청 */
  voucher?: FundingVoucherInfo | null;
  /** 배송 접수 기록. 배송지는 수령인 key가 맞을 때만 담는다 */
  delivery?: FundingDelivery | null;
};

export type FundingDelivery = { requestedAt: number; shipping?: ShippingAddress };

/** completedNow: 이 결제로 처음 100% 완성됐는지 (운영 알림을 한 번만 보내기 위해) */
export type ContributeResult = { contribution: StoredContribution; goal: number; collected: number; count: number; completedNow: boolean };

/** 클라이언트에 그대로 돌려줄 수 있는 실패 사유 */
export type ContributeErrorCode = "share_not_found" | "funding_closed" | "invalid_amount" | "goal_missing" | "topup_unavailable" | "store_unavailable";

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
const KNOWN_DB_ERRORS: ContributeErrorCode[] = ["share_not_found", "funding_closed", "invalid_amount", "goal_missing", "topup_unavailable"];

/** 차액 결제로 기록되는 참여의 표시 이름 */
export const TOPUP_NICKNAME = "차액 결제";

type StoredVoucher = { requestedAt?: number; type?: string; amount?: number } | null | undefined;
const voucherInfo = (v: StoredVoucher, isOwner: boolean): FundingVoucherInfo | null =>
  v ? { requestedAt: typeof v.requestedAt === "number" ? v.requestedAt : Date.now(), ...(isOwner ? { type: v.type, amount: v.amount } : {}) } : null;

interface ContributionStore {
  contribute(shareId: string, input: { nickname: string; message: string; amount: number }): Promise<ContributeResult>;
  /** 기간이 끝난 미도달 선물에 수령인이 남은 차액을 정확히 채운다 */
  contributeTopup(shareId: string, amount: number): Promise<ContributeResult>;
  /** ownerKey가 맞으면 닉네임·메시지까지 포함. status는 저장된 상태 그대로 */
  summary(shareId: string, ownerKey?: string): Promise<ContributionSummary | null>;
}

/* ------------------------------ Supabase (배포용) ------------------------------ */

type RpcRow = { contribution_id: string; amount: number; collected_amount: number; contribution_count: number; goal: number; created_at: string; completed_now: boolean };

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

  const rpc = async (fn: string, args: Record<string, unknown>, input: { nickname: string; message: string }): Promise<ContributeResult> => {
    const res = await call(`/rpc/${fn}`, { method: "POST", body: JSON.stringify(args) });
    if (!res.ok) {
      const err = await readError(res);
      const known = KNOWN_DB_ERRORS.find((c) => err.message === c);
      if (known) throw new ContributeError(known, known, err);
      // 404 PGRST202: 함수 없음 → 마이그레이션(20261121000000_mogiving_gift_voucher_model.sql) 미적용
      throw new ContributeError("store_unavailable", `supabase rpc ${fn} ${res.status}`, { status: res.status, ...err });
    }
    const r = ((await res.json()) as RpcRow[])[0];
    if (!r) throw new ContributeError("store_unavailable", "supabase rpc returned no row");
    return {
      contribution: { id: r.contribution_id, nickname: input.nickname, message: input.message, amount: r.amount, createdAt: Date.parse(r.created_at) },
      goal: r.goal,
      collected: r.collected_amount,
      count: r.contribution_count,
      completedNow: !!r.completed_now,
    };
  };

  return {
    contribute: (shareId, { nickname, message, amount }) =>
      rpc("mogiving_contribute", { p_share_id: shareId, p_nickname: nickname, p_message: message, p_amount: amount }, { nickname, message }),
    contributeTopup: (shareId, amount) => rpc("mogiving_contribute_topup", { p_share_id: shareId, p_amount: amount }, { nickname: TOPUP_NICKNAME, message: "" }),

    async summary(shareId, ownerKey) {
      // select=*: 상태 컬럼을 추가하는 마이그레이션 적용 전에도 화면이 깨지지 않게
      const shareRes = await call(`/mogiving_shares?id=eq.${encodeURIComponent(shareId)}&select=*`);
      if (!shareRes.ok) throw new ContributeError("store_unavailable", `supabase shares ${shareRes.status}`, await readError(shareRes));
      const share = (
        (await shareRes.json()) as { goal: number | null; collected_amount: number; contribution_count: number; key_hash: string; gift_status?: string; voucher_request?: StoredVoucher }[]
      )[0];
      if (!share) return null;
      const isOwner = !!ownerKey && hashKey(ownerKey) === share.key_hash;
      const listRes = await call(`/mogiving_contributions?share_id=eq.${encodeURIComponent(shareId)}&select=id,nickname,message,amount,created_at&order=created_at.asc&limit=1000`);
      if (!listRes.ok) throw new ContributeError("store_unavailable", `supabase contributions ${listRes.status}`, await readError(listRes));
      const rows = (await listRes.json()) as { id: string; nickname: string; message: string; amount: number; created_at: string }[];
      return {
        goal: share.goal,
        collected: share.collected_amount,
        count: share.contribution_count,
        status: isGiftStatus(share.gift_status) ? share.gift_status : undefined,
        voucher: voucherInfo(share.voucher_request, isOwner),
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
  type Share = { keyHash: string; deliveryRequestedAt?: number; voucher?: StoredVoucher; payload: { d: number; p: { price: number }; x?: { g?: number } } };
  const goalOf = (s: Share) => s.payload.x?.g || s.payload.p.price;

  const append = async (shareId: string, check: (share: Share, goal: number, collected: number) => number, input: { nickname: string; message: string }): Promise<ContributeResult> => {
    const share = (await readJson<Record<string, Share>>(sharesFile, {}))[shareId];
    if (!share) throw new ContributeError("share_not_found", "share_not_found");
    const all = await readJson<Record<string, StoredContribution[]>>(file, {});
    const list = all[shareId] ?? [];
    const goal = goalOf(share);
    const collected = list.reduce((s, c) => s + c.amount, 0);
    const amount = check(share, goal, collected);
    const contribution = { id: randomUUID(), nickname: input.nickname, message: input.message, amount, createdAt: Date.now() };
    all[shareId] = [...list, contribution];
    await mkdir(dir, { recursive: true });
    await writeFile(file, JSON.stringify(all));
    return { contribution, goal, collected: collected + amount, count: list.length + 1, completedNow: collected < goal && collected + amount >= goal };
  };

  return {
    contribute: (shareId, { nickname, message, amount }) =>
      append(
        shareId,
        (share, goal, collected) => {
          if (share.voucher || collected >= goal || share.payload.d < Date.now()) throw new ContributeError("funding_closed", "funding_closed");
          return Math.min(amount, goal - collected);
        },
        { nickname, message },
      ),
    contributeTopup: (shareId, amount) =>
      append(
        shareId,
        (share, goal, collected) => {
          if (share.voucher || share.deliveryRequestedAt || collected >= goal || share.payload.d > Date.now() || amount !== goal - collected)
            throw new ContributeError("topup_unavailable", "topup_unavailable");
          return amount;
        },
        { nickname: TOPUP_NICKNAME, message: "" },
      ),
    async summary(shareId, ownerKey) {
      const share = (await readJson<Record<string, Share>>(sharesFile, {}))[shareId];
      if (!share) return null;
      const isOwner = !!ownerKey && hashKey(ownerKey) === share.keyHash;
      const list = (await readJson<Record<string, StoredContribution[]>>(file, {}))[shareId] ?? [];
      return {
        goal: goalOf(share),
        collected: list.reduce((s, c) => s + c.amount, 0),
        count: list.length,
        status: share.voucher ? "CONVERTED_VOUCHER" : undefined,
        voucher: voucherInfo(share.voucher, isOwner),
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
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

export function saveContribution(shareId: string, input: { nickname: string; message: string; amount: number }) {
  return exclusive(() => store.contribute(shareId, input));
}

export function saveTopupContribution(shareId: string, amount: number) {
  return exclusive(() => store.contributeTopup(shareId, amount));
}

export function getContributionSummary(shareId: string, ownerKey?: string) {
  return store.summary(shareId, ownerKey);
}
