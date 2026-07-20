-- v1.5.1 Commit 1: authenticated itinerary overrides and expense ledger.
-- Run after travel_documents.sql and trip_members.sql.
-- Realtime stays OFF in this migration; the explicit opt-in switch is at the end.

create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_trip_member_user(target_trip_id text, target_user_id uuid)
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
      and user_id = target_user_id
  );
$$;

create or replace function private.valid_itinerary_notes(value text[])
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select value is not null
    and cardinality(value) <= 20
    and not exists (
      select 1
      from unnest(value) as notes(note)
      where note is null or char_length(note) not between 1 and 500
    );
$$;

create or replace function private.valid_itinerary_maps(value jsonb)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select case
    when value is null or jsonb_typeof(value) <> 'array' then false
    when jsonb_array_length(value) > 20 then false
    else not exists (
      select 1
      from jsonb_array_elements(value) as entries(item)
      where case
        when jsonb_typeof(entries.item) <> 'object' then true
        else (
            select array_agg(keys.key order by keys.key)
            from jsonb_object_keys(entries.item) as keys(key)
          ) is distinct from array['label', 'query']::text[]
          or jsonb_typeof(entries.item -> 'label') <> 'string'
          or char_length(entries.item ->> 'label') not between 1 and 80
          or jsonb_typeof(entries.item -> 'query') <> 'string'
          or char_length(entries.item ->> 'query') not between 1 and 300
      end
    )
  end;
$$;

create or replace function private.valid_itinerary_periods(value jsonb)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select case
    when value is null or jsonb_typeof(value) <> 'object' then false
    when (
      select array_agg(keys.key order by keys.key)
      from jsonb_object_keys(value) as keys(key)
    ) is distinct from array['afternoon', 'evening', 'morning', 'noon']::text[] then false
    when exists (
      select 1
      from (values ('morning'), ('noon'), ('afternoon'), ('evening')) as period_names(name)
      where case
        when jsonb_typeof(value -> period_names.name) <> 'array' then true
        else jsonb_array_length(value -> period_names.name) > 30
      end
    ) then false
    else
      not exists (
        select 1
        from (values ('morning'), ('noon'), ('afternoon'), ('evening')) as period_names(name)
        cross join lateral jsonb_array_elements(value -> period_names.name) as entries(item)
        where case
          when jsonb_typeof(entries.item) <> 'object' then true
          else (
              select array_agg(keys.key order by keys.key)
              from jsonb_object_keys(entries.item) as keys(key)
            ) is distinct from array['id', 'order', 'status', 'text', 'time']::text[]
            or jsonb_typeof(entries.item -> 'id') <> 'string'
            or char_length(entries.item ->> 'id') not between 1 and 64
            or (entries.item ->> 'id') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'
            or jsonb_typeof(entries.item -> 'text') <> 'string'
            or char_length(entries.item ->> 'text') not between 1 and 300
            or case
              when entries.item -> 'time' = 'null'::jsonb then false
              when jsonb_typeof(entries.item -> 'time') = 'string'
                then (entries.item ->> 'time') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
              else true
            end
            or case
              when jsonb_typeof(entries.item -> 'order') = 'number'
                and (entries.item ->> 'order') ~ '^[0-9]{1,4}$'
                then (entries.item ->> 'order')::integer not between 0 and 9990
              else true
            end
            or jsonb_typeof(entries.item -> 'status') <> 'string'
            or (entries.item ->> 'status') not in ('planned', 'done', 'cancelled')
        end
      )
      and not exists (
        select 1
        from (values ('morning'), ('noon'), ('afternoon'), ('evening')) as period_names(name)
        cross join lateral jsonb_array_elements(value -> period_names.name) as entries(item)
        group by entries.item ->> 'id'
        having count(*) > 1
      )
  end;
$$;

