-- 직접 올린 상품 사진 저장소 (Supabase Storage 비공개 버킷)
-- 서버(service role)만 읽고 쓰며, 사진은 /api/image/[id] 라우트로만 내보낸다.
-- 앱도 첫 업로드 때 버킷이 없으면 같은 설정으로 만들므로, 이 마이그레이션은 미리 만들어 두는 용도다.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mogiving-images', 'mogiving-images', false, 1572864, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
