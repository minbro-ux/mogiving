import { percent } from "./format";
import { PRODUCTS, createFunding, sumAmount } from "./mock";
import { type ContributionSummary, participantsFromSummary } from "./contribute";
import { linkOrigin } from "./site";
import type { Funding, Product, ShippingAddress } from "./types";

/**
 * 공유 링크로 전달하는 펀딩 요약. 크롤러(OG)와 친구 화면 모두 여기서 복원한다.
 * 기본은 서버 저장소에 넣고 짧은 id(/f/[shortId])로 공유하며, 저장에 실패하면 링크 자체에 담는다(/f/eyJ…).
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
  p: Pick<Product, "id" | "brand" | "name" | "price" | "emoji" | "bg" | "category" | "mall"> & { img?: string; opt?: string };
  /**
   * 운영자(관리자 페이지) 전용 정보. 저장소에만 보관하고 publicPayload에서 걸러지므로 공유 화면·OG에는 나가지 않는다
   * u: 원본 상품 링크, g: 목표 금액, a: 현재 모인 금액
   */
  x?: { u?: string; g: number; a: number };
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
  const { id, brand, name, price, emoji, bg, category, mall, imageUrl, option } = f.product;
  return {
    id: f.id,
    o: f.ownerName,
    t: f.title,
    r: Math.min(100, percent(sumAmount(f.participants), f.goal)),
    d: f.deadline,
    // blob: 등 로컬 이미지는 외부에서 열 수 없으므로 공개 주소만 담는다
    p: { id, brand, name, price, emoji, bg, category, mall, img: imageUrl && /^https?:\/\//.test(imageUrl) ? imageUrl : undefined, opt: option || undefined },
  };
}

/** 원본 구매 링크 최대 길이 (쇼핑몰 추적 파라미터가 붙은 긴 링크도 수용) */
export const MAX_URL = 4096;

/** 서버 저장용: 공개 요약 + 운영자 전용 정보(x). 긴 링크(/f/eyJ…)에는 쓰지 않는다 */
export function toStoredPayload(f: Funding): SharePayload {
  const url = f.product.url?.trim();
  return { ...toSharePayload(f), x: { u: url && /^https?:\/\//i.test(url) && url.length <= MAX_URL ? url : undefined, g: f.goal, a: sumAmount(f.participants) } };
}

/** 저장 시 운영자 전용 정보만 검증·정리해 꺼낸다 (잘못된 값이면 버림) */
export function adminExtra(s: SharePayload): SharePayload["x"] {
  const x = s.x;
  if (!x) return undefined;
  // 구매 링크는 금액 값과 독립적으로 보존한다. 잘라내면 깨진 링크가 되므로 길이 초과 시에만 버린다
  const u = typeof x.u === "string" && /^https?:\/\//i.test(x.u) && x.u.length <= MAX_URL ? x.u : undefined;
  const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? Math.max(0, Math.round(v)) : undefined);
  const g = num(x.g);
  const a = num(x.a);
  if (g === undefined || a === undefined) return u ? { u, g: Math.max(0, Math.round(s.p.price)), a: Math.round((s.p.price * s.r) / 100) } : undefined;
  return { u, g, a };
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : undefined);

/**
 * 공개해도 되는 필드만 골라 새 객체로 만든다 (화이트리스트).
 * 저장소에 함께 보관된 배송지(shipping) 등 비공개 값이 친구 화면·OG로 새지 않게, 읽어올 때 항상 거친다
 */
export function publicPayload(s: SharePayload): SharePayload {
  const p = s.p;
  return {
    id: s.id.slice(0, 64),
    o: s.o.slice(0, 40),
    t: s.t.slice(0, 80),
    r: Math.max(0, Math.min(100, Math.round(s.r))),
    d: s.d,
    p: {
      id: str(p.id, 64) ?? "",
      brand: str(p.brand, 60) ?? "",
      name: p.name.slice(0, 120),
      price: p.price,
      emoji: str(p.emoji, 8) ?? "🎁",
      bg: str(p.bg, 16) ?? "#EEF3FF",
      category: str(p.category, 30) ?? "링크",
      mall: str(p.mall, 40) ?? "",
      img: typeof p.img === "string" && /^https?:\/\//.test(p.img) ? p.img.slice(0, 2000) : undefined,
      opt: str(p.opt, 40),
    },
  };
}

export function isShippingAddress(v: unknown): v is ShippingAddress {
  const a = v as ShippingAddress | null;
  const ok = (x: unknown, max: number) => typeof x === "string" && x.length <= max;
  return !!a && ok(a.name, 20) && ok(a.phone, 20) && ok(a.address, 100) && ok(a.detail, 60) && (a.memo === undefined || ok(a.memo, 60));
}

export function isSharePayload(v: unknown): v is SharePayload {
  const s = v as SharePayload | null;
  return (
    typeof s?.id === "string" &&
    typeof s.o === "string" &&
    typeof s.t === "string" &&
    typeof s.r === "number" &&
    typeof s.d === "number" &&
    typeof s.p?.name === "string" &&
    typeof s.p.price === "number"
  );
}

export function decodeShareToken(token: string): SharePayload | null {
  try {
    const v: unknown = JSON.parse(fromBase64Url(decodeURIComponent(token)));
    return isSharePayload(v) ? publicPayload(v) : null;
  } catch {
    return null;
  }
}

export const fundingSharePath = (f: Funding) => `/f/${toBase64Url(JSON.stringify(toSharePayload(f)))}`;

/** 저장소 없이 펀딩 요약을 통째로 담은 긴 링크 (짧은 링크 발급 실패 시 대체용) */
export const fundingShareUrl = (f: Funding) => new URL(fundingSharePath(f), linkOrigin()).toString();

export type ShortLink = { id: string; key: string | null };

export const shortShareUrl = (id: string) => new URL(`/f/${id}`, linkOrigin()).toString();

/**
 * 짧은 공유 링크 발급. prev의 비밀 key가 있으면 같은 id에 최신 달성률만 갱신해 링크가 그대로 유지된다.
 * 실패하면 null (호출하는 쪽에서 긴 링크로 대체)
 */
export async function registerShortLink(f: Funding, prev?: ShortLink | null): Promise<ShortLink | null> {
  try {
    const res = await fetch("/api/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // 배송지는 공개 payload와 분리해 보낸다 (서버에만 보관, 링크·친구 화면에는 나가지 않음)
      body: JSON.stringify({ payload: toStoredPayload(f), shipping: f.shipping, prev: prev?.key ? prev : undefined }),
    });
    if (!res.ok) return null;
    const v = (await res.json()) as { id?: unknown; key?: unknown };
    return typeof v.id === "string" && typeof v.key === "string" ? { id: v.id, key: v.key } : null;
  } catch {
    return null;
  }
}

