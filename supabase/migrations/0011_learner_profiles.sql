-- Phase 11: Learner Profile — minimal ecosystem layer (spec §9, §15).
-- One row per learner; the profile's *content* (strengths, insights,
-- portfolio) is assembled at read time from learner_insights and
-- portfolio_artifacts rather than duplicated here — this table just holds
-- the profile-level status/summary.

create type public.profile_status as enum ('active', 'inactive');

create table public.learner_profiles (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null unique references public.learners (id) on delete cascade,
  profile_status public.profile_status not null default 'active',
  summary text,
  updated_at timestamptz not null default now()
);

create trigger set_learner_profiles_updated_at
  before update on public.learner_profiles
  for each row execute function public.set_updated_at();

alter table public.learner_profiles enable row level security;

create policy "learner_profiles: staff can view"
  on public.learner_profiles for select
  to authenticated
  using (public.is_staff());

create policy "learner_profiles: learner can view own"
  on public.learner_profiles for select
  to authenticated
  using (learner_id in (select id from public.learners where user_id = auth.uid()));

create policy "learner_profiles: staff can create"
  on public.learner_profiles for insert
  to authenticated
  with check (public.is_staff());

create policy "learner_profiles: staff can update"
  on public.learner_profiles for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());
