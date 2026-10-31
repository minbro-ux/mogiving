"use client";

import { Ban, PackageCheck } from "lucide-react";

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
