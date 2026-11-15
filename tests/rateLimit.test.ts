import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clientIp, createRateLimiter } from "@/lib/rateLimit";

describe("createRateLimiter: 호출 횟수 제한", () => {
  it("창 안에서 max회까지 통과, 그다음부터 제한", () => {
    const limited = createRateLimiter({ windowMs: 1000, max: 3 });
    assert.deepEqual([0, 1, 2, 3, 4].map((i) => limited("a", 100 + i)), [false, false, false, true, true]);
  });
  it("키(IP)마다 따로 센다", () => {
    const limited = createRateLimiter({ windowMs: 1000, max: 1 });
    assert.equal(limited("a", 0), false);
    assert.equal(limited("b", 0), false);
    assert.equal(limited("a", 1), true);
  });
  it("창이 지나면 다시 통과 (제한된 호출은 세지 않는다)", () => {
    const limited = createRateLimiter({ windowMs: 1000, max: 2 });
    limited("a", 0);
    limited("a", 500);
    assert.equal(limited("a", 900), true);
    assert.equal(limited("a", 1000), false); // 0에 한 호출이 창 밖으로 나감
    assert.equal(limited("a", 1200), true); // 500·1000 두 번이 창 안
    assert.equal(limited("a", 1600), false);
  });
  it("키가 maxKeys를 넘으면 비우되, 방금 센 호출은 남긴다", () => {
    const limited = createRateLimiter({ windowMs: 1000, max: 1, maxKeys: 2 });
    limited("a", 0);
    limited("b", 0);
    limited("c", 0); // 3개 → 비우고 c만 남김
    assert.equal(limited("a", 1), false);
    assert.equal(limited("c", 1), true);
  });
});

describe("clientIp", () => {
  it("x-real-ip 우선, 없으면 x-forwarded-for 첫 값, 둘 다 없으면 local", () => {
    assert.equal(clientIp(new Headers({ "x-real-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2" })), "1.1.1.1");
    assert.equal(clientIp(new Headers({ "x-forwarded-for": " 3.3.3.3 , 10.0.0.1" })), "3.3.3.3");
    assert.equal(clientIp(new Headers()), "local");
  });
});
