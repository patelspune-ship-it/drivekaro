-- DriveKaro Booking Desk (drivekaro.in/desk) — one-time setup.
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run more than once. Does not touch any existing table.

-- 1. One table holds the desk's cars, bookings, settings and counters as JSON documents.
create table if not exists public.desk_docs (
  collection  text        not null,
  id          text        not null,
  data        jsonb       not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  primary key (collection, id)
);

-- 2. Who counts as an owner: any email in your existing public.owners table.
--    security definer so it works whatever the owners table's own policies are.
create or replace function public.is_desk_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.owners o
    where lower(o.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function public.is_desk_owner() from public, anon;
grant execute on function public.is_desk_owner() to authenticated;

-- 3. Row-level security: only signed-in owners can read or write desk data.
alter table public.desk_docs enable row level security;
drop policy if exists desk_owner_all on public.desk_docs;
create policy desk_owner_all on public.desk_docs
  for all to authenticated
  using (public.is_desk_owner())
  with check (public.is_desk_owner());
revoke all on public.desk_docs from anon;
grant select, insert, update, delete on public.desk_docs to authenticated;

-- 4. Gap-free invoice numbers per financial year (DK/26-27/0001, 0002, ...).
create or replace function public.desk_next_invoice(p_fy text)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare v integer;
begin
  if not public.is_desk_owner() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into public.desk_docs (collection, id, data)
  values ('meta', 'invoice_counter', jsonb_build_object('fy', p_fy, 'seq', 1))
  on conflict (collection, id) do update
    set data = case
          when public.desk_docs.data ->> 'fy' = p_fy
            then jsonb_build_object('fy', p_fy, 'seq', (public.desk_docs.data ->> 'seq')::int + 1)
          else jsonb_build_object('fy', p_fy, 'seq', 1)
        end,
        updated_at = now()
  returning (data ->> 'seq')::int into v;
  return v;
end;
$$;
revoke all on function public.desk_next_invoice(text) from public, anon;
grant execute on function public.desk_next_invoice(text) to authenticated;

-- 5. Live updates between your phone and laptop.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'desk_docs'
  ) then
    alter publication supabase_realtime add table public.desk_docs;
  end if;
end $$;

-- Check: this should return your owner email(s).
select email from public.owners;
