-- v1.5.0 Shared Membership Hardening
-- Run after travel_documents.sql. Add real memberships separately in SQL Editor.

create schema if not exists private;
revoke all on schema private from public, anon;

create table if not exists public.trip_members (
  trip_id text not null check (trip_id ~ '^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create index if not exists trip_members_user_trip_idx
on public.trip_members (user_id, trip_id);

alter table public.trip_members enable row level security;
revoke all on table public.trip_members from anon;
revoke insert, update, delete on table public.trip_members from authenticated;
grant select on table public.trip_members to authenticated;

drop policy if exists "Trip members own membership select" on public.trip_members;
create policy "Trip members own membership select"
on public.trip_members for select
to authenticated
using (user_id = (select auth.uid()));

create or replace function private.is_trip_member(target_trip_id text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.trip_members
    where trip_id = target_trip_id
      and user_id = (select auth.uid())
  );
$$;

create or replace function private.is_trip_owner(target_trip_id text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.trip_members
    where trip_id = target_trip_id
      and user_id = (select auth.uid())
      and role = 'owner'
  );
$$;

revoke all on function private.is_trip_member(text) from public, anon;
revoke all on function private.is_trip_owner(text) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_trip_member(text) to authenticated;
grant execute on function private.is_trip_owner(text) to authenticated;

revoke all on table public.travel_documents from anon;
grant select, insert, delete on table public.travel_documents to authenticated;
revoke update on table public.travel_documents from authenticated;

drop policy if exists "Travel documents owner select" on public.travel_documents;
drop policy if exists "Travel documents owner insert" on public.travel_documents;
drop policy if exists "Travel documents owner delete" on public.travel_documents;
drop policy if exists "Travel documents trip member select" on public.travel_documents;
drop policy if exists "Travel documents trip member insert" on public.travel_documents;
drop policy if exists "Travel documents uploader or trip owner delete" on public.travel_documents;

create policy "Travel documents trip member select"
on public.travel_documents for select
to authenticated
using (private.is_trip_member(trip_id));

create policy "Travel documents trip member insert"
on public.travel_documents for insert
to authenticated
with check (
  trip_id is not null
  and private.is_trip_member(trip_id)
  and uploaded_by = (select auth.uid())
);

create policy "Travel documents uploader or trip owner delete"
on public.travel_documents for delete
to authenticated
using (
  private.is_trip_member(trip_id)
  and (
    uploaded_by = (select auth.uid())
    or private.is_trip_owner(trip_id)
  )
);

drop policy if exists "Travel documents object select" on storage.objects;
drop policy if exists "Travel documents object insert" on storage.objects;
drop policy if exists "Travel documents object delete" on storage.objects;
drop policy if exists "Travel documents trip member object select" on storage.objects;
drop policy if exists "Travel documents trip member object insert" on storage.objects;
drop policy if exists "Travel documents uploader or trip owner object delete" on storage.objects;

create policy "Travel documents trip member object select"
on storage.objects for select
to authenticated
using (
  bucket_id = 'travel-documents'
  and private.is_trip_member((storage.foldername(name))[1])
);

create policy "Travel documents trip member object insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'travel-documents'
  and private.is_trip_member((storage.foldername(name))[1])
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and lower(storage.extension(name)) in ('pdf', 'png', 'jpg', 'jpeg')
);

create policy "Travel documents uploader or trip owner object delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'travel-documents'
  and private.is_trip_member((storage.foldername(name))[1])
  and (
    owner_id = (select auth.uid())::text
    or private.is_trip_owner((storage.foldername(name))[1])
  )
);
