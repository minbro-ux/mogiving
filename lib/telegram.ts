import { won } from "./format";
import { linkOrigin } from "./site";
import type { ShippingAddress } from "./types";

/**
 * 텔레그램 운영 알림 — 서버 전용.
 * TELEGRAM_BOT_TOKEN·TELEGRAM_CHAT_ID가 없거나 발송에 실패해도 예외를 던지지 않는다 (결제·선물 처리에 영향 없음).
 * 서버리스 함수는 응답 뒤 작업이 끊길 수 있어 호출하는 쪽에서 await하되, 시간 제한으로 오래 붙잡지 않는다.
 */

const TIMEOUT_MS = 4_000;
/** 텔레그램 메시지 최대 길이 4096자 */
const MAX_LENGTH = 4_000;

export async function sendTelegramAlert(text: string): Promise<boolean> {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) {
      console.warn("[telegram] TELEGRAM_BOT_TOKEN 또는 TELEGRAM_CHAT_ID가 없어 알림을 보내지 않았습니다");
      return false;
    }
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: text.slice(0, MAX_LENGTH), disable_web_page_preview: true }),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      // 응답 본문에는 토큰이 없지만 요청 주소에는 있으므로 주소는 남기지 않는다
      console.error("[telegram] 알림 발송 실패", { status: res.status, body: (await res.text().catch(() => "")).slice(0, 300) });
      return false;
    }
    return true;
  } catch (e) {
    console.error("[telegram] 알림 발송 오류", { error: e instanceof Error ? e.name : String(e) });
    return false;
  }
}

/* ------------------------------ 메시지 형식 ------------------------------ */

const giftUrl = (shareId: string) => {
  try {
    return new URL(`/f/${shareId}`, linkOrigin()).toString();
  } catch {
    return `/f/${shareId}`;
  }
};

const shippingLines = (s: ShippingAddress | null | undefined) =>
  s
    ? [`수령인: ${s.name} / ${s.phone}`, `배송지: ${s.zonecode ? `(${s.zonecode}) ` : ""}${s.address} ${s.detail}`.trim(), ...(s.memo ? [`배송 메모: ${s.memo}`] : [])]
    : ["수령인 배송지: 미입력 (수령인이 입력하면 📦 배송지 접수 알림이 다시 와요)"];

export function giftCompletedMessage(a: {
  shareId: string;
  productName: string;
  option?: string;
  productUrl?: string;
  total: number;
  topupAmount?: number;
  shipping?: ShippingAddress | null;
}) {
  return [
    "[🎉 선물 100% 완성 / 실물 발주 요망]",
    `상품명: ${a.productName}${a.option ? ` (옵션: ${a.option})` : ""}`,
    `총 결제액: ${won(a.total)}${a.topupAmount ? ` (수령인 차액 결제 ${won(a.topupAmount)} 포함)` : ""}`,
    ...shippingLines(a.shipping),
    `원본 상품 링크: ${a.productUrl || "없음"}`,
    `선물 페이지: ${giftUrl(a.shareId)}`,
  ].join("\n");
}

export function deliveryRequestedMessage(a: { shareId: string; productName: string; option?: string; productUrl?: string; total: number; shipping: ShippingAddress }) {
  return [
    "[📦 배송지 접수 / 실물 발주 요망]",
    `상품명: ${a.productName}${a.option ? ` (옵션: ${a.option})` : ""}`,
    `총 결제액: ${won(a.total)}`,
    ...shippingLines(a.shipping),
    `원본 상품 링크: ${a.productUrl || "없음"}`,
    `선물 페이지: ${giftUrl(a.shareId)}`,
  ].join("\n");
}

export function voucherRequestedMessage(a: { shareId: string; productName: string; name: string; phone: string; amount: number; collected: number; voucherType: string }) {
  return [
    "[🎁 모바일 상품권 전환 신청]",
    `수령인: ${a.name} / ${a.phone}`,
    `전환 요청 원가 금액: ${won(a.amount)} (적립 금액 ${won(a.collected)}에서 수수료 제외)`,
    `희망 상품권 종류: ${a.voucherType}`,
    `원래 선물: ${a.productName}`,
    `선물 페이지: ${giftUrl(a.shareId)}`,
  ].join("\n");
}

export function giftCreatedMessage(a: { shareId: string; ownerName: string; productName: string; goal: number; deadline: number; productUrl?: string }) {
  const until = new Date(a.deadline).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
  return [
    "[🆕 신규 공동 선물 생성]",
    `개설자: ${a.ownerName}`,
    `상품명: ${a.productName}`,
    `총 목표 금액: ${won(a.goal)}`,
    `마감: ${until} (KST)`,
    ...(a.productUrl ? [`원본 상품 링크: ${a.productUrl}`] : []),
    `선물 페이지: ${giftUrl(a.shareId)}`,
  ].join("\n");
}
