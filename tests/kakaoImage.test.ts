import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { crawlProduct, parseLinkInput } from "@/lib/crawl";
import { type KakaoImageDoc, kakaoImageQuery, pickKakaoImage, resolveKakaoImageUrl, searchProductImage } from "@/lib/kakaoImage";

const doc = (image_url: string, width: number, height: number, thumbnail_url = `https://search1.kakaocdn.net/thumb/${width}x${height}`): KakaoImageDoc => ({ image_url, width, height, thumbnail_url });

describe("pickKakaoImage: 검색 결과 중 대표 사진 고르기", () => {
  it("쇼핑몰 CDN + 정사각형에 가까운 사진이 1순위", () => {
    const docs = [doc("https://blog.example.com/a.jpg", 800, 800), doc("https://thumbnail.coupangcdn.com/b.jpg", 3000, 600), doc("https://shop-phinf.pstatic.net/c.jpg", 900, 1000)];
    assert.equal(pickKakaoImage(docs)?.image_url, "https://shop-phinf.pstatic.net/c.jpg");
  });
  it("CDN 사진이 없으면 길쭉한 배너·아이콘을 뺀 첫 번째 사진", () => {
    const docs = [doc("https://a.example.com/banner.jpg", 1200, 300), doc("https://a.example.com/tall.jpg", 200, 800), doc("https://a.example.com/ok.jpg", 1000, 700)];
    assert.equal(pickKakaoImage(docs)?.image_url, "https://a.example.com/ok.jpg");
  });
  it("CDN 사진이라도 비율이 정사각형과 멀면 1순위가 아니다", () => {
    const docs = [doc("https://a.example.com/first.jpg", 1000, 1000), doc("https://image.musinsa.com/wide.jpg", 1800, 1000)];
    assert.equal(pickKakaoImage(docs)?.image_url, "https://a.example.com/first.jpg");
  });
  it("비율 경계값: 2.0·0.5는 허용, 넘으면 제외", () => {
    assert.equal(pickKakaoImage([doc("https://a.example.com/x.jpg", 2000, 1000)])?.image_url, "https://a.example.com/x.jpg");
    assert.equal(pickKakaoImage([doc("https://a.example.com/y.jpg", 500, 1000)])?.image_url, "https://a.example.com/y.jpg");
    assert.equal(pickKakaoImage([doc("https://a.example.com/z.jpg", 2010, 1000)]), undefined);
  });
  it("결과가 없거나 주소가 없으면 undefined", () => {
    assert.equal(pickKakaoImage(undefined), undefined);
    assert.equal(pickKakaoImage([]), undefined);
    assert.equal(pickKakaoImage([{ width: 100, height: 100 }]), undefined);
  });
});

describe("kakaoImageQuery", () => {
  it("상품명 뒤에 ' 상품'을 붙이고 공백을 정리한다", () => assert.equal(kakaoImageQuery("  에어팟   맥스 "), "에어팟 맥스 상품"));
});

/** 주소별로 다른 응답을 돌려주는 가짜 fetch (실제 카카오·쇼핑몰에 요청하지 않음) */
type Reply = { status?: number; json?: unknown; contentType?: string };
function fakeFetch(route: (url: string) => Reply | Promise<Reply>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const f = (async (input: string | URL, init?: RequestInit) => {
    const url = input.toString();
    calls.push({ url, init });
    const r = await route(url);
    const status = r.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: new Headers({ "content-type": r.contentType ?? "application/json" }),
      json: async () => r.json,
    };
  }) as unknown as typeof fetch;
  return { f, calls };
}

const KAKAO_BODY = { documents: [doc("http://a.example.com/banner.jpg", 1600, 300), doc("http://thumbnail.coupangcdn.com/p.jpg", 800, 800, "https://search1.kakaocdn.net/argon/p")] };

