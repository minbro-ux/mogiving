import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { fetchProductName, linkProduct, parseLinkInput } from "@/lib/crawl";
import { extractTitle } from "@/lib/productTitle";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

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

describe("linkProduct: 입력 폼 초기값", () => {
  it("공유 글의 상품명·가격·쇼핑몰만 채우고 사진은 비운다 (쇼핑몰 기본 이미지)", () => {
    const p = linkProduct(parseLinkInput(COUPANG)!);
    assert.equal(p.name, "Apple 에어팟 맥스 2 USB-C");
    assert.equal(p.price, 849000);
    assert.equal(p.mall, "쿠팡");
    assert.equal(p.url, "https://link.coupang.com/a/bXyZ12");
    assert.equal(p.imageUrl, undefined);
  });

  it("순수 URL은 상품명·가격이 빈 칸", () => {
    const p = linkProduct(parseLinkInput("https://example.com/item/1")!);
    assert.equal(p.name, "");
    assert.equal(p.price, 0);
    assert.equal(p.mall, "기타 쇼핑몰");
  });
});

describe("fetchProductName: 실패는 모두 빈 문자열", () => {
  const mock = (impl: () => Promise<unknown>) => {
    globalThis.fetch = impl as unknown as typeof fetch;
  };

  it("서버가 찾은 상품명을 돌려준다", async () => {
    mock(async () => ({ json: async () => ({ name: "  에어팟 맥스  " }) }));
    assert.equal(await fetchProductName("https://example.com/a"), "에어팟 맥스");
  });

  it("빈 응답이면 빈 문자열", async () => {
    mock(async () => ({ json: async () => ({}) }));
    assert.equal(await fetchProductName("https://example.com/a"), "");
  });

  it("네트워크 오류도 throw하지 않고 빈 문자열", async () => {
    mock(async () => {
      throw new TypeError("failed");
    });
    assert.equal(await fetchProductName("https://example.com/a"), "");
  });
});

describe("extractTitle: HTML → 상품명", () => {
  it("og:title 우선, 끝의 사이트 이름은 걷어낸다", () => {
    const html = `<head><title>무시</title><meta property="og:site_name" content="무신사"><meta property="og:title" content="나이키 에어포스 1 &amp; 07 | 무신사"></head>`;
    assert.equal(extractTitle(html), "나이키 에어포스 1 & 07");
  });

  it("og:title이 없으면 <title>", () => {
    assert.equal(extractTitle("<head><title> DJI 오즈모 포켓 4P </title></head>"), "DJI 오즈모 포켓 4P");
  });

  it("차단·에러 페이지 제목이나 숫자만 있는 제목은 버린다", () => {
    assert.equal(extractTitle("<title>Access Denied</title>"), undefined);
    assert.equal(extractTitle('<meta property="og:title" content="1234567">'), undefined);
    assert.equal(extractTitle("<body>제목 없음</body>"), undefined);
  });
});
