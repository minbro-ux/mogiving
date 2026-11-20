-- 즉시 확정형 공동 선물(선물 교환권) 모델로 전환
--
-- 참여 결제는 승인 즉시 수령인의 지정 선물 전용 교환권 발행(구매 확정)으로 처리하고, 기간 내 미도달이어도 결제를 취소하지 않는다.
-- 공동 선물 상태(mogiving_shares.gift_status):
--   ACTIVE            선물 적립 중
--   COMPLETED_FULL    100% 완성 — 실물 발주 대기 (친구들의 적립으로 완성되었거나 수령인이 차액을 결제)
--   PENDING_CHOICE    기간 종료·미도달 — 수령인의 수령 방식 선택 대기 (차액 결제 또는 모바일 상품권 전환)
--   CONVERTED_VOUCHER 모바일 상품권 전환 신청 (적립 금액에서 플랫폼 수수료를 뺀 원가 상당액)
--
-- 이전의 미달성 자동 환불·개설자 취소 기능은 없앤다 (mogiving_cancel_funding, mogiving_expired_under_fundings 삭제).

-- 0) 목표 금액 계산 (컬럼이 비어 있으면 payload의 값으로)
create or replace function public.mogiving_share_goal(p_goal integer, p_payload jsonb)
returns integer
language sql
immutable
as $$
  select coalesce(p_goal, nullif((p_payload->'x'->>'g')::numeric, 0)::integer, nullif((p_payload->'p'->>'price')::numeric, 0)::integer);
$$;

-- 1) 공동 선물 상태·완성 시각·모바일 상품권 전환 신청
alter table public.mogiving_shares
  add column if not exists gift_status text not null default 'ACTIVE',
  add column if not exists completed_at timestamptz,
  add column if not exists voucher_request jsonb;

do $$
begin
  alter table public.mogiving_shares
    add constraint mogiving_shares_gift_status_check check (gift_status in ('ACTIVE', 'COMPLETED_FULL', 'PENDING_CHOICE', 'CONVERTED_VOUCHER'));
exception when duplicate_object then null;
end $$;

comment on column public.mogiving_shares.gift_status is '공동 선물 상태: ACTIVE | COMPLETED_FULL(100% 완성·실물 발주 대기) | PENDING_CHOICE(수령 방식 선택 대기) | CONVERTED_VOUCHER(모바일 상품권 전환 신청)';
comment on column public.mogiving_shares.completed_at is '선물이 100% 완성된 시각 (친구들의 적립 또는 수령인 차액 결제)';
comment on column public.mogiving_shares.voucher_request is '모바일 상품권 전환 신청 {type, name, phone, amount(원가 상당액), collected, requestedAt}';

-- 기존 행 상태 채우기
update public.mogiving_shares s
set gift_status = case
      when s.collected_amount >= public.mogiving_share_goal(s.goal, s.payload) then 'COMPLETED_FULL'
      when (s.payload->>'d')::numeric <= extract(epoch from now()) * 1000 then 'PENDING_CHOICE'
      else 'ACTIVE'
    end,
    completed_at = case when s.collected_amount >= public.mogiving_share_goal(s.goal, s.payload) then coalesce(s.completed_at, s.updated_at) else s.completed_at end
where s.gift_status = 'ACTIVE';

create index if not exists mogiving_shares_gift_status_idx on public.mogiving_shares (gift_status);

-- 2) 주문 종류: gift(친구의 선물 보태기) | topup(수령인의 차액 결제)
alter table public.mogiving_payment_orders
  add column if not exists kind text not null default 'gift';

do $$
begin
  alter table public.mogiving_payment_orders
    add constraint mogiving_payment_orders_kind_check check (kind in ('gift', 'topup'));
exception when duplicate_object then null;
end $$;

comment on column public.mogiving_payment_orders.kind is 'gift: 선물 보태기(선물 교환권 구매) | topup: 수령인 차액 결제';

-- 3) 없애는 기능과 반환 형식이 바뀌는 함수
drop function if exists public.mogiving_cancel_funding(text);
drop function if exists public.mogiving_expired_under_fundings(bigint, integer);
drop function if exists public.mogiving_finalize_payment(text, text);
drop function if exists public.mogiving_contribute(text, text, text, integer);

