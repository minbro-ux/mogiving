"use client";

import { useEffect, useState } from "react";
import { Ban, ChevronLeft, ChevronRight, CreditCard, MapPin, ShieldCheck, Truck } from "lucide-react";
import { won } from "@/lib/format";
import type { Funding, Product, Resolution, ShippingAddress } from "@/lib/types";
import { BottomSheet, Button, OptionRow, ProductThumb, Spinner } from "./ui";

type Step = "choose" | "topup" | "cancel" | "address" | "processing";

const EMPTY_ADDRESS: ShippingAddress = { name: "", phone: "", address: "", detail: "" };

/**
 * 펀딩 결과 처리 모달 (현금 송금·포인트·교환권 없음)
 * - 달성(achieved): 배송지 입력 → 원래 쇼핑몰 상품 실물 배송
 * - 미달(under):    부족한 차액 직접 결제 후 배송 / 전액 승인 취소
 */
export function ResolutionSheet({
  open,
  funding,
  raised,
  onClose,
  onResolve,
}: {
  open: boolean;
  funding: Funding;
  raised: number;
  onClose: () => void;
  onResolve: (r: Resolution) => void;
}) {
  const { goal, product } = funding;
  const achieved = funding.phase === "achieved";
  const shortfall = Math.max(0, goal - raised);
  const firstStep: Step = achieved ? "address" : "choose";

  const [step, setStep] = useState<Step>(firstStep);
  // 펀딩 등록 때 입력한 배송지가 있으면 미리 채워 둔다
  const initialAddress = funding.shipping ?? EMPTY_ADDRESS;
  const [address, setAddress] = useState<ShippingAddress>(initialAddress);
  const [processingText, setProcessingText] = useState("");

  useEffect(() => {
    if (!open) return;
    setStep(firstStep);
    setAddress(initialAddress);
  }, [open, firstStep, initialAddress]);

  const commit = (r: Resolution, text: string) => {
    setProcessingText(text);
    setStep("processing");
    setTimeout(() => onResolve(r), 1200);
  };

  const back = (to: Step) => (
    <button onClick={() => setStep(to)} className="-ml-1 mb-1 flex items-center text-[14px] font-medium text-grey-500">
      <ChevronLeft size={18} /> 이전으로
    </button>
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

  /* ----------------------------- 미달: 방법 선택 ----------------------------- */
  if (step === "choose")
    return (
      <BottomSheet
        open={open}
        onClose={onClose}
        title="목표 금액에 조금 못 미쳤어요"
        description={
          <>
            모인 금액 <b className="text-grey-900">{won(raised)}</b> · 부족한 금액 <b className="text-toss-red">{won(shortfall)}</b>
          </>
        }
      >
        <div className="mt-4 space-y-2.5">
          <OptionRow
            icon={<CreditCard size={20} className="text-toss-blue" />}
            title="차액 결제하고 원래 선물 받기"
            description={`${won(shortfall)}만 결제하면 원래 선물을 배송받아요`}
            right={<ChevronRight size={20} className="text-grey-400" />}
            onClick={() => setStep("topup")}
          />
          <OptionRow
            icon={<Ban size={20} className="text-toss-red" />}
            title="전액 결제 취소하기"
            description="친구들의 결제가 모두 자동으로 승인 취소돼요"
            right={<ChevronRight size={20} className="text-grey-400" />}
            onClick={() => setStep("cancel")}
          />
        </div>
        <NoCashNote />
      </BottomSheet>
    );

  /* ----------------------------- 미달 ① 차액 결제 ----------------------------- */
  if (step === "topup")
    return (
      <BottomSheet
        open={open}
        onClose={onClose}
        title={
          <>
            {back("choose")}
            차액만 결제하고 원래 선물 받을게요
          </>
        }
        footer={<Button onClick={() => setStep("address")}>다음 · 배송지 입력</Button>}
      >
        <ProductRow product={product} />
        <dl className="mt-5 space-y-3 rounded-2xl bg-grey-50 p-4 text-[15px]">
          <Row k="선물 금액" v={won(goal)} />
          <Row k="친구들이 모아준 금액" v={`- ${won(raised)}`} />
          <div className="border-t border-grey-200 pt-3">
            <Row k={<b className="text-grey-900">내가 결제할 차액</b>} v={<b className="text-[17px] text-toss-blue">{won(shortfall)}</b>} />
          </div>
        </dl>
        <p className="pb-2 pt-3 text-[13px] text-grey-500">차액은 배송지를 입력한 뒤 토스페이로 결제돼요.</p>
      </BottomSheet>
    );

  /* --------------------------- 미달 ② 전액 승인 취소 --------------------------- */
  if (step === "cancel")
    return (
      <BottomSheet
        open={open}
        onClose={onClose}
        title={
          <>
            {back("choose")}
            펀딩을 취소할까요?
          </>
        }
        footer={
          <Button variant="danger" onClick={() => commit({ kind: "cancel", amount: raised, count: funding.participants.length }, "결제를 승인 취소하고 있어요")}>
            전액 결제 취소하기
          </Button>
        }
      >
        <ul className="mt-4 space-y-3 rounded-2xl bg-grey-50 p-4 text-[14px] leading-relaxed text-grey-700">
          <li>
            • 참여한 친구 {funding.participants.length}명의 결제 <b className="text-grey-900">{won(raised)}</b>가 모두 <b className="text-grey-900">자동 승인 취소</b>돼요.
          </li>
          <li>• 카드·토스페이 결제는 카드사에 따라 3~5영업일 안에 취소가 반영돼요.</li>
          <li>• 친구들이 남긴 롤링페이퍼는 그대로 남아요.</li>
        </ul>
        <p className="pb-2 pt-3 text-[13px] text-grey-500">친구들에게는 &lsquo;펀딩이 취소되어 결제가 자동 취소됐어요&rsquo;로만 안내돼요.</p>
      </BottomSheet>
    );

  /* ------------------------------ 배송지 입력 ------------------------------ */
  const extraPaid = achieved ? 0 : shortfall;
  const valid = address.name.trim() && address.phone.trim() && address.address.trim();

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={
        achieved ? (
          "축하해요! 100% 달성했어요 🎉"
        ) : (
          <>
            {back("topup")}
            어디로 보내드릴까요?
          </>
        )
      }
      description={achieved ? "배송지를 입력하면 쇼핑몰에 바로 주문을 넣어드려요." : undefined}
      footer={
        <Button
          disabled={!valid}
          onClick={() =>
            commit(
              { kind: "gift", product, reason: achieved ? "achieved" : "topup", address, collected: raised, extraPaid: extraPaid || undefined },
              extraPaid ? "차액을 결제하고 배송을 접수하고 있어요" : "배송을 접수하고 있어요",
            )
          }
        >
          {extraPaid > 0 && <span className="rounded bg-white px-1 text-[11px] font-black tracking-tight text-toss-blue">toss pay</span>}
          {extraPaid > 0 ? `${won(extraPaid)} 결제하고 배송 접수하기` : "배송 접수하기"}
        </Button>
      }
    >
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
          <AddressInput value={address.name} onChange={(v) => setAddress({ ...address, name: v })} placeholder="받는 분" />
          <AddressInput value={address.phone} onChange={(v) => setAddress({ ...address, phone: v })} placeholder="연락처" inputMode="tel" />
        </div>
        <AddressInput className="mt-2" value={address.address} onChange={(v) => setAddress({ ...address, address: v })} placeholder="주소" />
        <AddressInput className="mt-2" value={address.detail} onChange={(v) => setAddress({ ...address, detail: v })} placeholder="상세 주소 (선택)" />
      </div>
      <NoCashNote />
    </BottomSheet>
  );
}

function NoCashNote() {
  return (
    <p className="flex items-center gap-1 pb-2 pt-4 text-[12px] text-grey-500">
      <ShieldCheck size={13} className="shrink-0" /> 모인 금액은 현금으로 지급되지 않고 선물 구매에만 쓰여요
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
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  className?: string;
}) {
  return (
    <input
      value={value}
      inputMode={inputMode}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`h-12 w-full rounded-xl bg-grey-100 px-4 text-[15px] text-grey-900 outline-none placeholder:text-grey-400 focus:ring-2 focus:ring-toss-blue ${className}`}
    />
  );
}

function Row({ k, v }: { k: React.ReactNode; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-grey-600">
      <dt>{k}</dt>
      <dd className="font-semibold text-grey-900">{v}</dd>
    </div>
  );
}
