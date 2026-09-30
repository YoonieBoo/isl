-- Phase 6: SmartDiscovery adapter / processing (spec §5, §6, §15, §20).

create type public.result_status as enum ('success', 'warning', 'failed', 'skipped');

create table public.processing_results (
  id uuid primary key default gen_random_uuid(),
  processing_run_id uuid not null references public.processing_runs (id) on delete cascade,
  dataset_record_id uuid not null references public.dataset_records (id) on delete cascade,
  learner_id uuid references public.learners (id) on delete set null,
  status public.result_status not null default 'success',
  raw_ai_output jsonb,
  structured_output jsonb,
  -- Failure handling (spec §20): failures must never disappear silently.
  warning text,
  error text,
  source_type public.ai_source not null,
  model_or_tool text,
  created_at timestamptz not null default now()
);

create index processing_results_run_id_idx on public.processing_results (processing_run_id);
create index processing_results_learner_id_idx on public.processing_results (learner_id);

alter table public.processing_results enable row level security;

create policy "processing_results: staff can view"
  on public.processing_results for select
  to authenticated
  using (public.is_staff());

create policy "processing_results: staff can create"
  on public.processing_results for insert
  to authenticated
  with check (public.is_staff());

create policy "processing_results: staff can update"
  on public.processing_results for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());
