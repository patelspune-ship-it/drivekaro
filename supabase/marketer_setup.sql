-- DriveKaro AI Marketer (drivekaro.in/marketer): one-time setup.
-- Paste into Supabase → SQL Editor → New query → Run. Safe to run more than once.
-- Needs desk_setup.sql to have been run first (it creates desk_docs and is_desk_owner()).
--
-- Creates a PUBLIC storage bucket "marketing" for your car photos and the finished post images.
-- It has to be public because Instagram and Google download the image from its link when posting.
-- Only put marketing pictures here: never KYC documents, DL or Aadhaar.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('marketing', 'marketing', true, 15728640, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Only desk owners can upload, replace or delete. Anyone can view (public bucket).
drop policy if exists marketing_owner_insert on storage.objects;
create policy marketing_owner_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'marketing' and public.is_desk_owner());

drop policy if exists marketing_owner_update on storage.objects;
create policy marketing_owner_update on storage.objects
  for update to authenticated
  using (bucket_id = 'marketing' and public.is_desk_owner())
  with check (bucket_id = 'marketing' and public.is_desk_owner());

drop policy if exists marketing_owner_delete on storage.objects;
create policy marketing_owner_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'marketing' and public.is_desk_owner());

drop policy if exists marketing_owner_select on storage.objects;
create policy marketing_owner_select on storage.objects
  for select to authenticated
  using (bucket_id = 'marketing' and public.is_desk_owner());
