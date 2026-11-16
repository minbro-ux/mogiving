import { NextResponse, type NextRequest } from "next/server";
import type { TitleResponse } from "@/lib/crawl";
import { extractTitle } from "@/lib/productTitle";
import { isPublicHttpUrl } from "@/lib/publicUrl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 리다이렉트·본문 읽기까지 포함한 전체 제한 시간. 넘기면 빈 응답 (사용자가 바로 직접 입력) */
const DEADLINE_MS = 2500;
const MAX_REDIRECTS = 5;
/** og:title은 <head>에 있으므로 앞부분만 읽는다 */
const MAX_BYTES = 512 * 1024;

/** 카카오톡 링크 미리보기 봇: 대부분의 쇼핑몰이 공유 미리보기를 위해 OG 태그를 그대로 내어준다 */
const HEADERS = {
  Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
  "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
  "User-Agent": "kakaotalk-scrap/1.0; +https://devtalk.kakao.com/t/scrap/33984",
};

const empty = () => NextResponse.json<TitleResponse>({}, { headers: { "Cache-Control": "no-store" } });

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

/** 본문을 MAX_BYTES까지만 읽고 끊는다 */
async function readHead(res: Response) {
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < MAX_BYTES) {
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
 * GET /api/crawl?url=… → { name?: string }
 * 상품명(og:title)만 가볍게 뽑는다. 차단·시간 초과·파싱 실패는 모두 빈 응답이라 화면은 조용히 빈 칸으로 둔다.
 */
export async function GET(req: NextRequest) {
  let target: URL;
  try {
    target = new URL(req.nextUrl.searchParams.get("url") ?? "");
  } catch {
    return empty();
  }
  if (!isPublicHttpUrl(target)) return empty();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEADLINE_MS);
  try {
    const res = await fetchPage(target, controller.signal);
    if (!res?.ok || !/html|xml/i.test(res.headers.get("content-type") ?? "text/html")) return empty();
    const name = extractTitle(decodeHtml(await readHead(res), res.headers.get("content-type")));
    return name ? NextResponse.json<TitleResponse>({ name }, { headers: { "Cache-Control": "no-store" } }) : empty();
  } catch {
    return empty();
  } finally {
    clearTimeout(timer);
  }
}
