"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { KakaoPostcodeEmbed, type Address } from "react-daum-postcode";
import type { ShippingAddress } from "@/lib/types";

export type PickedAddress = { zonecode: string; address: string };

/**
 * 카카오 우편번호 결과 → 기본 주소.
 * 도로명·지번 어느 쪽을 눌러도 도로명 주소로 맞추고, 카카오 가이드대로 법정동(동·로·가로 끝날 때)과 공동주택 건물명을 참고항목으로 붙인다
 * 예) 경기 안양시 동안구 달안로 153 (관양동, 공작성일아파트)
 */
export function toPickedAddress(d: Address): PickedAddress {
  const base = d.roadAddress || d.address;
  const extra: string[] = [];
  if (d.bname && /[동로가]$/.test(d.bname)) extra.push(d.bname);
  if (d.buildingName && d.apartment === "Y") extra.push(d.buildingName);
  // 서버 검증 한도(100자)를 넘지 않게 자른다
  return { zonecode: d.zonecode, address: (extra.length ? `${base} (${extra.join(", ")})` : base).slice(0, 100) };
}

/** 우편번호는 5자리일 때만 저장한다 (직접 입력 중 덜 쓴 값이 서버 검증에 걸리지 않게) */
export const cleanZonecode = (z?: string) => (z && /^\d{5}$/.test(z.trim()) ? z.trim() : undefined);

/**
 * 우편번호 검색 모달. 바텀시트(transform 애니메이션) 안에서 열려도 화면 전체를 덮도록 body에 포털로 띄운다.
 * 주소를 고르면 onSelect 후 닫힌다. 검색 스크립트를 못 불러왔거나 주소가 검색되지 않으면 onManual로 직접 입력으로 넘긴다
 */
