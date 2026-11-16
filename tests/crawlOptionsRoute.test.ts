import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/crawl/options/route";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

const call = async (url?: string) => {
  const q = url === undefined ? "" : `?url=${encodeURIComponent(url)}`;
  const res = await GET(new NextRequest(`http://localhost/api/crawl/options${q}`));
  assert.equal(res.status, 200);
  return res.json();
};

/** 쇼핑몰 응답 흉내 (리다이렉트 1번 → 상품 페이지) */
const shop = (html: string, contentType = "text/html; charset=utf-8") => {
  const seen: string[] = [];
  globalThis.fetch = (async (input: URL | string) => {
    const url = String(input);
    seen.push(url);
    if (url.endsWith("/short")) return new Response(null, { status: 302, headers: { location: "/product/detail.html?product_no=1" } });
    return new Response(html, { status: 200, headers: { "content-type": contentType } });
  }) as typeof fetch;
  return seen;
};

describe("GET /api/crawl/options", () => {
  it("리다이렉트를 따라가 카페24식 select에서 옵션을 뽑는다", async () => {
    const seen = shop(`<html><body><select id="product_option_id1"><option value="*">- [필수] 옵션을 선택해 주세요 -</option><option value="P1">블랙</option><option value="P2">아이보리 (+2,000원)</option><option value="P3">네이비 [품절]</option></select></body></html>`);
    assert.deepEqual(await call("https://shop.example.com/short"), { options: ["블랙", "아이보리", { label: "네이비", soldOut: true }] });
    assert.deepEqual(seen, ["https://shop.example.com/short", "https://shop.example.com/product/detail.html?product_no=1"]);
  });

  it("단품 페이지는 빈 응답", async () => {
    shop(`<html><head><title>단품</title></head><body>상품</body></html>`);
    assert.deepEqual(await call("https://shop.example.com/p/1"), {});
  });

  it("쇼핑몰 오류·HTML이 아닌 응답·네트워크 오류는 모두 빈 응답", async () => {
    globalThis.fetch = (async () => new Response("blocked", { status: 403, headers: { "content-type": "text/html" } })) as typeof fetch;
    assert.deepEqual(await call("https://shop.example.com/p/1"), {});
    shop(`{"options":["블랙"]}`, "application/json");
    assert.deepEqual(await call("https://shop.example.com/p/1"), {});
    globalThis.fetch = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;
    assert.deepEqual(await call("https://shop.example.com/p/1"), {});
  });

  it("주소가 없거나 잘못됐거나 내부망이면 요청하지 않고 빈 응답", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      return new Response("");
    }) as typeof fetch;
    assert.deepEqual(await call(), {});
    assert.deepEqual(await call("not a url"), {});
    assert.deepEqual(await call("http://169.254.169.254/latest/meta-data"), {});
    assert.deepEqual(await call("http://localhost:3000/"), {});
    assert.equal(calls, 0);
  });

  it("리다이렉트가 내부망을 가리키면 따라가지 않는다", async () => {
    const seen: string[] = [];
    globalThis.fetch = (async (input: URL | string) => {
      seen.push(String(input));
      return new Response(null, { status: 302, headers: { location: "http://127.0.0.1/admin" } });
    }) as typeof fetch;
    assert.deepEqual(await call("https://shop.example.com/p/1"), {});
    assert.deepEqual(seen, ["https://shop.example.com/p/1"]);
  });
});
