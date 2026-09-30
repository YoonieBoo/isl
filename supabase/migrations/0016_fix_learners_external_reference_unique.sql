-- 0015's partial unique index (`where external_reference is not null`)
-- can't be used as an ON CONFLICT inference target by a plain
-- `on_conflict=external_reference` upsert — Postgres only infers partial
-- indexes when the conflict clause repeats the same WHERE predicate, which
-- PostgREST's upsert API has no way to express. This silently broke every
-- new-student upsert with "42P10: no unique or exclusion constraint
-- matching the ON CONFLICT specification" (caught and swallowed by the
-- background validation task, so datasets just sat "pending" forever).
-- A plain (non-partial) unique constraint already allows unlimited NULLs
-- in standard Postgres semantics, so there's no need for the partial
-- predicate at all.
drop index if exists public.learners_external_reference_unique_idx;

alter table public.learners
  add constraint learners_external_reference_key unique (external_reference);
