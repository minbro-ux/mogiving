import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseShareText } from "@/lib/shareText";

/**
 * 쇼핑몰 앱 [공유하기 → 복사] 글 → 링크·쇼핑몰·상품명·가격 분리.
 * 아래 글은 각 쇼핑몰 공유 형식을 흉내 낸 예시다. 실제 공유 글이 다르게 나뉘면 여기에 케이스를 추가한다.
 */
const cases: { title: string; text: string; expected: Partial<ReturnType<typeof parseShareText>> }[] = [
  {
    title: "쿠팡: 안내 문구 + 가격 + 링크",
    text: "쿠팡에서 추천하는 상품입니다.\n[쿠팡] Apple 에어팟 맥스 2 USB-C, 미드나이트\n849,000원\nhttps://link.coupang.com/a/bXyZ12",
    expected: { url: "https://link.coupang.com/a/bXyZ12", mall: "쿠팡", name: "Apple 에어팟 맥스 2 USB-C, 미드나이트", price: 849000 },
  },
  {
    title: "쿠팡: 따옴표 안 상품명, 주소 바로 뒤에 붙은 한글",
    text: "쿠팡에서 '탬버린즈 퍼퓸 핸드크림 3종 세트'을(를) 추천합니다! https://link.coupang.com/a/cD3f4g지금 확인해 보세요",
    expected: { url: "https://link.coupang.com/a/cD3f4g", name: "탬버린즈 퍼퓸 핸드크림 3종 세트" },
  },
  {
    title: "쿠팡: 정가·할인가가 함께 있으면 할인가, 배송비 줄은 무시",
    text: "[쿠팡] 발뮤다 더 토스터 프로\n정가 419,000원 → 할인가 369,000원\n배송비 3,000원\nhttps://www.coupang.com/vp/products/7120934?itemId=1",
    expected: { mall: "쿠팡", name: "발뮤다 더 토스터 프로", price: 369000 },
  },
  {
    title: "네이버: [네이버 쇼핑] 표기 + ₩ 가격 + 짧은 링크",
    text: "[네이버 쇼핑] DJI 오즈모 포켓 4P 브이로그 콤보\n₩999,000\nhttps://naver.me/5aBcDeFg",
    expected: { url: "https://naver.me/5aBcDeFg", mall: "네이버 스마트스토어", name: "DJI 오즈모 포켓 4P 브이로그 콤보", price: 999000 },
  },
  {
    title: "네이버: 쇼핑몰이 아닌 스토어명 대괄호는 상품명에 남긴다",
    text: "[Apple 공식스토어] 아이패드 에어 11 M2 128GB 129,000 원 https://brand.naver.com/apple/products/123",
    expected: { name: "[Apple 공식스토어] 아이패드 에어 11 M2 128GB", price: 129000, mall: undefined },
  },
  {
    title: "무신사: 괄호로 감싼 링크",
    text: "[무신사] 뉴발란스 993 메이드 인 USA 그레이\n289,000원\n(https://www.musinsa.com/products/2210934)",
    expected: { url: "https://www.musinsa.com/products/2210934", mall: "무신사", name: "뉴발란스 993 메이드 인 USA 그레이", price: 289000 },
  },
  {
    title: "카카오톡 선물하기: 가격 없는 글",
    text: "[카카오톡 선물하기] 조말론 우드 세이지 앤 씨 솔트 코롱 100ml\n선물해 주세요!\nhttps://gift.kakao.com/product/993120",
    expected: { mall: "카카오톡 선물하기", name: "조말론 우드 세이지 앤 씨 솔트 코롱 100ml", price: undefined },
  },
  {
    title: "순수 URL: 다른 항목을 지어내지 않는다",
    text: "https://www.29cm.co.kr/products/993120",
    expected: { url: "https://www.29cm.co.kr/products/993120", name: undefined, price: undefined, mall: undefined },
  },
  {
    title: "순수 URL: 앞뒤 공백·쿼리 문자열",
    text: "   https://www.coupang.com/vp/products/6033412?itemId=11&vendorItemId=22  \n",
    expected: { url: "https://www.coupang.com/vp/products/6033412?itemId=11&vendorItemId=22", name: undefined },
  },
  {
    title: "링크가 없는 글",
    text: "그냥 상품명만 적은 글 39,000원",
    expected: { url: undefined },
  },
];

describe("parseShareText", () => {
  for (const { title, text, expected } of cases) {
    it(title, () => {
      const got = parseShareText(text);
      for (const [key, value] of Object.entries(expected)) assert.deepEqual(got[key as keyof typeof got], value, key);
    });
  }
});
