import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

/**
 * 운영자 페이지(/admin) 간단 비밀번호 인증.
 * 환경변수 ADMIN_PASSWORD가 없으면 관리자 페이지는 항상 잠겨 있다.
 * 쿠키에는 비밀번호 원문 대신 HMAC 값만 담고, 비밀번호를 바꾸면 기존 세션은 자동으로 무효가 된다.
 */

export const ADMIN_COOKIE = "mogiving_admin";
export const ADMIN_SESSION_SECONDS = 60 * 60 * 12;

const password = () => process.env.ADMIN_PASSWORD ?? "";
export const adminConfigured = () => password().length > 0;

const sign = (value: string) => createHmac("sha256", password()).update(value).digest("hex");

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function checkPassword(input: string) {
  // 길이 차이로 인한 정보 노출을 막기 위해 해시끼리 비교
  return adminConfigured() && safeEqual(sign(`pw:${input}`), sign(`pw:${password()}`));
}

/** 세션 토큰 = 만료시각.서명 */
export function createSessionToken() {
  const exp = Math.floor(Date.now() / 1000) + ADMIN_SESSION_SECONDS;
  return `${exp}.${sign(`session:${exp}`)}`;
}

export function isValidSession(token: string | undefined) {
  if (!adminConfigured() || !token) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) * 1000 < Date.now()) return false;
  return safeEqual(sig, sign(`session:${exp}`));
}

export const isAdmin = () => isValidSession(cookies().get(ADMIN_COOKIE)?.value);
