-- A multi-file dataset upload validates each file's learner matches in a
-- separate background task (see uploadDatasets' after() calls), and those
-- tasks run concurrently. Concurrent check-then-insert on external_reference
-- raced and created dozens of duplicate learner rows for the same student
-- (see scripts/_tmp_merge_dupes.mjs, run 2026-09-11, which cleaned up 230
-- duplicates across 7 students). This constraint makes that class of bug
-- structurally impossible — the application now upserts against it
-- atomically instead of racing on a read-then-write check.
create unique index learners_external_reference_unique_idx
  on public.learners (external_reference)
  where external_reference is not null;