export const shareTitle = (s: SharePayload) => `${s.o}님의 위시리스트 · ${s.p.name} 조각 펀딩`;
export const shareDescription = (s: SharePayload) => `커피 한 잔 값으로 축하를 전해보세요. 현재 ${s.r}% 달성 중!`;

/**
 * 공유 링크로 들어온 친구 화면용 펀딩 복원.
 * summary(DB 참여 내역)가 있으면 실제 금액으로 채운다.
 * 없으면(긴 링크·저장소 장애) 참여 내역을 지어내지 않고 비워 두며, 링크의 달성률은 마감 여부 판단에만 쓴다
 */
export function fundingFromShare(s: SharePayload, summary?: ContributionSummary | null): Funding {
  const curated = PRODUCTS.find((p) => p.id === s.p.id);
  const { img, opt, ...rest } = s.p;
  const product: Product = { ...(curated ?? { ...rest, imageUrl: img }), option: opt };
  const base = createFunding(product, { title: s.t, ownerName: s.o });
  if (summary) {
    const goal = summary.goal && summary.goal > 0 ? summary.goal : base.goal;
    return {
      ...base,
      id: s.id,
      goal,
      deadline: s.d,
      participants: participantsFromSummary(summary),
      phase: summary.collected >= goal ? "achieved" : s.d <= Date.now() ? "under" : "active",
    };
  }
  return {
    ...base,
    id: s.id,
    deadline: s.d,
    participants: [],
    phase: s.r >= 100 ? "achieved" : s.d <= Date.now() ? "under" : "active",
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

export type ShareOutcome = "shared" | "cancelled" | "copied" | "failed";

/**
 * 모바일 네이티브 공유 시트(카카오톡 등 메신저)를 우선 호출하고, 지원하지 않으면 fallbackText를 복사한다.
 * 메신저로 보낼 때만 안내 문구를 함께 담고, 단순 '링크 복사'에는 copyText(url)를 쓴다
 */
export async function shareOrCopy(data: ShareData, fallbackText: string): Promise<ShareOutcome> {
  if (typeof navigator.share === "function" && (!navigator.canShare || navigator.canShare(data))) {
    try {
      await navigator.share(data);
      return "shared";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
      // 권한 거부 등은 복사로 대체
    }
  }
  return (await copyText(fallbackText)) ? "copied" : "failed";
}

/** 펀딩 공유: 공유 시트에는 제목·설명·링크를, 미지원 환경에서는 링크만 복사 */
export function shareFunding(f: Funding, url: string) {
  const s = toSharePayload(f);
  return shareOrCopy({ title: shareTitle(s), text: shareDescription(s), url }, url);
}
