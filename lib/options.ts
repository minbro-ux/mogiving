import type { ProductOption } from "./types";

/** 화면에서 쓰는 옵션 형태. 문자열 옵션은 구매 가능으로 본다 */
export type OptionItem = { label: string; soldOut: boolean };

const MAX_LABEL = 40;

/** 링크에서 가져온 옵션 칩 최대 개수 (너무 많으면 직접 입력이 낫다) */
export const MAX_OPTIONS = 30;

/** 문자열·객체가 섞인 옵션 목록을 하나의 형태로 정리한다. 같은 이름이 겹치면 구매 가능한 쪽을 남긴다 */
export function toOptionItems(options?: readonly unknown[]): OptionItem[] {
  if (!Array.isArray(options)) return [];
  const byLabel = new Map<string, OptionItem>();
  for (const o of options) {
    const raw = typeof o === "string" ? o : o && typeof o === "object" && typeof (o as { label?: unknown }).label === "string" ? (o as { label: string }).label : "";
    const label = raw.trim().slice(0, MAX_LABEL);
    if (!label) continue;
    const soldOut = typeof o === "object" && (o as { soldOut?: unknown }).soldOut === true;
    const prev = byLabel.get(label);
    if (!prev || (prev.soldOut && !soldOut)) byLabel.set(label, { label, soldOut });
  }
  return Array.from(byLabel.values());
}

/** 저장·전달용 형태: 구매 가능한 옵션은 문자열, 품절만 객체로 */
export const toProductOptions = (items: OptionItem[]): ProductOption[] => items.map((o) => (o.soldOut ? { label: o.label, soldOut: true } : o.label));

/** 처음 열 때 자동으로 고를 옵션: 품절이 아닌 첫 번째 옵션 (모두 품절이면 빈 값) */
export const firstAvailableOption = (options?: readonly ProductOption[]) => toOptionItems(options).find((o) => !o.soldOut)?.label ?? "";

/** 목록이 바뀌었는지 비교하는 키 (품절 상태 포함) */
export const optionsKey = (options?: readonly ProductOption[]) =>
  toOptionItems(options)
    .map((o) => `${o.label}${o.soldOut ? "!" : ""}`)
    .join("|");
