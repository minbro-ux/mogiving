// 토스 취소 실패 후 재시도와 환불 실패 알림 시험. 사용법: 저장소 루트에서 node scripts/refund-retry/run.cjs
// 임시 폴더 파일 저장소 + 가짜 토스로 실제 /api/cron/refund-expired 라우트와 /admin 화면을 호출한다. 운영 DB와 실제 토스로는 나가지 않는다.
// 검증하지 않는 것: 실제 토스 오류 응답, Supabase REST 경로, Vercel 실행 환경.
const { spawn, execSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const REPO = path.resolve(__dirname, "../..");
const PORT = 3999;
const SECRET = "local-retry-test";
const ADMIN_PASSWORD = "local-admin-test";
const BASE = `http://localhost:${PORT}`;
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), "mogiving-retry-"));
const DAY = 86_400_000;
const p = (f) => path.join(DIR, f);
const write = (f, v) => fs.writeFileSync(p(f), JSON.stringify(v));
const read = (f) => JSON.parse(fs.readFileSync(p(f), "utf8"));

function seed(fundings) {
  const shares = {}, contributions = {}, orders = {}, payments = {};
  for (const f of fundings) {
    shares[f.id] = {
      keyHash: crypto.createHash("sha256").update("k").digest("hex"),
      createdAt: Date.now() - 8 * DAY,
      updatedAt: Date.now(),
      ...(f.delivered ? { deliveryRequestedAt: Date.now() - DAY, shipping: { name: "t", phone: "0", address: "t", detail: "" } } : {}),
      payload: { id: f.id, o: "시험", t: "시험", r: 0, d: Date.now() - (f.ageDays ?? 4) * DAY, p: { id: "x", brand: "", name: "시험", price: 3000, emoji: "🎁", bg: "#EEF3FF", category: "링크", mall: "" }, x: { g: f.goal ?? 3200, a: 0 } },
    };
    contributions[f.id] = [];
    for (const o of f.orders) {
      const orderId = `mg_${o.key}`;
      const approvedOnly = o.approvedOnly;
      if (!approvedOnly) contributions[f.id].push({ id: crypto.randomUUID(), nickname: "n", message: "", amount: o.amount, createdAt: Date.now() - 6 * DAY });
      orders[orderId] = {
        orderId, shareId: f.id, nickname: "n", message: "", amount: o.amount, status: approvedOnly ? "approved" : "finalized", paymentKey: o.key,
        ...(approvedOnly ? {} : { result: { shareId: f.id, contributionId: "c", recordedAmount: o.amount, refundAmount: 0, refundStatus: "none", collected: 0, count: 0, goal: f.goal ?? 3200, contributedAt: 0 } }),
      };
      payments[o.key] = { orderId, amount: o.amount, status: o.tossStatus ?? "DONE", onCancel: o.onCancel ?? "ok" };
    }
  }
  write("shares.json", shares);
  write("contributions.json", contributions);
  write("payment-orders.json", orders);
  write("toss-state.json", { payments });
  fs.writeFileSync(p("toss-calls.jsonl"), "");
}