describe("searchProductImage: 카카오 이미지 검색", () => {
  it("키가 없으면 호출하지 않고 undefined", async () => {
    const { f, calls } = fakeFetch(() => ({ json: KAKAO_BODY }));
    assert.equal(await searchProductImage("에어팟", { apiKey: "", fetchImpl: f }), undefined);
    assert.equal(calls.length, 0);
  });
  it("검색어·헤더를 맞게 보내고, 원본이 열리면 https 원본 주소를 쓴다", async () => {
    const { f, calls } = fakeFetch((url) => (url.startsWith("https://dapi.kakao.com") ? { json: KAKAO_BODY } : { contentType: "image/jpeg" }));
    assert.equal(await searchProductImage("에어팟 맥스", { apiKey: "KEY", fetchImpl: f }), "https://thumbnail.coupangcdn.com/p.jpg");
    const u = new URL(calls[0].url);
    assert.equal(u.searchParams.get("query"), "에어팟 맥스 상품");
    assert.equal(u.searchParams.get("size"), "10");
    assert.equal(u.searchParams.get("sort"), "accuracy");
    assert.equal((calls[0].init?.headers as Record<string, string>).Authorization, "KakaoAK KEY");
  });
  it("원본이 막혀 있으면(403·이미지 아님) 카카오 썸네일을 쓴다", async () => {
    const { f } = fakeFetch((url) => (url.startsWith("https://dapi.kakao.com") ? { json: KAKAO_BODY } : { status: 403, contentType: "text/html" }));
    assert.equal(await searchProductImage("에어팟", { apiKey: "KEY", fetchImpl: f }), "https://search1.kakaocdn.net/argon/p");
  });
  it("API 오류·네트워크 실패·빈 결과는 모두 undefined (throw 없음)", async () => {
    assert.equal(await searchProductImage("에어팟", { apiKey: "KEY", fetchImpl: fakeFetch(() => ({ status: 401, json: {} })).f }), undefined);
    assert.equal(await searchProductImage("에어팟", { apiKey: "KEY", fetchImpl: fakeFetch(() => Promise.reject(new Error("down"))).f }), undefined);
    assert.equal(await searchProductImage("에어팟", { apiKey: "KEY", fetchImpl: fakeFetch(() => ({ json: { documents: [] } })).f }), undefined);
    assert.equal(await searchProductImage("에어팟", { apiKey: "KEY", fetchImpl: fakeFetch(() => ({ json: null })).f }), undefined);
  });
  it("사설망 주소는 원본 확인 요청을 보내지 않고 썸네일을 쓴다", async () => {
    const { f, calls } = fakeFetch(() => ({ contentType: "image/png" }));
    assert.equal(await resolveKakaoImageUrl({ image_url: "http://127.0.0.1/x.png", thumbnail_url: "https://search1.kakaocdn.net/t" }, f), "https://search1.kakaocdn.net/t");
    assert.equal(calls.length, 0);
  });
});

describe("crawlProduct: 크롤링이 막혀도 상품명으로 사진을 채운다", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });
  const COUPANG = "쿠팡에서 추천하는 상품입니다.\n[쿠팡] Apple 에어팟 맥스 2 USB-C\n849,000원\nhttps://link.coupang.com/a/bXyZ12";
  const BLOCKED = { json: async () => ({ ok: false, code: "blocked", status: 403 }) };

  it("쿠팡 공유 글 + 차단 → 붙여넣은 상품명으로 검색한 사진", async () => {
    const queries: string[] = [];
    globalThis.fetch = (async (input: string) => {
      if (input.startsWith("/api/image-search")) {
        queries.push(new URL(input, "http://x").searchParams.get("q") ?? "");
        return { json: async () => ({ imageUrl: "https://thumbnail.coupangcdn.com/p.jpg" }) };
      }
      return BLOCKED;
    }) as unknown as typeof fetch;
    const r = await crawlProduct(parseLinkInput(COUPANG)!);
    assert.equal(r.ok, true);
    assert.equal(r.product.imageUrl, "https://thumbnail.coupangcdn.com/p.jpg");
    assert.equal(r.searchedImageUrl, "https://thumbnail.coupangcdn.com/p.jpg");
    assert.deepEqual(queries, ["Apple 에어팟 맥스 2 USB-C"]);
  });

  it("검색도 실패하면 사진 없이(쇼핑몰 기본 카드) 그대로 진행", async () => {
    globalThis.fetch = (async (input: string) => {
      if (input.startsWith("/api/image-search")) throw new Error("down");
      return BLOCKED;
    }) as unknown as typeof fetch;
    const r = await crawlProduct(parseLinkInput(COUPANG)!);
    assert.equal(r.ok, true);
    assert.equal(r.product.imageUrl, undefined);
    assert.equal(r.searchedImageUrl, undefined);
  });

  it("크롤링으로 사진을 받았으면 검색하지 않는다", async () => {
    let searched = false;
    globalThis.fetch = (async (input: string) => {
      if (input.startsWith("/api/image-search")) searched = true;
      return { json: async () => ({ ok: true, meta: { name: "상품", price: 10000, imageUrl: "https://img.example.com/a.jpg" } }) };
    }) as unknown as typeof fetch;
    const r = await crawlProduct({ url: "https://www.musinsa.com/products/1", mall: "무신사" });
    assert.equal(r.product.imageUrl, "https://img.example.com/a.jpg");
    assert.equal(searched, false);
  });

  it("검색 응답이 https 주소가 아니면 쓰지 않는다", async () => {
    globalThis.fetch = (async (input: string) =>
      input.startsWith("/api/image-search") ? { json: async () => ({ imageUrl: "javascript:alert(1)" }) } : BLOCKED) as unknown as typeof fetch;
    const r = await crawlProduct(parseLinkInput(COUPANG)!);
    assert.equal(r.product.imageUrl, undefined);
  });
});
