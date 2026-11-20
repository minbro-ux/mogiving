import { createHash, randomBytes } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { getContributionSummary } from "./contributionStore";
import { FEE_PERCENT, goalWithFee, voucherAmount } from "./fee";
import { isGiftStatus } from "./giftStatus";
import { maxDeadline } from "./policy";
import { type SharePayload, adminExtra, publicPayload } from "./share";
import type { GiftStatus, ShippingAddress } from "./types";

/** goal은 integer 컬럼 */
const MAX_GOAL_COLUMN = 2_147_483_647;

/**
 * 짧은 공유 링크(/f/[shortId]) 저장소.
 * SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY가 있으면 Supabase mogiving_shares 테이블(서버 전용)을 쓰고,
 * 없으면 로컬 개발용 JSON 파일(.data/shares.json)로 대체한다.
 *
 * 저장 형태: payload 컬럼 = 공개 요약만, shipping 컬럼 = 주최자 배송지(비공개).
 * 조회는 payload 컬럼만 읽으므로 배송지는 공유 화면·API 응답으로 나갈 경로가 없다.
 */

/** 헷갈리는 문자(0/O, 1/l/I)를 뺀 base56 */
const ALPHABET = "23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
const ID_LENGTH = 7;
export const SHORT_ID_RE = new RegExp(`^[${ALPHABET}]{${ID_LENGTH}}$`);

const randomCode = (n: number) => Array.from(randomBytes(n), (b) => ALPHABET[b % ALPHABET.length]).join("");
const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");

export type ShortLink = { id: string; key: string };

interface ShareStore {
  /** prev의 key가 맞으면 내용만 갱신하고 true. shipping이 없으면 기존 배송지는 그대로 둔다 */
  update(prev: ShortLink, payload: SharePayload, shipping?: ShippingAddress): Promise<boolean>;
  /** 새 id로 저장. id가 이미 있으면 false (호출 측에서 다른 id로 재시도) */
  insert(id: string, keyHash: string, payload: SharePayload, shipping: ShippingAddress | undefined, goal: number | null): Promise<boolean>;
  /** 공개 요약(payload 컬럼)만 읽는다 */
  get(id: string): Promise<SharePayload | null>;
  /** 주최자 비밀 key가 맞는지 */
  verifyKey(id: string, keyHash: string): Promise<boolean>;
  /** 관리자 페이지용 전체 목록 (배송지 포함, 최신 등록순) */
  list(): Promise<AdminShareRow[]>;
  /** 아직 접수되지 않았을 때만 배송지와 접수 시각을 저장한다 */
  requestDelivery(id: string, keyHash: string, shipping: ShippingAddress): Promise<void>;
  getDelivery(id: string): Promise<StoredDelivery | null>;
  /** 기간이 끝난 미도달 선물을 모바일 상품권 전환 신청 상태(CONVERTED_VOUCHER)로 만든다 */
  convertVoucher(id: string, request: VoucherRequestInput): Promise<ConvertVoucherResult>;
  /** 운영 알림용: 운영자 전용 정보(x)가 담긴 payload와 수령인 배송지 */
  getOps(id: string): Promise<{ payload: SharePayload; shipping: ShippingAddress | null } | null>;
  /** 기간이 끝난 ACTIVE 미도달 선물을 PENDING_CHOICE로 바꾸고 바뀐 id를 돌려준다 */
  markPendingChoice(nowMs: number, limit: number): Promise<string[]>;
}

/** 수령인이 입력하는 모바일 상품권 전환 정보 */
export type VoucherRequestInput = { type: string; name: string; phone: string };
/** 저장된 전환 신청. amount = 적립 금액에서 수수료를 뺀 원가 상당액 */
export type VoucherRequest = VoucherRequestInput & { amount: number; collected: number; requestedAt: number };

/** converted: 이번에 신청됨 · already: 이미 신청됨 · unavailable: 기간 종료 전이거나 완성·적립 0원 · not_found: 선물 없음 */
export type ConvertVoucherResult = { result: "converted" | "already"; request: VoucherRequest } | { result: "unavailable" | "not_found" };

