import { REFUND_NOTICE, UNCHOSEN_CONVERT_DAYS, UNDER_GOAL_NOTICE } from "@/lib/policy";

/**
 * /intro 외부 홍보용 랜딩 페이지의 교체 가능한 문구 모음.
 * - 카피 규칙: '펀딩', '후원', '기부', '지분'은 쓰지 않는다. '선물 모으기', '위시리스트', '모바일 선물 교환권'으로 표현한다.
 * - STORIES는 실제 후기가 쌓이면 이 배열만 바꾸면 된다. 실제 후기가 아니면 isExample: true로 두어 화면에 '예시'로 표시한다.
 */

export const CTA_HREF = "/";

export type Story = {
  tag: string;
  emoji: string;
  title: string;
  body: string;
  who: string;
  /** true면 '예시' 뱃지를 붙인다 (실제 후기로 교체하면 false) */
  isExample: boolean;
};

export const STORIES: Story[] = [
  {
    tag: "#신혼집_집들이",
    emoji: "🤖",
    title: "대학·회사·동네 친구들 마음이 모여 100만 원대 로봇청소기를 선물 받았어요!",
    body: "단톡방 네 군데에 링크 하나만 올렸는데, 서로 모르는 친구들이 한 팀처럼 채워줬어요.",
    who: "신혼부부 J님",
    isExample: true,
  },
  {
    tag: "#생일선물",
    emoji: "💨",
    title: "생일마다 쌓이던 커피 대신 갖고 싶던 다이슨 에어랩 받았어요",
    body: "기프티콘 열 장 대신, 진짜 매일 쓰는 선물 하나가 생겼어요.",
    who: "직장인 S님",
    isExample: true,
  },
  {
    tag: "#기념일",
    emoji: "📸",
    title: "결혼 1주년, 친구들과 가족이 함께 미러리스 카메라를 채워줬어요",
    body: "축하 메시지까지 한곳에 모여서 두고두고 다시 보게 돼요.",
    who: "결혼 1년 차 K님",
    isExample: true,
  },
];

export const TAGS = ["#결혼축하", "#신혼집_집들이", "#생일선물", "#기념일"];

/** FAQ 답변은 약관·환불 정책과 같은 문장(lib/policy)을 함께 보여 줘 심사 기준과 어긋나지 않게 한다 */
export const FAQS: { q: string; a: string[] }[] = [
  {
    q: "목표 금액을 다 못 채우면 어떻게 되나요?",
    a: [
      "걱정하지 않으셔도 돼요. 모인 마음은 사라지지 않아요.",
      UNDER_GOAL_NOTICE,
    ],
  },
  {
    q: "선물을 보태는 친구도 회원가입을 해야 하나요?",
    a: [
      "아니요. 친구는 앱 설치나 회원가입 없이, 받은 링크를 열고 원하는 금액과 축하 메시지를 남긴 뒤 바로 결제하면 끝이에요.",
    ],
  },
  {
    q: "취소나 환불은 어떻게 되나요?",
    a: [
      "결제 즉시 수령인에게 지정 선물 전용 모바일 선물 교환권이 발행돼요.",
      REFUND_NOTICE,
      `교환권 발급 후 ${UNCHOSEN_CONVERT_DAYS}일 이내에 실물 선물을 고르지 않으면, 교환권 금액만큼 모바일 상품권으로 전환되어 지급돼요.`,
    ],
  },
];
