-- Phase 3: Learner persistence (spec §4.2, §15).

create type public.learner_status as enum ('active', 'archived');
create type public.participation_status as enum ('active', 'completed', 'withdrawn');

create table public.learners (
  id uuid primary key default gen_random_uuid(),
  external_reference text,
  display_name text not null,
  email text,
  -- Links a learner record to an actual login for the "Learner" role
  -- (spec §14: learners can view their own profile/insights/portfolio).
  -- Nullable because most learners in the MVP won't have platform logins —
  -- self-service login is opt-in, not required for the record to exist.
  user_id uuid references auth.users (id) on delete set null,
  status public.learner_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create trigger set_learners_updated_at
  before update on public.learners
  for each row execute function public.set_updated_at();

alter table public.learners enable row level security;

create policy "learners: staff can view"
  on public.learners for select
  to authenticated
  using (public.is_staff());

create policy "learners: learner can view own record"
  on public.learners for select
  to authenticated
  using (user_id = auth.uid());

create policy "learners: staff can create"
  on public.learners for insert
  to authenticated
  with check (public.is_staff());

create policy "learners: staff can update"
  on public.learners for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create table public.learner_environments (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.learners (id) on delete cascade,
  environment_id uuid not null references public.learning_environments (id) on delete cascade,
  participation_status public.participation_status not null default 'active',
  joined_at timestamptz not null default now(),
  unique (learner_id, environment_id)
);

alter table public.learner_environments enable row level security;

create policy "learner_environments: staff can view"
  on public.learner_environments for select
  to authenticated
  using (public.is_staff());

create policy "learner_environments: learner can view own"
  on public.learner_environments for select
  to authenticated
  using (learner_id in (select id from public.learners where user_id = auth.uid()));

create policy "learner_environments: staff can create"
  on public.learner_environments for insert
  to authenticated
  with check (public.is_staff());

create policy "learner_environments: staff can update"
  on public.learner_environments for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());
