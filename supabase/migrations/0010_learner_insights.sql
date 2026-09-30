-- Phase 10: Approved learner insight (spec §7, §15).

create type public.insight_status as enum ('candidate', 'under_review', 'revised', 'approved', 'rejected');

create table public.learner_insights (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.learners (id) on delete cascade,
  environment_id uuid not null references public.learning_environments (id) on delete cascade,
  processing_run_id uuid references public.processing_runs (id) on delete set null,
  insight_type text not null default 'individual',
  title text not null,
  summary text not null,
  -- Kept as separate fields, not one narrative blob, so Fact → Signal →
  -- Interpretation → Recommendation stay distinguishable (spec §7).
  observed_strengths text[] not null default '{}',
  development_needs text[] not null default '{}',
  learning_preferences text[] not null default '{}',
  concerns text[] not null default '{}',
  interpretation_boundary text,
  status public.insight_status not null default 'candidate',
  -- The AI-generated candidate content lives here; approved_output is a
  -- separate column populated only on approval, so "what the AI said" and
  -- "what was approved" never collapse into a single mutated field.
  approved_output jsonb,
  approved_by uuid references public.profiles (id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index learner_insights_learner_id_idx on public.learner_insights (learner_id);
create index learner_insights_environment_id_idx on public.learner_insights (environment_id);

create trigger set_learner_insights_updated_at
  before update on public.learner_insights
  for each row execute function public.set_updated_at();

alter table public.learner_insights enable row level security;

create policy "learner_insights: staff can view"
  on public.learner_insights for select
  to authenticated
  using (public.is_staff());

create policy "learner_insights: learner can view own approved insights"
  on public.learner_insights for select
  to authenticated
  using (
    status = 'approved'
    and learner_id in (select id from public.learners where user_id = auth.uid())
  );

create policy "learner_insights: staff can create"
  on public.learner_insights for insert
  to authenticated
  with check (public.is_staff());

create policy "learner_insights: staff can update"
  on public.learner_insights for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create table public.insight_evidence (
  id uuid primary key default gen_random_uuid(),
  learner_insight_id uuid not null references public.learner_insights (id) on delete cascade,
  dataset_record_id uuid references public.dataset_records (id) on delete set null,
  learner_signal_id uuid references public.learner_signals (id) on delete set null,
  evidence_text text not null,
  created_at timestamptz not null default now()
);

create index insight_evidence_learner_insight_id_idx on public.insight_evidence (learner_insight_id);

alter table public.insight_evidence enable row level security;

create policy "insight_evidence: staff can view"
  on public.insight_evidence for select
  to authenticated
  using (public.is_staff());

create policy "insight_evidence: learner can view own approved insight evidence"
  on public.insight_evidence for select
  to authenticated
  using (
    learner_insight_id in (
      select id from public.learner_insights
      where status = 'approved'
        and learner_id in (select id from public.learners where user_id = auth.uid())
    )
  );

create policy "insight_evidence: staff can create"
  on public.insight_evidence for insert
  to authenticated
  with check (public.is_staff());
