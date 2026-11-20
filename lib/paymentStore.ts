import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { ContributeError, type ContributeResult, type ContributionSummary, getContributionSummary, saveContribution, saveTopupContribution } from "./contributionStore";
import { goalWithFee } from "./fee";
import { giftStatusOf } from "./giftStatus";
import { getDelivery, getShare, verifyShareKey } from "./shareStore";

/**
 * 토스페이먼츠 결제 주문 저장소 — 서버 전용.
 * Supabase: mogiving_payment_orders 테이블 + mogiving_finalize_payment() 함수.
 * 환경변수가 없으면 로컬 개발용 JSON 파일(.data/payment-orders.json)을 쓴다.
 *
 * 결제가 승인되면 곧바로 수령인의 지정 선물 전용 교환권이 발행(구매 확정)된다.
 * 결제 취소는 교환권을 발행하지 못한 결제(그사이 선물이 완성되었거나 기간이 끝난 경우의 초과분)에만 일어난다.
 */

export type RefundStatus = "none" | "required" | "done" | "failed";

/** gift: 친구의 선물 보태기 · topup: 수령인의 차액 결제 */
export type OrderKind = "gift" | "topup";

export type PaymentOrder = {
  orderId: string;
  shareId: string;
  kind: OrderKind;
  nickname: string;
  message: string;
  amount: number;
  status: "pending" | "approved" | "finalized" | "failed";
  paymentKey: string | null;
};

export type FinalizeResult = {
  shareId: string;
  kind: OrderKind;
  contributionId: string | null;
  recordedAmount: number;
  /** 교환권을 발행하지 못해 결제 취소해야 하는 금액 */
  refundAmount: number;
  refundStatus: RefundStatus;
  collected: number;
  count: number;
  goal: number | null;
  contributedAt: number | null;
  /** 이 결제로 선물이 처음 100% 완성됐는지 (재시도에는 false) */
  completedNow: boolean;
};

export class PaymentStoreError extends Error {
  constructor(
    public code: string,
    public detail?: unknown,
  ) {
    super(code);
  }
}

type NewOrder = Pick<PaymentOrder, "orderId" | "shareId" | "kind" | "nickname" | "message" | "amount">;

/** 운영자가 확인해야 하는 결제 취소 주문. 관리자 화면에 내보내므로 결제 키와 참여자 정보는 담지 않는다 */
export type RefundAttention = {
  orderId: string;
  shareId: string;
  amount: number;
  refundAmount: number;
  refundStatus: "required" | "failed";
  updatedAt: string | null;
};

interface PaymentStore {
  /** 결제 취소가 실패했거나 아직 끝나지 않은 주문 (오래된 순) */
  listRefundAttention(limit: number): Promise<RefundAttention[]>;
  create(order: NewOrder): Promise<void>;
  get(orderId: string): Promise<PaymentOrder | null>;
  markApproved(orderId: string, paymentKey: string): Promise<void>;
  /** 결제 전 상태인 주문만 실패 처리한다 */
  markFailed(orderId: string, code: string): Promise<void>;
  finalize(orderId: string, paymentKey: string): Promise<FinalizeResult>;
  setRefundStatus(orderId: string, status: RefundStatus): Promise<void>;
}

/* ------------------------------ Supabase (배포용) ------------------------------ */

