import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractOptions } from "@/app/api/crawl/options";
import { firstAvailableOption, toOptionItems } from "@/lib/options";

const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

describe("extractOptions (상품 페이지 → 옵션 목록)", () => {
  it("카페24식 select: 안내 문구·구분선 제외, 추가금 표기 정리, 품절·disabled는 soldOut", () => {
    const html = `<body><select id="product_option_id1"><option value="*">- [필수] 옵션을 선택해 주세요 -</option><option value="**" disabled>-------------------</option><option value="P1">블랙</option><option value="P2">아이보리 (+2,000원)</option><option value="P3">네이비 [품절]</option><option value="P4" disabled>그레이</option></select></body>`;
    assert.deepEqual(extractOptions(html, decode), ["블랙", "아이보리", { label: "네이비", soldOut: true }, { label: "그레이", soldOut: true }]);
  });

  it("색상 → 사이즈 두 단은 조합하고, 한쪽이라도 품절이면 조합도 품절", () => {
    const html = `<body><select name="opt_color"><option value="">색상 선택</option><option>Black</option><option>White (품절)</option></select><select name="opt_size"><option value="">사이즈 선택</option><option>S</option><option>M - 품절</option></select></body>`;
    assert.deepEqual(extractOptions(html, decode), ["Black / S", { label: "Black / M", soldOut: true }, { label: "White / S", soldOut: true }, { label: "White / M", soldOut: true }]);
  });

  it("JSON-LD hasVariant: OutOfStock 변형은 soldOut", () => {
    const html = `<script type="application/ld+json">{"@type":"ProductGroup","hasVariant":[{"color":"Blue","size":"M"},{"color":"Blue","size":"L","offers":{"availability":"https://schema.org/OutOfStock"}},{"color":"Red","size":"M"}]}</script><body></body>`;
    assert.deepEqual(extractOptions(html, decode), ["Blue / M", { label: "Blue / L", soldOut: true }, "Red / M"]);
  });

  it("전부 품절이면 빈 목록 (링크 상품은 직접 입력으로)", () => {
    const html = `<body><select name="option1"><option value="">선택</option><option>S 품절</option><option>M [품절]</option></select></body>`;
    assert.deepEqual(extractOptions(html, decode), []);
  });

  it("상품 옵션이 아닌 select(정렬·내 사이즈 설정)는 무시", () => {
    const html = `<body><select id="sort"><option>인기순</option></select><select id="my-size-top"><option value="">선택</option><option>M</option></select></body>`;
    assert.deepEqual(extractOptions(html, decode), []);
  });
});

describe("옵션 기본 선택", () => {
  it("품절이 아닌 첫 번째 옵션을 고른다", () => {
    assert.equal(firstAvailableOption([{ label: "10호", soldOut: true }, { label: "11호", soldOut: true }, "12호", { label: "17호", soldOut: true }]), "12호");
  });

  it("전부 품절이면 빈 값", () => {
    assert.equal(firstAvailableOption([{ label: "S", soldOut: true }]), "");
  });

  it("문자열·객체가 섞인 목록을 정리하고, 같은 이름이면 구매 가능한 쪽을 남긴다", () => {
    assert.deepEqual(toOptionItems(["M", { label: "M", soldOut: true }, { label: "L", soldOut: true }, "  "]), [
      { label: "M", soldOut: false },
      { label: "L", soldOut: true },
    ]);
  });
});
