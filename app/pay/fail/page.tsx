import { AlertCircle } from "lucide-react";
import { Footer } from "@/components/Footer";

type Props = { searchParams: { code?: string; share?: string } };

/** 토스페이먼츠 결제창 실패·취소 후 돌아오는 화면. 주소로 조작할 수 있는 message는 그대로 보여주지 않는다 */
export default function PayFailPage({ searchParams: { code, share } }: Props) {
  const canceled = code === "PAY_PROCESS_CANCELED";
  const back = share && /^[A-Za-z0-9]{7}$/.test(share) ? `/f/${share}` : "/";
  return (
    <main className="relative mx-auto min-h-dvh max-w-[430px] bg-white shadow-[0_0_40px_rgba(0,0,0,0.06)]">
      <div className="flex flex-col items-center px-5 py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-toss-orange text-white">
          <AlertCircle size={34} />
        </div>
        <h1 className="mt-6 text-[22px] font-bold text-grey-900">{canceled ? "결제를 취소했어요" : "결제를 완료하지 못했어요"}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-grey-600">결제 금액은 청구되지 않았어요. 다시 시도해 주세요.</p>
        {!canceled && code && <p className="mt-2 text-[13px] text-grey-500">오류 코드: {code.slice(0, 60)}</p>}
        <a href={back} className="mt-8 flex h-14 w-full items-center justify-center rounded-2xl bg-toss-blue text-[17px] font-bold text-white">
          {back === "/" ? "처음으로" : "펀딩으로 돌아가기"}
        </a>
      </div>
      <Footer />
    </main>
  );
}