function supabaseStore(url: string, serviceKey: string): PaymentStore {
  const base = `${url.replace(/\/$/, "")}/rest/v1`;
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" };
  const call = (p: string, init: RequestInit = {}) => fetch(`${base}${p}`, { ...init, headers: { ...headers, ...init.headers }, cache: "no-store" });
  const order = (id: string) => `/mogiving_payment_orders?order_id=eq.${encodeURIComponent(id)}`;

  const fail = async (what: string, res: Response) => {
    const text = await res.text().catch(() => "");
    let detail: { message?: string } = { message: text.slice(0, 500) };
    try {
      detail = JSON.parse(text) as { message?: string };
    } catch {
      /* JSON이 아니면 원문 일부만 남긴다 */
    }
    return new PaymentStoreError(`store_unavailable`, { what, status: res.status, ...detail });
  };

  const patch = async (what: string, query: string, body: Record<string, unknown>) => {
    const res = await call(query, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ ...body, updated_at: new Date().toISOString() }) });
    if (!res.ok) throw await fail(what, res);
  };

  return {
    async listRefundAttention(limit) {
      const res = await call(`/mogiving_payment_orders?refund_status=in.(required,failed)&select=order_id,share_id,amount,refund_amount,refund_status,updated_at&order=updated_at.asc&limit=${limit}`);
      if (!res.ok) throw await fail("listRefundAttention", res);
      const rows = (await res.json()) as { order_id: string; share_id: string; amount: number; refund_amount: number; refund_status: RefundAttention["refundStatus"]; updated_at: string }[];
      return rows.map((r) => ({ orderId: r.order_id, shareId: r.share_id, amount: r.amount, refundAmount: r.refund_amount, refundStatus: r.refund_status, updatedAt: r.updated_at }));
    },

    async create({ orderId, shareId, kind, nickname, message, amount }) {
      const res = await call("/mogiving_payment_orders", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ order_id: orderId, share_id: shareId, kind, nickname, message, amount }),
      });
      if (!res.ok) throw await fail("create", res);
    },

    async get(orderId) {
      const res = await call(`${order(orderId)}&select=*`);
      if (!res.ok) throw await fail("get", res);
      const r = (
        (await res.json()) as { order_id: string; share_id: string; kind?: OrderKind; nickname: string; message: string; amount: number; status: PaymentOrder["status"]; payment_key: string | null }[]
      )[0];
      return r
        ? { orderId: r.order_id, shareId: r.share_id, kind: r.kind === "topup" ? "topup" : "gift", nickname: r.nickname, message: r.message, amount: r.amount, status: r.status, paymentKey: r.payment_key }
        : null;
    },

    markApproved: (orderId, paymentKey) => patch("markApproved", `${order(orderId)}&status=eq.pending`, { status: "approved", payment_key: paymentKey }),
    markFailed: (orderId, code) => patch("markFailed", `${order(orderId)}&status=eq.pending`, { status: "failed", failure_code: code.slice(0, 80) }),
    setRefundStatus: (orderId, status) => patch("setRefundStatus", order(orderId), { refund_status: status }),

    async finalize(orderId, paymentKey) {
      const res = await call("/rpc/mogiving_finalize_payment", { method: "POST", body: JSON.stringify({ p_order_id: orderId, p_payment_key: paymentKey }) });
      if (!res.ok) {
        const err = await fail("finalize", res);
        const message = (err.detail as { message?: string }).message;
        if (message === "order_not_found" || message === "order_failed" || message === "payment_key_mismatch") throw new PaymentStoreError(message, err.detail);
        throw err;
      }
      const r = (
        (await res.json()) as {
          share_id: string;
          contribution_id: string | null;
          recorded_amount: number;
          refund_amount: number;
          refund_status: RefundStatus;
          collected_amount: number;
          contribution_count: number;
          goal: number | null;
          contributed_at: string | null;
          kind: OrderKind;
          completed_now: boolean;
        }[]
      )[0];
      if (!r) throw new PaymentStoreError("store_unavailable", { what: "finalize returned no row" });
      return {
        shareId: r.share_id,
        kind: r.kind === "topup" ? "topup" : "gift",
        contributionId: r.contribution_id,
        recordedAmount: r.recorded_amount,
        refundAmount: r.refund_amount,
        refundStatus: r.refund_status,
        collected: r.collected_amount,
        count: r.contribution_count,
        goal: r.goal,
        contributedAt: r.contributed_at ? Date.parse(r.contributed_at) : null,
        completedNow: !!r.completed_now,
      };
    },
  };
}

/* ------------------------------ 로컬 파일 (개발용) ------------------------------ */

type FileOrder = PaymentOrder & { result?: FinalizeResult };

