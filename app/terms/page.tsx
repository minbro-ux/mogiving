import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, Ol, Section, Ul } from "@/components/LegalPage";
import { COMPANY, POLICY_EFFECTIVE_DATE } from "@/lib/company";
import { FEE_PERCENT } from "@/lib/fee";
import { AUTO_REFUND_DAYS, FUNDING_PERIOD_DAYS, MIN_AMOUNT } from "@/lib/policy";

export const metadata: Metadata = { title: "서비스 이용약관 | 모기빙" };

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

export default function TermsPage() {
  return (
    <LegalPage title="서비스 이용약관" current="/terms">
      <Section title="제1조 (목적)">
        <p>
          이 약관은 {COMPANY.name}(이하 &lsquo;회사&rsquo;)가 제공하는 선물 펀딩 서비스 &lsquo;모기빙&rsquo;(이하 &lsquo;서비스&rsquo;)의 이용과 관련해 회사와 이용자의 권리·의무 및 책임사항을 정하는 것을 목적으로 해요.
        </p>
      </Section>

      <Section title="제2조 (정의)">
        <Ol>
          <li>&lsquo;이용자&rsquo;란 이 약관에 따라 서비스를 이용하는 개설자와 참여자를 말해요.</li>
          <li>&lsquo;개설자&rsquo;란 받고 싶은 선물을 정해 펀딩을 만들고, 펀딩이 달성되면 선물을 받는 사람을 말해요.</li>
          <li>&lsquo;참여자&rsquo;란 펀딩 링크를 통해 선물 금액의 일부(&lsquo;조각&rsquo;)를 결제하는 사람을 말해요.</li>
          <li>&lsquo;펀딩&rsquo;이란 특정 선물 상품을 구매하기 위해 정해진 기간 동안 목표 금액을 모으는 모금함을 말해요.</li>
          <li>&lsquo;목표 금액&rsquo;이란 선물 상품 가격에 플랫폼 수수료를 더한 금액을 말해요.</li>
        </Ol>
      </Section>

      <Section title="제3조 (약관의 게시와 개정)">
        <Ol>
          <li>회사는 이 약관을 서비스 화면 하단에 게시해 이용자가 쉽게 확인할 수 있도록 해요.</li>
          <li>회사는 관계 법령을 위반하지 않는 범위에서 약관을 개정할 수 있으며, 개정 시 적용일자와 사유를 적용일 7일 전(이용자에게 불리한 변경은 30일 전)부터 서비스 화면에 공지해요.</li>
          <li>이 약관에 정하지 않은 사항은 「전자상거래 등에서의 소비자보호에 관한 법률」 등 관계 법령과 상관례를 따라요.</li>
        </Ol>
      </Section>

      <Section title="제4조 (서비스 내용)">
        <p>회사는 다음 서비스를 제공해요. 서비스는 회원가입 없이 이용할 수 있어요.</p>
        <Ul>
          <li>선물 상품을 정해 펀딩을 만들고 링크로 공유하는 기능</li>
          <li>참여자가 원하는 금액만큼 조각을 결제하고 축하 메시지를 남기는 기능</li>
          <li>펀딩이 달성되면 회사가 모인 금액으로 선물 상품을 구매해 개설자가 입력한 배송지로 보내는 구매·배송 대행</li>
          <li>펀딩이 목표 금액에 미달하면 모든 참여 결제를 취소하는 환불 처리</li>
        </Ul>
      </Section>

      <Section title="제5조 (펀딩 개설)">
        <Ol>
          <li>개설자는 선물 상품, 펀딩 제목과 메시지, 모금 기간({FUNDING_PERIOD_DAYS.join("·")}일 중 선택)을 정해 펀딩을 만들어요. 마감일은 개설 후 바꿀 수 없어요.</li>
          <li>개설자는 상품 정보(가격, 옵션 등)를 정확히 입력해야 하며, 잘못된 정보로 생긴 문제의 책임은 개설자에게 있어요.</li>
          <li>
            다음 상품으로는 펀딩을 만들 수 없으며, 회사는 이를 발견하면 펀딩을 중단하고 모든 참여 결제를 취소할 수 있어요.
            <Ul>
              <li>법령상 판매·배송이 금지되거나 제한되는 상품, 성인 인증이 필요한 상품</li>
              <li>상품권·금·포인트 등 현금으로 바꿀 수 있는 상품</li>
              <li>위조품 등 타인의 권리를 침해하는 상품</li>
            </Ul>
          </li>
        </Ol>
      </Section>

      <Section title="제6조 (참여와 결제)">
        <Ol>
          <li>참여자는 {won(MIN_AMOUNT)} 이상 남은 금액 이하로 참여할 수 있어요. 남은 금액이 {won(MIN_AMOUNT)}보다 적으면 남은 금액 그대로 참여할 수 있어요.</li>
          <li>결제는 회사가 지정한 결제대행사(토스페이먼츠)를 통해 이루어져요.</li>
          <li>목표 금액을 넘는 결제분과 마감 후 완료된 결제는 자동으로 취소돼요.</li>
          <li>참여자의 닉네임, 메시지, 참여 금액은 개설자에게만 보이며, 다른 참여자에게는 참여 인원수만 표시돼요.</li>
        </Ol>
      </Section>

      <Section title="제7조 (플랫폼 수수료)">
        <Ol>
          <li>목표 금액에는 선물 상품 가격의 {FEE_PERCENT}%에 해당하는 플랫폼 수수료가 포함되며(100원 단위 올림), 펀딩 개설 시 금액을 함께 안내해요.</li>
          <li>수수료는 펀딩이 달성되어 선물이 구매된 경우에만 회사가 받으며, 펀딩이 취소·환불되면 수수료도 전액 환불돼요.</li>
        </Ol>
      </Section>

      <Section title="제8조 (펀딩 달성과 선물 배송)">
        <Ol>
          <li>목표 금액이 모두 모이면 펀딩은 즉시 마감되며, 개설자는 선물을 받을 배송지를 입력해요.</li>
          <li>회사는 배송지 접수 후 상품을 판매하는 쇼핑몰에서 선물 상품을 주문하며, 배송은 해당 판매처의 배송 정책에 따라요.</li>
          <li>모인 금액은 현금·포인트 등으로 지급하지 않고 선물 상품 구매에만 사용해요.</li>
          <li>상품 품절이나 가격 변동 등으로 주문할 수 없으면 회사는 개설자에게 알리고 모든 참여 결제를 취소해요.</li>
        </Ol>
      </Section>

      <Section title="제9조 (펀딩 미달과 환불)">
        <p>
          모금 기간이 끝났을 때 목표 금액을 채우지 못한 펀딩은 성립하지 않아요. 개설자가 마감 후 직접 취소하거나, 마감일로부터 {AUTO_REFUND_DAYS}일이 지나면 회사가 모든 참여 결제를 전액 취소해요.
        </p>
      </Section>

      <Section title="제10조 (청약철회와 환불)">
        <p>
          참여 취소, 상품 반품·교환, 환불 방법과 기간은{" "}
          <Link href="/refund" className="font-medium text-toss-blue underline underline-offset-2">취소 및 환불 정책</Link>에서 정한 바를 따라요.
        </p>
      </Section>

      <Section title="제11조 (이용자의 의무)">
        <p>이용자는 다음 행위를 해서는 안 돼요.</p>
        <Ul>
          <li>타인의 정보나 결제수단을 도용하는 행위</li>
          <li>펀딩을 현금화, 자금 세탁, 사기 등 불법적인 목적으로 이용하는 행위</li>
          <li>욕설·혐오·음란 등 타인에게 불쾌감을 주는 메시지나 사진을 올리는 행위</li>
          <li>서비스의 정상적인 운영을 방해하는 행위</li>
        </Ul>
        <p>회사는 위 행위가 확인되면 해당 펀딩이나 참여를 중단하거나 취소할 수 있어요.</p>
      </Section>

      <Section title="제12조 (회사의 의무)">
        <Ol>
          <li>회사는 관계 법령과 이 약관을 지키며, 안정적으로 서비스를 제공하기 위해 노력해요.</li>
          <li>
            회사는 이용자의 개인정보를{" "}
            <Link href="/privacy" className="font-medium text-toss-blue underline underline-offset-2">개인정보처리방침</Link>에 따라 보호해요.
          </li>
          <li>회사는 이용자의 불만이나 의견이 정당하다고 인정되면 신속하게 처리하고, 처리에 시간이 걸리면 그 사유와 일정을 알려드려요.</li>
        </Ol>
      </Section>

      <Section title="제13조 (서비스의 중단)">
        <p>
          회사는 설비 점검·교체, 고장, 통신 장애, 천재지변 등 부득이한 사유가 있으면 서비스를 일시 중단할 수 있어요. 이 경우 진행 중인 펀딩과 결제는 이 약관과 환불 정책에 따라 처리해요.
        </p>
      </Section>

      <Section title="제14조 (책임의 제한)">
        <Ol>
          <li>회사는 천재지변 등 불가항력으로 서비스를 제공할 수 없는 경우 책임을 지지 않아요.</li>
          <li>회사는 이용자가 작성한 펀딩 정보·메시지의 내용과 이용자 간 다툼에 대해, 회사의 고의 또는 과실이 없는 한 책임을 지지 않아요.</li>
          <li>개설자가 잘못 입력한 배송지로 인해 생긴 배송 문제는 개설자가 책임져요.</li>
        </Ol>
      </Section>

      <Section title="제15조 (분쟁 해결과 관할)">
        <Ol>
          <li>서비스 이용과 관련한 문의·불만은 고객센터({COMPANY.phone}, {COMPANY.email})로 접수할 수 있어요.</li>
          <li>회사와 이용자 사이의 분쟁은 대한민국 법을 따르며, 소송은 「민사소송법」에 따른 관할 법원에 제기해요.</li>
        </Ol>
      </Section>

      <Section title="부칙">
        <p>이 약관은 {POLICY_EFFECTIVE_DATE}부터 시행해요.</p>
      </Section>
    </LegalPage>
  );
}