export function AddressSearchModal({
  open,
  onClose,
  onSelect,
  onManual,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (a: PickedAddress) => void;
  onManual: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const goManual = () => {
    onClose();
    onManual();
  };

  if (!open || !mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="주소 검색"
        onClick={(e) => e.stopPropagation()}
        className="flex h-[85dvh] w-full max-w-[430px] flex-col overflow-hidden rounded-t-[24px] bg-white sm:h-[600px] sm:rounded-[24px]"
      >
        <div className="flex h-14 shrink-0 items-center justify-between pl-5 pr-2">
          <p className="text-[17px] font-bold text-grey-900">주소 검색</p>
          <button onClick={onClose} aria-label="닫기" className="flex h-10 w-10 items-center justify-center rounded-full text-grey-500 active:bg-grey-100">
            <X size={22} />
          </button>
        </div>
        <div className="min-h-0 flex-1">
          <KakaoPostcodeEmbed
            style={{ width: "100%", height: "100%" }}
            autoClose={false}
            onComplete={(d) => {
              onSelect(toPickedAddress(d));
              onClose();
            }}
            errorMessage={
              <div className="px-5 py-12 text-center" data-postcode-error>
                <p className="text-[15px] font-semibold text-grey-800">주소 검색을 불러오지 못했어요</p>
                <p className="mt-1 text-[13px] text-grey-500">네트워크 상태를 확인하거나, 주소를 직접 입력해 주세요.</p>
                <button type="button" onClick={goManual} className="mt-5 h-11 rounded-xl bg-toss-blue px-5 text-[15px] font-semibold text-white active:bg-toss-blue-dark">
                  직접 입력하기
                </button>
              </div>
            }
          />
        </div>
        {/* 검색 서비스 장애나 아직 등록되지 않은 신축 건물 등으로 결과가 없을 때의 탈출구 */}
        <div className="shrink-0 border-t border-grey-100 px-5 pb-safe pt-3 text-center text-[13px] text-grey-500">
          주소가 검색되지 않나요?{" "}
          <button type="button" onClick={goManual} className="font-semibold text-grey-700 underline underline-offset-2">
            직접 입력하기
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * 우편번호 + 기본 주소 + 상세 주소.
 * 기본은 검색으로만 입력: '주소 검색' 버튼이나 우편번호·기본 주소 칸을 누르면 검색 모달이 열리고, 주소를 고르면 상세 주소 칸으로 포커스를 옮긴다.
 * 검색이 안 되면(스크립트 로드 실패, 검색 결과 없음) 직접 입력 모드로 바꿔 우편번호(선택)·기본 주소를 타이핑할 수 있게 한다
 */
export function PostcodeFields({
  value,
  onChange,
  inputClassName,
}: {
  value: Pick<ShippingAddress, "zonecode" | "address" | "detail">;
  onChange: (patch: Partial<ShippingAddress>) => void;
  inputClassName: string;
}) {
  const [open, setOpen] = useState(false);
  const [manual, setManual] = useState(false);
  const detailRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLInputElement>(null);
  const openSearch = () => setOpen(true);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openSearch();
    }
  };

  return (
    <>
      <div className="mt-2 flex gap-2">
        {manual ? (
          <input
            value={value.zonecode ?? ""}
            inputMode="numeric"
            maxLength={5}
            onChange={(e) => onChange({ zonecode: e.target.value.replace(/\D/g, "").slice(0, 5) })}
            placeholder="우편번호 (선택)"
            aria-label="우편번호 (선택)"
            className={`${inputClassName} min-w-0 flex-1`}
          />
        ) : (
          <input
            readOnly
            value={value.zonecode ?? ""}
            onClick={openSearch}
            onKeyDown={onKey}
            placeholder="우편번호"
            aria-label="우편번호 (주소 검색으로 입력)"
            className={`${inputClassName} min-w-0 flex-1 cursor-pointer`}
          />
        )}
        <button type="button" onClick={openSearch} className="h-12 shrink-0 rounded-xl bg-grey-800 px-4 text-[15px] font-semibold text-white active:bg-grey-900">
          주소 검색
        </button>
      </div>
      {manual ? (
        <input
          ref={addressRef}
          value={value.address}
          maxLength={100}
          onChange={(e) => onChange({ address: e.target.value })}
          placeholder="도로명 또는 지번 주소"
          aria-label="기본 주소 (직접 입력)"
          className={`${inputClassName} mt-2`}
        />
      ) : (
        /* 긴 도로명 주소(참고항목 포함)가 잘리지 않게 input 대신 줄바꿈되는 버튼으로 보여준다 */
        <button
          type="button"
          onClick={openSearch}
          aria-label={value.address ? `기본 주소: ${value.address} (눌러서 다시 검색)` : "기본 주소 (주소 검색으로 입력)"}
          data-address-value={value.address}
          className={`${inputClassName} mt-2 !h-auto min-h-12 py-3 text-left leading-snug ${value.address ? "" : "!text-grey-400"}`}
        >
          {value.address || "주소 검색을 눌러 주소를 찾아주세요"}
        </button>
      )}
      <input
        ref={detailRef}
        value={value.detail}
        maxLength={60}
        onChange={(e) => onChange({ detail: e.target.value })}
        placeholder="상세 주소 (동·호수 등)"
        className={`${inputClassName} mt-2`}
      />
      {manual && <p className="mt-1.5 text-[12px] text-grey-500">주소를 직접 입력하고 있어요. 우편번호를 모르면 비워 두셔도 돼요.</p>}
      <AddressSearchModal
        open={open}
        onClose={() => setOpen(false)}
        onSelect={(a) => {
          setManual(false);
          // 주소가 바뀌면 이전 상세 주소는 맞지 않으므로 비운다
          onChange({ zonecode: a.zonecode, address: a.address, detail: "" });
          // 모달이 닫혀 DOM에서 빠진 뒤 포커스해야 키보드가 상세 주소 칸에 붙는다
          setTimeout(() => detailRef.current?.focus(), 0);
        }}
        onManual={() => {
          setManual(true);
          setTimeout(() => addressRef.current?.focus(), 0);
        }}
      />
    </>
  );
}