function fileStore(): PaymentStore {
  const file = path.join(process.env.SHARE_STORE_DIR ?? path.join(process.cwd(), ".data"), "payment-orders.json");
  const load = async (): Promise<Record<string, FileOrder>> => {
    try {
      return JSON.parse(await readFile(file, "utf8")) as Record<string, FileOrder>;
    } catch {
      return {};
    }
  };
  const save = async (all: Record<string, FileOrder>) => {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(all));
  };
  // Supabase의 행 잠금을 대신해 주문 처리를 한 줄로 세운다
  let queue: Promise<unknown> = Promise.resolve();
  const exclusive = <T,>(fn: () => Promise<T>): Promise<T> => {
    const run = queue.then(fn, fn);
    queue = run.catch(() => undefined);
    return run;
  };

  return {
    listRefundAttention: async (limit) =>
      Object.values(await load())
        .flatMap((o) =>
          o.result?.refundStatus === "required" || o.result?.refundStatus === "failed"
            ? [{ orderId: o.orderId, shareId: o.shareId, amount: o.amount, refundAmount: o.result.refundAmount, refundStatus: o.result.refundStatus, updatedAt: null }]
            : [],
        )
        .slice(0, limit),
    create: (o) =>
      exclusive(async () => {
        const all = await load();
        all[o.orderId] = { ...o, status: "pending", paymentKey: null };
        await save(all);
      }),
    get: async (orderId) => {
      const o = (await load())[orderId];
      return o ? { ...o, kind: o.kind ?? "gift" } : null;
    },
    markApproved: (orderId, paymentKey) =>
      exclusive(async () => {
        const all = await load();
        if (all[orderId]?.status === "pending") {
          all[orderId] = { ...all[orderId], status: "approved", paymentKey };
          await save(all);
        }
      }),
    markFailed: (orderId) =>
      exclusive(async () => {
        const all = await load();
        if (all[orderId]?.status === "pending") {
          all[orderId] = { ...all[orderId], status: "failed" };
          await save(all);
        }
      }),
    setRefundStatus: (orderId, status) =>
      exclusive(async () => {
        const all = await load();
        const result = all[orderId]?.result;
        if (result) {
          all[orderId] = { ...all[orderId], result: { ...result, refundStatus: status } };
          await save(all);
        }
      }),
    finalize: (orderId, paymentKey) =>
      exclusive(async () => {
        const all = await load();
        const o = all[orderId];
        if (!o) throw new PaymentStoreError("order_not_found");
        if (o.status === "failed") throw new PaymentStoreError("order_failed");
        if (o.paymentKey && o.paymentKey !== paymentKey) throw new PaymentStoreError("payment_key_mismatch");
        // 다시 확인하는 요청에는 저장된 결과를 돌려주되, 완성 알림은 처음 한 번만
        if (o.status === "finalized" && o.result) return { ...o.result, completedNow: false };

        const kind = o.kind ?? "gift";
        let result: FinalizeResult;
        try {
          const r: ContributeResult =
            kind === "topup" ? await saveTopupContribution(o.shareId, o.amount) : await saveContribution(o.shareId, { nickname: o.nickname, message: o.message, amount: o.amount });
          const refundAmount = o.amount - r.contribution.amount;
          result = {
            shareId: o.shareId,
            kind,
            contributionId: r.contribution.id,
            recordedAmount: r.contribution.amount,
            refundAmount,
            refundStatus: refundAmount > 0 ? "required" : "none",
            collected: r.collected,
            count: r.count,
            goal: r.goal,
            contributedAt: r.contribution.createdAt,
            completedNow: r.completedNow,
          };
        } catch (e) {
          if (!(e instanceof ContributeError) || !["funding_closed", "share_not_found", "goal_missing", "topup_unavailable"].includes(e.code)) throw e;
          const s = await getContributionSummary(o.shareId);
          result = {
            shareId: o.shareId,
            kind,
            contributionId: null,
            recordedAmount: 0,
            refundAmount: o.amount,
            refundStatus: "required",
            collected: s?.collected ?? 0,
            count: s?.count ?? 0,
            goal: s?.goal ?? null,
            contributedAt: null,
            completedNow: false,
          };
        }
        all[orderId] = { ...o, kind, status: "finalized", paymentKey, result };
        await save(all);
        return result;
      }),
  };
}

const store: PaymentStore =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? supabaseStore(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    : fileStore();

export const createPaymentOrder = (o: NewOrder) => store.create(o);
export const getPaymentOrder = (orderId: string) => store.get(orderId);
export const markOrderApproved = (orderId: string, paymentKey: string) => store.markApproved(orderId, paymentKey);
export const markOrderFailed = (orderId: string, code: string) => store.markFailed(orderId, code);
export const finalizePayment = (orderId: string, paymentKey: string) => store.finalize(orderId, paymentKey);
export const setRefundStatus = (orderId: string, status: RefundStatus) => store.setRefundStatus(orderId, status);
export const listRefundAttention = (limit: number) => store.listRefundAttention(limit);

/** 참여 요약 + 공동 선물 상태 + 배송 접수. 화면 동기화와 공유 화면이 함께 쓴다 */
export async function getFundingSummary(shareId: string, ownerKey?: string): Promise<ContributionSummary | null> {
  const summary = await getContributionSummary(shareId, ownerKey);
  if (!summary) return null;
  const share = await getShare(shareId);
  const goal = summary.goal && summary.goal > 0 ? summary.goal : share ? goalWithFee(share.p.price) : 0;
  const status = giftStatusOf({ stored: summary.status, collected: summary.collected, goal, deadline: share?.d ?? Date.now() });
  const stored = await getDelivery(shareId);
  // 배송지는 수령인에게만 내보낸다
  const isOwner = !!stored && !!ownerKey && (await verifyShareKey(shareId, ownerKey));
  const delivery = stored && { requestedAt: stored.requestedAt, ...(isOwner && stored.shipping ? { shipping: stored.shipping } : {}) };
  return { ...summary, status, delivery };
}

/** 지금 이 선물의 결제 가능 여부. 선물을 읽지 못하면 null */
export async function fundingAvailability(shareId: string) {
  const share = await getShare(shareId);
  if (!share) return null;
  const summary = await getFundingSummary(shareId);
  if (!summary) return null;
  const goal = summary.goal && summary.goal > 0 ? summary.goal : goalWithFee(share.p.price);
  const status = summary.status ?? "ACTIVE";
  return {
    status,
    /** 친구가 선물을 보탤 수 있는지 */
    open: status === "ACTIVE" && share.d > Date.now() && summary.collected < goal,
    achieved: status === "COMPLETED_FULL" || summary.collected >= goal,
    /** 수령인이 차액 결제 또는 모바일 상품권 전환을 고를 수 있는지 */
    pendingChoice: status === "PENDING_CHOICE" && !summary.delivery,
    remaining: Math.max(0, goal - summary.collected),
    goal,
    collected: summary.collected,
    productName: share.p.name,
  };
}
