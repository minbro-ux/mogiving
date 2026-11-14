import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clipboardImage } from "@/lib/image";
import { mallTheme, usesMallThumb } from "@/lib/mallThumb";

describe("mallTheme: 쇼핑몰 이름 → 기본 썸네일 카드", () => {
  const cases: [string | undefined, string, string][] = [
    ["쿠팡", "coupang", "쿠팡"],
    ["네이버 스마트스토어", "naver", "네이버 스마트스토어"],
    ["무신사", "musinsa", "무신사"],
    ["29CM", "29cm", "29CM"],
    ["카카오톡 선물하기", "kakao", "카카오톡 선물하기"],
    ["카카오톡 쇼핑하기", "kakao", "카카오톡 쇼핑하기"],
    ["KREAM", "etc", "KREAM"],
    ["기타 쇼핑몰", "etc", "쇼핑몰"],
    ["", "etc", "쇼핑몰"],
    [undefined, "etc", "쇼핑몰"],
  ];
  for (const [mall, key, label] of cases)
    it(`${mall ?? "(없음)"} → ${key}`, () => {
      const t = mallTheme(mall);
      assert.equal(t.key, key);
      assert.equal(t.label, label);
    });
});

describe("usesMallThumb: 사진 없을 때 쇼핑몰 카드를 쓸지", () => {
  it("링크 상품 기본(🎁)은 쇼핑몰 카드", () => assert.equal(usesMallThumb({ emoji: "🎁" }), true));
  it("직접 고른 기본 이미지(👜)는 그 이모지", () => assert.equal(usesMallThumb({ emoji: "👜" }), false));
  it("큐레이션 상품은 이모지", () => assert.equal(usesMallThumb({ emoji: "🎁", curated: true }), false));
});

describe("clipboardImage: 붙여넣기 내용에서 이미지 찾기", () => {
  const file = (type: string) => ({ type, name: "x" }) as File;
  const item = (kind: string, type: string, f: File | null = file(type)) => ({ kind, type, getAsFile: () => f });
  const data = (items: ReturnType<typeof item>[], files: File[] = []) => ({ items, files }) as unknown as DataTransfer;

  it("스크린샷(image/png)을 찾는다", () => assert.equal(clipboardImage(data([item("string", "text/plain"), item("file", "image/png")]))?.type, "image/png"));
  it("글자만 붙여넣으면 null", () => assert.equal(clipboardImage(data([item("string", "text/plain"), item("string", "text/html")])), null));
  it("이미지가 아닌 파일은 무시", () => assert.equal(clipboardImage(data([item("file", "application/pdf")])), null));
  it("items에 없으면 files에서 찾는다", () => assert.equal(clipboardImage(data([], [file("image/jpeg")]))?.type, "image/jpeg"));
  it("clipboardData가 없으면 null", () => assert.equal(clipboardImage(null), null));
});
