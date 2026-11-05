-- One class summary per week (Most improved / Common gap / Teacher action,
-- plus the per-skill counts it was written from). Rebuilt after the week's
-- students are updated.
alter table public.workshops add column if not exists class_summary jsonb;
