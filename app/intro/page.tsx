import type { Metadata } from "next";
import { IntroLanding } from "./IntroLanding";

const TITLE = "진짜 갖고 싶던 선물, 링크 하나로 모으기 | 모기빙";
const DESCRIPTION = "서로 모르는 단톡방 친구들의 마음까지 링크 하나로 모으는 위시리스트, 모기빙.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/intro" },
  twitter: { title: TITLE, description: DESCRIPTION },
};

export default function IntroPage() {
  return <IntroLanding />;
}
