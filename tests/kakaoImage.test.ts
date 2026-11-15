import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { crawlProduct, parseLinkInput } from "@/lib/crawl";
import { MAX_IMAGE_BYTES } from "@/lib/imageStore";
import { type KakaoImageDoc, downloadImage, downloadKakaoImage, findProductImage, isHotlinkBlocked, isOfficialCdn, kakaoImageQuery, pickKakaoImage } from "@/lib/kakaoImage";

const doc = (image_url: string, width: number, height: number, thumbnail_url = `https://search1.kakaocdn.net/thumb/${width}x${height}`): KakaoImageDoc => ({ image_url, width, height, thumbnail_url });

describe("pickKakaoImage: 검색 결과 중 대표 사진 고르기", () => {
  it("쇼핑몰 공식 CDN + 정사각형에 가까운 사진이 1순위", () => {
    const docs = [doc("https://blog.example.com/a.jpg", 800, 800), doc("https://thumbnail.coupangcdn.com/b.jpg", 3000, 600), doc("https://shop-phinf.pstatic.net/c.jpg", 900, 1000)];
    assert.equal(pickKakaoImage(docs)?.image_url, "https://shop-phinf.pstatic.net/c.jpg");
  });
  it("네이버 블로그·카페 이미지(핫링크 차단)는 정사각형이어도 후보에서 뺀다", () => {
    const docs = [
      doc("https://postfiles.pstatic.net/a.jpg", 800, 800),
      doc("https://blogfiles.pstatic.net/b.jpg", 800, 800),
      doc("https://cafeptthumb-phinf.pstatic.net/c.jpg", 800, 800),
      doc("https://a.example.com/ok.jpg", 900, 800),
    ];
    assert.equal(pickKakaoImage(docs)?.image_url, "https://a.example.com/ok.jpg");
    assert.equal(pickKakaoImage(docs.slice(0, 3)), undefined);
  });
  it("공식 CDN 목록 (하위 도메인 포함, pstatic.net 전체는 아님)", () => {
    for (const u of [
      "https://shopping-phinf.pstatic.net/x.jpg",
      "https://shop-phinf.pstatic.net/x.jpg",
      "https://thumbnail10.coupangcdn.com/x.jpg",
      "https://image.musinsa.com/x.jpg",
      "https://img.29cm.co.kr/x.jpg",
      "https://cf.product-image.s.zigzag.kr/x.jpg",
      "https://sitem.ssgcdn.com/x.jpg",
    ])
      assert.equal(isOfficialCdn(u), true, u);
    for (const u of ["https://postfiles.pstatic.net/x.jpg", "https://ssl.pstatic.net/x.jpg", "https://evilcoupangcdn.com/x.jpg", "not a url"]) assert.equal(isOfficialCdn(u), false, u);
    assert.equal(isHotlinkBlocked("http://postfiles.pstatic.net/x.jpg"), true);
    assert.equal(isHotlinkBlocked("https://shop-phinf.pstatic.net/x.jpg"), false);
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

/* ------------------------- 가짜 서버 (실제 카카오·이미지 서버에 요청하지 않음) ------------------------- */

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const GIF = new TextEncoder().encode("GIF89a....");

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>;
function fakeFetch(handler: Handler) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const f = (async (input: string | URL, init?: RequestInit) => {
    const url = input.toString();
    calls.push({ url, init });
    return handler(url, init);
  }) as unknown as typeof fetch;
  return { f, calls };
}
const img = (bytes: Uint8Array, status = 200) => new Response(new Blob([new Uint8Array(bytes)]), { status, headers: { "content-type": "image/jpeg" } });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("downloadImage: 서버에서 직접 사진 받기", () => {
  it("브라우저 User-Agent와 Referer를 붙여 요청하고, 내용으로 형식을 판별한다", async () => {
    const { f, calls } = fakeFetch(() => img(PNG));
    const r = await downloadImage("https://shop-phinf.pstatic.net/a.png", "https://smartstore.naver.com/x/products/1", f);
    assert.equal(r?.type, "image/png");
    const h = calls[0].init?.headers as Record<string, string>;
    assert.match(h["User-Agent"], /Chrome\//);
    assert.equal(h.Referer, "https://smartstore.naver.com/x/products/1");
    assert.equal(calls[0].init?.redirect, "manual");
  });
  it("오류 응답·이미지가 아닌 내용·GIF·너무 큰 파일은 undefined", async () => {
    assert.equal(await downloadImage("https://a.example.com/x", undefined, fakeFetch(() => img(JPEG, 403)).f), undefined);
    assert.equal(await downloadImage("https://a.example.com/x", undefined, fakeFetch(() => new Response("<html>")).f), undefined);
    assert.equal(await downloadImage("https://a.example.com/x", undefined, fakeFetch(() => img(GIF)).f), undefined);
    const big = new Uint8Array(MAX_IMAGE_BYTES + 1);
    big.set(JPEG);
    assert.equal(await downloadImage("https://a.example.com/x", undefined, fakeFetch(() => img(big)).f), undefined);
    assert.equal(await downloadImage("https://a.example.com/x", undefined, fakeFetch(() => Promise.reject(new Error("down"))).f), undefined);
  });
  it("리다이렉트를 따라가되, 사설망 주소로 가면 멈춘다", async () => {
    const ok = fakeFetch((u) => (u.includes("/start") ? new Response(null, { status: 302, headers: { location: "/final.jpg" } }) : img(JPEG)));
    assert.equal((await downloadImage("https://a.example.com/start", undefined, ok.f))?.type, "image/jpeg");
    assert.equal(ok.calls[1].url, "https://a.example.com/final.jpg");

    const evil = fakeFetch(() => new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest" } }));
    assert.equal(await downloadImage("https://a.example.com/start", undefined, evil.f), undefined);
    assert.equal(evil.calls.length, 1);
  });
  it("사설망 주소는 요청 자체를 보내지 않는다", async () => {
    const { f, calls } = fakeFetch(() => img(JPEG));
    assert.equal(await downloadImage("http://127.0.0.1/x.jpg", undefined, f), undefined);
    assert.equal(calls.length, 0);
  });
});

describe("downloadKakaoImage: 원본 → 썸네일 순서", () => {
  const d: KakaoImageDoc = { image_url: "http://thumbnail.coupangcdn.com/p.jpg", thumbnail_url: "https://search1.kakaocdn.net/argon/p", doc_url: "https://www.coupang.com/vp/products/1" };
  it("원본이 받아지면 원본 (http는 https로, Referer는 원문 페이지)", async () => {
    const { f, calls } = fakeFetch(() => img(JPEG));
    assert.equal((await downloadKakaoImage(d, f))?.source, "original");
    assert.equal(calls[0].url, "https://thumbnail.coupangcdn.com/p.jpg");
    assert.equal((calls[0].init?.headers as Record<string, string>).Referer, "https://www.coupang.com/vp/products/1");
  });
  it("원본이 막히면 카카오 썸네일", async () => {
    const { f } = fakeFetch((u) => (u.includes("coupangcdn") ? img(JPEG, 403) : img(JPEG)));
    assert.equal((await downloadKakaoImage(d, f))?.source, "thumbnail");
  });
  it("둘 다 안 되면 undefined", async () => {
    assert.equal(await downloadKakaoImage(d, fakeFetch(() => img(JPEG, 404)).f), undefined);
  });
});

describe("findProductImage: 카카오 검색 + 내려받기", () => {
  const KAKAO_BODY = { documents: [doc("https://postfiles.pstatic.net/blog.jpg", 800, 800), doc("http://a.example.com/banner.jpg", 1600, 300), doc("http://thumbnail.coupangcdn.com/p.jpg", 800, 800, "https://search1.kakaocdn.net/argon/p")] };

  it("키가 없으면 호출하지 않고 undefined", async () => {
    const { f, calls } = fakeFetch(() => json(KAKAO_BODY));
    assert.equal(await findProductImage("에어팟", { apiKey: "", fetchImpl: f }), undefined);
    assert.equal(calls.length, 0);
  });
  it("검색어·헤더를 맞게 보내고, 블로그 사진을 건너뛰어 쇼핑몰 사진을 받는다", async () => {
    const { f, calls } = fakeFetch((u) => (u.startsWith("https://dapi.kakao.com") ? json(KAKAO_BODY) : img(JPEG)));
    const r = await findProductImage("에어팟 맥스", { apiKey: "KEY", fetchImpl: f });
    assert.equal(r?.source, "original");
    assert.equal(r?.type, "image/jpeg");
    const u = new URL(calls[0].url);
    assert.equal(u.searchParams.get("query"), "에어팟 맥스 상품");
    assert.equal(u.searchParams.get("size"), "10");
    assert.equal(u.searchParams.get("sort"), "accuracy");
    assert.equal((calls[0].init?.headers as Record<string, string>).Authorization, "KakaoAK KEY");
    assert.equal(calls[1].url, "https://thumbnail.coupangcdn.com/p.jpg");
    assert.ok(!calls.some((c) => c.url.includes("postfiles")));
  });
  it("API 오류·네트워크 실패·빈 결과는 모두 undefined (throw 없음)", async () => {
    assert.equal(await findProductImage("에어팟", { apiKey: "KEY", fetchImpl: fakeFetch(() => json({}, 401)).f }), undefined);
    assert.equal(await findProductImage("에어팟", { apiKey: "KEY", fetchImpl: fakeFetch(() => Promise.reject(new Error("down"))).f }), undefined);
    assert.equal(await findProductImage("에어팟", { apiKey: "KEY", fetchImpl: fakeFetch(() => json({ documents: [] })).f }), undefined);
    assert.equal(await findProductImage("에어팟", { apiKey: "KEY", fetchImpl: fakeFetch(() => json(null)).f }), undefined);
  });
});

describe("crawlProduct: 크롤링이 막혀도 상품명으로 사진을 채운다", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });
  const COUPANG = "쿠팡에서 추천하는 상품입니다.\n[쿠팡] Apple 에어팟 맥스 2 USB-C\n849,000원\nhttps://link.coupang.com/a/bXyZ12";
  const BLOCKED = { json: async () => ({ ok: false, code: "blocked", status: 403 }) };
  const STORED = "http://localhost:3000/api/image/abcDEF2345678xyz";

  it("쿠팡 공유 글 + 차단 → 붙여넣은 상품명으로 찾아 저장한 사진(절대 주소)", async () => {
    const queries: string[] = [];
    globalThis.fetch = (async (input: string) => {
      if (input.startsWith("/api/image-search")) {
        queries.push(new URL(input, "http://x").searchParams.get("q") ?? "");
        return { json: async () => ({ imageUrl: "/api/image/abcDEF2345678xyz" }) };
      }
      return BLOCKED;
    }) as unknown as typeof fetch;
    const r = await crawlProduct(parseLinkInput(COUPANG)!);
    assert.equal(r.ok, true);
    assert.equal(r.product.imageUrl, STORED);
    assert.equal(r.searchedImageUrl, STORED);
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

  it("우리 저장소 경로가 아닌 응답(외부 주소·스크립트)은 쓰지 않는다", async () => {
    for (const imageUrl of ["javascript:alert(1)", "https://postfiles.pstatic.net/a.jpg", "/api/image/../../etc", "//evil.com/api/image/x"]) {
      globalThis.fetch = (async (input: string) => (input.startsWith("/api/image-search") ? { json: async () => ({ imageUrl }) } : BLOCKED)) as unknown as typeof fetch;
      const r = await crawlProduct(parseLinkInput(COUPANG)!);
      assert.equal(r.product.imageUrl, undefined, imageUrl);
    }
  });
});
