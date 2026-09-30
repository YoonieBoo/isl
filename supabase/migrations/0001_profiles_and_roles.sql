-- Phase 1 foundation: app-user profiles + roles, shared helpers used by every
-- later migration's RLS policies.
--
-- Roles (spec §14): admin/project owner, analyst/research user,
-- educator/reviewer, learner. Complex multi-tenant permission architecture
-- is explicitly out of scope for the MVP — this is deliberately a single
-- shared workspace (one org: Peanuts Academy), not a multi-tenant system.

create type public.app_role as enum ('admin', 'analyst', 'educator', 'learner');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  role public.app_role not null default 'analyst',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'App-side user profile + role, one row per auth.users row. Not to be confused with LearnerProfile (public.learner_profiles), which is about learners, not staff/app users.';

alter table public.profiles enable row level security;

create policy "profiles: users can view all profiles"
  on public.profiles for select
  to authenticated
  using (true);

create policy "profiles: users can update their own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Every new auth.users row gets a profile row automatically, defaulting to
-- the 'analyst' role and using signup metadata (display_name) captured by
-- the signUp() server action. First staff user should be promoted to admin
-- manually via SQL — self-serve admin escalation is a deliberate non-goal.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Shared updated_at trigger, reused by every table below that has one.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Role helpers, used by every subsequent migration's RLS policies.
create function public.current_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid();
$$;

create function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select role in ('admin', 'analyst', 'educator') from public.profiles where id = auth.uid()),
    false
  );
$$;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select role = 'admin' from public.profiles where id = auth.uid()),
    false
  );
$$;
