-- Q4/2026: each course's fixed skill list is entered on the course page
-- instead of being written into the code, so a new course (e.g. DDI1321,
-- NUR2105) can be rated as soon as its skills are typed in.
-- Shape: [{ "key": "ai_fit_judgment", "name": "AI-fit judgment", "description": "..." }, ...]
alter table public.learning_environments
  add column if not exists skill_framework jsonb;

comment on column public.learning_environments.skill_framework is
  'Fixed skill list every learner in this course is rated on. Null = use the built-in list for known course codes (DDI1311/DDI2331/DDI2332), if any.';
