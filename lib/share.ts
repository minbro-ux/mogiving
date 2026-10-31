import { percent } from "./format";
import { PRODUCTS, buildParticipants, createFunding, sumAmount } from "./mock";
import { SITE_URL } from "./site";
import type { Funding, Product } from "./types";

/**
 * 공유 링크에 담는 펀딩 요약.
 * 아직 서버 저장소가 없으므로 링크 자체에 담아 두고, 크롤러(OG)와 친구 화면 모두 여기서 복원한다.
 */
export type SharePayload = {
  id: string;
  /** 주인공 이름 */
  o: string;
  /** 펀딩 제목 */
  t: string;
  /** 공유 시점 달성률 (%) */
  r: number;
  /** 마감 시각 */
  d: number;
  p: Pick<Product, "id" | "brand" | "name" | "price" | "emoji" | "bg" | "category" | "mall"> & { img?: string };
};

const toBase64Url = (s: string) => {
  let bin = "";
  new TextEncoder().encode(s).forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const fromBase64Url = (t: string) => {
  const bin = atob(t.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
};

export function toSharePayload(f: Funding): SharePayload {
  const { id, brand, name, price, emoji, bg, category, mall, imageUrl } = f.product;
  return {
    id: f.id,
    o: f.ownerName,
    t: f.title,
    r: Math.min(100, percent(sumAmount(f.participants), f.goal)),
    d: f.deadline,
    // blob: 등 로컬 이미지는 외부에서 열 수 없으므로 공개 주소만 담는다
    p: { id, brand, name, price, emoji, bg, category, mall, img: imageUrl && /^https?:\/\//.test(imageUrl) ? imageUrl : undefined },
  };
}

export function decodeShareToken(token: string): SharePayload | null {
  try {
    const v = JSON.parse(fromBase64Url(decodeURIComponent(token))) as SharePayload;
    if (typeof v?.o !== "string" || typeof v.r !== "number" || typeof v.p?.name !== "string" || typeof v.p.price !== "number") return null;
    return v;
  } catch {
    return null;
  }
}

export const fundingSharePath = (f: Funding) => `/f/${toBase64Url(JSON.stringify(toSharePayload(f)))}`;

/** 브라우저에서는 현재 접속 주소, 서버에서는 SITE_URL 기준 절대 링크 */
export function fundingShareUrl(f: Funding) {
  const origin = typeof window !== "undefined" ? window.location.origin : SITE_URL;
  return new URL(fundingSharePath(f), origin).toString();
}

export const shareTitle = (s: SharePayload) => `${s.o}님의 위시리스트 · ${s.p.name} 조각 펀딩`;
export const shareDescription = (s: SharePayload) => `커피 한 잔 값으로 축하를 전해보세요. 현재 ${s.r}% 달성 중!`;

/** 공유 링크로 들어온 친구 화면용 펀딩 복원 (참여 내역은 달성률에 맞춘 데모 데이터) */
export function fundingFromShare(s: SharePayload): Funding {
  const curated = PRODUCTS.find((p) => p.id === s.p.id);
  const { img, ...rest } = s.p;
  const product: Product = curated ?? { ...rest, imageUrl: img };
  const base = createFunding(product, { title: s.t });
  const raised = Math.round((base.goal * s.r) / 100 / 1000) * 1000;
  const chunks = raised > 0 ? Math.max(1, Math.ceil(s.r / 15)) : 0;
  const amounts = Array.from({ length: chunks }, (_, i) =>
    i < chunks - 1 ? Math.floor(raised / chunks / 1000) * 1000 : raised - Math.floor(raised / chunks / 1000) * 1000 * (chunks - 1),
  );
  const achieved = s.r >= 100;
  return {
    ...base,
    id: s.id,
    ownerName: s.o,
    deadline: s.d,
    participants: buildParticipants(amounts),
    phase: achieved ? "achieved" : s.d <= Date.now() ? "under" : "active",
  };
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // 비보안(http) 환경·웹뷰 등 Clipboard API가 막힌 경우
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    el.remove();
    return ok;
  }
}

/** 모바일 네이티브 공유 시트를 우선 호출하고, 지원하지 않으면 링크를 복사한다 */
export async function shareFunding(f: Funding): Promise<"shared" | "cancelled" | "copied" | "failed"> {
  const s = toSharePayload(f);
  const url = fundingShareUrl(f);
  const data: ShareData = { title: shareTitle(s), text: shareDescription(s), url };
  if (typeof navigator.share === "function" && (!navigator.canShare || navigator.canShare(data))) {
    try {
      await navigator.share(data);
      return "shared";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
      // 권한 거부 등은 링크 복사로 대체
    }
  }
  return (await copyText(url)) ? "copied" : "failed";
}
