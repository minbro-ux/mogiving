import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { voucherNumber } from "../lib/giftVoucher";

describe("선물 교환권 발급번호", () => {
  it("참여 기록 uuid에서 MG-XXXX-XXXX-XXXX 형식을 만든다", () => {
    assert.equal(voucherNumber("3f2a9c1e-7b4d-4e21-9a0b-1c2d3e4f5a6b"), "MG-3F2A-9C1E-7B4D");
  });
  it("같은 id는 항상 같은 번호 (결제 완료 화면과 선물 상세가 일치)", () => {
    const id = "0a1b2c3d-4e5f-6789-abcd-ef0123456789";
    assert.equal(voucherNumber(id), voucherNumber(id));
  });
  it("주문번호(mg_ + hex)로 대체해도 형식을 지킨다", () => {
    assert.match(voucherNumber("mg_9e8d7c6b5a4f3e2d1c0b"), /^MG-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
  });
});
