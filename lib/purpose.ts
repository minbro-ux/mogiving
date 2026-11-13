/** 펀딩 목적(선물 이유). 목적을 고르면 제목·한마디 기본 문구가 바뀌고, 사용자가 자유롭게 고쳐 쓸 수 있다 */
export type FundingPurpose = "general" | "birthday" | "housewarming" | "anniversary" | "graduation";

export const FUNDING_PURPOSES: { id: FundingPurpose; label: string; title: string; message: string }[] = [
  { id: "general", label: "일반 선물", title: "내가 갖고 싶은 선물 펀딩", message: "평소 정말 갖고 싶던 선물이에요! 마음 모아주시면 감사히 받을게요 🙏" },
  { id: "birthday", label: "생일", title: "내 생일 선물 펀딩", message: "올해 생일엔 이 선물이 정말 갖고 싶어요! 마음 모아주시면 감사히 받을게요 🙏" },
  { id: "housewarming", label: "집들이", title: "우리 집 집들이 선물 펀딩", message: "새 보금자리에 꼭 필요한 선물이에요! 마음 모아주시면 예쁘게 잘 쓸게요 🏠" },
  { id: "anniversary", label: "결혼·기념일", title: "특별한 기념일 선물 펀딩", message: "소중한 날을 함께 축하해 주세요! 보내주신 마음 오래오래 간직할게요 💐" },
  { id: "graduation", label: "졸업·취업", title: "새로운 시작 응원 펀딩", message: "새로운 출발을 앞두고 꼭 갖고 싶던 선물이에요! 응원해 주셔서 감사합니다 🎓" },
];

export const DEFAULT_PURPOSE: FundingPurpose = "general";

/**
 * 목적 선택 기능 이전에 만든 펀딩은 모두 생일 문구였다.
 * 한마디가 저장되지 않은 예전 공유 링크를 복원할 때 이 문구로 채운다
 */
export const LEGACY_PURPOSE: FundingPurpose = "birthday";

export const TITLE_MAX = 40;
export const MESSAGE_MAX = 100;

export const purposePreset = (id: FundingPurpose) => FUNDING_PURPOSES.find((p) => p.id === id) ?? FUNDING_PURPOSES[0];

/** 2탄 이상이면 제목 뒤에 회차를 붙인다 */
export const presetTitle = (id: FundingPurpose, round = 1) => {
  const title = purposePreset(id).title;
  return round > 1 ? `${title} ${round}탄` : title;
};
