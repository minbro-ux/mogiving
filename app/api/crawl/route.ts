import { NextResponse, type NextRequest } from "next/server";
import type { CrawlErrorCode, CrawlResponse, RawMeta } from "@/lib/crawl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 리다이렉트·모바일 재시도까지 포함한 전체 크롤링 제한 시간 (구찌·쿠팡 등이 응답을 붙잡아 두는 경우 대비) */
const DEADLINE_MS = 3000;
const MAX_REDIRECTS = 8;
const MAX_BYTES = 3 * 1024 * 1024;
/** 본문 이미지 중 이 크기(px) 이상으로 선언된 것을 '큰 이미지'로 본다 */
const MIN_BODY_IMAGE_PX = 300;

/** 실제 크롬 브라우저가 보내는 요청 헤더 (데스크톱 → 차단 시 모바일로 재시도) */
const CHROME_HEADERS = {
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Sec-CH-UA": '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
};
const BROWSERS = [
  {
    ...CHROME_HEADERS,
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    "Sec-CH-UA-Mobile": "?0",
    "Sec-CH-UA-Platform": '"Windows"',
  },
  {
    ...CHROME_HEADERS,
    "User-Agent": "Mozilla/5.0 (Linux; Android 14; SM-S928N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
    "Sec-CH-UA-Mobile": "?1",
    "Sec-CH-UA-Platform": '"Android"',
  },
];

/** 봇 차단·보안 정책으로 보는 응답 코드 */
const BLOCKED_STATUS = [401, 403, 429, 503];

const fail = (code: CrawlErrorCode, status?: number) => NextResponse.json<CrawlResponse>({ ok: false, code, status });

/** 서버 내부망으로 요청이 새지 않도록 사설·로컬 주소는 막는다 */
function isPublicHttpUrl(u: URL) {
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return false;
  if (/^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h)) return false;
  if (h === "::1" || h === "::" || /^f[cd]|^fe80:/.test(h)) return false;
  return h.includes(".");
}

/**
 * 단축 URL·모바일 리다이렉트를 끝까지 따라가 최종 페이지를 받는다.
 * redirect: "follow"와 같은 결과지만, 매 단계 주소를 다시 검사하고 중간에 받은 쿠키를 이어 보낸다.
 */
async function fetchPage(start: URL, headers: Record<string, string>, signal: AbortSignal) {
  let url = start;
  const cookies = new Map<string, string>();
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    if (!isPublicHttpUrl(url)) return null;
    const cookie = Array.from(cookies, ([k, v]) => `${k}=${v}`).join("; ");
    const res = await fetch(url, {
      redirect: "manual",
      signal,
      headers: cookie ? { ...headers, Cookie: cookie } : headers,
    });
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(";");
      const eq = pair.indexOf("=");
      if (eq > 0) cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      url = new URL(location, url);
      continue;
    }
    return { res, url };
  }
  return null;
}

