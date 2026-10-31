import type { Metadata } from "next";
import { App } from "@/components/App";

export const metadata: Metadata = {
  title: "받고 싶은 선물 링크를 남겨주세요 | 모기빙",
  description: "원하는 선물의 상품 링크를 붙여넣으면 친구들이 조각으로 마음을 모아 선물해요.",
};

/** 위시리스트 요청 초대 링크: 받은 사람이 상품 링크를 등록하는 첫 화면으로 연결 */
export default function WishRequestPage() {
  return <App />;
}
