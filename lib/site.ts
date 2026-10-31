/** 공유 미리보기(OG)에 쓰는 사이트 기본 정보 */
export const SITE_NAME = "모기빙 (MOGIVING)";
export const DEFAULT_TITLE = "친구들과 함께 만드는 특별한 선물 | 모기빙";
export const DEFAULT_DESCRIPTION = "부담 없는 조각으로 마음을 보태어 진짜 원하는 선물을 전해보세요.";

/** 카카오톡 등 외부 크롤러가 접근할 수 있는 절대 주소 (배포 시 NEXT_PUBLIC_SITE_URL 지정) */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

/** 모기빙 기본 썸네일 (app/opengraph-image.tsx) */
export const DEFAULT_OG_IMAGE = "/opengraph-image";
