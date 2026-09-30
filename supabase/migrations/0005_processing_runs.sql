-- Phase 5: Processing context + run structure (spec §4.4, §4.5, §15).

create type public.run_status as enum (
  'draft', 'queued', 'running', 'completed', 'completed_with_warning', 'failed', 'cancelled'
);

-- The modular adapter pattern (spec §6): every ProcessingResult records
-- which of these actually produced it, and provenance must always be
-- visible in the UI — external AI output must never be labelled as
-- SmartDiscovery output.
create type public.ai_source as enum ('smartdiscovery', 'external_ai', 'manual', 'mock');

create table public.processing_runs (
  id uuid primary key default gen_random_uuid(),
  environment_id uuid not null references public.learning_environments (id) on delete cascade,
  dataset_id uuid not null references public.datasets (id) on delete cascade,
  status public.run_status not null default 'draft',
  -- Processing Context (spec §4.4): learning objective, course/activity
  -- context, learner population, activity type, interpretation focus,
  -- signal categories, taxonomy guidance, processing notes, evidence fields.
  processing_context jsonb not null default '{}'::jsonb,
  processing_configuration jsonb not null default '{}'::jsonb,
  ai_source public.ai_source not null default 'mock',
  model_or_tool text,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create index processing_runs_environment_id_idx on public.processing_runs (environment_id);
create index processing_runs_dataset_id_idx on public.processing_runs (dataset_id);

alter table public.processing_runs enable row level security;

create policy "processing_runs: staff can view"
  on public.processing_runs for select
  to authenticated
  using (public.is_staff());

create policy "processing_runs: staff can create"
  on public.processing_runs for insert
  to authenticated
  with check (public.is_staff() and created_by = auth.uid());

create policy "processing_runs: staff can update"
  on public.processing_runs for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());
