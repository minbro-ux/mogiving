-- 1) 배송지 전용 컬럼 추가
alter table public.mogiving_shares
  add column if not exists shipping jsonb;

comment on column public.mogiving_shares.shipping is
  '주최자 배송지 (비공개). 공유 화면·API 응답에 절대 포함하지 않음';

-- 2) 기존 행: payload 안의 shipping을 새 컬럼으로 옮기고 payload에서는 제거
update public.mogiving_shares
set shipping = coalesce(shipping, payload->'shipping'),
    payload  = payload - 'shipping'
where payload ? 'shipping';
