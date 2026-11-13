import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, Ol, Section, Ul } from "@/components/LegalPage";
import { COMPANY } from "@/lib/company";
import { FEE_PERCENT } from "@/lib/fee";
import { AUTO_REFUND_DAYS } from "@/lib/policy";

export const metadata: Metadata = { title: "취소 및 환불 정책 | 모기빙" };

export default function RefundPolicyPage() {
  return (
    <LegalPage
      title="취소 및 환불 정책"
      current="/refund"
      intro={
        <>
          목표 금액을 채우지 못한 펀딩은 <b className="text-grey-900">플랫폼 수수료를 포함한 전액</b>이 각 참여자의 결제 수단으로 자동 취소돼요.
          아래 내용은 「전자상거래 등에서의 소비자보호에 관한 법률」(이하 &lsquo;전자상거래법&rsquo;)을 따르며, 이 정책보다 법령이 소비자에게 유리하면 법령을 우선 적용해요.
        </>
      }
    >
      <Section title="1. 목표 금액 미달 시 전액 환불">
        <Ol>
          <li>모금 기간이 끝났을 때 목표 금액을 채우지 못한 펀딩은 성립하지 않으며, 모인 금액은 상품 구매에 쓰이지 않아요.</li>
          <li>펀딩 개설자는 마감 후 &lsquo;전액 결제 취소하기&rsquo;로 즉시 모든 참여 결제를 취소할 수 있어요.</li>
          <li>
            개설자가 처리하지 않더라도 마감일로부터 <b>{AUTO_REFUND_DAYS}일</b>이 지나면 회사가 모든 참여 결제를 자동으로 전액 취소해요.
          </li>
          <li>환불 금액에는 플랫폼 수수료({FEE_PERCENT}%)가 포함되며, 참여자에게 별도로 차감하는 금액은 없어요.</li>
        </Ol>
      </Section>

      <Section title="2. 목표 금액을 넘는 결제">
        <p>
          여러 사람이 동시에 결제해 목표 금액을 넘으면, 목표 금액을 초과한 만큼은 결제 직후 자동으로 취소돼요. 펀딩이 이미 마감된 뒤 완료된 결제는 전액 자동 취소돼요.
        </p>
      </Section>

      <Section title="3. 모금 진행 중 참여 취소 (청약철회)">
        <Ol>
          <li>
            참여자는 결제일로부터 7일 이내에 고객센터로 참여 취소를 요청할 수 있으며, 회사는 요청을 확인한 날부터 3영업일 이내에 해당 참여 결제를 전액 취소해요.
          </li>
          <li>
            다만 펀딩이 목표 금액을 달성해 회사가 이미 상품을 주문(발주)한 뒤에는 상품 공급이 시작된 것으로 보아, 개별 참여 취소 대신 아래 4~5항의 반품 절차를 따라요.
          </li>
        </Ol>
      </Section>

      <Section title="4. 펀딩 달성 후 상품 주문 전 취소">
        <Ol>
          <li>펀딩이 달성된 뒤 회사가 상품을 주문하기 전까지는 펀딩 개설자가 고객센터를 통해 펀딩 전체 취소를 요청할 수 있어요. 이 경우 모든 참여 결제를 전액 취소해요.</li>
          <li>
            상품이 품절됐거나 판매처 가격 인상 등으로 모인 금액으로 같은 상품을 주문할 수 없으면, 회사는 개설자에게 알린 뒤 모든 참여 결제를 전액 취소해요.
          </li>
        </Ol>
      </Section>

      <Section title="5. 상품 수령 후 반품·교환">
        <Ol>
          <li>상품을 받은 날부터 7일 이내에 고객센터로 반품을 신청할 수 있어요.</li>
          <li>
            상품이 표시·광고 내용과 다르거나 계약 내용과 다르게 이행된 경우(파손, 오배송 등)에는 상품을 받은 날부터 3개월 이내, 그 사실을 안 날(또는 알 수 있었던 날)부터 30일 이내에 반품할 수 있으며 반품 배송비는 회사가 부담해요.
          </li>
          <li>단순 변심에 따른 반품은 반품 배송비를 받는 사람이 부담해요.</li>
          <li>
            다음의 경우에는 반품이 제한될 수 있어요 (전자상거래법 제17조 제2항).
            <Ul>
              <li>받는 사람의 책임으로 상품이 멸실·훼손된 경우 (내용 확인을 위한 포장 훼손은 제외)</li>
              <li>사용하거나 일부 소비해 상품 가치가 현저히 줄어든 경우</li>
              <li>시간이 지나 다시 판매하기 곤란할 정도로 상품 가치가 현저히 줄어든 경우</li>
              <li>복제가 가능한 상품의 포장을 훼손한 경우</li>
              <li>주문 제작 상품 등 반품 시 판매처에 회복할 수 없는 손해가 생기는 경우로서, 사전에 그 사실을 고지하고 동의를 받은 경우</li>
            </Ul>
          </li>
          <li>교환은 상품을 판매한 쇼핑몰의 교환 정책에 따라 가능 여부가 정해지며, 회사가 판매처와의 절차를 대신 진행해요.</li>
        </Ol>
      </Section>

      <Section title="6. 환불 방법과 기간">
        <Ol>
          <li>환불은 각 참여자가 결제한 원래 결제 수단의 승인 취소로 진행되며, 현금이나 포인트로 돌려드리지 않아요.</li>
          <li>반품의 경우 회사는 판매처로부터 상품 반환이 확인된 날부터 3영업일 이내에 결제 취소를 요청해요.</li>
          <li>반품 배송비 등 받는 사람이 부담할 비용이 있으면 이를 뺀 금액을 각 참여자의 참여 금액 비율에 따라 나누어 환불해요.</li>
          <li>결제 취소 후 실제 카드 승인 취소가 반영되기까지 카드사에 따라 3~5영업일이 걸릴 수 있어요.</li>
          <li>회사의 사유로 환불이 늦어지면 전자상거래법에서 정한 지연이자를 함께 지급해요.</li>
        </Ol>
      </Section>

      <Section title="7. 문의">
        <p>
          취소·환불 요청은 펀딩 링크 또는 결제 시 받은 주문번호와 함께 고객센터로 보내 주세요.
          <br />
          전화 <a href={`tel:${COMPANY.phone.replace(/\D/g, "")}`} className="underline underline-offset-2">{COMPANY.phone}</a> · 이메일{" "}
          <a href={`mailto:${COMPANY.email}`} className="underline underline-offset-2">{COMPANY.email}</a>
        </p>
        <p className="text-[13px] text-grey-500">
          서비스 이용에 관한 자세한 내용은{" "}
          <Link href="/terms" className="underline underline-offset-2">서비스 이용약관</Link>을 확인해 주세요.
        </p>
      </Section>
    </LegalPage>
  );
}
