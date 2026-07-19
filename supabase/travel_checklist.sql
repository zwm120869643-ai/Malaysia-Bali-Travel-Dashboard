-- Travel OS v1.3.0 Phase 1: checklist-only shared state.
-- ponytail: anonymous RLS keeps setup small; add Supabase Auth before syncing private data.

create extension if not exists pgcrypto;

create table if not exists public.travel_checklist (
  id uuid primary key default gen_random_uuid(),
  trip_id text not null check (trip_id ~ '^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$'),
  task_id text not null check (task_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$'),
  task_name text not null check (char_length(task_name) between 1 and 160),
  completed boolean not null default false,
  completed_by text not null check (char_length(completed_by) between 1 and 64)
    check (completed_by !~* '(护照号|身份证号|银行卡号|订单号|CVV|密码)'),
  updated_by_user_id uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint travel_checklist_trip_task_key unique (trip_id, task_id),
  constraint travel_checklist_no_sensitive_labels check (task_name !~* '(护照号|身份证号|银行卡号|订单号|CVV)')
);

-- Existing Phase 1 databases also receive the reserved Auth identity field.
alter table public.travel_checklist
  add column if not exists updated_by_user_id uuid references auth.users(id) on delete set null;

create or replace function public.set_travel_checklist_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists travel_checklist_updated_at on public.travel_checklist;
create trigger travel_checklist_updated_at
before update on public.travel_checklist
for each row execute function public.set_travel_checklist_updated_at();

alter table public.travel_checklist enable row level security;
revoke all on public.travel_checklist from anon, authenticated;
grant select, insert, update on public.travel_checklist to anon, authenticated;

drop policy if exists "shared checklist select" on public.travel_checklist;
create policy "shared checklist select"
on public.travel_checklist for select
to anon, authenticated
using (trip_id = 'malaysia-bali-2026');

drop policy if exists "shared checklist insert" on public.travel_checklist;
create policy "shared checklist insert"
on public.travel_checklist for insert
to anon, authenticated
with check (trip_id = 'malaysia-bali-2026');

-- Future Supabase Auth phase: require updated_by_user_id = (select auth.uid())
-- in insert/update policies before treating user identity as verified.

drop policy if exists "shared checklist update" on public.travel_checklist;
create policy "shared checklist update"
on public.travel_checklist for update
to anon, authenticated
using (trip_id = 'malaysia-bali-2026')
with check (trip_id = 'malaysia-bali-2026');
