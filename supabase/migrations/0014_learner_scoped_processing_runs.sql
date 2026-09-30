-- On-demand, single-learner processing (spec extension, Sep 2026 meeting notes):
-- a processing run can now be scoped to one learner within one environment,
-- pulling from whatever datasets exist there, instead of always requiring
-- exactly one pre-selected dataset.

alter table public.processing_runs alter column dataset_id drop not null;

alter table public.processing_runs
  add column learner_id uuid references public.learners (id) on delete cascade;

alter table public.processing_runs
  add constraint processing_runs_scope_check
  check (dataset_id is not null or learner_id is not null);

create index processing_runs_learner_id_idx on public.processing_runs (learner_id);
