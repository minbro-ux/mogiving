import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getGlobalRateLimiter, supabaseRateLimiter } from "@/lib/globalRateLimit";

/** Supabase RPC를 흉내 낸다 (실제 DB에 요청하지 않음) */
function fakeRpc(reply: () => { status?: number; body?: unknown } | Promise<never>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const f = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const r = await reply();
    const status = r.status ?? 200;
    return { ok: status >= 200 && status < 300, status, json: async () => r.body, text: async () => JSON.stringify(r.body ?? "") };
  }) as unknown as typeof fetch;
  return { f, calls };
}

/** 오류 로그가 테스트 출력에 섞이지 않게 잠시 끈다 */
async function quiet<T>(fn: () => Promise<T>) {
  const orig = console.error;
  console.error = () => {};
  try {
    return await fn();
  } finally {
    console.error = orig;
  }
}

describe("supabaseRateLimiter: 전체 호출 제한 (Supabase RPC)", () => {
  it("RPC 주소·인증 헤더·인자를 맞게 보낸다", async () => {
    const { f, calls } = fakeRpc(() => ({ body: true }));
    assert.equal(await supabaseRateLimiter("https://x.supabase.co/", "SVC", f)("kakao-image-search", 86400, 3000), "allowed");
    assert.equal(calls[0].url, "https://x.supabase.co/rest/v1/rpc/mogiving_rate_limit_hit");
    const h = calls[0].init?.headers as Record<string, string>;
    assert.equal(h.apikey, "SVC");
    assert.equal(h.Authorization, "Bearer SVC");
    assert.deepEqual(JSON.parse(calls[0].init?.body as string), { p_bucket: "kakao-image-search", p_window_seconds: 86400, p_max: 3000 });
  });
  it("false면 limited", async () => {
    assert.equal(await supabaseRateLimiter("https://x.supabase.co", "SVC", fakeRpc(() => ({ body: false })).f)("b", 60, 1), "limited");
  });
  it("함수 없음(404)·서버 오류·네트워크 실패·이상한 응답은 unknown (요청을 막지 않음)", async () => {
    const run = (reply: Parameters<typeof fakeRpc>[0]) => quiet(() => supabaseRateLimiter("https://x.supabase.co", "SVC", fakeRpc(reply).f)("b", 60, 1));
    assert.equal(await run(() => ({ status: 404, body: { code: "PGRST202" } })), "unknown");
    assert.equal(await run(() => ({ status: 500, body: {} })), "unknown");
    assert.equal(await run(() => Promise.reject(new Error("down"))), "unknown");
    assert.equal(await run(() => ({ body: [{ ok: true }] })), "unknown");
  });
  it("Supabase 설정이 없으면(로컬) 호출 없이 unknown", async () => {
    const saved = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY };
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    try {
      assert.equal(await getGlobalRateLimiter()("b", 60, 1), "unknown");
    } finally {
      if (saved.url !== undefined) process.env.SUPABASE_URL = saved.url;
      if (saved.key !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = saved.key;
    }
  });
});
