-- 서버 인스턴스를 모두 합친 호출 횟수 제한 (예: 카카오 이미지 검색 하루 상한)
-- 서버(service role)만 RPC로 호출한다. 메모리 기반 제한(lib/rateLimit.ts)은 인스턴스마다 따로 세므로, 전체 상한은 여기서 센다.

create table if not exists public.mogiving_rate_limits (
  bucket text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (bucket, window_start)
);

comment on table public.mogiving_rate_limits is '호출 제한 카운터: 이름(bucket)과 고정 창 시작 시각별 호출 수';

-- 정책 없이 RLS만 켜 둔다 → anon·authenticated는 읽기·쓰기 불가, service role만 접근
alter table public.mogiving_rate_limits enable row level security;
revoke all on table public.mogiving_rate_limits from public, anon, authenticated;

-- 호출 1회를 센 뒤, 이번 창의 호출 수가 p_max 이하면 true(허용), 넘으면 false.
-- 창은 한국 시간(UTC+9) 기준으로 나눈다: 하루 창이면 매일 0시(KST)에 새로 센다.
-- insert … on conflict do update 한 문장이라 동시에 여러 요청이 와도 빠짐없이 센다.
create or replace function public.mogiving_rate_limit_hit(p_bucket text, p_window_seconds integer, p_max integer)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_kst_offset constant integer := 9 * 3600;
  v_start timestamptz;
  v_hits integer;
begin
  if p_bucket is null or length(p_bucket) = 0 or length(p_bucket) > 100 then
    raise exception 'invalid_bucket';
  end if;
  if p_window_seconds is null or p_window_seconds <= 0 or p_max is null or p_max < 0 then
    raise exception 'invalid_limit';
  end if;

  v_start := to_timestamp(floor((extract(epoch from now()) + v_kst_offset) / p_window_seconds) * p_window_seconds - v_kst_offset);

  insert into public.mogiving_rate_limits as r (bucket, window_start, hits)
  values (p_bucket, v_start, 1)
  on conflict (bucket, window_start) do update set hits = r.hits + 1
  returning r.hits into v_hits;

  -- 새 창의 첫 호출일 때 지난 창 기록을 지운다 (테이블이 계속 커지지 않게)
  if v_hits = 1 then
    delete from public.mogiving_rate_limits where bucket = p_bucket and window_start < v_start;
  end if;

  return v_hits <= p_max;
end;
$$;

revoke execute on function public.mogiving_rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.mogiving_rate_limit_hit(text, integer, integer) to service_role;

notify pgrst, 'reload schema';
