import type { AdminShareRow } from "./shareStore";

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
  /** 모인 금액이 실제 값이 아니라 달성률로 추정한 값인지 (운영자 정보 저장 이전에 만든 펀딩) */
  estimated: boolean;
  deadline: number;
  recipient: string;
  phone: string;
  address: string;
  memo: string;
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
    address: s ? [s.address, s.detail].filter(Boolean).join(" ") : "",
    memo: s?.memo ?? "",
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
  const header = ["등록일시", "펀딩ID", "주최자", "펀딩제목", "쇼핑몰", "브랜드", "상품명", "원본상품링크", "옵션", "목표금액", "모인금액", "달성률(%)", "수령인", "연락처", "주소", "배송메모"];
  const lines = rows.map((r) =>
    [
      cell(kstDateTime(r.createdAt)),
      cell(r.id),
      cell(r.owner),
      cell(r.title),
      cell(r.mall),
      cell(r.brand),
      cell(r.productName),
      cell(r.productUrl ?? ""),
      cell(r.option),
      cell(r.goal),
      cell(r.raised),
      cell(r.rate),
      cell(r.recipient),
      phoneCell(r.phone),
      cell(r.address),
      cell(r.memo),
    ].join(","),
  );
  // BOM: 엑셀에서 한글이 깨지지 않게
  return "﻿" + [header.map(cell).join(","), ...lines].join("\r\n");
}
