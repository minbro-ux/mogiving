import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { App } from "@/components/App";
import { type SharePayload, decodeShareToken, fundingFromShare, shareDescription, shareTitle } from "@/lib/share";
import { type ContributionSummary, getContributionSummary } from "@/lib/contributionStore";
import { SHORT_ID_RE, getShare } from "@/lib/shareStore";
import { DEFAULT_OG_IMAGE, SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";

type Props = { params: { token: string } };

/** 짧은 id(/f/aB3xK9p)는 서버 저장소에서, 예전 긴 링크(/f/eyJ…)는 링크 자체에서 펀딩 요약을 꺼낸다 */
async function resolveShare(token: string): Promise<SharePayload | null> {
  return SHORT_ID_RE.test(token) ? getShare(token) : decodeShareToken(token);
}

/** DB에 쌓인 실제 참여 내역 (긴 링크거나 조회 실패 시 null → 링크의 달성률로 대체) */
async function resolveSummary(token: string): Promise<ContributionSummary | null> {
  if (!SHORT_ID_RE.test(token)) return null;
  try {
    return await getContributionSummary(token);
  } catch (e) {
    console.error("[f/[token]] 참여 내역 조회 실패 — 링크의 달성률로 대신 표시", { token, error: e instanceof Error ? e.message : String(e) });
    return null;
  }
}

/** OG 설명·화면의 달성률을 DB 누적 금액 기준으로 맞춘다 */
const withLiveRate = (s: SharePayload, summary: ContributionSummary | null): SharePayload =>
  summary?.goal ? { ...s, r: Math.min(100, Math.floor((summary.collected / summary.goal) * 100)) } : s;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const shared = await resolveShare(params.token);
  if (!shared) return {};
  const s = withLiveRate(shared, await resolveSummary(params.token));
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
  const summary = await resolveSummary(params.token);
  return <App initialFunding={fundingFromShare(withLiveRate(s, summary), summary)} initialRole="friend" initialShareId={shortId} />;
}
