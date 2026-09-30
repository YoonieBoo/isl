-- Phase 7: Learner signals + evidence traceability (spec §5.1, §15).

create type public.signal_type as enum ('strength', 'need', 'concern', 'preference', 'activity_behaviour');

create table public.learner_signals (
  id uuid primary key default gen_random_uuid(),
  processing_result_id uuid not null references public.processing_results (id) on delete cascade,
  learner_id uuid not null references public.learners (id) on delete cascade,
  signal_type public.signal_type not null,
  label text not null,
  normalized_label text not null,
  evidence_text text not null,
  source_field text,
  interpretation_note text,
  created_at timestamptz not null default now()
);

create index learner_signals_processing_result_id_idx on public.learner_signals (processing_result_id);
create index learner_signals_learner_id_idx on public.learner_signals (learner_id);

alter table public.learner_signals enable row level security;

create policy "learner_signals: staff can view"
  on public.learner_signals for select
  to authenticated
  using (public.is_staff());

create policy "learner_signals: staff can create"
  on public.learner_signals for insert
  to authenticated
  with check (public.is_staff());
