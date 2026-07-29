-- Roster Manager: accounts, wards, and per-ward roster data.
--
-- Two roles:
--   admin — manages wards and head-of-roster accounts; sees everything.
--   head  — manages the staff, rules and duties of the ward(s) they own.
--
-- Every table is protected by row-level security. The browser only ever holds the
-- publishable key, so these policies are the entire access-control story.

-- ---------------------------------------------------------------- tables ----

create table if not exists public.profiles (
  id                   uuid primary key references auth.users (id) on delete cascade,
  email                text        not null,
  full_name            text        not null default '',
  role                 text        not null default 'head' check (role in ('admin', 'head')),
  must_change_password boolean     not null default false,
  created_at           timestamptz not null default now()
);

comment on table public.profiles is 'Application identity for each auth user.';

create table if not exists public.wards (
  id         uuid primary key default gen_random_uuid(),
  name       text        not null check (length(btrim(name)) > 0),
  head_id    uuid        references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on column public.wards.head_id is 'The head of roster who may manage this ward.';

create table if not exists public.staff (
  id               uuid primary key default gen_random_uuid(),
  ward_id          uuid        not null references public.wards (id) on delete cascade,
  code             text        not null,
  name             text        not null default '',
  is_senior        boolean     not null default false,
  is_male          boolean     not null default false,
  max_morning      integer     not null default 15 check (max_morning >= 0),
  max_evening      integer     not null default 10 check (max_evening >= 0),
  max_night        integer     not null default 8  check (max_night >= 0),
  phone            text        not null default '',
  is_counterpart   boolean     not null default false,
  counterpart_of   uuid        references public.staff (id) on delete set null,
  counterpart_start date,
  counterpart_end   date,
  sort_order       integer     not null default 0,
  created_at       timestamptz not null default now(),
  unique (ward_id, code)
);

create index if not exists staff_ward_idx on public.staff (ward_id);

-- One saved rule set per ward per month.
create table if not exists public.roster_configs (
  ward_id    uuid        not null references public.wards (id) on delete cascade,
  year       integer     not null,
  month      text        not null,
  settings   jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (ward_id, year, month)
);

create table if not exists public.assignments (
  ward_id   uuid not null references public.wards (id) on delete cascade,
  staff_id  uuid not null references public.staff (id) on delete cascade,
  duty_date date not null,
  shift     text not null,
  primary key (staff_id, duty_date)
);

create index if not exists assignments_ward_date_idx on public.assignments (ward_id, duty_date);

-- ------------------------------------------------------------- helpers -----

-- SECURITY DEFINER so the policy on `profiles` does not recurse into itself.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.owns_ward(p_ward uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.wards where id = p_ward and head_id = auth.uid()
  );
$$;

revoke execute on function public.is_admin() from anon;
revoke execute on function public.owns_ward(uuid) from anon;

-- Give every new auth user a profile. Role defaults to 'head' with no ward, which
-- grants access to nothing until an administrator assigns one.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, email, full_name, role, must_change_password)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'head',
    coalesce((new.raw_user_meta_data ->> 'must_change_password')::boolean, false)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Stop a head from promoting themselves. RLS cannot restrict individual columns,
-- so the sensitive ones are guarded here.
create or replace function public.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- auth.uid() is null for service-role and direct database connections, which are
  -- already trusted; the guard exists to constrain signed-in end users.
  if auth.uid() is not null and not public.is_admin() then
    if new.role is distinct from old.role then
      raise exception 'only an administrator can change a role';
    end if;
    if new.email is distinct from old.email then
      raise exception 'email is managed by the authentication system';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_update on public.profiles;
create trigger profiles_guard_update
before update on public.profiles
for each row execute function public.guard_profile_update();

-- A head may rename their own ward but never reassign it.
create or replace function public.guard_ward_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is not null and not public.is_admin()
     and new.head_id is distinct from old.head_id then
    raise exception 'only an administrator can reassign a ward';
  end if;
  return new;
end;
$$;

drop trigger if exists wards_guard_update on public.wards;
create trigger wards_guard_update
before update on public.wards
for each row execute function public.guard_ward_update();

-- Keep assignments.ward_id honest: it must match the staff member's ward.
create or replace function public.assignments_set_ward()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  select ward_id into new.ward_id from public.staff where id = new.staff_id;
  if new.ward_id is null then
    raise exception 'unknown staff member';
  end if;
  return new;
end;
$$;

drop trigger if exists assignments_ward_sync on public.assignments;
create trigger assignments_ward_sync
before insert or update on public.assignments
for each row execute function public.assignments_set_ward();

-- ------------------------------------------------------------ policies -----

alter table public.profiles       enable row level security;
alter table public.wards          enable row level security;
alter table public.staff          enable row level security;
alter table public.roster_configs enable row level security;
alter table public.assignments    enable row level security;

-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles
  for delete to authenticated
  using (public.is_admin());

-- wards
drop policy if exists wards_select on public.wards;
create policy wards_select on public.wards
  for select to authenticated
  using (public.is_admin() or head_id = auth.uid());

drop policy if exists wards_insert on public.wards;
create policy wards_insert on public.wards
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists wards_update on public.wards;
create policy wards_update on public.wards
  for update to authenticated
  using (public.is_admin() or head_id = auth.uid())
  with check (public.is_admin() or head_id = auth.uid());

drop policy if exists wards_delete on public.wards;
create policy wards_delete on public.wards
  for delete to authenticated
  using (public.is_admin());

-- Ward-scoped data: identical shape for the three roster tables.
drop policy if exists staff_rw on public.staff;
create policy staff_rw on public.staff
  for all to authenticated
  using (public.is_admin() or public.owns_ward(ward_id))
  with check (public.is_admin() or public.owns_ward(ward_id));

drop policy if exists roster_configs_rw on public.roster_configs;
create policy roster_configs_rw on public.roster_configs
  for all to authenticated
  using (public.is_admin() or public.owns_ward(ward_id))
  with check (public.is_admin() or public.owns_ward(ward_id));

drop policy if exists assignments_rw on public.assignments;
create policy assignments_rw on public.assignments
  for all to authenticated
  using (public.is_admin() or public.owns_ward(ward_id))
  with check (public.is_admin() or public.owns_ward(ward_id));

-- --------------------------------------------------------------- grants ----

grant usage on schema public to authenticated;
grant select, insert, update, delete
  on public.profiles, public.wards, public.staff, public.roster_configs, public.assignments
  to authenticated;

-- The anonymous role must not touch application data; only signing in is allowed.
revoke all on public.profiles, public.wards, public.staff, public.roster_configs, public.assignments
  from anon;
