/**
 * 메모리 기반 고정 창(sliding log) 호출 제한.
 * 서버리스에선 인스턴스마다 따로 세므로 완벽하진 않지만, 한 곳에서 반복 호출하는 남용은 막는다.
 */
export function createRateLimiter({ windowMs, max, maxKeys = 5000 }: { windowMs: number; max: number; maxKeys?: number }) {
  const hits = new Map<string, number[]>();
  /** 이번 호출이 제한에 걸리면 true (걸리지 않으면 호출 1회로 센다) */
  return function limited(key: string, now = Date.now()) {
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      hits.set(key, recent);
      return true;
    }
    recent.push(now);
    hits.set(key, recent);
    // 키가 너무 많아지면 메모리를 비운다 (오래 켜진 인스턴스에서 IP가 계속 쌓이지 않게)
    if (hits.size > maxKeys) {
      hits.clear();
      hits.set(key, recent);
    }
    return false;
  };
}

/** 요청한 쪽 IP (Vercel이 x-forwarded-for 첫 값에 실제 접속 IP를 넣는다). 없으면 "local" */
export const clientIp = (headers: Headers) => headers.get("x-real-ip")?.trim() || headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
