-- Phase 2: Learning Environment persistence (spec §4.1, §15).

create type public.learning_environment_status as enum ('active', 'archived');

create table public.learning_environments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  organisation_name text not null,
  environment_type text not null,
  course_or_workshop text not null,
  description text,
  learning_objectives text,
  status public.learning_environment_status not null default 'active',
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.learning_environments.environment_type is 'Free text, e.g. "university course", "professional upskilling program", "developmental exploration workshop" — deliberately not a closed enum per the spec examples.';

create trigger set_learning_environments_updated_at
  before update on public.learning_environments
  for each row execute function public.set_updated_at();

alter table public.learning_environments enable row level security;

-- Single shared workspace: any staff role can manage any environment.
-- Archival (soft delete) happens via `status`, never a hard DELETE — no
-- delete policy is defined, so RLS blocks it by default even for staff.
create policy "learning_environments: staff can view"
  on public.learning_environments for select
  to authenticated
  using (public.is_staff());

create policy "learning_environments: staff can create"
  on public.learning_environments for insert
  to authenticated
  with check (public.is_staff() and created_by = auth.uid());

create policy "learning_environments: staff can update"
  on public.learning_environments for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());
