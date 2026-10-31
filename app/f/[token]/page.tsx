import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { App } from "@/components/App";
import { decodeShareToken, fundingFromShare, shareDescription, shareTitle } from "@/lib/share";
import { DEFAULT_OG_IMAGE, SITE_NAME } from "@/lib/site";

type Props = { params: { token: string } };

export function generateMetadata({ params }: Props): Metadata {
  const s = decodeShareToken(params.token);
  if (!s) return {};
  const title = shareTitle(s);
  const description = shareDescription(s);
  // 상품 이미지가 없으면 모기빙 기본 썸네일 (1200x630)
  const image = s.p.img ? { url: s.p.img, alt: s.p.name } : { url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: s.p.name };
  return {
    title,
    description,
    openGraph: {
      siteName: SITE_NAME,
      type: "website",
      locale: "ko_KR",
      url: `/f/${params.token}`,
      title,
      description,
      images: [image],
    },
    twitter: { card: "summary_large_image", title, description, images: [image.url] },
  };
}

/** 친구가 공유 링크로 들어오는 펀딩 상세 화면 */
export default function SharedFundingPage({ params }: Props) {
  const s = decodeShareToken(params.token);
  if (!s) notFound();
  return <App initialFunding={fundingFromShare(s)} initialRole="friend" />;
}
