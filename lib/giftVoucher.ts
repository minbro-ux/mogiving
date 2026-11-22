/**
 * 선물 교환권 발급번호.
 * 결제 1건 = 교환권 1장 = 참여 기록 1건(uuid)이므로, 참여 기록 id에서 번호를 만들어
 * 결제 완료 화면과 선물 상세의 교환권 내역에 같은 번호가 보이게 한다.
 * 예) 3f2a9c1e-… → MG-3F2A-9C1E-…
 */
export function voucherNumber(sourceId: string): string {
  const hex = sourceId.replace(/^mg_/, "").replace(/[^0-9a-f]/gi, "").toUpperCase();
  if (hex.length < 12) return `MG-${sourceId.toUpperCase().slice(0, 14)}`;
  return `MG-${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`;
}

/** 발급 일시 표시 (한국 시간) */
export const issuedAtText = (ms: number) =>
  new Date(ms).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
