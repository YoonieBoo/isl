-- Phase 12: Learner Portfolio (spec §10, §15).

create type public.artifact_type as enum (
  'project', 'assignment', 'workshop_output', 'reflection', 'prototype',
  'presentation', 'achievement', 'other_evidence'
);

-- 'internal': staff-only, not yet shown on the learner-facing profile.
-- 'learner_visible': shown to the learner on their own profile/portfolio.
create type public.artifact_visibility as enum ('internal', 'learner_visible');

create table public.portfolio_artifacts (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.learners (id) on delete cascade,
  environment_id uuid references public.learning_environments (id) on delete set null,
  artifact_type public.artifact_type not null,
  title text not null,
  description text,
  file_reference text,
  external_url text,
  evidence_note text,
  visibility public.artifact_visibility not null default 'internal',
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create index portfolio_artifacts_learner_id_idx on public.portfolio_artifacts (learner_id);

alter table public.portfolio_artifacts enable row level security;

create policy "portfolio_artifacts: staff can view"
  on public.portfolio_artifacts for select
  to authenticated
  using (public.is_staff());

create policy "portfolio_artifacts: learner can view own visible artifacts"
  on public.portfolio_artifacts for select
  to authenticated
  using (
    visibility = 'learner_visible'
    and learner_id in (select id from public.learners where user_id = auth.uid())
  );

create policy "portfolio_artifacts: staff can create"
  on public.portfolio_artifacts for insert
  to authenticated
  with check (public.is_staff() and created_by = auth.uid());

create policy "portfolio_artifacts: staff can update"
  on public.portfolio_artifacts for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Private Storage bucket for portfolio artifact files.
insert into storage.buckets (id, name, public)
values ('portfolio', 'portfolio', false)
on conflict (id) do nothing;

create policy "portfolio bucket: staff can read"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'portfolio' and public.is_staff());

create policy "portfolio bucket: staff can upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'portfolio' and public.is_staff());
