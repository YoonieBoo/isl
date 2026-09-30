-- Phase 9: Human review (spec §5.3, §8, §15).

create type public.review_decision as enum (
  'agree', 'revise', 'reject', 'unsure', 'needs_more_evidence', 'request_rerun'
);

-- Error categorisation captured "where applicable" during Module C
-- validation (spec §5.3) — a review can tag more than one, hence the array.
create type public.error_category as enum (
  'false_positive', 'false_negative', 'over_interpretation', 'missing_signal',
  'normalization_error', 'taxonomy_mismatch', 'pattern_mismatch', 'insufficient_evidence'
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  processing_result_id uuid not null references public.processing_results (id) on delete cascade,
  learner_id uuid references public.learners (id) on delete set null,
  reviewer_id uuid not null references public.profiles (id),
  decision public.review_decision not null,
  -- Original AI output lives on processing_results.structured_output and is
  -- never overwritten — corrected_output is a separate column so both stay
  -- distinguishable (spec §2.3, §8: "Approved output must remain separate
  -- from original AI output").
  corrected_output jsonb,
  error_categories public.error_category[] not null default '{}',
  review_notes text,
  reviewed_at timestamptz not null default now()
);

create index reviews_processing_result_id_idx on public.reviews (processing_result_id);

alter table public.reviews enable row level security;

create policy "reviews: staff can view"
  on public.reviews for select
  to authenticated
  using (public.is_staff());

create policy "reviews: staff can create"
  on public.reviews for insert
  to authenticated
  with check (public.is_staff() and reviewer_id = auth.uid());
