/**
 * 사업자 정보 (전자상거래법 제10조 표시 의무, PG 심사용).
 * 사업자등록번호·통신판매업신고번호는 발급·신고가 끝나면 아래 값만 채우면 푸터에 바로 반영된다.
 * 빈 문자열이면 "발급 예정" / "신고 진행 중"으로 표시한다.
 */
export const COMPANY = {
  name: "모기빙",
  brand: "mogiving",
  ceo: "조성민",
  /** 예: "123-45-67890" */
  businessNumber: "897-42-01529",
  /** 예: "제2026-경기안양-0000호" */
  mailOrderNumber: "",
  address: "경기도 안양시 동안구 달안로 153, 201동 506호(관양동, 공작아파트)",
  phone: "010-4739-5629",
  email: "idmin.official@gmail.com",
  hostingProvider: "Vercel Inc.",
} as const;

/** 약관·개인정보처리방침·환불 정책 시행일. 정책을 개정하면 이 값을 바꾸고, 시행 7일 전(이용자에게 불리하면 30일 전)부터 공지한다 */
export const POLICY_EFFECTIVE_DATE = "2026년 11월 21일";

/** 개인정보 보호책임자 */
export const PRIVACY_OFFICER = { name: COMPANY.ceo, title: "대표", phone: COMPANY.phone, email: COMPANY.email } as const;

/**
 * 개인정보 처리 위탁·국외 이전 업체.
 * Supabase country는 프로젝트 리전(ap-northeast-1, 도쿄) 기준. 리전을 옮기면 함께 바꾼다
 */
export const PROCESSORS = [
  {
    name: "토스페이먼츠㈜",
    task: "결제 처리, 결제 취소·환불",
    items: "주문번호, 결제 금액, 결제 키, 결제·취소 내역",
    country: null,
  },
  {
    name: "Supabase, Inc.",
    task: "공동 선물·선물 교환권·주문·배송지 정보의 데이터베이스 저장",
    items: "수령인 표시 이름, 닉네임, 메시지, 결제 금액, 주문·결제 내역, 배송지 정보, 모바일 상품권 전환 신청 정보",
    country: "일본 (도쿄 리전)",
  },
  {
    name: "Telegram FZ-LLC (텔레그램)",
    task: "주문·발송 처리를 위한 운영자 알림 전송 (선물 완성·배송지 접수·모바일 상품권 전환 신청)",
    items: "상품명, 결제 금액, 수령인 이름·휴대전화번호·배송지, 모바일 상품권 전환 신청 정보",
    country: "아랍에미리트 등 텔레그램 서버 소재 국가",
  },
  {
    name: "Vercel Inc.",
    task: "웹사이트 호스팅, 서버 운영과 접속 기록 처리",
    items: "서비스 이용 중 전송되는 정보 전반, 접속 IP·브라우저 정보·접속 일시",
    country: "미국",
  },
] as const;

/** 세 정책은 /terms 한 페이지에 앵커로 모여 있다 (/privacy, /refund는 단독 페이지로도 남겨 둔다) */
export const LEGAL_LINKS = [
  { href: "/terms", anchor: "terms", label: "이용약관" },
  { href: "/terms#privacy", anchor: "privacy", label: "개인정보처리방침", emphasize: true },
  { href: "/terms#refund", anchor: "refund", label: "환불 및 취소 정책" },
] as const;

/** 공정위 사업자정보 공개 페이지 (사업자등록번호가 입력된 경우에만 링크) */
export function bizInfoUrl(businessNumber: string) {
  const digits = businessNumber.replace(/\D/g, "");
  return digits.length === 10 ? `https://www.ftc.go.kr/bizCommPop.do?wrkr_no=${digits}` : null;
}
