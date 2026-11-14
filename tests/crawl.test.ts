import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { type CrawlResponse, crawlProduct, parseLinkInput } from "@/lib/crawl";

/** /api/crawl 응답을 흉내 낸다 (실제 서버·쇼핑몰에 요청하지 않음) */
const realFetch = globalThis.fetch;
function mockCrawl(body: CrawlResponse) {
  globalThis.fetch = (async () => ({ json: async () => body })) as unknown as typeof fetch;
}
afterEach(() => {
  globalThis.fetch = realFetch;
});

const BLOCKED: CrawlResponse = { ok: false, code: "blocked", status: 403 };
const CRAWLED: CrawlResponse = {
  ok: true,
  meta: { name: "크롤링된 다른 이름", price: 1, imageUrl: "https://img.example.com/a.jpg", options: ["미드나이트", { label: "블루", soldOut: true }] },
};

const COUPANG = "쿠팡에서 추천하는 상품입니다.\n[쿠팡] Apple 에어팟 맥스 2 USB-C\n849,000원\nhttps://link.coupang.com/a/bXyZ12";

describe("parseLinkInput", () => {
  it("쿠팡 공유 글 → 링크·쇼핑몰·글에서 뽑은 값(seed)", () => {
    const link = parseLinkInput(COUPANG);
    assert.ok(link);
    assert.equal(link.url, "https://link.coupang.com/a/bXyZ12");
    assert.equal(link.mall, "쿠팡");
    assert.deepEqual(link.seed, { name: "Apple 에어팟 맥스 2 USB-C", price: 849000 });
  });

  it("네이버 짧은 링크는 도메인으로 쇼핑몰을 판별", () => {
    const link = parseLinkInput("[네이버 쇼핑] DJI 오즈모 포켓 4P\n₩999,000\nhttps://naver.me/5aBcDeFg");
    assert.equal(link?.mall, "네이버 스마트스토어");
    assert.deepEqual(link?.seed, { name: "DJI 오즈모 포켓 4P", price: 999000 });
  });

  it("순수 URL은 seed 없이 도메인으로 쇼핑몰 판별", () => {
    const link = parseLinkInput("https://www.musinsa.com/products/2210934");
    assert.equal(link?.mall, "무신사");
    assert.equal(link?.seed, undefined);
  });

  it("스킴 없는 주소 한 줄도 예전처럼 받는다", () => {
    const link = parseLinkInput("coupang.com/vp/products/6033412");
    assert.equal(link?.url, "https://coupang.com/vp/products/6033412");
    assert.equal(link?.mall, "쿠팡");
  });

  it("링크가 없는 글은 null", () => {
    assert.equal(parseLinkInput("에어팟 맥스 849,000원"), null);
  });
});

describe("crawlProduct + 붙여넣은 글", () => {
  it("크롤링이 막혀도 글에서 뽑은 상품명·가격·쇼핑몰·링크는 그대로, 개설 진행 가능", async () => {
    mockCrawl(BLOCKED);
    const r = await crawlProduct(parseLinkInput(COUPANG)!);
    assert.equal(r.ok, true);
    assert.equal(r.product.name, "Apple 에어팟 맥스 2 USB-C");
    assert.equal(r.product.price, 849000);
    assert.equal(r.product.mall, "쿠팡");
    assert.equal(r.product.url, "https://link.coupang.com/a/bXyZ12");
    assert.equal(r.product.imageUrl, undefined);
  });

  it("크롤링이 성공하면 빈 칸(이미지·옵션)만 채우고 글의 값이 우선", async () => {
    mockCrawl(CRAWLED);
    const r = await crawlProduct(parseLinkInput(COUPANG)!);
    assert.equal(r.ok, true);
    assert.equal(r.product.name, "Apple 에어팟 맥스 2 USB-C");
    assert.equal(r.product.price, 849000);
    assert.equal(r.product.imageUrl, "https://img.example.com/a.jpg");
    assert.deepEqual(r.product.options, ["미드나이트", { label: "블루", soldOut: true }]);
  });

  it("글에 가격이 없고 크롤링도 막히면 수동 입력으로 가되 상품명·쇼핑몰은 유지", async () => {
    mockCrawl(BLOCKED);
    const r = await crawlProduct(parseLinkInput("[네이버] 판도라 모먼트 팔찌 https://smartstore.naver.com/pandora/products/1")!);
    assert.equal(r.ok, false);
    assert.equal(r.product.name, "판도라 모먼트 팔찌");
    assert.equal(r.product.mall, "네이버 스마트스토어");
  });

  it("순수 URL은 크롤링 값을 그대로 쓴다", async () => {
    mockCrawl(CRAWLED);
    const r = await crawlProduct(parseLinkInput("https://www.musinsa.com/products/2210934")!);
    assert.equal(r.product.name, "크롤링된 다른 이름");
  });
});
