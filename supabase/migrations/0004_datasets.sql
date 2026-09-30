-- Phase 4: Dataset upload, parsing, storage, validation (spec §4.3, §15).

create type public.validation_status as enum ('pending', 'valid', 'valid_with_warnings', 'invalid');

create table public.datasets (
  id uuid primary key default gen_random_uuid(),
  environment_id uuid not null references public.learning_environments (id) on delete cascade,
  name text not null,
  original_file_name text not null,
  -- Path within the private 'datasets' Storage bucket (set up below),
  -- e.g. "<environment_id>/<dataset_id>/<original_file_name>".
  storage_reference text not null,
  record_count integer not null default 0,
  validation_status public.validation_status not null default 'pending',
  validation_summary jsonb not null default '{}'::jsonb,
  uploaded_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

comment on column public.datasets.validation_summary is 'Structured detection results per spec §4.3: missing learner IDs, duplicate IDs, empty records, required fields, inconsistent column structures, unusable rows.';

alter table public.datasets enable row level security;

create policy "datasets: staff can view"
  on public.datasets for select
  to authenticated
  using (public.is_staff());

create policy "datasets: staff can create"
  on public.datasets for insert
  to authenticated
  with check (public.is_staff() and uploaded_by = auth.uid());

create policy "datasets: staff can update"
  on public.datasets for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create table public.dataset_records (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.datasets (id) on delete cascade,
  -- Nullable: a row can fail learner-ID mapping and still be persisted so
  -- the validation screen can show *which* rows are unmapped, rather than
  -- silently dropping them (spec §4.3 "System must detect: missing learner IDs").
  learner_id uuid references public.learners (id) on delete set null,
  source_record_id text,
  source_data jsonb not null,
  validation_status public.validation_status not null default 'pending',
  validation_notes text,
  created_at timestamptz not null default now()
);

create index dataset_records_dataset_id_idx on public.dataset_records (dataset_id);
create index dataset_records_learner_id_idx on public.dataset_records (learner_id);

alter table public.dataset_records enable row level security;

create policy "dataset_records: staff can view"
  on public.dataset_records for select
  to authenticated
  using (public.is_staff());

create policy "dataset_records: staff can create"
  on public.dataset_records for insert
  to authenticated
  with check (public.is_staff());

create policy "dataset_records: staff can update"
  on public.dataset_records for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Private Storage bucket for original dataset files (spec §17: file/object
-- storage must preserve source datasets). Not public — access goes through
-- RLS on storage.objects below, gated on the same is_staff() check.
insert into storage.buckets (id, name, public)
values ('datasets', 'datasets', false)
on conflict (id) do nothing;

create policy "datasets bucket: staff can read"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'datasets' and public.is_staff());

create policy "datasets bucket: staff can upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'datasets' and public.is_staff());
