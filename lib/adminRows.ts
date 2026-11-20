import { GIFT_STATUS_LABEL, giftStatusOf } from "./giftStatus";
import type { AdminShareRow, VoucherRequest } from "./shareStore";
import type { GiftStatus } from "./types";

/** 관리자 화면·CSV에 공통으로 쓰는 정리된 행 */
export type AdminView = {
  id: string;
  createdAt: string;
  owner: string;
  title: string;
  productName: string;
  brand: string;
  mall: string;
  productUrl?: string;
  option: string;
  goal: number;
  raised: number;
  rate: number;
  /** 적립 금액이 실제 값이 아니라 완성도로 추정한 값인지 (운영자 정보 저장 이전에 만든 선물) */
  estimated: boolean;
  deadline: number;
  recipient: string;
  phone: string;
  address: string;
  memo: string;
  /** 수령인이 배송을 접수한 시각. 있으면 발주 대상 */
  deliveryRequestedAt: string | null;
  status: GiftStatus;
  statusLabel: string;
  /** 모바일 상품권 전환 신청. 있으면 상품권 발송 대상 */
  voucher: VoucherRequest | null;
};

export function toAdminView(r: AdminShareRow): AdminView {
  const p = r.payload;
  const x = p.x;
  const goal = x?.g ?? p.p.price;
  const raised = x?.a ?? Math.round((goal * p.r) / 100);
  const s = r.shipping;
  return {
    id: r.id,
    createdAt: r.createdAt,
    owner: p.o,
    title: p.t,
    productName: p.p.name,
    brand: p.p.brand,
    mall: p.p.mall,
    productUrl: x?.u,
    option: p.p.opt ?? "",
    goal,
    raised,
    rate: goal > 0 ? Math.floor((raised / goal) * 100) : 0,
    estimated: !x,
    deadline: p.d,
    recipient: s?.name ?? "",
    phone: s?.phone ?? "",
    address: s ? [s.zonecode && `(${s.zonecode})`, s.address, s.detail].filter(Boolean).join(" ") : "",
    memo: s?.memo ?? "",
    deliveryRequestedAt: r.deliveryRequestedAt,
    status: r.voucher ? "CONVERTED_VOUCHER" : giftStatusOf({ stored: r.giftStatus, collected: raised, goal, deadline: p.d }),
    statusLabel: GIFT_STATUS_LABEL[r.voucher ? "CONVERTED_VOUCHER" : giftStatusOf({ stored: r.giftStatus, collected: raised, goal, deadline: p.d })],
    voucher: r.voucher,
  };
}

export const kstDateTime = (iso: string | number) =>
  new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });

/** CSV 셀: 엑셀 수식 주입(=, +, -, @ 로 시작) 방지 + 따옴표 이스케이프 */
function cell(v: string | number) {
  let s = String(v);
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/** 전화번호는 엑셀이 숫자로 바꿔 앞자리 0을 지우지 않도록 텍스트 수식으로 감싼다 (숫자·하이픈만 허용된 경우에 한해) */
const phoneCell = (phone: string) => (/^[0-9-]+$/.test(phone) ? `"=""${phone}"""` : cell(phone));

export function toOrderCsv(rows: AdminView[]) {
  const header = ["등록일시", "선물ID", "수령인(개설자)", "선물제목", "상태", "쇼핑몰", "브랜드", "상품명", "원본상품링크", "옵션", "목표금액", "선물적립금액", "선물완성도(%)", "배송접수일시", "받는분", "연락처", "주소", "배송메모", "상품권종류", "상품권전환금액", "상품권받는분", "상품권연락처"];
  const lines = rows.map((r) =>
    [
      cell(kstDateTime(r.createdAt)),
      cell(r.id),
      cell(r.owner),
      cell(r.title),
      cell(r.statusLabel),
      cell(r.mall),
      cell(r.brand),
      cell(r.productName),
      cell(r.productUrl ?? ""),
      cell(r.option),
      cell(r.goal),
      cell(r.raised),
      cell(r.rate),
      cell(r.deliveryRequestedAt ? kstDateTime(r.deliveryRequestedAt) : ""),
      cell(r.recipient),
      phoneCell(r.phone),
      cell(r.address),
      cell(r.memo),
      cell(r.voucher?.type ?? ""),
      cell(r.voucher?.amount ?? ""),
      cell(r.voucher?.name ?? ""),
      r.voucher ? phoneCell(r.voucher.phone) : cell(""),
    ].join(","),
  );
  // BOM: 엑셀에서 한글이 깨지지 않게
  return "﻿" + [header.map(cell).join(","), ...lines].join("\r\n");
}
