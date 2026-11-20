import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

/**
 * 즉시 확정형 공동 선물(선물 교환권) 모델 — 로컬 파일 저장소로 확인한다 (토스·Supabase 없이).
 * 결제 승인 뒤 반영(saveContribution)과 상태 전환, 차액 결제, 모바일 상품권 전환을 본다
 */
describe("공동 선물 상태와 수령 방식", () => {
  let dir = "";
  let mods: {
    share: typeof import("@/lib/shareStore");
    contrib: typeof import("@/lib/contributionStore");
    payment: typeof import("@/lib/paymentStore");
    fee: typeof import("@/lib/fee");
  };

  before(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "mogiving-gift-"));
    process.env.SHARE_STORE_DIR = dir;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    mods = {
      share: await import("@/lib/shareStore"),
      contrib: await import("@/lib/contributionStore"),
      payment: await import("@/lib/paymentStore"),
      fee: await import("@/lib/fee"),
    };
  });
  after(() => rm(dir, { recursive: true, force: true }));

  const newGift = (price: number) =>
    mods.share.saveShare({
      id: "f1",
      o: "민수",
      t: "생일 공동 선물",
      r: 0,
      d: Date.now() + 3 * 24 * 60 * 60 * 1000,
      p: { id: "p1", brand: "브랜드", name: "선물", price, emoji: "🎁", bg: "#fff", category: "기타", mall: "기타" } as never,
    });

  /** 기간이 끝난 것으로 만든다 (마감일은 API로 바꿀 수 없으므로 파일을 직접 고친다) */
  const expire = async (id: string) => {
    const file = path.join(dir, "shares.json");
    const all = JSON.parse(await readFile(file, "utf8"));
    all[id].payload.d = Date.now() - 1000;
    await writeFile(file, JSON.stringify(all));
  };

  it("새로 만들면 created가 표시되고, 갱신하면 표시되지 않는다", async () => {
    const created = await newGift(10_000);
    assert.equal(created.created, true);
    const again = await mods.share.saveShare(
      { id: "f1", o: "민수", t: "생일 공동 선물", r: 10, d: Date.now() + 1000, p: { id: "p1", brand: "", name: "선물", price: 10_000, emoji: "🎁", bg: "#fff", category: "기타", mall: "기타" } as never },
      created,
    );
    assert.equal(again.created, undefined);
  });

  it("100% 도달 시 COMPLETED_FULL이 되고, completedNow는 완성시킨 결제에서만 true", async () => {
    const { id } = await newGift(10_000);
    const goal = (await mods.payment.fundingAvailability(id))!.goal;
    assert.equal(goal, 10_500);
    const first = await mods.contrib.saveContribution(id, { nickname: "a", message: "", amount: 5_000 });
    assert.equal(first.completedNow, false);
    const last = await mods.contrib.saveContribution(id, { nickname: "b", message: "", amount: 5_500 });
    assert.equal(last.completedNow, true);
    const a = await mods.payment.fundingAvailability(id);
    assert.equal(a?.status, "COMPLETED_FULL");
    assert.equal(a?.open, false);
    await assert.rejects(mods.contrib.saveContribution(id, { nickname: "c", message: "", amount: 1000 }), (e: { code?: string }) => e.code === "funding_closed");
  });

  it("기간이 끝난 미도달 선물은 결제가 취소되지 않고 PENDING_CHOICE가 된다", async () => {
    const { id } = await newGift(10_000);
    await mods.contrib.saveContribution(id, { nickname: "a", message: "", amount: 3_000 });
    await expire(id);
    const a = await mods.payment.fundingAvailability(id);
    assert.equal(a?.status, "PENDING_CHOICE");
    assert.equal(a?.pendingChoice, true);
    assert.equal(a?.collected, 3_000, "적립 금액 유지");
    await assert.rejects(mods.contrib.saveContribution(id, { nickname: "b", message: "", amount: 1000 }), (e: { code?: string }) => e.code === "funding_closed");
  });

  it("차액 결제: 남은 금액과 정확히 같을 때만 반영되고 COMPLETED_FULL이 된다", async () => {
    const { id } = await newGift(10_000);
    await mods.contrib.saveContribution(id, { nickname: "a", message: "", amount: 3_000 });
    await assert.rejects(mods.contrib.saveTopupContribution(id, 7_500), (e: { code?: string }) => e.code === "topup_unavailable", "기간 중에는 불가");
    await expire(id);
    await assert.rejects(mods.contrib.saveTopupContribution(id, 7_000), (e: { code?: string }) => e.code === "topup_unavailable", "금액 불일치");
    const r = await mods.contrib.saveTopupContribution(id, 7_500);
    assert.equal(r.completedNow, true);
    assert.equal(r.contribution.nickname, mods.contrib.TOPUP_NICKNAME);
    const a = await mods.payment.fundingAvailability(id);
    assert.equal(a?.status, "COMPLETED_FULL");
    assert.equal(a?.achieved, true);
    assert.deepEqual(await mods.share.convertShareVoucher(id, { type: "스타벅스 e카드", name: "민수", phone: "010-1234-5678" }), { result: "unavailable" });
  });

  it("모바일 상품권 전환: 기간 종료 후에만, 수수료를 뺀 원가 기준 금액으로 한 번만", async () => {
    const { id, key } = await newGift(10_000);
    await mods.contrib.saveContribution(id, { nickname: "a", message: "", amount: 4_200 });
    const req = { type: "스타벅스 e카드", name: "민수", phone: "010-1234-5678" };
    assert.deepEqual(await mods.share.convertShareVoucher(id, req), { result: "unavailable" }, "기간 중에는 불가");
    await expire(id);

    const r = await mods.share.convertShareVoucher(id, req);
    assert.equal(r.result, "converted");
    assert.ok("request" in r);
    assert.equal(r.request.amount, 4_000, "4,200 × 100 / 105");
    assert.equal(r.request.amount, mods.fee.voucherAmount(4_200));
    assert.equal((await mods.share.convertShareVoucher(id, req)).result, "already");

    const summary = await mods.payment.getFundingSummary(id, key);
    assert.equal(summary?.status, "CONVERTED_VOUCHER");
    assert.equal(summary?.voucher?.amount, 4_000);
    assert.equal(summary?.voucher?.type, "스타벅스 e카드");
    const friendView = await mods.payment.getFundingSummary(id);
    assert.equal(friendView?.voucher?.amount, undefined, "금액·종류는 수령인에게만");

    await assert.rejects(mods.contrib.saveTopupContribution(id, 6_300), (e: { code?: string }) => e.code === "topup_unavailable", "전환 후 차액 결제 불가");
  });

  it("적립 금액이 0원이면 상품권으로 전환할 수 없다", async () => {
    const { id } = await newGift(10_000);
    await expire(id);
    assert.deepEqual(await mods.share.convertShareVoucher(id, { type: "스타벅스 e카드", name: "민수", phone: "010-1234-5678" }), { result: "unavailable" });
  });

  it("결제 확정(finalize): 차액 결제 주문은 completedNow를 한 번만 돌려준다", async () => {
    const { id } = await newGift(1_000);
    await mods.contrib.saveContribution(id, { nickname: "a", message: "", amount: 1_000 });
    await expire(id);
    await mods.payment.createPaymentOrder({ orderId: "mg_topup_1", shareId: id, kind: "topup", nickname: mods.contrib.TOPUP_NICKNAME, message: "", amount: 100 });
    await mods.payment.markOrderApproved("mg_topup_1", "pk_1");
    const r1 = await mods.payment.finalizePayment("mg_topup_1", "pk_1");
    assert.equal(r1.kind, "topup");
    assert.equal(r1.recordedAmount, 100);
    assert.equal(r1.refundAmount, 0);
    assert.equal(r1.completedNow, true);
    const r2 = await mods.payment.finalizePayment("mg_topup_1", "pk_1");
    assert.equal(r2.completedNow, false, "재시도에는 알림 없음");
  });
});

