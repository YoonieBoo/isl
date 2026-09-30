-- Phase 8: Pattern / insight structuring (spec §5.2, §15).

create type public.pattern_assignment_status as enum (
  'candidate', 'confirmed', 'unassigned', 'needs_more_evidence'
);

create table public.learner_patterns (
  id uuid primary key default gen_random_uuid(),
  processing_run_id uuid not null references public.processing_runs (id) on delete cascade,
  -- Nullable: a pattern can be cohort-level rather than tied to one learner
  -- (spec §5.2 "optionally identify cohort-level patterns").
  learner_id uuid references public.learners (id) on delete cascade,
  pattern_type text not null,
  title text not null,
  description text,
  supporting_signal_ids uuid[] not null default '{}',
  contradictory_evidence text,
  -- Do NOT force every learner into a pattern (spec §5.2) — 'unassigned'
  -- and 'needs_more_evidence' are first-class outcomes, not error states.
  assignment_status public.pattern_assignment_status not null default 'candidate',
  reason_for_assignment text,
  reason_for_uncertainty text,
  created_at timestamptz not null default now()
);

create index learner_patterns_processing_run_id_idx on public.learner_patterns (processing_run_id);
create index learner_patterns_learner_id_idx on public.learner_patterns (learner_id);

alter table public.learner_patterns enable row level security;

create policy "learner_patterns: staff can view"
  on public.learner_patterns for select
  to authenticated
  using (public.is_staff());

create policy "learner_patterns: staff can create"
  on public.learner_patterns for insert
  to authenticated
  with check (public.is_staff());

create policy "learner_patterns: staff can update"
  on public.learner_patterns for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());
