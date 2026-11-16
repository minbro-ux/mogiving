import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { firstAvailableOption, toOptionItems } from "@/lib/options";

const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

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
