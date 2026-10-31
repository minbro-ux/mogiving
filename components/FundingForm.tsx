"use client";

import { Ban, Lock, MapPin, PackageCheck } from "lucide-react";
import type { ShippingAddress } from "@/lib/types";

/* ------------------------- 펀딩 개설 시트 공통 폼 요소 ------------------------- */

export function SafetyNote() {
  return (
    <div className="mb-2 mt-5 space-y-2.5 rounded-2xl bg-grey-50 p-4 text-[13px] text-grey-700">
      <p className="flex items-center gap-2">
        <PackageCheck size={16} className="shrink-0 text-grey-500" /> 목표 달성 시 즉시 마감되고, 쇼핑몰에서 실물로 배송돼요
      </p>
      <p className="flex items-center gap-2">
        <Ban size={16} className="shrink-0 text-grey-500" /> 목표 금액까지만 모이고, 미달 시 차액 결제 또는 전액 결제 취소를 골라요
      </p>
    </div>
  );
}

export function PeriodPicker({ value, onChange }: { value: number; onChange: (d: number) => void }) {
  return (
    <FormField label="모금 기간">
      <div className="grid grid-cols-3 gap-2">
        {[3, 7, 14].map((d) => (
          <button
            key={d}
            onClick={() => onChange(d)}
            className={`h-11 rounded-xl text-[15px] font-semibold transition ${value === d ? "bg-toss-blue text-white" : "bg-grey-100 text-grey-600"}`}
          >
            {d}일
          </button>
        ))}
      </div>
    </FormField>
  );
}

export function FormField({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[14px] font-semibold text-grey-600">{label}</p>
        {hint}
      </div>
      {children}
    </div>
  );
}

export const inputClass =
  "h-12 w-full rounded-xl bg-grey-100 px-4 text-[16px] text-grey-900 outline-none placeholder:text-grey-400 focus:ring-2 focus:ring-toss-blue";

/** 천 단위 콤마가 붙는 금액 입력 */
export function PriceInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex h-12 items-center rounded-xl bg-grey-100 px-4 focus-within:ring-2 focus-within:ring-toss-blue">
      <input
        inputMode="numeric"
        value={value ? value.toLocaleString("ko-KR") : ""}
        onChange={(e) => onChange(Math.min(10_000_000, Number(e.target.value.replace(/\D/g, "")) || 0))}
        placeholder="0"
        className="min-w-0 flex-1 bg-transparent text-[16px] font-semibold text-grey-900 outline-none placeholder:text-grey-400"
      />
      <span className="text-[15px] text-grey-500">원</span>
    </div>
  );
}

/* ------------------------------- 옵션 · 배송지 ------------------------------- */

export function OptionField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <FormField label="옵션 (색상 / 사이즈 / 용량 등)" hint={<span className="text-[12px] text-grey-400">선택</span>}>
      <input value={value} maxLength={40} onChange={(e) => onChange(e.target.value)} placeholder="예) 스페이스 그레이 / 256GB" className={inputClass} />
    </FormField>
  );
}

export const EMPTY_SHIPPING: ShippingAddress = { name: "", phone: "", address: "", detail: "", memo: "" };

/** 비어 있음 / 필수 항목(이름·연락처·주소) 모두 입력 / 일부만 입력 */
export function shippingStatus(s: ShippingAddress): "empty" | "complete" | "partial" {
  const filled = [s.name, s.phone, s.address, s.detail, s.memo ?? ""].some((v) => v.trim());
  if (!filled) return "empty";
  const phoneOk = s.phone.replace(/\D/g, "").length >= 9;
  return s.name.trim() && phoneOk && s.address.trim() ? "complete" : "partial";
}

/** 폼 값 → 저장용 배송지 (입력하지 않았으면 undefined) */
export function toShipping(s: ShippingAddress): ShippingAddress | undefined {
  if (shippingStatus(s) !== "complete") return undefined;
  const memo = s.memo?.trim();
  return { name: s.name.trim(), phone: s.phone.trim(), address: s.address.trim(), detail: s.detail.trim(), ...(memo ? { memo } : {}) };
}

/** 선물 수령용 배송지. 지금 비워 두면 펀딩 성공 후 수령 단계에서 입력한다 */
export function ShippingFields({ value, onChange }: { value: ShippingAddress; onChange: (v: ShippingAddress) => void }) {
  const set = (patch: Partial<ShippingAddress>) => onChange({ ...value, ...patch });
  const partial = shippingStatus(value) === "partial";
  return (
    <div className="mt-6 rounded-2xl border border-grey-200 p-4">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1 text-[15px] font-bold text-grey-900">
          <MapPin size={16} /> 배송지 정보
        </p>
        <span className="text-[12px] text-grey-400">선택 · 나중에 입력해도 돼요</span>
      </div>
      <p className="mt-1 flex items-center gap-1 text-[12px] font-medium text-toss-blue">
        <Lock size={12} /> 배송 정보는 친구들에게 공개되지 않습니다.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <input value={value.name} maxLength={20} onChange={(e) => set({ name: e.target.value })} placeholder="수령인 이름" className={inputClass} />
        <input value={value.phone} maxLength={20} inputMode="tel" onChange={(e) => set({ phone: e.target.value })} placeholder="연락처" className={inputClass} />
      </div>
      <input value={value.address} maxLength={100} onChange={(e) => set({ address: e.target.value })} placeholder="주소" className={`${inputClass} mt-2`} />
      <input value={value.detail} maxLength={60} onChange={(e) => set({ detail: e.target.value })} placeholder="상세 주소 (선택)" className={`${inputClass} mt-2`} />
      <input value={value.memo ?? ""} maxLength={60} onChange={(e) => set({ memo: e.target.value })} placeholder="배송 메모 (예: 부재 시 문 앞)" className={`${inputClass} mt-2`} />
      {partial && <p className="mt-2 text-[13px] text-toss-red">수령인 이름, 연락처, 주소를 모두 입력하거나 전부 비워주세요</p>}
    </div>
  );
}