/** Content-Type 또는 <meta charset>을 보고 EUC-KR 등도 올바르게 디코딩 */
function decodeHtml(buf: ArrayBuffer, contentType: string | null) {
  const head = new TextDecoder("latin1").decode(buf.slice(0, 4096));
  const charset = (/charset=["']?([\w-]+)/i.exec(contentType ?? "") ?? /<meta[^>]+charset=["']?([\w-]+)/i.exec(head))?.[1] ?? "utf-8";
  try {
    return new TextDecoder(charset).decode(buf);
  } catch {
    return new TextDecoder("utf-8").decode(buf);
  }
}

const decodeEntities = (s: string) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

const attr = (tag: string, name: string) => {
  const v = new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag)?.slice(2).find((x) => x !== undefined);
  return v === undefined ? undefined : decodeEntities(v);
};

function parsePrice(v: unknown) {
  if (typeof v === "number") return Math.round(v);
  if (typeof v !== "string") return undefined;
  const n = Number(v.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
}

/**
 * 이미지 주소를 https 절대 URL로 바꾼다.
 * "//cdn…" → "https://cdn…", "/img/a.jpg" → "https://도메인/img/a.jpg", 상대 경로 → 페이지 기준
 */
function toAbsoluteImageUrl(raw: string | undefined, base: URL) {
  const src = raw?.trim();
  if (!src || src.startsWith("data:") || src.startsWith("blob:")) return undefined;
  try {
    const u = new URL(src.startsWith("//") ? `https:${src}` : src, base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return undefined;
    // 페이지가 https면 이미지도 https로 (혼합 콘텐츠 차단 방지)
    if (u.protocol === "http:" && base.protocol === "https:" && u.hostname === base.hostname) u.protocol = "https:";
    return u.toString();
  } catch {
    return undefined;
  }
}

type LdNode = Record<string, unknown>;

/** JSON-LD 안의 schema.org Product 노드 찾기 */
function findLdProduct(html: string): LdNode | undefined {
  const stack: unknown[] = [];
  for (const m of Array.from(html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi))) {
    try {
      stack.push(JSON.parse(m[1]));
    } catch {
      /* 깨진 JSON-LD는 무시 */
    }
  }
  while (stack.length) {
    const n = stack.pop();
    if (Array.isArray(n)) stack.push(...n);
    else if (n && typeof n === "object") {
      const node = n as LdNode;
      const type = node["@type"];
      if (type === "Product" || (Array.isArray(type) && type.includes("Product"))) return node;
      if (node["@graph"]) stack.push(node["@graph"]);
    }
  }
  return undefined;
}

/** JSON-LD image: "url" | ["url", …] | { url } | [{ url }, …] */
function ldImage(v: unknown): string | undefined {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(ldImage).find(Boolean);
  if (v && typeof v === "object") {
    const o = v as LdNode;
    return ldImage(o.url ?? o.contentUrl);
  }
  return undefined;
}

/** 로고·아이콘·추적 픽셀 등 상품 사진이 아닐 가능성이 높은 이미지 */
const NON_PRODUCT_IMAGE = /(logo|icon|sprite|blank|spacer|pixel|tracking|badge|banner|btn|button|loading|placeholder|avatar|profile|emoji|flag)/i;

/** 상품 상세 본문에서 첫 번째 큰 이미지 (lazy-load 속성·srcset 포함) */
function firstBodyImage(html: string, base: URL) {
  const body = html.slice(Math.max(0, html.search(/<body[\s>]/i)));
  let fallback: string | undefined;
  for (const [tag] of Array.from(body.matchAll(/<img\s[^>]*>/gi))) {
    const srcset = attr(tag, "data-srcset") ?? attr(tag, "srcset");
    const raw = attr(tag, "data-src") ?? attr(tag, "data-original") ?? attr(tag, "data-lazy-src") ?? attr(tag, "data-lazy") ?? attr(tag, "src") ?? srcset?.split(",").pop()?.trim().split(/\s+/)[0];
    const src = toAbsoluteImageUrl(raw, base);
    if (!src || /\.(svg|gif)(\?|$)/i.test(src) || NON_PRODUCT_IMAGE.test(src) || NON_PRODUCT_IMAGE.test(attr(tag, "class") ?? "")) continue;
    const w = Number(attr(tag, "width")) || 0;
    const h = Number(attr(tag, "height")) || 0;
    if (w >= MIN_BODY_IMAGE_PX || h >= MIN_BODY_IMAGE_PX) return src;
    // 크기 선언이 없는 이미지는 큰 이미지를 못 찾았을 때만 사용 (작게 선언된 썸네일은 제외)
    if (!w && !h && !fallback) fallback = src;
  }
  return fallback;
}

function extractMeta(html: string, pageUrl: URL): RawMeta {
  const head = html.slice(0, Math.max(html.search(/<body[\s>]/i), 0) || html.length);
  const baseHref = attr(/<base\s[^>]*>/i.exec(head)?.[0] ?? "", "href");
  let base = pageUrl;
  try {
    if (baseHref) base = new URL(baseHref, pageUrl);
  } catch {
    /* 잘못된 <base>는 무시 */
  }

  const meta = new Map<string, string>();
  for (const [tag] of Array.from(html.matchAll(/<meta\s[^>]*>/gi))) {
    const key = (attr(tag, "property") ?? attr(tag, "name") ?? attr(tag, "itemprop"))?.toLowerCase();
    const content = attr(tag, "content");
    if (key && content && !meta.has(key)) meta.set(key, content);
  }
  const pick = (...keys: string[]) => keys.map((k) => meta.get(k)).find(Boolean);

  const ld = findLdProduct(html);
  const offers = (Array.isArray(ld?.offers) ? ld?.offers[0] : ld?.offers) as LdNode | undefined;
  const ldBrand = ld?.brand;
  const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  const imageSrcLink = /<link\s[^>]*rel=["']?image_src["']?[^>]*>/i.exec(head)?.[0];

  // 이미지 탐색 순서: OG(secure_url → 기본) → 트위터 카드 → JSON-LD Product.image → 기타 메타 → 본문 첫 번째 큰 이미지
  const imageCandidates = [
    pick("og:image:secure_url"),
    pick("og:image", "og:image:url"),
    pick("twitter:image", "twitter:image:src"),
    ldImage(ld?.image),
    pick("image", "thumbnail"),
    imageSrcLink && attr(imageSrcLink, "href"),
  ];
  const imageUrl = imageCandidates.map((c) => toAbsoluteImageUrl(c, base)).find(Boolean) ?? firstBodyImage(html, base);

  return {
    name: pick("og:title", "twitter:title") ?? (typeof ld?.name === "string" ? decodeEntities(ld.name) : undefined) ?? (titleTag ? decodeEntities(titleTag) : undefined),
    price:
      parsePrice(pick("product:price:amount", "og:price:amount", "product:sale_price:amount", "price")) ??
      parsePrice(offers?.price) ??
      parsePrice(offers?.lowPrice),
    imageUrl,
    brand: pick("product:brand", "og:brand", "brand") ?? (typeof ldBrand === "string" ? ldBrand : typeof (ldBrand as LdNode)?.name === "string" ? ((ldBrand as LdNode).name as string) : undefined),
    siteName: pick("og:site_name"),
  };
}

type Attempt = { ok: true; meta: RawMeta } | { ok: false; code: CrawlErrorCode; status?: number };

async function crawl(target: URL, headers: Record<string, string>, signal: AbortSignal): Promise<Attempt> {
  try {
    const page = await fetchPage(target, headers, signal);
    if (!page) return { ok: false, code: "network" };
    const { res, url } = page;
    if (BLOCKED_STATUS.includes(res.status)) return { ok: false, code: "blocked", status: res.status };
    if (!res.ok) return { ok: false, code: "network", status: res.status };
    if (!/html|xml/i.test(res.headers.get("content-type") ?? "text/html")) return { ok: false, code: "parse" };

    const buf = await res.arrayBuffer();
    const html = decodeHtml(buf.byteLength > MAX_BYTES ? buf.slice(0, MAX_BYTES) : buf, res.headers.get("content-type"));
    // 최종 목적지(url) 기준으로 상대 경로 이미지를 절대 URL로 만든다
    return { ok: true, meta: extractMeta(html, url) };
  } catch (e) {
    return { ok: false, code: signal.aborted ? "timeout" : "network" };
  }
}

/** GET /api/crawl?url=… → 상품 페이지의 OG/JSON-LD/본문 메타데이터 */
export async function GET(req: NextRequest) {
  let target: URL;
  try {
    target = new URL(req.nextUrl.searchParams.get("url") ?? "");
  } catch {
    return fail("network");
  }
  if (!isPublicHttpUrl(target)) return fail("network");

  // 하나의 AbortController로 전체 3초를 묶는다: 시간이 지나면 진행 중인 요청·본문 읽기를 모두 끊고 실패로 응답
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEADLINE_MS);
  try {
    return NextResponse.json<CrawlResponse>(await crawlWithRetry(target, controller.signal));
  } finally {
    clearTimeout(timer);
  }
}

/** 데스크톱 크롬으로 먼저 시도하고, 차단되거나 상품 정보가 비면 남은 시간 안에서 모바일 크롬으로 한 번 더 */
async function crawlWithRetry(target: URL, signal: AbortSignal): Promise<Attempt> {
  let result = await crawl(target, BROWSERS[0], signal);
  const incomplete = result.ok && (!result.meta.name || !result.meta.imageUrl || !result.meta.price);
  if (!signal.aborted && ((!result.ok && result.code === "blocked") || incomplete)) {
    const mobile = await crawl(target, BROWSERS[1], signal);
    if (mobile.ok) {
      const prev = result.ok ? result.meta : {};
      result = {
        ok: true,
        meta: {
          name: prev.name ?? mobile.meta.name,
          price: prev.price ?? mobile.meta.price,
          imageUrl: prev.imageUrl ?? mobile.meta.imageUrl,
          brand: prev.brand ?? mobile.meta.brand,
          siteName: prev.siteName ?? mobile.meta.siteName,
        },
      };
    }
  }
  return result;
}