const cron = async (auth = `Bearer ${SECRET}`) => {
  const res = await fetch(`${BASE}/api/cron/refund-expired`, { headers: auth ? { Authorization: auth } : {} });
  return { status: res.status, ...(await res.json()) };
};
let adminCookie = "";
async function adminHtml() {
  if (!adminCookie) {
    const res = await fetch(`${BASE}/api/admin/login`, { method: "POST", body: new URLSearchParams({ password: ADMIN_PASSWORD }), redirect: "manual" });
    adminCookie = (res.headers.get("set-cookie") ?? "").split(";")[0];
    if (!adminCookie) throw new Error("관리자 로그인 실패");
  }
  const res = await fetch(`${BASE}/admin`, { headers: { Cookie: adminCookie } });
  // React가 글자 사이에 넣는 주석을 지워 화면 문구 그대로 비교한다
  return (await res.text()).replace(/<!-- -->/g, "");
}
const setCancel = (key, onCancel) => { const s = read("toss-state.json"); s.payments[key].onCancel = onCancel; write("toss-state.json", s); };
const calls = () => fs.readFileSync(p("toss-calls.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const posts = (key) => calls().filter((c) => c.key === key && c.method === "POST");
const order = (key) => read("payment-orders.json")[`mg_${key}`];
const toss = (key) => read("toss-state.json").payments[key];

const results = [];
const check = (scenario, what, ok, got) => { results.push({ scenario, what, ok }); console.log(`${ok ? "PASS" : "FAIL"}  [${scenario}] ${what}${ok ? "" : `  got=${JSON.stringify(got)}`}`); };

/** 실패 → 다음 cron에서 재시도 성공을 공통으로 확인 */
async function failThenRetry(name, onCancel) {
  seed([{ id: "Retry2a", orders: [{ key: "pay_one_123", amount: 1000, onCancel }] }]);
  const r1 = await cron();
  check(name, "1회차: 500, 실패 펀딩 보고", r1.status === 500 && r1.ok === false && r1.finished === 0 && r1.failed?.includes("Retry2a") && r1.unfinished?.includes("Retry2a"), r1);
  check(name, "1회차: 주문 failed, 전액 환불 대상 표시", order("pay_one_123").result?.refundStatus === "failed" && order("pay_one_123").result?.refundAmount === 1000, order("pay_one_123"));
  const failedPage = await adminHtml();
  check(name, "1회차: 관리자 화면에 실패 표시", failedPage.includes("환불 확인 필요 1건 · 실패 1건") && failedPage.includes("mg_pay_one_123"), failedPage.length);
  setCancel("pay_one_123", "ok");
  const r2 = await cron();
  check(name, "2회차: 200, 재시도 성공", r2.status === 200 && r2.ok === true && r2.finished === 1 && r2.unfinished?.length === 0, r2);
  check(name, "2회차: 관리자 화면 표시 사라짐", !(await adminHtml()).includes("환불 확인 필요"), "still shown");
  check(name, "2회차: 주문 done, 토스 CANCELED", order("pay_one_123").result?.refundStatus === "done" && toss("pay_one_123").status === "CANCELED", { o: order("pay_one_123"), t: toss("pay_one_123") });
  const keys = posts("pay_one_123").map((c) => c.idempotencyKey);
  check(name, "재시도마다 멱등키가 다름", new Set(keys).size === keys.length && keys.length === 2, keys);
  const before = calls().length;
  const r3 = await cron();
  check(name, "3회차: 대상 없음, 토스 호출 없음", r3.checked === 0 && calls().length === before, { r3, n: calls().length - before });
}

async function scenarios() {
  const unauth = await cron(null);
  check("인증", "secret 없으면 401", unauth.status === 401, unauth);
  await failThenRetry("거절 400", "reject");
  await failThenRetry("토스 500", "server_error");
  await failThenRetry("네트워크 오류", "network");
  await failThenRetry("부분 취소 응답", "partial");

  seed([{ id: "Retry2b", orders: [{ key: "pay_fail_12", amount: 1000, onCancel: "reject" }, { key: "pay_good_12", amount: 1000 }] }]);
  const m1 = await cron();
  check("일부 실패", "1회차: 실패 주문 failed, 성공 주문 done", order("pay_fail_12").result?.refundStatus === "failed" && order("pay_good_12").result?.refundStatus === "done" && m1.unfinished?.includes("Retry2b"), m1);
  setCancel("pay_fail_12", "ok");
  const m2 = await cron();
  check("일부 실패", "2회차: 남은 주문만 처리", m2.finished === 1 && posts("pay_good_12").length === 1 && posts("pay_fail_12").length === 2, { m2, good: posts("pay_good_12").length, fail: posts("pay_fail_12").length });
  check("일부 실패", "이중 취소 없음", toss("pay_good_12").cancelCount === 1 && toss("pay_fail_12").cancelCount === 1, [toss("pay_good_12"), toss("pay_fail_12")]);

  seed([{ id: "Retry2c", orders: [{ key: "pay_lost_12", amount: 1000, onCancel: "lost_response" }] }]);
  const l1 = await cron();
  check("응답 유실", "1회차: 결과를 몰라 failed로 남김", order("pay_lost_12").result?.refundStatus === "failed" && l1.finished === 0, l1);
  const l2 = await cron();
  check("응답 유실", "2회차: 조회로 취소 확인, 재취소 없음", l2.finished === 1 && posts("pay_lost_12").length === 1 && toss("pay_lost_12").cancelCount === 1 && order("pay_lost_12").result?.refundStatus === "done", { l2, posts: posts("pay_lost_12").length });

  seed([{ id: "Retry2d", orders: [{ key: "pay_alrdy_1", amount: 1000, onCancel: "already" }] }]);
  const a1 = await cron();
  check("이미 취소 응답", "ALREADY_CANCELED_PAYMENT는 완료 처리", a1.finished === 1 && order("pay_alrdy_1").result?.refundStatus === "done", a1);

  seed([{ id: "Retry2e", orders: [{ key: "pay_stuck_1", amount: 1000, onCancel: "reject" }] }]);
  let stuck;
  for (let i = 0; i < 3; i++) stuck = await cron();
  check("계속 실패", "3회 실패해도 대상 유지, 매번 시도", stuck.unfinished?.includes("Retry2e") && posts("pay_stuck_1").length === 3, { stuck, n: posts("pay_stuck_1").length });

  seed([{ id: "Retry2f", orders: [{ key: "pay_appr_12", amount: 1000, approvedOnly: true, onCancel: "reject" }] }]);
  await cron();
  const ap1 = order("pay_appr_12");
  check("승인만 된 주문", "1회차: 확정 후 failed", ap1.status === "finalized" && ap1.result?.recordedAmount === 0 && ap1.result?.refundAmount === 1000 && ap1.result?.refundStatus === "failed", ap1);
  setCancel("pay_appr_12", "ok");
  const ap2 = await cron();
  check("승인만 된 주문", "2회차: 재시도 성공", ap2.finished === 1 && order("pay_appr_12").result?.refundStatus === "done", ap2);

  seed([
    { id: "Retry2g", goal: 1000, orders: [{ key: "pay_ach_123", amount: 1000 }] },
    { id: "Retry2h", delivered: true, orders: [{ key: "pay_del_123", amount: 1000 }] },
    { id: "Retry2j", ageDays: 2, orders: [{ key: "pay_new_123", amount: 1000 }] },
  ]);
  const safe = await cron();
  check("환불 제외", "달성·배송 접수·마감 3일 미만은 건드리지 않음", safe.status === 200 && safe.checked === 0 && calls().length === 0, { safe, calls: calls() });

  // 달성 펀딩의 초과 금액 환불 실패: cron 대상이 아니므로 관리자 화면에서만 알 수 있어야 한다
  seed([{ id: "Retry2k", goal: 1000, orders: [{ key: "pay_over_12", amount: 1000 }] }]);
  const orders = read("payment-orders.json");
  Object.assign(orders.mg_pay_over_12.result, { recordedAmount: 500, refundAmount: 500, refundStatus: "failed" });
  write("payment-orders.json", orders);
  const over = await cron();
  check("초과 금액 환불 실패", "cron 대상 아님, 토스 호출 없음", over.status === 200 && over.checked === 0 && calls().length === 0, over);
  const overPage = await adminHtml();
  check("초과 금액 환불 실패", "관리자 화면에 표시", overPage.includes("환불 확인 필요 1건 · 실패 1건") && overPage.includes("mg_pay_over_12"), overPage.length);
}

async function main() {
  write("toss-state.json", { payments: {} });
  fs.writeFileSync(p("toss-calls.jsonl"), "");
  const log = fs.openSync(p("dev-server.log"), "w");
  const server = spawn(process.execPath, [path.join(REPO, "node_modules/next/dist/bin/next"), "dev", "-p", String(PORT)], {
    cwd: REPO,
    stdio: ["ignore", log, log],
    env: {
      ...process.env,
      SUPABASE_URL: "", SUPABASE_SERVICE_ROLE_KEY: "",
      SHARE_STORE_DIR: DIR,
      TOSS_SECRET_KEY: "test_mock_not_a_real_key",
      CRON_SECRET: SECRET,
      ADMIN_PASSWORD,
      NODE_OPTIONS: `--require ${path.join(__dirname, "toss-mock.cjs").replace(/\\/g, "/")}`,
    },
  });
  try {
    let up = false;
    for (let i = 0; i < 180 && !up; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      try { up = (await cron(null)).status === 401; } catch { /* 아직 시작 전 */ }
    }
    if (!up) throw new Error(`서버가 시작되지 않았습니다. 로그: ${p("dev-server.log")}`);
    await scenarios();
  } finally {
    try { execSync(`taskkill /pid ${server.pid} /T /F`, { stdio: "ignore" }); } catch { server.kill(); }
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n합계: ${results.length - failed}/${results.length} 통과`);
  console.log(`임시 폴더: ${DIR}`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
