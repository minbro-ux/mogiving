-- 카카오 이미지 검색 폴백을 없애면서(2026-11-16) 쓰는 코드가 사라진 전체 호출 제한 카운터를 지운다.
-- 운영 DB의 함수 인자가 저장소 버전(20261115010000)과 다를 수 있어, 이름이 같은 함수는 인자와 상관없이 모두 지운다.

do $$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'mogiving_rate_limit_hit'
  loop
    execute format('drop function %s', f);
  end loop;
end;
$$;

drop table if exists public.mogiving_rate_limits;

notify pgrst, 'reload schema';
