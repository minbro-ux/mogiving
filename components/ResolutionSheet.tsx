"use client";

import { useEffect, useState } from "react";
import { MapPin, ShieldCheck, Truck } from "lucide-react";
import { won } from "@/lib/format";
import { AUTO_REFUND_DAYS } from "@/lib/policy";
import type { Funding, Product, Resolution, ShippingAddress } from "@/lib/types";
import { BottomSheet, Button, ProductThumb, Spinner } from "./ui";

type Step = "cancel" | "address" | "processing";

const EMPTY_ADDRESS: ShippingAddress = { name: "", phone: "", address: "", detail: "" };

type ActionResult<T> = ({ ok: true } & T) | { ok: false; message: string };

/**
 * 펀딩 결과 처리 모달 (현금 송금·포인트·교환권 없음)
 * - 달성(achieved): 배송지 입력 → 서버에 배송 접수 → 운영자가 원래 쇼핑몰 상품을 발주
 * - 미달(under):    전액 승인 취소. 처리하지 않아도 마감 후 일정 기간이 지나면 자동으로 전액 환불된다
 */
export function ResolutionSheet({
  open,
  funding,
  raised,
  onClose,
  onResolve,
  onCancelFunding,
  onRequestDelivery,
}: {
  open: boolean;
  funding: Funding;
  raised: number;
  onClose: () => void;
  onResolve: (r: Resolution) => void;
  /** 토스 결제를 실제로 전액 취소한다 */
  onCancelFunding: () => Promise<ActionResult<{ amount: number; count: number }>>;
  /** 배송 접수를 서버에 저장한다. 돌려준 address가 실제로 접수된 배송지다 */
  onRequestDelivery: (address: ShippingAddress) => Promise<ActionResult<{ address: ShippingAddress }>>;
}) {
  const { goal, product } = funding;
  const firstStep: Step = funding.phase === "achieved" ? "address" : "cancel";

  const [step, setStep] = useState<Step>(firstStep);
  // 펀딩 등록 때 입력한 배송지가 있으면 미리 채워 둔다
  const initialAddress = funding.shipping ?? EMPTY_ADDRESS;
  const [address, setAddress] = useState<ShippingAddress>(initialAddress);
  const [processingText, setProcessingText] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep(firstStep);
    setAddress(initialAddress);
    setError(null);
  }, [open, firstStep, initialAddress]);

  const cancelFunding = async () => {
    setError(null);
    setProcessingText("결제를 전액 취소하고 있어요");
    setStep("processing");
    const r = await onCancelFunding();
    if (r.ok) {
      onResolve({ kind: "cancel", amount: r.amount, count: r.count });
      return;
    }
    setError(r.message);
    setStep("cancel");
  };

  const requestDelivery = async () => {
    setError(null);
    setProcessingText("배송을 접수하고 있어요");
    setStep("processing");
    const r = await onRequestDelivery(address);
    if (r.ok) {
      onResolve({ kind: "gift", product, reason: "achieved", address: r.address, collected: raised });
      return;
    }
    setError(r.message);
    setStep("address");
  };

  const errorBox = error && (
    <p role="alert" className="mt-3 rounded-xl bg-toss-red-light px-3.5 py-3 text-[14px] font-semibold text-toss-red">
      {error}
    </p>
  );

  if (step === "processing")
    return (
      <BottomSheet open={open} onClose={() => {}} hideClose>
        <div className="flex flex-col items-center py-12">
          <Spinner className="!h-10 !w-10 !border-4" />
          <p className="mt-6 text-[20px] font-bold text-grey-900">{processingText}</p>
        </div>
      </BottomSheet>
    );

  /* ----------------------------- 미달: 전액 승인 취소 ----------------------------- */
  if (step === "cancel")
    return (
      <BottomSheet
        open={open}
        onClose={onClose}
        title="목표 금액에 못 미쳤어요"
        description={
          <>
            모인 금액 <b className="text-grey-900">{won(raised)}</b> · 부족한 금액 <b className="text-toss-red">{won(Math.max(0, goal - raised))}</b>
          </>
        }
        footer={
          <Button variant="danger" onClick={cancelFunding}>
            전액 결제 취소하기
          </Button>
        }
      >
        {errorBox}
        <ul className="mt-4 space-y-3 rounded-2xl bg-grey-50 p-4 text-[14px] leading-relaxed text-grey-700">
          <li>
            • 참여한 친구 {funding.participants.length}명의 결제 <b className="text-grey-900">{won(raised)}</b>이 모두 <b className="text-grey-900">자동 승인 취소</b>돼요.
          </li>
          <li>• 수수료까지 포함해 친구들이 결제한 금액 그대로 100% 환불돼요.</li>
          <li>• 지금 취소하지 않아도 마감 {AUTO_REFUND_DAYS}일 후부터 자동으로 전액 환불돼요.</li>
          <li>• 카드·토스페이 결제는 카드사에 따라 3~5영업일 안에 취소가 반영돼요.</li>
          <li>• 친구들이 남긴 롤링페이퍼는 그대로 남아요.</li>
        </ul>
        <p className="pb-2 pt-3 text-[13px] text-grey-500">친구들에게는 &lsquo;펀딩이 취소되어 결제가 자동 취소됐어요&rsquo;로만 안내돼요.</p>
      </BottomSheet>
    );

  /* ------------------------------ 달성: 배송지 입력 ------------------------------ */
  const valid = address.name.trim() && address.phone.trim() && address.address.trim();

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="축하해요! 100% 달성했어요 🎉"
      description="배송지를 입력해 접수하면 쇼핑몰 주문을 진행해 드려요."
      footer={
        <Button disabled={!valid} onClick={requestDelivery}>
          배송 접수하기
        </Button>
      }
    >
      {errorBox}
      <ProductRow product={product} />

      <div className="mt-4 flex items-center gap-2.5 rounded-xl bg-toss-blue-light/60 px-4 py-3 text-[13px] text-grey-700">
        <Truck size={17} className="shrink-0 text-toss-blue" />
        {product.mall}에서 주문해 입력한 주소로 실물 배송돼요
      </div>

      <div className="mt-5">
        <p className="flex items-center gap-1 text-[14px] font-semibold text-grey-600">
          <MapPin size={15} /> 배송지
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <AddressInput value={address.name} maxLength={20} onChange={(v) => setAddress({ ...address, name: v })} placeholder="받는 분" />
          <AddressInput value={address.phone} maxLength={20} onChange={(v) => setAddress({ ...address, phone: v })} placeholder="연락처" inputMode="tel" />
        </div>
        <AddressInput className="mt-2" value={address.address} maxLength={100} onChange={(v) => setAddress({ ...address, address: v })} placeholder="주소" />
        <AddressInput className="mt-2" value={address.detail} maxLength={60} onChange={(v) => setAddress({ ...address, detail: v })} placeholder="상세 주소 (선택)" />
      </div>
      <p className="mt-3 text-[13px] text-grey-500">접수 후에는 배송지를 바꿀 수 없으니 한 번 더 확인해 주세요.</p>
      <NoCashNote />
    </BottomSheet>
  );
}

function NoCashNote() {
  return (
    <p className="flex items-center gap-1 pb-2 pt-4 text-[12px] text-grey-500">
      <ShieldCheck size={13} className="shrink-0" /> 모인 금액은 현금으로 지급되지 않고 선물 구매와 수수료에만 쓰여요
    </p>
  );
}

function ProductRow({ product }: { product: Product }) {
  return (
    <div className="mt-4 flex items-center gap-3">
      <ProductThumb product={product} size="sm" />
      <div className="min-w-0">
        <p className="line-clamp-1 text-[15px] text-grey-800">{product.name}</p>
        <p className="text-[13px] text-grey-500">
          {product.mall} · {won(product.price)}
          {product.option && ` · 옵션 ${product.option}`}
        </p>
      </div>
    </div>
  );
}

function AddressInput({
  value,
  onChange,
  placeholder,
  inputMode,
  maxLength,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number;
  className?: string;
}) {
  return (
    <input
      value={value}
      inputMode={inputMode}
      maxLength={maxLength}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`h-12 w-full rounded-xl bg-grey-100 px-4 text-[15px] text-grey-900 outline-none placeholder:text-grey-400 focus:ring-2 focus:ring-toss-blue ${className}`}
    />
  );
}