describe("상태 계산과 금액", () => {
  it("giftStatusOf", async () => {
    const { giftStatusOf } = await import("@/lib/giftStatus");
    const now = 1_000_000;
    assert.equal(giftStatusOf({ collected: 0, goal: 100, deadline: now + 1, now }), "ACTIVE");
    assert.equal(giftStatusOf({ collected: 100, goal: 100, deadline: now + 1, now }), "COMPLETED_FULL");
    assert.equal(giftStatusOf({ collected: 50, goal: 100, deadline: now, now }), "PENDING_CHOICE");
    assert.equal(giftStatusOf({ stored: "ACTIVE", collected: 50, goal: 100, deadline: now - 1, now }), "PENDING_CHOICE", "크론이 늦어도 마감일로 판단");
    assert.equal(giftStatusOf({ stored: "CONVERTED_VOUCHER", collected: 50, goal: 100, deadline: now - 1, now }), "CONVERTED_VOUCHER");
  });

  it("voucherAmount는 goalWithFee의 역산이다", async () => {
    const { goalWithFee, voucherAmount } = await import("@/lib/fee");
    assert.equal(voucherAmount(0), 0);
    assert.equal(voucherAmount(10_500), 10_000);
    assert.equal(voucherAmount(1_000), 952);
    for (const price of [1_000, 12_345, 99_900]) assert.ok(voucherAmount(goalWithFee(price)) >= price, `${price}`);
  });
});