export type StoredDelivery = { requestedAt: number; shipping: ShippingAddress | null };

/** 관리자 페이지 전용 행. 서버에서만 만들고 /admin 화면·CSV로만 내보낸다 */
export type AdminShareRow = {
  id: string;
  createdAt: string;
  updatedAt: string;
  payload: SharePayload;
  shipping: ShippingAddress | null;
  /** 주최자가 배송을 접수한 시각 (없으면 미접수) */
  deliveryRequestedAt: string | null;
  /** 저장된 공동 선물 상태 (로컬 저장소에는 없음) */
  giftStatus: GiftStatus | null;
  /** 모바일 상품권 전환 신청 */
  voucher: VoucherRequest | null;
};

/* ------------------------------ Supabase (배포용) ------------------------------ */

const TABLE = "mogiving_shares";

function supabaseStore(url: string, serviceKey: string): ShareStore {
  const endpoint = `${url.replace(/\/$/, "")}/rest/v1/${TABLE}`;
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" };
  // Next 서버 컴포넌트의 fetch 캐시를 끄고 항상 최신 완성도을 읽는다
  const call = (query: string, init: RequestInit) => fetch(`${endpoint}${query}`, { ...init, headers: { ...headers, ...init.headers }, cache: "no-store" });
  const rpc = (fn: string, args: Record<string, unknown>) =>
    fetch(`${url.replace(/\/$/, "")}/rest/v1/rpc/${fn}`, { method: "POST", headers, body: JSON.stringify(args), cache: "no-store" });

  return {
    async update(prev, payload, shipping) {
      const res = await call(`?id=eq.${encodeURIComponent(prev.id)}&key_hash=eq.${hashKey(prev.key)}&select=id`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ payload, ...(shipping ? { shipping } : {}), updated_at: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error(`supabase update ${res.status}`);
      return ((await res.json()) as unknown[]).length > 0;
    },
    async insert(id, keyHash, payload, shipping, goal) {
      const res = await call("", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ id, key_hash: keyHash, payload, shipping: shipping ?? null, goal }),
      });
      if (res.status === 409) return false;
      if (!res.ok) throw new Error(`supabase insert ${res.status}`);
      return true;
    },
    async get(id) {
      const res = await call(`?id=eq.${encodeURIComponent(id)}&select=payload`, { method: "GET" });
      if (!res.ok) throw new Error(`supabase get ${res.status}`);
      const rows = (await res.json()) as { payload: SharePayload }[];
      return rows[0]?.payload ?? null;
    },
    async verifyKey(id, keyHash) {
      const res = await call(`?id=eq.${encodeURIComponent(id)}&key_hash=eq.${keyHash}&select=id`, { method: "GET" });
      if (!res.ok) throw new Error(`supabase verifyKey ${res.status}`);
      return ((await res.json()) as unknown[]).length > 0;
    },
    async list() {
      // select=*: 참여 누적 컬럼(collected_amount)이 아직 없는 DB에서도 목록이 깨지지 않게
      const res = await call(`?select=*&order=created_at.desc&limit=1000`, { method: "GET" });
      if (!res.ok) throw new Error(`supabase list ${res.status}`);
      const rows = (await res.json()) as {
        id: string;
        payload: SharePayload;
        shipping: ShippingAddress | null;
        created_at: string;
        updated_at: string;
        goal?: number | null;
        collected_amount?: number;
        delivery_requested_at?: string | null;
        gift_status?: string;
        voucher_request?: VoucherRequest | null;
      }[];
      return rows.map((r) => ({
        id: r.id,
        // 현재 모인 금액은 주최자 화면 값(x.a)이 아니라 실제 결제 저장값(DB)을 쓴다
        payload:
          typeof r.collected_amount === "number" && r.payload.x
            ? { ...r.payload, x: { ...r.payload.x, g: r.goal ?? r.payload.x.g, a: r.collected_amount } }
            : r.payload,
        shipping: r.shipping,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        deliveryRequestedAt: r.delivery_requested_at ?? null,
        giftStatus: isGiftStatus(r.gift_status) ? r.gift_status : null,
        voucher: r.voucher_request ?? null,
      }));
    },
    async requestDelivery(id, keyHash, shipping) {
      const now = new Date().toISOString();
      const res = await call(`?id=eq.${encodeURIComponent(id)}&key_hash=eq.${keyHash}&delivery_requested_at=is.null`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ shipping, delivery_requested_at: now, updated_at: now }),
      });
      if (!res.ok) throw new Error(`supabase requestDelivery ${res.status}`);
    },
    async getDelivery(id) {
      // select=*: 접수 컬럼을 추가하는 마이그레이션 적용 전에도 공동 선물 화면과 결제가 깨지지 않게
      const res = await call(`?id=eq.${encodeURIComponent(id)}&select=*`, { method: "GET" });
      if (!res.ok) throw new Error(`supabase getDelivery ${res.status}`);
      const r = ((await res.json()) as { shipping: ShippingAddress | null; delivery_requested_at?: string | null }[])[0];
      return r?.delivery_requested_at ? { requestedAt: Date.parse(r.delivery_requested_at), shipping: r.shipping } : null;
    },
    async convertVoucher(id, request) {
      // 행 잠금 아래에서 상태 확인과 신청 기록을 함께 한다 (차액 결제와 엇갈리지 않음)
      const res = await rpc("mogiving_convert_voucher", { p_share_id: id, p_fee_percent: FEE_PERCENT, p_request: request });
      // 404 PGRST202: 함수 없음 → 마이그레이션(20261121000000_mogiving_gift_voucher_model.sql) 미적용
      if (!res.ok) throw new Error(`supabase rpc mogiving_convert_voucher ${res.status}`);
      const r = (await res.json()) as { result?: string; request?: VoucherRequest };
      if ((r.result === "converted" || r.result === "already") && r.request) return { result: r.result, request: r.request };
      if (r.result === "unavailable" || r.result === "not_found") return { result: r.result };
      throw new Error(`supabase rpc mogiving_convert_voucher unexpected ${String(r.result).slice(0, 40)}`);
    },
    async getOps(id) {
      const res = await call(`?id=eq.${encodeURIComponent(id)}&select=payload,shipping,goal,collected_amount`, { method: "GET" });
      if (!res.ok) throw new Error(`supabase getOps ${res.status}`);
      const r = ((await res.json()) as { payload: SharePayload; shipping: ShippingAddress | null; goal: number | null; collected_amount: number }[])[0];
      if (!r) return null;
      return { payload: r.payload.x ? { ...r.payload, x: { ...r.payload.x, g: r.goal ?? r.payload.x.g, a: r.collected_amount } } : r.payload, shipping: r.shipping };
    },
    async markPendingChoice(nowMs, limit) {
      const res = await rpc("mogiving_mark_pending_choice", { p_now_ms: nowMs, p_limit: limit });
      if (!res.ok) throw new Error(`supabase rpc mogiving_mark_pending_choice ${res.status}`);
      return ((await res.json()) as { share_id: string }[]).map((r) => r.share_id);
    },
  };
}

