-- =============================================================================
-- Ritual — private storage buckets for avatars and progress photos.
-- Both buckets are PRIVATE: files are only reachable through short-lived
-- signed URLs, and each user can only touch objects inside a folder named
-- after their own user id, e.g.  progress-photos/<uid>/2026-10-23-ab12.jpg
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', false, 2097152, array['image/jpeg','image/png','image/webp']),
  ('progress-photos', 'progress-photos', false, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "ritual storage: read own files" on storage.objects for select to authenticated
  using (bucket_id in ('avatars', 'progress-photos')
         and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "ritual storage: upload own files" on storage.objects for insert to authenticated
  with check (bucket_id in ('avatars', 'progress-photos')
              and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "ritual storage: update own files" on storage.objects for update to authenticated
  using (bucket_id in ('avatars', 'progress-photos')
         and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id in ('avatars', 'progress-photos')
              and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "ritual storage: delete own files" on storage.objects for delete to authenticated
  using (bucket_id in ('avatars', 'progress-photos')
         and (storage.foldername(name))[1] = (select auth.uid())::text);
