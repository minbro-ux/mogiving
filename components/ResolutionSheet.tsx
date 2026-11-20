"use client";

import { useEffect, useState } from "react";
import { CreditCard, Gift, MapPin, ShieldCheck, Smartphone, Truck } from "lucide-react";
import type { FundingVoucherInfo } from "@/lib/contributionStore";
import { FEE_PERCENT, voucherAmount } from "@/lib/fee";
import { won } from "@/lib/format";
import { VOUCHER_SEND_BUSINESS_DAYS, VOUCHER_TYPES, type VoucherType } from "@/lib/policy";
import type { Funding, Product, Resolution, ShippingAddress } from "@/lib/types";
import { PostcodeFields, cleanZonecode } from "./AddressSearch";
import { BottomSheet, Button, ProductThumb, Spinner } from "./ui";

type Step = "choice" | "voucher" | "address" | "processing";

const EMPTY_ADDRESS: ShippingAddress = { name: "", phone: "", address: "", detail: "" };

type ActionResult<T> = ({ ok: true } & T) | { ok: false; message: string };

/**
 * 수령인의 선물 수령 모달
 * - 100% 완성(achieved = COMPLETED_FULL): 배송지 입력 → 서버에 배송 접수 → 운영자가 원래 쇼핑몰 상품을 발주
 * - 기간 종료·미도달(under = PENDING_CHOICE): 결제는 취소되지 않고 수령 방식을 고른다
 *     A. 차액 결제하고 실물 받기 → 결제 완료 시 COMPLETED_FULL → 배송지 입력
 *     B. 모바일 상품권으로 받기 → 적립 금액에서 수수료를 뺀 원가 상당액으로 전환 신청 (CONVERTED_VOUCHER)
 */
