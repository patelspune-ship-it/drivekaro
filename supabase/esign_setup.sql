-- DriveKaro desk: storage for Aadhaar-eSigned agreements (run once in Supabase → SQL Editor).
-- Private bucket: files are only reachable through short-lived links created by the server.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('esign', 'esign', false, 20971520, array['application/pdf'])
on conflict (id) do nothing;

-- Check: should return one row with public = false
select id, public from storage.buckets where id = 'esign';
