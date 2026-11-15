/**
 * 서버 인스턴스를 모두 합친 호출 제한 (Supabase RPC mogiving_rate_limit_hit, 마이그레이션 20261115010000).
 * lib/rateLimit.ts의 메모리 제한은 인스턴스마다 따로 세므로, 서비스 전체 상한(예: 카카오 API 하루 할당량)은 여기서 센다.
 */

/** Supabase 응답을 기다리는 최대 시간. 넘으면 '모름'으로 보고 요청을 막지 않는다 */
const RPC_TIMEOUT_MS = 1500;

/**
 * 호출 1회를 센다.
 * - "allowed": 상한 이하 → 진행
 * - "limited": 상한 초과 → 막음
 * - "unknown": 저장소 미설정·마이그레이션 미적용·네트워크 오류 → 막지 않음 (메모리 제한은 그대로 적용됨)
 */
export type GlobalLimitResult = "allowed" | "limited" | "unknown";

export type GlobalRateLimiter = (bucket: string, windowSeconds: number, max: number) => Promise<GlobalLimitResult>;

export function supabaseRateLimiter(url: string, serviceKey: string, fetchImpl: typeof fetch = fetch): GlobalRateLimiter {
  const endpoint = `${url.replace(/\/$/, "")}/rest/v1/rpc/mogiving_rate_limit_hit`;
  return async (bucket, windowSeconds, max) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);
    try {
      const res = await fetchImpl(endpoint, {
        method: "POST",
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ p_bucket: bucket, p_window_seconds: windowSeconds, p_max: max }),
        signal: controller.signal,
        cache: "no-store",
      });
      if (!res.ok) {
        // 404 PGRST202: 함수 없음 → 마이그레이션(20261115010000_mogiving_rate_limits.sql) 미적용
        const text = await res.text().catch(() => "");
        console.error(`[rate-limit] supabase rpc mogiving_rate_limit_hit ${res.status}`, text.slice(0, 300));
        return "unknown";
      }
      const body = (await res.json()) as unknown;
      if (body === true) return "allowed";
      if (body === false) return "limited";
      console.error("[rate-limit] unexpected rpc body", JSON.stringify(body)?.slice(0, 200));
      return "unknown";
    } catch (e) {
      console.error("[rate-limit] supabase rpc failed", e instanceof Error ? e.message : String(e));
      return "unknown";
    } finally {
      clearTimeout(timer);
    }
  };
}

/** 운영: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY가 있으면 Supabase로 센다. 없으면(로컬 개발) 항상 "unknown" */
export function getGlobalRateLimiter(): GlobalRateLimiter {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? supabaseRateLimiter(url, key) : async () => "unknown";
}
