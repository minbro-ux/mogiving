-- 펀딩 짧은 공유 링크 (/f/[id]) 저장소
create table if not exists public.mogiving_shares (
  id text primary key check (id ~ '^[2-9a-kmnp-zA-HJ-NP-Z]{7}$'),
  -- 링크 갱신용 비밀 key의 SHA-256 해시 (원문은 저장하지 않음)
  key_hash text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 서버(service role)만 읽고 쓴다. anon/authenticated에는 정책을 열지 않으므로 클라이언트에서 직접 접근 불가
alter table public.mogiving_shares enable row level security;
revoke all on table public.mogiving_shares from anon, authenticated;
