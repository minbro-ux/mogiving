/** 서버 내부망으로 요청이 새지 않도록 사설·로컬 주소는 막는다 (서버에서 외부 주소를 대신 열 때 사용) */
export function isPublicHttpUrl(u: URL) {
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return false;
  if (/^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h)) return false;
  if (h === "::1" || h === "::" || /^f[cd]|^fe80:/.test(h)) return false;
  return h.includes(".");
}
