/**
 * 상품 페이지 HTML에서 상품명만 뽑는다 (og:title → twitter:title → <title>).
 * 가격·사진은 서버에서 가져오지 않는다. 사용자가 금액을 직접 넣고 사진은 캡처해서 올린다.
 * 외부 의존성이 없는 순수 함수라 단위 테스트로 바로 검증한다.
 */

/** HTML 엔티티를 풀고 공백을 하나로 모은다 (옵션 파서도 같이 쓴다) */
export const decodeEntities = (s: string) =>
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

const attr = (tag: string, name: string) =>
  new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag)?.slice(2).find((x) => x !== undefined);

/** 봇 차단·에러 페이지의 제목 (상품명으로 쓰면 안 됨) */
const BLOCK_PAGE_TITLE = /access denied|attention required|just a moment|forbidden|captcha|robot|too many requests|^error|에러|오류|차단|비정상|보안\s*(검사|확인)|접근이?\s*(제한|거부)|페이지를 찾을 수 없/i;

/** 상품명이 이보다 길면 잘라 쓴다 (상품명 입력칸 maxLength와 같게) */
export const MAX_NAME = 60;

/** HTML → 상품명. 못 찾거나 차단·에러 페이지면 undefined */
export function extractTitle(html: string): string | undefined {
  const meta = new Map<string, string>();
  for (const [tag] of Array.from(html.matchAll(/<meta\s[^>]*>/gi))) {
    const key = (attr(tag, "property") ?? attr(tag, "name"))?.toLowerCase();
    const content = attr(tag, "content");
    if (key && content && !meta.has(key)) meta.set(key, content);
  }
  const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  const siteName = meta.get("og:site_name");
  const raw = meta.get("og:title") ?? meta.get("twitter:title") ?? titleTag;
  if (!raw) return undefined;
  const name = cleanTitle(decodeEntities(raw), [siteName ? decodeEntities(siteName) : undefined]);
  if (!name || BLOCK_PAGE_TITLE.test(name)) return undefined;
  // 네이버처럼 렌더링 전 페이지에선 제목이 상품번호(숫자)나 URL만 남는 경우가 있다
  if (/^(\d+|https?:\/\/\S+)$/.test(name)) return undefined;
  return name.slice(0, MAX_NAME).trim();
}

/** "상품명 | 쇼핑몰" 처럼 제목 끝에 붙은 사이트 이름을 걷어낸다 */
export function cleanTitle(title: string | undefined, siteNames: (string | null | undefined)[]) {
  let t = title?.trim() ?? "";
  for (const site of siteNames) {
    if (!site) continue;
    const esc = site.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    t = t.replace(new RegExp(`\\s*[|\\-–:·]\\s*${esc}\\s*$`, "i"), "").trim();
  }
  return t;
}
