-- 토스페이먼츠 결제 주문 + 결제 확정 함수
-- 결제창을 열기 전에 서버가 주문(금액·닉네임·메시지)을 저장하고, 승인 후 mogiving_finalize_payment()가 참여 내역을 한 번만 반영한다.

create table if not exists public.mogiving_payment_orders (
  order_id text primary key check (order_id ~ '^[A-Za-z0-9_=-]{6,64}$'),
  -- 결제 기록이 있는 펀딩은 실수로 함께 지워지지 않게 막는다
  share_id text not null references public.mogiving_shares(id) on delete restrict,
  nickname text not null check (char_length(nickname) between 1 and 20),
  message text not null default '' check (char_length(message) <= 300),
  amount integer not null check (amount > 0),
  -- pending: 결제 전 / approved: 토스 승인 완료·반영 전 / finalized: 반영 완료 / failed: 승인 실패(청구 없음)
  status text not null default 'pending' check (status in ('pending', 'approved', 'finalized', 'failed')),
  payment_key text,
  contribution_id uuid,
  recorded_amount integer check (recorded_amount is null or recorded_amount >= 0),
  -- 결제 후 마감·목표 초과로 반영하지 못한 금액 (자동 환불 대상)
  refund_amount integer not null default 0 check (refund_amount >= 0),
  refund_status text not null default 'none' check (refund_status in ('none', 'required', 'done', 'failed')),
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mogiving_payment_orders_share_idx on public.mogiving_payment_orders (share_id, created_at);
create index if not exists mogiving_payment_orders_attention_idx on public.mogiving_payment_orders (status, refund_status);

-- 서버(service role)만 접근
alter table public.mogiving_payment_orders enable row level security;
revoke all on table public.mogiving_payment_orders from anon, authenticated;

-- 주문을 잠그고 mogiving_contribute()를 호출해 참여 내역 반영과 주문 확정을 한 트랜잭션으로 처리한다.
-- 같은 주문으로 다시 호출해도 기존 결과만 돌려주므로 모금액이 두 번 늘지 않는다.
create or replace function public.mogiving_finalize_payment(p_order_id text, p_payment_key text)
returns table (
  share_id text,
  contribution_id uuid,
  recorded_amount integer,
  refund_amount integer,
  refund_status text,
  collected_amount integer,
  contribution_count integer,
  goal integer,
  contributed_at timestamptz
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
      select * into c from public.mogiving_contribute(o.share_id, o.nickname, o.message, o.amount);
      v_contribution := c.contribution_id;
      v_recorded := c.amount;
    exception when sqlstate 'P0001' then
      -- 승인 사이에 마감된 경우: 반영하지 않고 전액 환불 대상으로 남긴다
      if sqlerrm not in ('funding_closed', 'share_not_found', 'goal_missing') then
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
           (select mc.created_at from public.mogiving_contributions mc where mc.id = o.contribution_id)
    from public.mogiving_shares s
    where s.id = o.share_id;
end;
$$;

revoke execute on function public.mogiving_finalize_payment(text, text) from public, anon, authenticated;
grant execute on function public.mogiving_finalize_payment(text, text) to service_role;

notify pgrst, 'reload schema';