/* ------------------------------ 로컬 파일 (개발용) ------------------------------ */

type FileEntry = { keyHash: string; payload: SharePayload; shipping?: ShippingAddress; createdAt?: number; updatedAt: number; deliveryRequestedAt?: number; voucher?: VoucherRequest };

function fileStore(): ShareStore {
  const file = path.join(process.env.SHARE_STORE_DIR ?? path.join(process.cwd(), ".data"), "shares.json");
  // 개발 서버는 라우트·페이지가 모듈을 따로 들고 있을 수 있어 메모리 캐시 없이 매번 파일을 읽는다
  const load = async (): Promise<Record<string, FileEntry>> => {
    try {
      return JSON.parse(await readFile(file, "utf8"));
    } catch {
      return {};
    }
  };
  const save = async (store: Record<string, FileEntry>) => {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(store));
  };
  return {
    async update(prev, payload, shipping) {
      const store = await load();
      const e = store[prev.id];
      if (!e || e.keyHash !== hashKey(prev.key)) return false;
      store[prev.id] = { ...e, payload, shipping: shipping ?? e.shipping, updatedAt: Date.now() };
      await save(store);
      return true;
    },
    async insert(id, keyHash, payload, shipping) {
      const store = await load();
      if (store[id]) return false;
      store[id] = { keyHash, payload, shipping, createdAt: Date.now(), updatedAt: Date.now() };
      await save(store);
      return true;
    },
    async get(id) {
      return (await load())[id]?.payload ?? null;
    },
    async verifyKey(id, keyHash) {
      return (await load())[id]?.keyHash === keyHash;
    },
    async list() {
      return Object.entries(await load())
        .map(([id, e]) => ({
          id,
          payload: e.payload,
          shipping: e.shipping ?? null,
          createdAt: new Date(e.createdAt ?? e.updatedAt).toISOString(),
          updatedAt: new Date(e.updatedAt).toISOString(),
          deliveryRequestedAt: e.deliveryRequestedAt ? new Date(e.deliveryRequestedAt).toISOString() : null,
          giftStatus: null,
          voucher: e.voucher ?? null,
        }))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async requestDelivery(id, keyHash, shipping) {
      const store = await load();
      const e = store[id];
      if (!e || e.keyHash !== keyHash || e.deliveryRequestedAt) return;
      store[id] = { ...e, shipping, deliveryRequestedAt: Date.now(), updatedAt: Date.now() };
      await save(store);
    },
    async getDelivery(id) {
      const e = (await load())[id];
      return e?.deliveryRequestedAt ? { requestedAt: e.deliveryRequestedAt, shipping: e.shipping ?? null } : null;
    },
    async convertVoucher(id, request) {
      const store = await load();
      const e = store[id];
      if (!e) return { result: "not_found" };
      if (e.voucher) return { result: "already", request: e.voucher };
      const goal = e.payload.x?.g || e.payload.p.price;
      const collected = (await getContributionSummary(id))?.collected ?? 0;
      if (e.deliveryRequestedAt || collected <= 0 || collected >= goal || e.payload.d > Date.now()) return { result: "unavailable" };
      const voucher: VoucherRequest = { ...request, amount: voucherAmount(collected), collected, requestedAt: Date.now() };
      store[id] = { ...e, voucher, updatedAt: Date.now() };
      await save(store);
      return { result: "converted", request: voucher };
    },
    async getOps(id) {
      const e = (await load())[id];
      if (!e) return null;
      const collected = (await getContributionSummary(id))?.collected;
      return { payload: e.payload.x && collected !== undefined ? { ...e.payload, x: { ...e.payload.x, a: collected } } : e.payload, shipping: e.shipping ?? null };
    },
    // 로컬 저장소는 상태를 저장하지 않고 마감일로 계산한다
    markPendingChoice: async () => [],
  };
}