export function ResolutionSheet({
  open,
  funding,
  raised,
  onClose,
  onResolve,
  onTopup,
  onRequestVoucher,
  onRequestDelivery,
}: {
  open: boolean;
  funding: Funding;
  raised: number;
  onClose: () => void;
  onResolve: (r: Resolution) => void;
  /** 남은 차액 결제창을 연다. 결제 완료 화면은 결제창에서 돌아온 /pay/success가 보여준다 */
  onTopup: () => Promise<{ status: "redirecting" | "canceled" } | { status: "error"; message: string }>;
  /** 모바일 상품권 전환을 서버에 신청한다 */
  onRequestVoucher: (input: { voucherType: VoucherType; name: string; phone: string }) => Promise<ActionResult<{ voucher: FundingVoucherInfo }>>;
  /** 배송 접수를 서버에 저장한다. 돌려준 address가 실제로 접수된 배송지다 */
  onRequestDelivery: (address: ShippingAddress) => Promise<ActionResult<{ address: ShippingAddress }>>;
}) {
  const { goal, product } = funding;
  const firstStep: Step = funding.phase === "achieved" ? "address" : "choice";
  const remaining = Math.max(0, goal - raised);
  const voucherValue = voucherAmount(raised);
  const extraPaid = funding.participants.filter((p) => p.nickname === "차액 결제").reduce((s, p) => s + p.amount, 0);

  const [step, setStep] = useState<Step>(firstStep);
  // 선물 등록 때 입력한 배송지가 있으면 미리 채워 둔다
  const initialAddress = funding.shipping ?? EMPTY_ADDRESS;
  const [address, setAddress] = useState<ShippingAddress>(initialAddress);
  const [voucherType, setVoucherType] = useState<VoucherType>(VOUCHER_TYPES[0]);
  const [contact, setContact] = useState({ name: initialAddress.name, phone: initialAddress.phone });
  const [processingText, setProcessingText] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep(firstStep);
    setAddress(initialAddress);
    setContact({ name: initialAddress.name, phone: initialAddress.phone });
    setError(null);
  }, [open, firstStep, initialAddress]);

  // 결제창에서 브라우저 '뒤로'로 돌아오면 멈춘 화면이 복원될 수 있어 선택 화면으로 되돌린다
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) setStep(firstStep);
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [firstStep]);

  const payTopup = async () => {
    setError(null);
    setProcessingText("차액 결제창을 열고 있어요");
    setStep("processing");
    const r = await onTopup();
    if (r.status === "redirecting") return;
    if (r.status === "error") setError(r.message);
    setStep("choice");
  };

  const submitVoucher = async () => {
    setError(null);
    setProcessingText("모바일 상품권 전환을 신청하고 있어요");
    setStep("processing");
    const r = await onRequestVoucher({ voucherType, name: contact.name.trim(), phone: contact.phone.trim() });
    if (r.ok) {
      onResolve({ kind: "voucher", requestedAt: r.voucher.requestedAt, amount: r.voucher.amount ?? voucherValue, voucherType: r.voucher.type ?? voucherType });
      return;
    }
    setError(r.message);
    setStep("voucher");
  };

  const requestDelivery = async () => {
    setError(null);
    setProcessingText("배송을 접수하고 있어요");
    setStep("processing");
    // 직접 입력 중 덜 쓴 우편번호(5자리 아님)는 빼고 보낸다
    const { zonecode, ...rest } = address;
    const z = cleanZonecode(zonecode);
    const r = await onRequestDelivery(z ? { ...rest, zonecode: z } : rest);
    if (r.ok) {
      onResolve({ kind: "gift", product, reason: extraPaid > 0 ? "topup" : "achieved", address: r.address, collected: raised - extraPaid, ...(extraPaid ? { extraPaid } : {}) });
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

  /* ----------------------- 기간 종료·미도달: 수령 방식 선택 ----------------------- */
  if (step === "choice")
    return (
      <BottomSheet
        open={open}
        onClose={onClose}
        title="선물 받을 방법을 골라주세요"
        description={
          <>
            선물 적립 금액 <b className="text-grey-900">{won(raised)}</b> · 남은 차액 <b className="text-toss-blue">{won(remaining)}</b>
          </>
        }
      >
        {errorBox}
        <ProductRow product={product} />
        <p className="mt-4 rounded-xl bg-grey-50 px-4 py-3 text-[13px] leading-relaxed text-grey-600">
          친구들이 보낸 선물 교환권은 이미 구매 확정되어 취소되지 않아요. 아래 두 가지 중 원하는 방법으로 받아요.
        </p>

        <ChoiceCard
          icon={<CreditCard size={20} />}
          title="A. 차액 결제하고 실물 받기"
          body={
            <>
              남은 차액 <b className="text-grey-900">{won(remaining)}</b>을 결제하면 선물이 100% 완성되고, 배송지를 입력하면 {product.mall || "쇼핑몰"}에서 실물로 보내드려요.
            </>
          }
          action={<Button onClick={payTopup}>{won(remaining)} 결제하고 실물 받기</Button>}
        />
        <ChoiceCard
          icon={<Smartphone size={20} />}
          title="B. 모바일 상품권으로 받기"
          body={
            raised > 0 ? (
              <>
                적립 금액 {won(raised)}에서 플랫폼 수수료({FEE_PERCENT}%)를 뺀 원가 기준 <b className="text-grey-900">{won(voucherValue)}</b>을 모바일 상품권으로 받아요.
              </>
            ) : (
              <>아직 적립된 금액이 없어 모바일 상품권으로 받을 수 없어요.</>
            )
          }
          action={
            <Button variant="secondary" disabled={raised <= 0} onClick={() => setStep("voucher")}>
              모바일 상품권으로 받기
            </Button>
          }
        />
        <NoCashNote />
      </BottomSheet>
    );

  /* --------------------------- B. 모바일 상품권 전환 신청 --------------------------- */
  if (step === "voucher") {
    const validContact = contact.name.trim() && /^[0-9-]{9,20}$/.test(contact.phone.trim());
    return (
      <BottomSheet
        open={open}
        onClose={onClose}
        title="모바일 상품권으로 받기"
        description={
          <>
            전환 금액 <b className="text-grey-900">{won(voucherValue)}</b> (적립 {won(raised)} − 수수료 {FEE_PERCENT}%)
          </>
        }
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" full={false} className="!w-28" onClick={() => setStep("choice")}>
              이전
            </Button>
            <Button disabled={!validContact} onClick={submitVoucher}>
              {won(voucherValue)} 상품권 신청하기
            </Button>
          </div>
        }
      >
        {errorBox}
        <p className="mt-5 text-[14px] font-semibold text-grey-600">상품권 종류</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {VOUCHER_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setVoucherType(t)}
              className={`rounded-xl px-3 py-3 text-[14px] font-semibold ${voucherType === t ? "bg-toss-blue text-white" : "bg-grey-100 text-grey-700 active:bg-grey-200"}`}
            >
              {t}
            </button>
          ))}
        </div>
        <p className="mt-5 text-[14px] font-semibold text-grey-600">받는 분</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <AddressInput value={contact.name} maxLength={20} onChange={(v) => setContact({ ...contact, name: v })} placeholder="이름" />
          <AddressInput value={contact.phone} maxLength={20} onChange={(v) => setContact({ ...contact, phone: v })} placeholder="휴대폰 번호" inputMode="tel" />
        </div>
        <ul className="mt-4 space-y-1.5 rounded-2xl bg-grey-50 p-4 text-[13px] leading-relaxed text-grey-600">
          <li>• 신청 후 영업일 기준 {VOUCHER_SEND_BUSINESS_DAYS}일 이내 입력한 번호로 모바일 상품권을 보내드려요.</li>
          <li>• 신청하면 차액 결제(실물 받기)로 바꿀 수 없어요.</li>
          <li>• 상품권은 현금으로 돌려드리지 않아요.</li>
        </ul>
        <div className="pb-2" />
      </BottomSheet>
    );
  }

  /* ------------------------------ 100% 완성: 배송지 입력 ------------------------------ */
  const valid = address.name.trim() && address.phone.trim() && address.address.trim();

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="축하해요! 선물이 100% 완성됐어요 🎉"
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
        <PostcodeFields value={address} onChange={(patch) => setAddress({ ...address, ...patch })} inputClassName={ADDRESS_INPUT_CLASS} />
      </div>
      <p className="mt-3 text-[13px] text-grey-500">접수 후에는 배송지를 바꿀 수 없으니 한 번 더 확인해 주세요.</p>
      <NoCashNote />
    </BottomSheet>
  );
}

