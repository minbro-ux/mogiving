-- 배송 접수 기록 + 자동 환불 대상 조회

-- 1) 주최자가 배송을 접수한 시각. 값이 있으면 운영자가 발주할 대상이고, 배송지(shipping)를 더 이상 바꾸지 않는다
alter table public.mogiving_shares
  add column if not exists delivery_requested_at timestamptz;

comment on column public.mogiving_shares.delivery_requested_at is '주최자 배송 접수 시각 (비어 있으면 미접수)';

-- 2) 마감이 지났고 목표에 못 미쳤으며 아직 전액 환불이 끝나지 않은 펀딩 (마감이 오래된 순)
create or replace function public.mogiving_expired_under_fundings(p_cutoff_ms bigint, p_limit integer)
returns table (share_id text)
language sql
stable
security definer
set search_path = public
as $$
  select s.id
  from public.mogiving_shares s
  where (s.payload->>'d')::numeric <= p_cutoff_ms
    and s.delivery_requested_at is null
    and s.collected_amount < coalesce(s.goal, nullif((s.payload->'x'->>'g')::numeric, 0)::integer, nullif((s.payload->'p'->>'price')::numeric, 0)::integer)
    and exists (
      select 1
      from public.mogiving_payment_orders o
      where o.share_id = s.id
        and o.status in ('approved', 'finalized')
        and (o.refund_status <> 'done' or o.refund_amount < o.amount)
    )
  order by (s.payload->>'d')::numeric asc
  limit p_limit;
$$;

revoke execute on function public.mogiving_expired_under_fundings(bigint, integer) from public, anon, authenticated;
grant execute on function public.mogiving_expired_under_fundings(bigint, integer) to service_role;

notify pgrst, 'reload schema';