-- 4) 선물 보태기: 행 잠금 → 남은 금액까지만 기록 → 100% 도달 시 COMPLETED_FULL.
--    completed_now는 이번 결제로 처음 완성됐을 때만 true (운영 알림을 한 번만 보내기 위해)
create function public.mogiving_contribute(
  p_share_id text,
  p_nickname text,
  p_message text,
  p_amount integer
)
returns table (contribution_id uuid, amount integer, collected_amount integer, contribution_count integer, goal integer, created_at timestamptz, completed_now boolean)
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
  v_completed boolean;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount' using errcode = 'P0001';
  end if;

  select * into s from public.mogiving_shares where id = p_share_id for update;
  if not found then
    raise exception 'share_not_found' using errcode = 'P0001';
  end if;

  v_goal := public.mogiving_share_goal(s.goal, s.payload);
  if v_goal is null then
    raise exception 'goal_missing' using errcode = 'P0001';
  end if;

  if s.gift_status <> 'ACTIVE'
     or s.collected_amount >= v_goal
     or ((s.payload->>'d')::numeric < extract(epoch from now()) * 1000) then
    raise exception 'funding_closed' using errcode = 'P0001';
  end if;

  v_amount := least(p_amount, v_goal - s.collected_amount);
  v_completed := s.collected_amount + v_amount >= v_goal;

  insert into public.mogiving_contributions (share_id, nickname, message, amount)
  values (p_share_id, p_nickname, coalesce(p_message, ''), v_amount)
  returning id, mogiving_contributions.created_at into v_id, v_created;

  update public.mogiving_shares
  set goal = v_goal,
      collected_amount = s.collected_amount + v_amount,
      contribution_count = s.contribution_count + 1,
      gift_status = case when v_completed then 'COMPLETED_FULL' else s.gift_status end,
      completed_at = case when v_completed then now() else s.completed_at end,
      updated_at = now()
  where id = p_share_id;

  return query select v_id, v_amount, s.collected_amount + v_amount, s.contribution_count + 1, v_goal, v_created, v_completed;
end;
$$;

revoke execute on function public.mogiving_contribute(text, text, text, integer) from public, anon, authenticated;
grant execute on function public.mogiving_contribute(text, text, text, integer) to service_role;

-- 5) 수령인 차액 결제: 기간이 끝난 미도달 선물에 남은 금액을 정확히 채우면 COMPLETED_FULL
create or replace function public.mogiving_contribute_topup(p_share_id text, p_amount integer)
returns table (contribution_id uuid, amount integer, collected_amount integer, contribution_count integer, goal integer, created_at timestamptz, completed_now boolean)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  s public.mogiving_shares%rowtype;
  v_goal integer;
  v_id uuid;
  v_created timestamptz;
begin
  select * into s from public.mogiving_shares where id = p_share_id for update;
  if not found then
    raise exception 'share_not_found' using errcode = 'P0001';
  end if;

  v_goal := public.mogiving_share_goal(s.goal, s.payload);
  if v_goal is null then
    raise exception 'goal_missing' using errcode = 'P0001';
  end if;

  if s.gift_status not in ('ACTIVE', 'PENDING_CHOICE')
     or s.delivery_requested_at is not null
     or s.collected_amount >= v_goal
     or ((s.payload->>'d')::numeric > extract(epoch from now()) * 1000)
     or p_amount is distinct from v_goal - s.collected_amount then
    raise exception 'topup_unavailable' using errcode = 'P0001';
  end if;

  insert into public.mogiving_contributions (share_id, nickname, message, amount)
  values (p_share_id, '차액 결제', '', p_amount)
  returning id, mogiving_contributions.created_at into v_id, v_created;

  update public.mogiving_shares
  set goal = v_goal,
      collected_amount = v_goal,
      contribution_count = s.contribution_count + 1,
      gift_status = 'COMPLETED_FULL',
      completed_at = now(),
      updated_at = now()
  where id = p_share_id;

  return query select v_id, p_amount, v_goal, s.contribution_count + 1, v_goal, v_created, true;
end;
$$;

revoke execute on function public.mogiving_contribute_topup(text, integer) from public, anon, authenticated;
grant execute on function public.mogiving_contribute_topup(text, integer) to service_role;

