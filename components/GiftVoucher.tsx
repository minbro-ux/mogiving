import { BadgeCheck, Ticket } from "lucide-react";
import { won } from "@/lib/format";
import { issuedAtText, voucherNumber } from "@/lib/giftVoucher";
import type { Participant } from "@/lib/types";

/** 지급 완료 배지: 결제 즉시 교환권이 수령인에게 지급(공급 완료)되었음을 표시 */
export function PaidBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full bg-toss-green-light px-2 py-[3px] text-[12px] font-bold text-toss-green ${className}`}>
      <BadgeCheck size={13} /> 지급 완료
    </span>
  );
}

/**
 * 결제 완료 화면의 실물 티켓형 '모기빙 전용 선물 교환권'.
 * 결제와 동시에 디지털 재화(교환권)가 발급·지급되었음을 한눈에 보여준다.
 */
export function GiftVoucherTicket({
  voucherNo,
  amount,
  productName,
  recipientName,
  issuedAt,
  kindLabel = "모기빙 전용 선물 교환권",
}: {
  voucherNo: string;
  amount: number;
  productName: string | null;
  recipientName: string | null;
  issuedAt: number;
  kindLabel?: string;
}) {
  return (
    <section aria-label={kindLabel} className="w-full overflow-hidden rounded-[24px] text-left shadow-[0_8px_30px_rgba(0,100,255,0.16)] ring-1 ring-toss-blue/15">
      <div className="bg-gradient-to-br from-[#0064FF] to-[#4F5BFF] px-5 pb-5 pt-4 text-white">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-black tracking-[0.16em] text-white/80">MOGIVING GIFT VOUCHER</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-[3px] text-[12px] font-bold text-toss-green">
            <BadgeCheck size={13} /> 지급 완료
          </span>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-[15px] font-bold">
          <Ticket size={17} /> {kindLabel}
        </p>
        <p className="mt-3 text-[12px] font-medium text-white/75">충전 금액</p>
        <p className="text-[30px] font-bold leading-tight tracking-tight">{won(amount)}</p>
      </div>

      {/* 절취선 */}
      <div className="relative h-0 bg-white">
        <span className="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-white ring-1 ring-toss-blue/15" aria-hidden />
        <span className="absolute -right-3 -top-3 h-6 w-6 rounded-full bg-white ring-1 ring-toss-blue/15" aria-hidden />
      </div>

      <dl className="space-y-2 border-t-2 border-dashed border-grey-200 bg-white px-5 py-4 text-[13px]">
        <Row k="발급번호" v={<span className="font-mono font-bold tracking-wide text-grey-900">{voucherNo}</span>} />
        {productName && <Row k="대상 상품" v={productName} />}
        {recipientName && <Row k="수령인" v={`${recipientName}님`} />}
        <Row k="발급 일시" v={issuedAtText(issuedAt)} />
        <Row k="사용처" v="지정 선물 상품 전용 (모바일 상품권 전환 가능)" />
      </dl>
    </section>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-[64px] shrink-0 text-grey-500">{k}</dt>
      <dd className="min-w-0 flex-1 break-words text-right font-medium text-grey-800">{v}</dd>
    </div>
  );
}

/**
 * 선물 상세의 '발급된 선물 교환권 내역'.
 * 수령인: 전체 장수·총 지급 금액과 교환권별 발급번호. 친구: 약관 제7조에 따라 장수와 내가 보낸 교환권만.
 */
export function VoucherLedger({ participants, isOwner }: { participants: Participant[]; isOwner: boolean }) {
  const count = participants.length;
  const total = participants.reduce((a, p) => a + p.amount, 0);
  const visible = (isOwner ? [...participants].reverse() : participants.filter((p) => p.isMe)).slice(0, isOwner ? 5 : 3);
  const hidden = isOwner ? count - visible.length : 0;

  return (
    <div className="mt-4 rounded-2xl border border-grey-200 p-4" aria-label="발급된 선물 교환권 내역">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[15px] font-bold text-grey-900">
          <Ticket size={16} className="text-toss-blue" /> 발급된 선물 교환권 내역
        </p>
        {count > 0 && <PaidBadge />}
      </div>
      <p className="mt-1.5 text-[14px] text-grey-700">
        {count === 0 ? (
          "아직 발급된 선물 교환권이 없어요"
        ) : isOwner ? (
          <>
            선물 교환권 <b>{count}장</b> · 총 <b className="text-toss-blue">{won(total)}</b> 지급 완료
          </>
        ) : (
          <>
            선물 교환권 <b>{count}장</b> 발급 · {count}장 모두 지급 완료
          </>
        )}
      </p>
      <p className="mt-0.5 text-[12px] text-grey-500">결제 즉시 교환권이 발급되어 수령인에게 지급(구매 확정)돼요</p>

      {visible.length > 0 && (
        <>
          {!isOwner && <p className="mt-3 text-[12px] font-semibold text-grey-600">내가 보낸 선물 교환권</p>}
          <ul className={`${isOwner ? "mt-3" : "mt-1.5"} divide-y divide-grey-100 rounded-xl bg-grey-50 px-3`}>
            {visible.map((p) => (
              <li key={p.id} className="flex items-center gap-2 py-2.5 text-[13px]">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-grey-800">
                    {p.nickname} <span className="font-mono text-[11px] font-medium text-grey-500">{voucherNumber(p.id)}</span>
                  </p>
                  <p className="text-[11px] text-grey-500">{issuedAtText(p.createdAt)} 발급</p>
                </div>
                <span className="shrink-0 font-bold text-grey-900">{won(p.amount)}</span>
                <span className="shrink-0 text-[11px] font-bold text-toss-green">지급 완료</span>
              </li>
            ))}
          </ul>
          {hidden > 0 && <p className="mt-1.5 text-right text-[12px] text-grey-500">외 {hidden}장 (롤링페이퍼에서 전체 보기)</p>}
        </>
      )}
    </div>
  );
}
