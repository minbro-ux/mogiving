/**
 * 서버 라우트(/api/crawl, /api/crawl/options)가 상품 페이지 HTML을 받아오는 공용 도우미.
 * 리다이렉트를 직접 따라가며 매 단계 공개 주소인지 다시 검사하고(SSRF 방지), 본문은 정해진 크기까지만 읽는다.
 */
import { isPublicHttpUrl } from "./publicUrl";

const MAX_REDIRECTS = 5;

/** 카카오톡 링크 미리보기 봇: 대부분의 쇼핑몰이 공유 미리보기를 위해 페이지를 그대로 내어준다 */
const HEADERS = {
  Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
  "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
  "User-Agent": "kakaotalk-scrap/1.0; +https://devtalk.kakao.com/t/scrap/33984",
};

/** Content-Type 또는 <meta charset>을 보고 EUC-KR 등도 올바르게 디코딩 */
function decodeHtml(buf: Uint8Array, contentType: string | null) {
  const head = new TextDecoder("latin1").decode(buf.subarray(0, 4096));
  const charset = (/charset=["']?([\w-]+)/i.exec(contentType ?? "") ?? /<meta[^>]+charset=["']?([\w-]+)/i.exec(head))?.[1] ?? "utf-8";
  try {
    return new TextDecoder(charset).decode(buf);
  } catch {
    return new TextDecoder("utf-8").decode(buf);
  }
}

/** 본문을 maxBytes까지만 읽고 끊는다 */
async function readHead(res: Response, maxBytes: number) {
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.byteLength;
  }
  reader.cancel().catch(() => {});
  const out = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.byteLength;
  }
  return out;
}

/** 단축 URL·모바일 리다이렉트를 따라가되, 매 단계 주소가 공개 http(s)인지 다시 검사한다 */
async function fetchPage(start: URL, signal: AbortSignal) {
  let url = start;
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    if (!isPublicHttpUrl(url)) return null;
    const res = await fetch(url, { redirect: "manual", signal, headers: HEADERS, cache: "no-store" });
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      url = new URL(location, url);
      continue;
    }
    return res;
  }
  return null;
}

/**
 * 공개 상품 페이지의 HTML(앞부분 maxBytes까지). 주소가 잘못됐거나, 차단·시간 초과·HTML이 아니면 null.
 * 어떤 실패도 throw하지 않는다.
 */
export async function fetchProductHtml(rawUrl: string | null, { deadlineMs, maxBytes }: { deadlineMs: number; maxBytes: number }): Promise<string | null> {
  let target: URL;
  try {
    target = new URL(rawUrl ?? "");
  } catch {
    return null;
  }
  if (!isPublicHttpUrl(target)) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deadlineMs);
  try {
    const res = await fetchPage(target, controller.signal);
    if (!res?.ok || !/html|xml/i.test(res.headers.get("content-type") ?? "text/html")) return null;
    return decodeHtml(await readHead(res, maxBytes), res.headers.get("content-type"));
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