function ChoiceCard({ icon, title, body, action }: { icon: React.ReactNode; title: string; body: React.ReactNode; action: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-2xl border border-grey-200 p-4">
      <p className="flex items-center gap-2 text-[16px] font-bold text-grey-900">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-toss-blue-light text-toss-blue">{icon}</span>
        {title}
      </p>
      <p className="mt-2 text-[14px] leading-relaxed text-grey-600">{body}</p>
      <div className="mt-3">{action}</div>
    </div>
  );
}

function NoCashNote() {
  return (
    <p className="flex items-center gap-1 pb-2 pt-4 text-[12px] text-grey-500">
      <ShieldCheck size={13} className="shrink-0" /> 적립된 선물 교환권은 현금으로 지급되지 않고 지정 선물 또는 모바일 상품권으로만 받아요
    </p>
  );
}

function ProductRow({ product }: { product: Product }) {
  return (
    <div className="mt-4 flex items-center gap-3">
      <ProductThumb product={product} size="sm" />
      <div className="min-w-0">
        <p className="line-clamp-1 text-[15px] text-grey-800">{product.name}</p>
        <p className="flex items-center gap-1 text-[13px] text-grey-500">
          <Gift size={12} />
          {product.mall} · {won(product.price)}
          {product.option && ` · 옵션 ${product.option}`}
        </p>
      </div>
    </div>
  );
}

const ADDRESS_INPUT_CLASS =
  "h-12 w-full rounded-xl bg-grey-100 px-4 text-[15px] text-grey-900 outline-none placeholder:text-grey-400 focus:ring-2 focus:ring-toss-blue";

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
      className={`${ADDRESS_INPUT_CLASS} ${className}`}
    />
  );
}
