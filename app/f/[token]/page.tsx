import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { App } from "@/components/App";
import { type SharePayload, decodeShareToken, fundingFromShare, shareDescription, shareTitle } from "@/lib/share";
import { SHORT_ID_RE, getShare } from "@/lib/shareStore";
import { DEFAULT_OG_IMAGE, SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";

type Props = { params: { token: string } };

/** 짧은 id(/f/aB3xK9p)는 서버 저장소에서, 예전 긴 링크(/f/eyJ…)는 링크 자체에서 펀딩 요약을 꺼낸다 */
async function resolveShare(token: string): Promise<SharePayload | null> {
  return SHORT_ID_RE.test(token) ? getShare(token) : decodeShareToken(token);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const s = await resolveShare(params.token);
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
export default async function SharedFundingPage({ params }: Props) {
  const s = await resolveShare(params.token);
  if (!s) notFound();
  const shortId = SHORT_ID_RE.test(params.token) ? params.token : undefined;
  return <App initialFunding={fundingFromShare(s)} initialRole="friend" initialShareId={shortId} />;
}
