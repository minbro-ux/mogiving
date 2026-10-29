"use client";

import { useEffect, useState } from "react";
import { ArrowUpCircle, ChevronLeft, ChevronRight, CreditCard, Gift, RotateCcw, Wallet } from "lucide-react";
import { won } from "@/lib/format";
import { recommendUpgrade, recommendWithin } from "@/lib/mock";
import type { Funding, Product, Resolution } from "@/lib/types";
import { BottomSheet, Button, OptionRow, ProductThumb, Spinner } from "./ui";

type Step = "choose" | "recommend" | "topup" | "cash" | "refund" | "upgrade" | "processing";

/**
 * 마감 예외 처리 모달
 * - 미달(under): 추천 선물 / 부족분 직접 결제 / 현금·포인트 수령
 * - 초과(over):  원래 선물 + 차액 환급 / 상위 선물 추천
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
  const [step, setStep] = useState<Step>("choose");
  const [selected, setSelected] = useState<Product | null>(null);
  const [cashMethod, setCashMethod] = useState<"toss-money" | "toss-point">("toss-money");

  useEffect(() => {
    if (open) {
      setStep("choose");
      setSelected(null);
    }
  }, [open]);

  const { goal, product } = funding;
  const under = funding.phase === "under";
  const shortfall = goal - raised;
  const surplus = raised - goal;

  const commit = (r: Resolution) => {
    setStep("processing");
    setTimeout(() => onResolve(r), 1200);
  };

  const back = (
    <button onClick={() => setStep("choose")} className="-ml-1 mb-1 flex items-center text-[14px] font-medium text-grey-500">
      <ChevronLeft size={18} /> 다른 방법 보기
    </button>
  );

  if (step === "processing")
    return (
      <BottomSheet open={open} onClose={() => {}} hideClose>
        <div className="flex flex-col items-center py-12">
          <Spinner className="!h-10 !w-10 !border-4" />
          <p className="mt-6 text-[20px] font-bold text-grey-900">토스머니로 송금하고 있어요</p>
        </div>
      </BottomSheet>
    );

  /* ---------------------------- 1단계: 방법 선택 ---------------------------- */
  if (step === "choose")
    return (
      <BottomSheet
        open={open}
        onClose={onClose}
        title={under ? "목표 금액에 조금 못 미쳤어요" : "목표보다 더 많이 모였어요 🎉"}
        description={
          under ? (
            <>
              모인 금액 <b className="text-grey-900">{won(raised)}</b> · 부족한 금액 <b className="text-toss-red">{won(shortfall)}</b>
            </>
          ) : (
            <>
              모인 금액 <b className="text-grey-900">{won(raised)}</b> · 초과 금액 <b className="text-toss-blue">{won(surplus)}</b>
            </>
          )
        }
      >
        <div className="mt-4 space-y-2.5 pb-4">
          {under ? (
            <>
              <OptionRow
                icon={<Gift size={20} className="text-toss-blue" />}
                title="모인 금액에 맞는 다른 선물 받기"
                description={`${won(raised)} 안에서 고를 수 있는 선물을 추천해드려요`}
                right={<ChevronRight size={20} className="text-grey-400" />}
                onClick={() => setStep("recommend")}
              />
              <OptionRow
                icon={<CreditCard size={20} className="text-toss-blue" />}
                title="부족한 금액 내고 원래 선물 받기"
                description={`${won(shortfall)}만 보태면 원래 선물을 살 수 있어요`}
                right={<ChevronRight size={20} className="text-grey-400" />}
                onClick={() => setStep("topup")}
              />
              <OptionRow
                icon={<Wallet size={20} className="text-toss-blue" />}
                title="현금 · 포인트로 받기"
                description="토스머니 또는 토스포인트로 바로 받아요"
                right={<ChevronRight size={20} className="text-grey-400" />}
                onClick={() => setStep("cash")}
              />
            </>
          ) : (
            <>
              <OptionRow
                icon={<RotateCcw size={20} className="text-toss-blue" />}
                title="원래 선물 사고 남은 금액 받기"
                description={`모인 ${won(raised)}을 받고, 선물 구매 후 ${won(surplus)}이 남아요`}
                right={<ChevronRight size={20} className="text-grey-400" />}
                onClick={() => setStep("refund")}
              />
              <OptionRow
                icon={<ArrowUpCircle size={20} className="text-toss-blue" />}
                title="더 좋은 선물로 업그레이드"
                description={`${won(raised)}에 맞춘 상위 선물을 추천해드려요`}
                right={<ChevronRight size={20} className="text-grey-400" />}
                onClick={() => setStep("upgrade")}
              />
            </>
          )}
        </div>
      </BottomSheet>
    );

  /* --------------------------- 미달 ① 추천 선물 --------------------------- */
  if (step === "recommend" || step === "upgrade") {
    const isUpgrade = step === "upgrade";
    const list = isUpgrade ? recommendUpgrade(goal, raised, product.id) : recommendWithin(raised, product.id);
    const leftover = selected ? raised - selected.price : 0;
    return (
      <BottomSheet
        open={open}
        onClose={onClose}
        title={
          <>
            {back}
            {isUpgrade ? "이런 선물은 어때요?" : "모인 금액으로 받을 수 있어요"}
          </>
        }
        description={`${won(raised)} 이하의 모기빙 추천 상품이에요`}
        footer={
          <Button
            disabled={!selected}
            onClick={() =>
              selected &&
              commit({
                kind: "gift",
                product: selected,
                reason: isUpgrade ? "upgrade" : "recommend",
                payout: raised,
                leftover: leftover > 0 ? leftover : undefined,
              })
            }
          >
            {selected ? `이 선물로 정하고 ${won(raised)} 받기` : "선물을 골라주세요"}
          </Button>
        }
      >
        {list.length === 0 ? (
          <p className="py-10 text-center text-[15px] text-grey-500">
            지금 금액에 맞는 상품이 없어요.
            <br />
            다른 방법을 선택해주세요.
          </p>
        ) : (
          <div className="mt-4 space-y-2.5 pb-2">
            {list.map((p) => (
              <OptionRow
                key={p.id}
                selected={selected?.id === p.id}
                onClick={() => setSelected(p)}
                icon={<ProductThumb product={p} size="sm" className="!h-11 !w-11 !rounded-full !text-xl" />}
                title={<span className="line-clamp-1 text-[15px]">{p.name}</span>}
                description={
                  <>
                    {p.brand} · <b className="text-grey-800">{won(p.price)}</b>
                  </>
                }
                right={<Radio on={selected?.id === p.id} />}
              />
            ))}
          </div>
        )}
      </BottomSheet>
    );
  }

  /* --------------------------- 미달 ② 부족분 결제 --------------------------- */
  if (step === "topup")
    return (
      <BottomSheet
        open={open}
        onClose={onClose}
        title={
          <>
            {back}
            부족한 금액만 보탤게요
          </>
        }
        footer={
          <Button onClick={() => commit({ kind: "gift", product, reason: "topup", payout: goal, extraPaid: shortfall })}>
            <span className="rounded bg-white px-1 text-[11px] font-black tracking-tight text-toss-blue">toss pay</span>
            {won(shortfall)} 결제하기
          </Button>
        }
      >
        <div className="mt-4 flex items-center gap-3">
          <ProductThumb product={product} size="sm" />
          <p className="line-clamp-2 text-[15px] text-grey-800">{product.name}</p>
        </div>
        <dl className="mt-5 space-y-3 rounded-2xl bg-grey-50 p-4 text-[15px]">
          <Row k="선물 금액" v={won(goal)} />
          <Row k="친구들이 모아준 금액" v={`- ${won(raised)}`} />
          <div className="border-t border-grey-200 pt-3">
            <Row k={<b className="text-grey-900">내가 보탤 금액</b>} v={<b className="text-[17px] text-toss-blue">{won(shortfall)}</b>} />
          </div>
        </dl>
      </BottomSheet>
    );

  /* --------------------------- 미달 ③ 현금/포인트 --------------------------- */
  if (step === "cash")
    return (
      <BottomSheet
        open={open}
        onClose={onClose}
        title={
          <>
            {back}
            어떻게 받을까요?
          </>
        }
        footer={<Button onClick={() => commit({ kind: "cash", amount: raised, method: cashMethod })}>{won(raised)} 받기</Button>}
      >
        <div className="mt-4 space-y-2.5 pb-2">
          <OptionRow
            selected={cashMethod === "toss-money"}
            onClick={() => setCashMethod("toss-money")}
            icon={<Wallet size={20} className="text-toss-blue" />}
            title="토스머니"
            description="토스 계좌로 받아 바로 송금·출금할 수 있어요"
            right={<Radio on={cashMethod === "toss-money"} />}
          />
          <OptionRow
            selected={cashMethod === "toss-point"}
            onClick={() => setCashMethod("toss-point")}
            icon={<span className="text-[18px] font-black text-toss-blue">P</span>}
            title="토스포인트"
            description="토스페이 가맹점에서 현금처럼 써요"
            right={<Radio on={cashMethod === "toss-point"} />}
          />
        </div>
        <p className="pb-2 text-[13px] text-grey-500">참여한 친구들에게는 &lsquo;마음이 잘 전달됐어요&rsquo;로 안내돼요.</p>
      </BottomSheet>
    );

  /* --------------------------- 초과 ① 차액 환급 --------------------------- */
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={
        <>
          {back}
          원래 선물로 정할게요
        </>
      }
      footer={<Button onClick={() => commit({ kind: "gift", product, reason: "refund", payout: raised, leftover: surplus })}>{won(raised)} 송금받기</Button>}
    >
      <div className="mt-4 flex items-center gap-3">
        <ProductThumb product={product} size="sm" />
        <p className="line-clamp-2 text-[15px] text-grey-800">{product.name}</p>
      </div>
      <dl className="mt-5 space-y-3 rounded-2xl bg-grey-50 p-4 text-[15px]">
        <Row k="모인 금액" v={won(raised)} />
        <Row k="선물 가격" v={`- ${won(goal)}`} />
        <div className="border-t border-grey-200 pt-3">
          <Row k={<b className="text-grey-900">구매 후 남는 금액</b>} v={<b className="text-[17px] text-toss-blue">{won(surplus)}</b>} />
        </div>
      </dl>
    </BottomSheet>
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

function Radio({ on }: { on: boolean }) {
  return (
    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${on ? "border-toss-blue bg-toss-blue" : "border-grey-300"}`}>
      {on && <span className="h-2 w-2 rounded-full bg-white" />}
    </span>
  );
}
