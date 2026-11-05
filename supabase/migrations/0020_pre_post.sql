-- Pre / Post per week (Q4/2026 workflow): each weekly form file is marked as
-- the Pre form (before class), the Post form (after class, e.g. the Learning
-- Reflection) or Other (e.g. team workshop submissions). Weekly insights rate
-- Pre and Post separately so teachers can see what changed.
alter table public.datasets add column if not exists form_stage text
  check (form_stage in ('pre', 'post', 'other'));

-- Files already in a week: guess from the file name.
update public.datasets
set form_stage = case
  when name ~* 'pre[- _]?(workshop|class)' then 'pre'
  when name ~* 'reflection|post[- _]?(workshop|class)' then 'post'
  else 'other'
end
where workshop_id is not null and form_stage is null;

-- What students should learn that week; given to the AI with the week's skills.
alter table public.workshops add column if not exists learning_objectives text;

-- The week's ratings from the Pre form and from the Post form, side by side.
alter table public.workshop_insights add column if not exists pre_ratings jsonb;
alter table public.workshop_insights add column if not exists post_ratings jsonb;