-- 6) 결제 확정: 주문 종류에 따라 선물 보태기/차액 결제를 반영한다. 같은 주문으로 다시 호출해도 기존 결과만 돌려준다.
--    반영할 수 없는 결제(그사이 완성·기간 종료·상태 변경)는 교환권을 발행하지 않았으므로 결제 취소 대상으로 남긴다
create function public.mogiving_finalize_payment(p_order_id text, p_payment_key text)
returns table (
  share_id text,
  contribution_id uuid,
  recorded_amount integer,
  refund_amount integer,
  refund_status text,
  collected_amount integer,
  contribution_count integer,
  goal integer,
  contributed_at timestamptz,
  kind text,
  completed_now boolean
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  o public.mogiving_payment_orders%rowtype;
  c record;
  v_contribution uuid;
  v_recorded integer := 0;
  v_completed boolean := false;
begin
  select * into o from public.mogiving_payment_orders po where po.order_id = p_order_id for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0001';
  end if;
  if o.status = 'failed' then
    raise exception 'order_failed' using errcode = 'P0001';
  end if;
  if o.payment_key is not null and o.payment_key <> p_payment_key then
    raise exception 'payment_key_mismatch' using errcode = 'P0001';
  end if;

  if o.status <> 'finalized' then
    begin
      if o.kind = 'topup' then
        select * into c from public.mogiving_contribute_topup(o.share_id, o.amount);
      else
        select * into c from public.mogiving_contribute(o.share_id, o.nickname, o.message, o.amount);
      end if;
      v_contribution := c.contribution_id;
      v_recorded := c.amount;
      v_completed := c.completed_now;
    exception when sqlstate 'P0001' then
      if sqlerrm not in ('funding_closed', 'share_not_found', 'goal_missing', 'topup_unavailable') then
        raise;
      end if;
    end;

    update public.mogiving_payment_orders po
    set status = 'finalized',
        payment_key = p_payment_key,
        contribution_id = v_contribution,
        recorded_amount = v_recorded,
        refund_amount = o.amount - v_recorded,
        refund_status = case when o.amount > v_recorded then 'required' else 'none' end,
        updated_at = now()
    where po.order_id = p_order_id
    returning * into o;
  end if;

  return query
    select o.share_id, o.contribution_id, o.recorded_amount, o.refund_amount, o.refund_status,
           s.collected_amount, s.contribution_count, s.goal,
           (select mc.created_at from public.mogiving_contributions mc where mc.id = o.contribution_id),
           o.kind, v_completed
    from public.mogiving_shares s
    where s.id = o.share_id;
end;
$$;

revoke execute on function public.mogiving_finalize_payment(text, text) from public, anon, authenticated;
grant execute on function public.mogiving_finalize_payment(text, text) to service_role;

-- 7) 기간이 끝난 미도달 선물을 PENDING_CHOICE로 (매일 크론). 화면과 결제 판단은 마감일로도 같은 상태를 계산하므로 크론이 늦어도 안전하다
create or replace function public.mogiving_mark_pending_choice(p_now_ms bigint, p_limit integer)
returns table (share_id text)
language sql
volatile
security definer
set search_path = public
as $$
  with due as (
    select s.id
    from public.mogiving_shares s
    where s.gift_status = 'ACTIVE'
      and (s.payload->>'d')::numeric <= p_now_ms
      and s.collected_amount < coalesce(public.mogiving_share_goal(s.goal, s.payload), 2147483647)
    order by (s.payload->>'d')::numeric asc
    limit p_limit
    for update skip locked
  )
  update public.mogiving_shares s
  set gift_status = 'PENDING_CHOICE', updated_at = now()
  from due
  where s.id = due.id
  returning s.id;
$$;

revoke execute on function public.mogiving_mark_pending_choice(bigint, integer) from public, anon, authenticated;
grant execute on function public.mogiving_mark_pending_choice(bigint, integer) to service_role;

-- 8) 모바일 상품권 전환 신청: 기간이 끝난 미도달 선물만. 원가 상당액 = 적립 금액 × 100 / (100 + 수수료%) (원 단위 내림)
--    반환: {"result": "converted" | "already" | "unavailable" | "not_found", "request": {...}}
create or replace function public.mogiving_convert_voucher(p_share_id text, p_fee_percent integer, p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.mogiving_shares%rowtype;
  v_goal integer;
  v_amount bigint;
  v_req jsonb;
begin
  select * into s from public.mogiving_shares where id = p_share_id for update;
  if not found then
    return jsonb_build_object('result', 'not_found');
  end if;
  if s.gift_status = 'CONVERTED_VOUCHER' then
    return jsonb_build_object('result', 'already', 'request', s.voucher_request);
  end if;

  v_goal := public.mogiving_share_goal(s.goal, s.payload);
  if s.gift_status not in ('ACTIVE', 'PENDING_CHOICE')
     or s.delivery_requested_at is not null
     or s.collected_amount <= 0
     or (v_goal is not null and s.collected_amount >= v_goal)
     or ((s.payload->>'d')::numeric > extract(epoch from now()) * 1000) then
    return jsonb_build_object('result', 'unavailable');
  end if;

  v_amount := (s.collected_amount::bigint * 100) / (100 + greatest(p_fee_percent, 0));
  v_req := coalesce(p_request, '{}'::jsonb) || jsonb_build_object(
    'amount', v_amount,
    'collected', s.collected_amount,
    'requestedAt', (extract(epoch from now()) * 1000)::bigint
  );

  update public.mogiving_shares
  set gift_status = 'CONVERTED_VOUCHER', voucher_request = v_req, updated_at = now()
  where id = p_share_id;

  return jsonb_build_object('result', 'converted', 'request', v_req);
end;
$$;

revoke execute on function public.mogiving_convert_voucher(text, integer, jsonb) from public, anon, authenticated;
grant execute on function public.mogiving_convert_voucher(text, integer, jsonb) to service_role;

notify pgrst, 'reload schema';
