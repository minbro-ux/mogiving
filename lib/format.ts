export const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

export const percent = (raised: number, goal: number) =>
  goal <= 0 ? 0 : Math.floor((raised / goal) * 100);

export const discountRate = (price: number, original?: number) =>
  original && original > price ? Math.round((1 - price / original) * 100) : 0;

export function dDay(deadline: number, now = Date.now()) {
  const diff = deadline - now;
  if (diff <= 0) return "마감";
  if (diff < 86_400_000) return "오늘 마감";
  return `D-${Math.ceil(diff / 86_400_000)}`;
}

export function timeAgo(ts: number, now = Date.now()) {
  const m = Math.floor((now - ts) / 60_000);
  if (m < 1) return "방금 전";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}
