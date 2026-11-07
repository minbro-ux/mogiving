// next dev에 NODE_OPTIONS=--require 로 끼워 넣는 가짜 토스 API.
// 토스 호출은 파일 상태로 응답하고, localhost 외의 외부 요청은 모두 막아 운영 DB·실제 토스로 나가지 않게 한다.
const fs = require("fs");
const path = require("path");

const DIR = process.env.SHARE_STORE_DIR;
if (!DIR) throw new Error("SHARE_STORE_DIR가 필요합니다");
if (process.env.SUPABASE_URL || process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE 환경변수를 비워야 합니다");

const STATE = path.join(DIR, "toss-state.json");
const CALLS = path.join(DIR, "toss-calls.jsonl");
const read = () => JSON.parse(fs.readFileSync(STATE, "utf8"));
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const realFetch = globalThis.fetch;

globalThis.fetch = async function mockedFetch(input, init = {}) {
  const url = new URL(typeof input === "string" ? input : input.url ?? String(input));
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return realFetch(input, init);
  if (url.hostname !== "api.tosspayments.com") throw new Error(`blocked external fetch: ${url.hostname}`);

  const m = url.pathname.match(/^\/v1\/payments\/([^/]+)(\/cancel)?$/);
  const method = init.method ?? "GET";
  if (!m) return json(404, { code: "NOT_FOUND", message: url.pathname });
  const key = decodeURIComponent(m[1]);
  const state = read();
  const p = state.payments[key];
  const headers = new Headers(init.headers);
  fs.appendFileSync(CALLS, JSON.stringify({ method, key, cancel: !!m[2], idempotencyKey: headers.get("idempotency-key") }) + "\n");
  if (!p) return json(404, { code: "NOT_FOUND_PAYMENT", message: key });

  const view = () => ({ paymentKey: key, orderId: p.orderId, status: p.status, totalAmount: p.amount, balanceAmount: p.status === "CANCELED" ? 0 : p.amount });
  if (method === "GET") return json(200, view());

  switch (p.onCancel ?? "ok") {
    case "reject": return json(400, { code: "INVALID_REQUEST", message: "mock reject" });
    case "server_error": return json(500, { code: "FAILED_INTERNAL_SYSTEM_PROCESSING", message: "mock 500" });
    case "network": throw new TypeError("mock network failure");
    case "already": return json(400, { code: "ALREADY_CANCELED_PAYMENT", message: "mock already canceled" });
    case "partial": return json(200, { ...view(), status: "PARTIAL_CANCELED", balanceAmount: 1 });
    case "lost_response": // 토스에서는 취소됐지만 응답을 받지 못한 경우
      p.status = "CANCELED";
      p.cancelCount = (p.cancelCount ?? 0) + 1;
      fs.writeFileSync(STATE, JSON.stringify(state));
      throw new TypeError("mock response lost");
  }
  if (p.status === "CANCELED") return json(400, { code: "ALREADY_CANCELED_PAYMENT", message: "already" });
  p.status = "CANCELED";
  p.cancelCount = (p.cancelCount ?? 0) + 1;
  fs.writeFileSync(STATE, JSON.stringify(state));
  return json(200, view());
};
