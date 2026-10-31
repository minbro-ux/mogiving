import { createHash, randomBytes } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { SharePayload } from "./share";

/**
 * 짧은 공유 링크(/f/[shortId]) 저장소.
 * SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY가 있으면 Supabase mogiving_shares 테이블(서버 전용)을 쓰고,
 * 없으면 로컬 개발용 JSON 파일(.data/shares.json)로 대체한다.
 */

/** 헷갈리는 문자(0/O, 1/l/I)를 뺀 base56 */
const ALPHABET = "23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
const ID_LENGTH = 7;
export const SHORT_ID_RE = new RegExp(`^[${ALPHABET}]{${ID_LENGTH}}$`);

const randomCode = (n: number) => Array.from(randomBytes(n), (b) => ALPHABET[b % ALPHABET.length]).join("");
const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");

export type ShortLink = { id: string; key: string };

interface ShareStore {
  /** prev의 key가 맞으면 내용만 갱신하고 true */
  update(prev: ShortLink, payload: SharePayload): Promise<boolean>;
  /** 새 id로 저장. id가 이미 있으면 false (호출 측에서 다른 id로 재시도) */
  insert(id: string, keyHash: string, payload: SharePayload): Promise<boolean>;
  get(id: string): Promise<SharePayload | null>;
}

/* ------------------------------ Supabase (배포용) ------------------------------ */

const TABLE = "mogiving_shares";

function supabaseStore(url: string, serviceKey: string): ShareStore {
  const endpoint = `${url.replace(/\/$/, "")}/rest/v1/${TABLE}`;
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" };
  // Next 서버 컴포넌트의 fetch 캐시를 끄고 항상 최신 달성률을 읽는다
  const call = (query: string, init: RequestInit) => fetch(`${endpoint}${query}`, { ...init, headers: { ...headers, ...init.headers }, cache: "no-store" });

  return {
    async update(prev, payload) {
      const res = await call(`?id=eq.${encodeURIComponent(prev.id)}&key_hash=eq.${hashKey(prev.key)}&select=id`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ payload, updated_at: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error(`supabase update ${res.status}`);
      return ((await res.json()) as unknown[]).length > 0;
    },
    async insert(id, keyHash, payload) {
      const res = await call("", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ id, key_hash: keyHash, payload }) });
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
  };
}

/* ------------------------------ 로컬 파일 (개발용) ------------------------------ */

type FileEntry = { keyHash: string; payload: SharePayload; updatedAt: number };

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
    async update(prev, payload) {
      const store = await load();
      const e = store[prev.id];
      if (!e || e.keyHash !== hashKey(prev.key)) return false;
      store[prev.id] = { ...e, payload, updatedAt: Date.now() };
      await save(store);
      return true;
    },
    async insert(id, keyHash, payload) {
      const store = await load();
      if (store[id]) return false;
      store[id] = { keyHash, payload, updatedAt: Date.now() };
      await save(store);
      return true;
    },
    async get(id) {
      return (await load())[id]?.payload ?? null;
    },
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
 * 펀딩 요약을 저장하고 짧은 id를 돌려준다.
 * prev(id + 비밀 key)가 맞으면 같은 id의 내용(달성률 등)만 갱신해 링크가 바뀌지 않게 한다.
 */
export function saveShare(payload: SharePayload, prev?: ShortLink): Promise<ShortLink> {
  return exclusive(async () => {
    if (prev && SHORT_ID_RE.test(prev.id) && (await store.update(prev, payload))) return prev;
    const key = randomCode(24);
    for (let attempt = 0; attempt < 5; attempt++) {
      const id = randomCode(ID_LENGTH);
      if (await store.insert(id, hashKey(key), payload)) return { id, key };
    }
    throw new Error("could not allocate short id");
  });
}

export async function getShare(id: string): Promise<SharePayload | null> {
  if (!SHORT_ID_RE.test(id)) return null;
  try {
    return await store.get(id);
  } catch {
    return null;
  }
}
