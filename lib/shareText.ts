/**
 * 쇼핑몰 앱의 [공유하기 → 복사] 텍스트를 통째로 붙여넣었을 때 링크·쇼핑몰·가격·상품명을 나눠 뽑는다.
 * 예) "[쿠팡] 애플 에어팟 프로 3\n369,000원\nhttps://link.coupang.com/a/abc123"
 * 외부 의존성이 없는 순수 함수라 단위 테스트로 바로 검증한다.
 */

export type ShareTextParse = {
  /** 텍스트 안의 첫 번째 http(s) 주소 (끝에 붙은 문장부호·한글은 걷어냄) */
  url?: string;
  /** [쿠팡] 같은 대괄호 표기에서 알아낸 쇼핑몰 이름 (도메인 판별은 lib/crawl.ts의 parseLink가 맡는다) */
  mall?: string;
  name?: string;
  price?: number;
};

/** 대괄호 안 표기 → 쇼핑몰 표시 이름 (lib/crawl.ts MALLS의 이름과 맞춘다) */
const TAG_MALLS: [RegExp, string][] = [
  [/^(쿠팡|coupang)/i, "쿠팡"],
  [/^(네이버|naver)/i, "네이버 스마트스토어"],
  [/^(무신사|musinsa)/i, "무신사"],
  [/^29cm/i, "29CM"],
  [/^카카오(톡)?\s*선물하기/, "카카오톡 선물하기"],
  [/^카카오(톡)?\s*쇼핑/, "카카오톡 쇼핑하기"],
  [/^(크림|kream)/i, "KREAM"],
  [/^올리브영/, "올리브영"],
  [/^11번가/, "11번가"],
  [/^(ssg|신세계)/i, "SSG.COM"],
  [/^(w\s*컨셉|wconcept)/i, "W컨셉"],
  [/^지그재그/, "지그재그"],
  [/^에이블리/, "에이블리"],
  [/^오늘의\s*집/, "오늘의집"],
  [/^(컬리|마켓컬리)/, "컬리"],
  [/^(g마켓|지마켓)/i, "G마켓"],
  [/^롯데온/, "롯데ON"],
];

const tagMall = (tag: string) => TAG_MALLS.find(([re]) => re.test(tag.trim()))?.[1];

/** 공백·한글·따옴표·꺾쇠가 나오면 주소가 끝난 것으로 본다 (앱 공유문은 주소 바로 뒤에 한글이 붙기도 한다) */
const URL_RE = /https?:\/\/[^\s<>"'`ㄱ-ㆎ가-힣]+/i;
const URL_RE_G = new RegExp(URL_RE.source, "gi");
/** 주소 끝에 딸려 온 문장부호 */
const URL_TRAILING = /[)\]}>.,!?;:'"…·]+$/;

/** ₩849,000 · 849,000원 · 129,000 원 · 849000원 */
const PRICE_RE = /(?:[₩￦]\s*(\d{1,3}(?:,\d{3})+|\d{3,9}))|(?:(\d{1,3}(?:,\d{3})+|\d{3,9})\s*원)/g;
/** 상품 가격이 아닌 금액이 나오는 줄 */
const NOT_PRICE_LINE = /배송|쿠폰|적립|포인트|캐시|마일리지|머니|리뷰|할부|최대\s*\d|\d+\s*원\s*(이상|할인)|할인\s*금액/;
/** 이 단어가 붙은 금액은 실제로 내는 가격으로 우선한다 */
const SALE_PRICE_HINT = /판매가|할인가|혜택가|특가|최저가|최종|구매가|쿠팡가/;

/** 상품명이 아닌 안내 문구 (줄 전체를 버린다) */
const BOILERPLATE =
  /추천하는\s*상품|추천\s*(합니다|해요|드려요)|공유\s*(합니다|해요|드려요)|확인해\s*보세요|구경해\s*보세요|둘러\s*보세요|지금\s*바로|앱에서|링크를\s*(눌러|클릭)|자세히\s*보기|바로\s*가기|바로가기|구매하러\s*가기|선물해\s*(주세요|줘)|갖고\s*싶어요|이\s*상품\s*어때요|함께\s*봐요/;
/** "쿠팡에서 'OOO'을(를) 추천합니다" 처럼 따옴표 안에 상품명이 있는 공유문 */
const QUOTED_NAME = /[‘'"“「『]([^‘’'"“”「」『』\n]{2,120})[’'"”」』]\s*(?:을|를|을\(를\)|상품)/;

