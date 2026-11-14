/**
 * 상품 페이지에서 고를 수 있는 옵션(색상·사이즈 등) 목록을 뽑는다.
 * 1) JSON-LD ProductGroup.hasVariant (schema.org 변형 상품)
 * 2) 상품 옵션으로 보이는 <select> (카페24·고도몰 등 정적 옵션)
 * 확신이 없으면 빈 배열을 돌려준다. 그때 개설 화면은 옵션 직접 입력칸을 보여준다.
 */

/** 링크 상품 옵션 칩 최대 개수 (lib/crawl.ts의 MAX_OPTIONS와 같게 유지) */
const MAX_OPTIONS = 30;
const MAX_LABEL = 40;

type LdNode = Record<string, unknown>;
type Decode = (s: string) => string;

/** id·name·class에 이런 단어가 있는 select만 상품 옵션으로 본다 */
const OPTION_SELECT = /opt|option|size|color|colour|variant|사이즈|색상|옵션/i;
/** 상품 옵션이 아닌 select (내 사이즈 설정·정렬·수량·배송·결제·필터 등) */
const NOT_OPTION_SELECT = /my-?size|sort|order-?by|qty|quantity|lang|country|currency|filter|search|category|deliv|ship|pay|card|install|month|year|day|birth|mail|phone|tel|addr/i;
/** "- [필수] 옵션을 선택해 주세요 -", "-------" 같은 안내 문구 */
const PLACEHOLDER = /^[-=_*\s]*$|선택|필수|choose|select|please/i;
const SOLD_OUT = /품절|sold\s*out|out\s*of\s*stock|일시\s*중지/i;

const attrOf = (tag: string, name: string) =>
  new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag)?.slice(2).find((x) => x !== undefined);

/** 옵션 문구 끝의 추가 금액 "(+5,000원)" · "[+5,000]" 을 걷어낸다 */
const cleanLabel = (s: string) =>
  s
    .replace(/\s*[([]\s*[+-]\s*[\d,]+\s*원?\s*[)\]]\s*$/, "")
    .replace(/\s*[+-]\s*[\d,]+\s*원\s*$/, "")
    .trim();

function finalize(labels: string[]): string[] {
  const out = Array.from(new Set(labels.map((l) => l.slice(0, MAX_LABEL).trim()).filter(Boolean)));
  return out.length > MAX_OPTIONS ? [] : out;
}

function variantLabel(v: LdNode): string | undefined {
  const parts = [v.color, v.size].map((x) => (typeof x === "string" ? x.trim() : x && typeof x === "object" && typeof (x as LdNode).name === "string" ? ((x as LdNode).name as string).trim() : "")).filter(Boolean);
  if (parts.length) return parts.join(" / ");
  return typeof v.name === "string" ? v.name.trim() : undefined;
}

/** JSON-LD의 hasVariant (품절 변형은 제외) */
export function ldVariantOptions(html: string, decode: Decode): string[] {
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
      if (Array.isArray(node.hasVariant) && node.hasVariant.length) {
        const labels = (node.hasVariant as LdNode[])
          .filter((v) => {
            const offer = (Array.isArray(v?.offers) ? v.offers[0] : v?.offers) as LdNode | undefined;
            return !(typeof offer?.availability === "string" && /OutOfStock|SoldOut|Discontinued/i.test(offer.availability));
          })
          .map((v) => (v && typeof v === "object" ? variantLabel(v) : undefined))
          .filter((l): l is string => !!l)
          .map(decode);
        const out = finalize(labels);
        // 변형 이름이 전부 같으면(색상·사이즈 정보 없음) 고를 의미가 없다
        if (out.length > 1) return out;
      }
      if (node["@graph"]) stack.push(node["@graph"]);
    }
  }
  return [];
}

/** 상품 옵션 select들의 선택지. 옵션이 여러 단(색상 → 사이즈)이면 조합하되 너무 많으면 포기한다 */
export function selectOptions(html: string, decode: Decode): string[] {
  const body = html.slice(Math.max(0, html.search(/<body[\s>]/i)));
  const groups: string[][] = [];
  for (const m of Array.from(body.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/gi))) {
    const open = m[1];
    const ident = ["id", "name", "class", "data-name", "aria-label", "title"].map((a) => attrOf(` ${open}`, a) ?? "").join(" ");
    if (!OPTION_SELECT.test(ident) || NOT_OPTION_SELECT.test(ident)) continue;
    const labels: string[] = [];
    for (const o of Array.from(m[2].matchAll(/<option\b([^>]*)>([\s\S]*?)(?=<option\b|<\/option>|$)/gi))) {
      const attrs = o[1];
      const value = attrOf(` ${attrs}`, "value");
      const text = decode(o[2].replace(/<[^>]*>/g, " "));
      if (/\sdisabled\b/i.test(` ${attrs}`) || value === "" || (value !== undefined && /^\*+$/.test(value))) continue;
      if (!text || PLACEHOLDER.test(text) || SOLD_OUT.test(text)) continue;
      labels.push(cleanLabel(text));
    }
    const out = finalize(labels);
    if (out.length) groups.push(out);
  }
  if (!groups.length) return [];
  // 카페24처럼 하위 옵션이 상위 선택 전엔 비어 있으면 첫 단만 남는다
  let combos = groups[0];
  for (const g of groups.slice(1)) {
    if (combos.length * g.length > MAX_OPTIONS) return [];
    combos = combos.flatMap((a) => g.map((b) => `${a} / ${b}`));
  }
  return finalize(combos);
}

export function extractOptions(html: string, decode: Decode): string[] {
  const ld = ldVariantOptions(html, decode);
  return ld.length ? ld : selectOptions(html, decode);
}
