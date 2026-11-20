import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { UNDER_GOAL_NOTICE, VOUCHER_ISSUE_NOTICE } from "@/lib/policy";

/**
 * 선물 교환권 구매 안내 (상품 상세·결제 화면 하단 고정 문구).
 * 결제 즉시 구매 확정되는 상품의 성격과 미도달 시 처리 방법을 결제 전에 분명히 알린다
 */
export function GiftVoucherNotice({ className = "" }: { className?: string }) {
  return (
    <aside aria-label="선물 교환권 구매 안내" className={`rounded-2xl border border-toss-blue/25 bg-toss-blue-light/50 p-4 text-[13px] leading-relaxed text-grey-800 ${className}`}>
      <p className="flex items-center gap-1.5 text-[14px] font-bold text-toss-blue">
        <BadgeCheck size={16} className="shrink-0" /> 선물 교환권 구매 안내
      </p>
      <ul className="mt-2 space-y-1.5">
        <li className="font-semibold text-grey-900">• {VOUCHER_ISSUE_NOTICE}</li>
        <li>• {UNDER_GOAL_NOTICE}</li>
      </ul>
      <p className="mt-2 text-[12px] text-grey-500">
        자세한 내용은{" "}
        <Link href="/terms#voucher" className="underline underline-offset-2">
          이용약관
        </Link>{" "}
        ·{" "}
        <Link href="/terms#refund" className="underline underline-offset-2">
          취소 및 환불 정책
        </Link>
        을 확인해 주세요.
      </p>
    </aside>
  );
}
