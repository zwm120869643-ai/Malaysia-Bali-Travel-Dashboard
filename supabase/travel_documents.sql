-- v1.5.0 Private Document Center base objects
-- Run this file first, then trip_members.sql. The bucket remains private.

create table if not exists public.travel_documents (
  id uuid primary key default gen_random_uuid(),
  trip_id text not null,
  category text not null check (category in ('flights', 'hotels', 'immigration', 'transport', 'activities', 'finance')),
  title text not null check (char_length(title) between 1 and 160),
  storage_path text not null unique,
  status text not null default 'verified' check (status in ('incoming', 'processing', 'verified', 'archived')),
  uploaded_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  related_item_id text,
  created_at timestamptz not null default now()
);

alter table public.travel_documents enable row level security;
revoke all on table public.travel_documents from anon;
grant select, insert, delete on table public.travel_documents to authenticated;
revoke update on table public.travel_documents from authenticated;

create index if not exists travel_documents_owner_trip_idx
on public.travel_documents (uploaded_by, trip_id, created_at desc);

create index if not exists travel_documents_trip_created_idx
on public.travel_documents (trip_id, created_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'travel-documents',
  'travel-documents',
  false,
  10485760,
  array['application/pdf', 'image/png', 'image/jpeg']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
