import type { Metadata } from "next";
import { DEFAULT_OG_IMAGE, SITE_NAME } from "@/lib/site";
import { IntroLanding } from "./IntroLanding";

const TITLE = "진짜 갖고 싶던 선물, 링크 하나로 모으기 | 모기빙";
const DESCRIPTION = "서로 모르는 단톡방 친구들의 마음까지 링크 하나로 모으는 위시리스트, 모기빙.";
/** openGraph를 페이지에서 지정하면 상위(layout)의 값이 통째로 대체되므로 썸네일·사이트명을 다시 넣어 준다 */
const IMAGE = { url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: TITLE };

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/intro", siteName: SITE_NAME, type: "website", locale: "ko_KR", images: [IMAGE] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: [IMAGE] },
};

export default function IntroPage() {
  return <IntroLanding />;
}