const MAX_NAME = 120;

export function extractUrl(text: string): string | undefined {
  const m = URL_RE.exec(text)?.[0];
  if (!m) return undefined;
  let url = m;
  // "(https://…)" 처럼 괄호로 감싼 주소는 닫는 괄호를 떼되, 주소 자체의 괄호 쌍은 남긴다
  while (URL_TRAILING.test(url)) {
    const last = url[url.length - 1];
    if (last === ")" && (url.match(/\(/g)?.length ?? 0) >= (url.match(/\)/g)?.length ?? 0)) break;
    url = url.slice(0, -1);
  }
  return url.length > "https://".length ? url : undefined;
}

export function extractPrice(text: string): number | undefined {
  const candidates: { value: number; hinted: boolean }[] = [];
  for (const line of text.replace(URL_RE_G, " ").split(/\n/)) {
    if (NOT_PRICE_LINE.test(line)) continue;
    for (const m of Array.from(line.matchAll(PRICE_RE))) {
      const value = Number((m[1] ?? m[2]).replace(/,/g, ""));
      if (value >= 100 && value <= 100_000_000) candidates.push({ value, hinted: SALE_PRICE_HINT.test(line) });
    }
  }
  if (!candidates.length) return undefined;
  // "정가 59,000원 → 39,000원" 처럼 여러 개면: 판매가 표기가 붙은 금액 → 없으면 가장 낮은 금액(할인가)
  const hinted = candidates.filter((c) => c.hinted);
  return Math.min(...(hinted.length ? hinted : candidates).map((c) => c.value));
}

/** 줄에서 주소·쇼핑몰 태그·가격·할인율·별점을 지운 나머지 */
function stripLine(line: string): string {
  return line
    .replace(URL_RE_G, " ")
    .replace(/\[([^\]]{1,30})\]/g, (all, tag: string) => (tagMall(tag) ? " " : all))
    .replace(/(판매가|할인가|혜택가|정가|가격|특가|최저가|쿠팡가)\s*[:：]?/g, " ")
    .replace(PRICE_RE, " ")
    .replace(/\d{1,3}\s*%/g, " ")
    .replace(/[★☆]\s*\d(\.\d)?|\(?리뷰\s*[\d,]+\)?|\(\s*[\d,]+\s*\)/g, " ")
    .replace(/[→⇒>]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s\-–|:·,]+|[\s\-–|:·,]+$/g, "")
    .trim();
}

/** 쇼핑몰 이름만 남은 줄("쿠팡", "네이버 쇼핑")은 상품명이 아니다 */
const ONLY_MALL = /^(쿠팡|coupang|네이버(\s*(쇼핑|스마트스토어|플러스스토어|브랜드스토어))?|무신사|29cm|카카오(톡)?\s*(선물하기|쇼핑하기)|kream|올리브영|11번가|ssg(\.com)?|w컨셉|지그재그|에이블리|오늘의집|컬리)$/i;

export function extractName(text: string): string | undefined {
  const quoted = QUOTED_NAME.exec(text.replace(URL_RE_G, " "))?.[1]?.trim();
  if (quoted) return quoted.slice(0, MAX_NAME);
  for (const line of text.split(/\n/)) {
    if (BOILERPLATE.test(line)) continue;
    const name = stripLine(line);
    // 글자(한글·영문)가 2자 이상 있어야 상품명으로 본다
    if ((name.match(/[A-Za-z가-힣]/g)?.length ?? 0) < 2 || ONLY_MALL.test(name)) continue;
    return name.slice(0, MAX_NAME);
  }
  return undefined;
}

export function extractMall(text: string): string | undefined {
  for (const m of Array.from(text.matchAll(/\[([^\]]{1,30})\]/g))) {
    const mall = tagMall(m[1]);
    if (mall) return mall;
  }
  return undefined;
}

/** 공유 텍스트 전체 → 링크·쇼핑몰·상품명·가격. 주소가 없으면 url은 비어 있다 */
export function parseShareText(raw: string): ShareTextParse {
  const text = raw.replace(/\r\n?/g, "\n").trim();
  const url = extractUrl(text);
  // 주소만 붙여넣은 경우엔 다른 항목을 지어내지 않는다
  const rest = url ? text.replace(URL_RE_G, " ").trim() : text;
  if (!rest) return { url };
  return { url, mall: extractMall(text), name: url ? extractName(text) : undefined, price: url ? extractPrice(text) : undefined };
}