revoke all on function private.is_trip_member_user(text, uuid) from public, anon;
revoke all on function private.valid_itinerary_notes(text[]) from public, anon;
revoke all on function private.valid_itinerary_maps(jsonb) from public, anon;
revoke all on function private.valid_itinerary_periods(jsonb) from public, anon;
grant execute on function private.is_trip_member_user(text, uuid) to authenticated;
grant execute on function private.valid_itinerary_notes(text[]) to authenticated;
grant execute on function private.valid_itinerary_maps(jsonb) to authenticated;
grant execute on function private.valid_itinerary_periods(jsonb) to authenticated;

create table if not exists public.travel_itinerary_overrides (
  trip_id text not null
    check (trip_id ~ '^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$'),
  day_id text not null
    check (day_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$'),
  base_version text not null
    check (char_length(base_version) between 1 and 30),
  travel_date date not null,
  city text not null
    check (char_length(city) between 1 and 120),
  theme text not null
    check (char_length(theme) between 1 and 160),
  transport text not null default ''
    check (char_length(transport) <= 1000),
  periods jsonb not null
    check (private.valid_itinerary_periods(periods))
    check (octet_length(periods::text) <= 65536),
  notes text[] not null default '{}'
    check (private.valid_itinerary_notes(notes)),
  maps jsonb not null default '[]'::jsonb
    check (private.valid_itinerary_maps(maps))
    check (octet_length(maps::text) <= 16384),
  status text not null default 'changed'
    check (status in ('pending', 'confirmed', 'changed', 'cancelled')),
  revision bigint not null default 1
    check (revision > 0),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint travel_itinerary_overrides_pkey primary key (trip_id, day_id),
  constraint travel_itinerary_overrides_trip_date_key unique (trip_id, travel_date)
);

create table if not exists public.travel_expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id text not null
    check (trip_id ~ '^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$'),
  client_ref text not null
    check (client_ref ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$'),
  title text not null
    check (char_length(title) between 1 and 160),
  category text not null
    check (category in ('flight', 'hotel', 'transport', 'food', 'sea', 'attractions', 'insurance', 'connectivity', 'shopping', 'other')),
  amount_minor bigint not null
    check (amount_minor between 1 and 999999999999),
  currency char(3) not null
    check (currency in ('CNY', 'MYR', 'IDR', 'USD')),
  incurred_on date not null,
  paid_by_user_id uuid references auth.users(id) on delete set null,
  split_mode text not null default 'shared'
    check (split_mode in ('shared', 'personal')),
  payment_status text not null default 'paid'
    check (payment_status in ('pending', 'paid', 'refunded')),
  note text
    check (note is null or char_length(note) <= 500),
  revision bigint not null default 1
    check (revision > 0),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint travel_expenses_trip_client_ref_key unique (trip_id, client_ref)
);

create index if not exists travel_itinerary_overrides_trip_updated_idx
on public.travel_itinerary_overrides (trip_id, updated_at desc);

create index if not exists travel_expenses_trip_date_idx
on public.travel_expenses (trip_id, incurred_on desc, created_at desc);

create index if not exists travel_expenses_trip_currency_status_idx
on public.travel_expenses (trip_id, currency, payment_status);

create or replace function private.set_itinerary_override_metadata()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if tg_op = 'INSERT' then
    new.revision := 1;
    new.updated_by := (select auth.uid());
    new.updated_at := now();
    return new;
  end if;

  if new.trip_id is distinct from old.trip_id
    or new.day_id is distinct from old.day_id
    or new.base_version is distinct from old.base_version
    or new.travel_date is distinct from old.travel_date then
    raise exception 'itinerary override identity is immutable' using errcode = '22023';
  end if;

  new.revision := old.revision + 1;
  new.updated_by := (select auth.uid());
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.set_expense_metadata()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if tg_op = 'INSERT' then
    new.revision := 1;
    new.created_by := (select auth.uid());
    new.updated_by := (select auth.uid());
    new.created_at := now();
    new.updated_at := now();
    return new;
  end if;

  if new.id is distinct from old.id
    or new.trip_id is distinct from old.trip_id
    or new.client_ref is distinct from old.client_ref
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at then
    raise exception 'expense identity and creator are immutable' using errcode = '22023';
  end if;

  new.revision := old.revision + 1;
  new.updated_by := (select auth.uid());
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.set_itinerary_override_metadata() from public, anon;
revoke all on function private.set_expense_metadata() from public, anon;

drop trigger if exists travel_itinerary_overrides_metadata on public.travel_itinerary_overrides;
create trigger travel_itinerary_overrides_metadata
before insert or update on public.travel_itinerary_overrides
for each row execute function private.set_itinerary_override_metadata();

drop trigger if exists travel_expenses_metadata on public.travel_expenses;
create trigger travel_expenses_metadata
before insert or update on public.travel_expenses
for each row execute function private.set_expense_metadata();

alter table public.travel_itinerary_overrides enable row level security;
alter table public.travel_expenses enable row level security;

revoke all on table public.travel_itinerary_overrides from anon, authenticated;
revoke all on table public.travel_expenses from anon, authenticated;
grant select, insert, update on table public.travel_itinerary_overrides to authenticated;
grant select, insert, update, delete on table public.travel_expenses to authenticated;

revoke insert, update, delete on table public.trip_members from authenticated;
grant select on table public.trip_members to authenticated;

drop policy if exists "Trip members own membership select" on public.trip_members;
drop policy if exists "Trip members same trip select" on public.trip_members;
create policy "Trip members same trip select"
on public.trip_members for select
to authenticated
using (private.is_trip_member(trip_id));

drop policy if exists "Itinerary overrides trip member select" on public.travel_itinerary_overrides;
drop policy if exists "Itinerary overrides trip member insert" on public.travel_itinerary_overrides;
drop policy if exists "Itinerary overrides trip member update" on public.travel_itinerary_overrides;

create policy "Itinerary overrides trip member select"
on public.travel_itinerary_overrides for select
to authenticated
using (private.is_trip_member(trip_id));

create policy "Itinerary overrides trip member insert"
on public.travel_itinerary_overrides for insert
to authenticated
with check (
  private.is_trip_member(trip_id)
  and updated_by = (select auth.uid())
);

create policy "Itinerary overrides trip member update"
on public.travel_itinerary_overrides for update
to authenticated
using (private.is_trip_member(trip_id))
with check (
  private.is_trip_member(trip_id)
  and updated_by = (select auth.uid())
);

drop policy if exists "Expenses trip member select" on public.travel_expenses;
drop policy if exists "Expenses trip member insert" on public.travel_expenses;
drop policy if exists "Expenses trip member update" on public.travel_expenses;
drop policy if exists "Expenses creator or trip owner delete" on public.travel_expenses;

create policy "Expenses trip member select"
on public.travel_expenses for select
to authenticated
using (private.is_trip_member(trip_id));

create policy "Expenses trip member insert"
on public.travel_expenses for insert
to authenticated
with check (
  private.is_trip_member(trip_id)
  and private.is_trip_member_user(trip_id, paid_by_user_id)
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);

create policy "Expenses trip member update"
on public.travel_expenses for update
to authenticated
using (private.is_trip_member(trip_id))
with check (
  private.is_trip_member(trip_id)
  and private.is_trip_member_user(trip_id, paid_by_user_id)
  and updated_by = (select auth.uid())
);

create policy "Expenses creator or trip owner delete"
on public.travel_expenses for delete
to authenticated
using (
  private.is_trip_member(trip_id)
  and (
    created_by = (select auth.uid())
    or private.is_trip_owner(trip_id)
  )
);

-- Realtime switch: OFF for Commit 1.
-- Enable only after the authenticated shared-data client is ready and tested:
-- alter publication supabase_realtime add table public.travel_itinerary_overrides;
-- alter publication supabase_realtime add table public.travel_expenses;