const store: ShareStore =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? supabaseStore(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    : fileStore();

/** 동시에 들어온 저장 요청이 서로 덮어쓰지 않도록 한 줄로 세운다 (파일 저장소용, Supabase에도 무해) */
let queue: Promise<unknown> = Promise.resolve();
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

/**
 * 공동 선물 요약을 저장하고 짧은 id를 돌려준다.
 * prev(id + 비밀 key)가 맞으면 같은 id의 내용(완성도 등)만 갱신해 링크가 바뀌지 않게 한다.
 */
export function saveShare(payload: SharePayload, prev?: ShortLink, shipping?: ShippingAddress): Promise<ShortLink & { created?: true }> {
  // payload 컬럼에는 공개 필드 + 운영자 전용 정보(x)만 (그 밖에 클라이언트가 끼워 넣은 값은 화이트리스트로 걸러짐).
  // x는 읽을 때 publicPayload에서 다시 빠지므로 공유 화면에는 나가지 않는다
  // 목표 금액은 클라이언트가 보낸 값을 믿지 않고 서버에서 선물 원가로 다시 계산한다
  const goal = goalWithFee(Math.round(payload.p.price));
  const pub: SharePayload = { ...publicPayload(payload), x: { ...(adminExtra(payload) ?? { a: 0 }), g: goal } };
  const goalColumn = goal > 0 && goal <= MAX_GOAL_COLUMN ? goal : null;
  return exclusive(async () => {
    // 갱신은 완성도 등 요약만 바꾼다. goal 컬럼은 개설 시 정한 값을 유지한다
    if (prev && SHORT_ID_RE.test(prev.id)) {
      // 배송 접수 뒤에는 화면에 남아 있던 예전 배송지가 접수한 배송지를 덮어쓰지 않게 한다
      const keepShipping = shipping && (await store.getDelivery(prev.id));
      // 마감일은 만들 때 정한 값을 유지한다. 바꿀 수 있으면 수령 방식 선택 시점을 마음대로 미룰 수 있다
      const stored = await store.get(prev.id);
      if (await store.update(prev, stored ? { ...pub, d: stored.d } : pub, keepShipping ? undefined : shipping)) return { id: prev.id, key: prev.key };
    }
    // 마감일이 멀수록 수령 방식 선택이 늦어지므로 만들 때 상한을 넘지 못하게 한다
    const created: SharePayload = { ...pub, d: Math.min(pub.d, maxDeadline()) };
    const key = randomCode(24);
    for (let attempt = 0; attempt < 5; attempt++) {
      const id = randomCode(ID_LENGTH);
      if (await store.insert(id, hashKey(key), created, shipping, goalColumn)) return { id, key, created: true as const };
    }
    throw new Error("could not allocate short id");
  });
}

/** 공개 요약만 돌려준다. 배송지는 절대 포함되지 않는다 */
export async function getShare(id: string): Promise<SharePayload | null> {
  if (!SHORT_ID_RE.test(id)) return null;
  try {
    const stored = await store.get(id);
    return stored ? publicPayload(stored) : null;
  } catch {
    return null;
  }
}

/** 주최자 비밀 key 확인. 저장소 오류는 호출한 쪽에서 처리한다 (권한 없음과 구분) */
export function verifyShareKey(id: string, key: string): Promise<boolean> {
  if (!SHORT_ID_RE.test(id) || !key || key.length > 200) return Promise.resolve(false);
  return store.verifyKey(id, hashKey(key));
}

/** 배송 접수를 저장한다. 주최자 key 확인은 호출하는 쪽에서 먼저 한다 */
export function requestDelivery(id: string, key: string, shipping: ShippingAddress) {
  const { name, phone, zonecode, address, detail, memo } = shipping;
  return exclusive(() => store.requestDelivery(id, hashKey(key), { name, phone, ...(zonecode ? { zonecode } : {}), address, detail, ...(memo ? { memo } : {}) }));
}

/** 배송 접수 기록. 배송지가 들어 있으므로 주최자가 아니면 호출한 쪽에서 빼고 내보낸다 */
export function getDelivery(id: string) {
  return store.getDelivery(id);
}

/** 모바일 상품권 전환 신청. 수령인 key 확인은 호출하는 쪽에서 먼저 한다 */
export function convertShareVoucher(id: string, request: VoucherRequestInput) {
  return exclusive(() => store.convertVoucher(id, request));
}

/** 운영 알림용 정보 (원본 상품 링크·수령인 배송지 포함). 서버 안에서만 쓰고 응답으로 내보내지 않는다 */
export async function getShareForOps(id: string) {
  if (!SHORT_ID_RE.test(id)) return null;
  return store.getOps(id);
}

/** 기간이 끝난 미도달 선물을 수령 방식 선택 대기(PENDING_CHOICE)로 바꾼다 */
export function markExpiredPendingChoice(nowMs: number, limit: number) {
  return store.markPendingChoice(nowMs, limit);
}

/** 관리자 페이지 전용: 배송지까지 포함한 전체 목록 (최신 등록순). 반드시 관리자 인증 뒤에만 호출할 것 */
export function listSharesForAdmin(): Promise<AdminShareRow[]> {
  return store.list();
}