describe("텔레그램 알림", () => {
  it("환경변수가 없으면 보내지 않고 예외도 없다", async () => {
    const { sendTelegramAlert } = await import("@/lib/telegram");
    const saved = { token: process.env.TELEGRAM_BOT_TOKEN, chat: process.env.TELEGRAM_CHAT_ID };
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    try {
      assert.equal(await sendTelegramAlert("test"), false);
    } finally {
      if (saved.token) process.env.TELEGRAM_BOT_TOKEN = saved.token;
      if (saved.chat) process.env.TELEGRAM_CHAT_ID = saved.chat;
    }
  });

  it("발송이 실패해도 예외 없이 false", async () => {
    const { sendTelegramAlert } = await import("@/lib/telegram");
    const origFetch = globalThis.fetch;
    const saved = { token: process.env.TELEGRAM_BOT_TOKEN, chat: process.env.TELEGRAM_CHAT_ID };
    process.env.TELEGRAM_BOT_TOKEN = "x";
    process.env.TELEGRAM_CHAT_ID = "1";
    globalThis.fetch = (async () => {
      throw new TypeError("network down");
    }) as typeof fetch;
    try {
      assert.equal(await sendTelegramAlert("test"), false);
    } finally {
      globalThis.fetch = origFetch;
      if (saved.token) process.env.TELEGRAM_BOT_TOKEN = saved.token;
      else delete process.env.TELEGRAM_BOT_TOKEN;
      if (saved.chat) process.env.TELEGRAM_CHAT_ID = saved.chat;
      else delete process.env.TELEGRAM_CHAT_ID;
    }
  });

  it("메시지에 요청한 항목이 담긴다", async () => {
    const t = await import("@/lib/telegram");
    const done = t.giftCompletedMessage({
      shareId: "abcdefg",
      productName: "에어팟",
      productUrl: "https://example.com/p",
      total: 210_000,
      topupAmount: 10_000,
      shipping: { name: "민수", phone: "010-1111-2222", zonecode: "12345", address: "서울시", detail: "101호" },
    });
    for (const s of ["[🎉 선물 100% 완성 / 실물 발주 요망]", "에어팟", "210,000원", "차액 결제 10,000원", "민수 / 010-1111-2222", "(12345) 서울시 101호", "https://example.com/p"]) assert.ok(done.includes(s), s);
    const v = t.voucherRequestedMessage({ shareId: "abcdefg", productName: "에어팟", name: "민수", phone: "010-1111-2222", amount: 4_000, collected: 4_200, voucherType: "스타벅스 e카드" });
    for (const s of ["[🎁 모바일 상품권 전환 신청]", "민수 / 010-1111-2222", "4,000원", "스타벅스 e카드"]) assert.ok(v.includes(s), s);
    const c = t.giftCreatedMessage({ shareId: "abcdefg", ownerName: "민수", productName: "에어팟", goal: 210_000, deadline: Date.now() });
    for (const s of ["[🆕 신규 공동 선물 생성]", "개설자: 민수", "에어팟", "210,000원"]) assert.ok(c.includes(s), s);
  });
});
