import { getShareForOps, type VoucherRequest } from "./shareStore";
import { deliveryRequestedMessage, giftCompletedMessage, giftCreatedMessage, sendTelegramAlert, voucherRequestedMessage } from "./telegram";
import type { SharePayload } from "./share";
import type { ShippingAddress } from "./types";

/**
 * 운영 이벤트를 텔레그램으로 보고한다 — 서버 전용.
 * 어떤 오류도 밖으로 던지지 않으므로 결제·선물 처리 흐름 안에서 그대로 await해도 된다.
 */

async function safely(what: string, fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (e) {
    console.error(`[opsAlerts] ${what} 알림 준비 실패`, { error: e instanceof Error ? e.message : String(e) });
  }
}

/** 🎉 선물 100% 완성 (친구들의 적립으로 완성 또는 수령인 차액 결제) */
export const alertGiftCompleted = (shareId: string, topupAmount?: number) =>
  safely("선물 완성", async () => {
    const ops = await getShareForOps(shareId);
    if (!ops) return;
    const p = ops.payload;
    await sendTelegramAlert(
      giftCompletedMessage({ shareId, productName: p.p.name, option: p.p.opt, productUrl: p.x?.u, total: p.x?.a ?? p.x?.g ?? 0, topupAmount, shipping: ops.shipping }),
    );
  });

/** 📦 완성된 선물의 배송지 접수 (발주에 필요한 배송지가 확정된 시점) */
export const alertDeliveryRequested = (shareId: string, shipping: ShippingAddress) =>
  safely("배송지 접수", async () => {
    const ops = await getShareForOps(shareId);
    if (!ops) return;
    const p = ops.payload;
    await sendTelegramAlert(deliveryRequestedMessage({ shareId, productName: p.p.name, option: p.p.opt, productUrl: p.x?.u, total: p.x?.a ?? p.x?.g ?? 0, shipping }));
  });

/** 🎁 모바일 상품권 전환 신청 */
export const alertVoucherRequested = (shareId: string, productName: string, r: VoucherRequest) =>
  safely("모바일 상품권 전환", () =>
    sendTelegramAlert(voucherRequestedMessage({ shareId, productName, name: r.name, phone: r.phone, amount: r.amount, collected: r.collected, voucherType: r.type })),
  );

/** 🆕 신규 공동 선물 생성. 목표 금액·마감일은 서버가 저장한 값으로 보고한다 */
export const alertGiftCreated = (shareId: string) =>
  safely("신규 공동 선물", async () => {
    const ops = await getShareForOps(shareId);
    if (!ops) return;
    const p: SharePayload = ops.payload;
    await sendTelegramAlert(giftCreatedMessage({ shareId, ownerName: p.o, productName: p.p.name, goal: p.x?.g ?? p.p.price, deadline: p.d, productUrl: p.x?.u }));
  });
