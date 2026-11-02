-- 조각 선물(참여) 내역 저장 + 펀딩별 누적 금액·조각 수
-- 펀딩 = mogiving_shares 한 행 (공유 링크 /f/[id]). 별도 fundings 테이블 없이 이 행에 누적값을 둔다.

-- 1) 누적 컬럼 (공개 payload와 분리. 결제 저장 함수만 갱신한다)
alter table public.mogiving_shares
  add column if not exists goal integer check (goal is null or goal > 0),
  add column if not exists collected_amount integer not null default 0 check (collected_amount >= 0),
  add column if not exists contribution_count integer not null default 0 check (contribution_count >= 0);

comment on column public.mogiving_shares.goal is '목표 금액 (첫 참여 시 payload.x.g 또는 상품가로 확정)';
comment on column public.mogiving_shares.collected_amount is '모인 금액 합계 (mogiving_contribute로만 갱신)';
comment on column public.mogiving_shares.contribution_count is '참여(조각 선물) 건수';

update public.mogiving_shares
set goal = coalesce(goal, nullif((payload->'x'->>'g')::numeric, 0)::integer, nullif((payload->'p'->>'price')::numeric, 0)::integer)
where goal is null;

-- 2) 참여 내역 (롤링페이퍼 메시지 포함)
create table if not exists public.mogiving_contributions (
  id uuid primary key default gen_random_uuid(),
  share_id text not null references public.mogiving_shares(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 20),
  message text not null default '' check (char_length(message) <= 300),
  amount integer not null check (amount > 0),
  created_at timestamptz not null default now()
);

create index if not exists mogiving_contributions_share_idx on public.mogiving_contributions (share_id, created_at);

-- 서버(service role)만 접근. anon/authenticated 정책은 열지 않는다 (클라이언트 직접 접근 불가)
alter table public.mogiving_contributions enable row level security;
revoke all on table public.mogiving_contributions from anon, authenticated;

-- 3) 참여 저장: 펀딩 행을 잠그고 → 남은 금액까지만(Hard Cap) 기록 → 누적값 갱신을 한 트랜잭션으로
create or replace function public.mogiving_contribute(
  p_share_id text,
  p_nickname text,
  p_message text,
  p_amount integer
)
returns table (contribution_id uuid, amount integer, collected_amount integer, contribution_count integer, goal integer, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  s public.mogiving_shares%rowtype;
  v_goal integer;
  v_amount integer;
  v_id uuid;
  v_created timestamptz;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount' using errcode = 'P0001';
  end if;

  select * into s from public.mogiving_shares where id = p_share_id for update;
  if not found then
    raise exception 'share_not_found' using errcode = 'P0001';
  end if;

  v_goal := coalesce(s.goal, nullif((s.payload->'x'->>'g')::numeric, 0)::integer, nullif((s.payload->'p'->>'price')::numeric, 0)::integer);
  if v_goal is null then
    raise exception 'goal_missing' using errcode = 'P0001';
  end if;

  if s.collected_amount >= v_goal or ((s.payload->>'d')::numeric < extract(epoch from now()) * 1000) then
    raise exception 'funding_closed' using errcode = 'P0001';
  end if;

  v_amount := least(p_amount, v_goal - s.collected_amount);

  insert into public.mogiving_contributions (share_id, nickname, message, amount)
  values (p_share_id, p_nickname, coalesce(p_message, ''), v_amount)
  returning id, mogiving_contributions.created_at into v_id, v_created;

  update public.mogiving_shares
  set goal = v_goal,
      collected_amount = s.collected_amount + v_amount,
      contribution_count = s.contribution_count + 1,
      updated_at = now()
  where id = p_share_id;

  return query select v_id, v_amount, s.collected_amount + v_amount, s.contribution_count + 1, v_goal, v_created;
end;
$$;

revoke execute on function public.mogiving_contribute(text, text, text, integer) from public, anon, authenticated;
grant execute on function public.mogiving_contribute(text, text, text, integer) to service_role;

-- PostgREST 스키마 캐시 갱신 (새 테이블·함수를 REST로 바로 쓰기 위해)
notify pgrst, 'reload schema';
