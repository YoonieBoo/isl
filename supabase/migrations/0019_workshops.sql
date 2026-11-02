-- Weekly workshops inside a course (Q4/2026): each week has its own topic and
-- skill list; uploaded form files belong to a week; every student gets their
-- own insights per week, on top of the overall course insights.
create table if not exists public.workshops (
  id uuid primary key default gen_random_uuid(),
  environment_id uuid not null references public.learning_environments (id) on delete cascade,
  week_number int not null,
  title text not null,
  workshop_date date,
  skill_framework jsonb,
  created_at timestamptz not null default now(),
  unique (environment_id, week_number)
);
alter table public.workshops enable row level security;
create policy "workshops: staff can view" on public.workshops for select to authenticated using (public.is_staff());
create policy "workshops: staff can create" on public.workshops for insert to authenticated with check (public.is_staff());
create policy "workshops: staff can update" on public.workshops for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "workshops: staff can delete" on public.workshops for delete to authenticated using (public.is_staff());

-- Which week an uploaded form file belongs to (null = not assigned to a week).
alter table public.datasets add column if not exists workshop_id uuid references public.workshops (id) on delete set null;

-- One set of weekly insights per student per workshop.
create table if not exists public.workshop_insights (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.learners (id) on delete cascade,
  workshop_id uuid not null references public.workshops (id) on delete cascade,
  skill_ratings jsonb,
  overview text,
  answer_count int not null default 0,
  updated_at timestamptz not null default now(),
  unique (learner_id, workshop_id)
);
alter table public.workshop_insights enable row level security;
create policy "workshop_insights: staff can view" on public.workshop_insights for select to authenticated using (public.is_staff());
create policy "workshop_insights: staff can create" on public.workshop_insights for insert to authenticated with check (public.is_staff());
create policy "workshop_insights: staff can update" on public.workshop_insights for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "workshop_insights: staff can delete" on public.workshop_insights for delete to authenticated using (public.is_staff());
