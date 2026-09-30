-- Phase 14: Run / Review History — activity log (spec §15).
-- Populated by server actions alongside their primary write (e.g. creating
-- a learning environment also inserts one activity_log row), not by
-- database triggers — keeps the summary text human-authored and specific.

create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  actor uuid not null references public.profiles (id),
  action_type text not null,
  target_type text not null,
  target_id uuid not null,
  summary text not null,
  created_at timestamptz not null default now()
);

create index activity_log_target_idx on public.activity_log (target_type, target_id);
create index activity_log_created_at_idx on public.activity_log (created_at desc);

alter table public.activity_log enable row level security;

create policy "activity_log: staff can view"
  on public.activity_log for select
  to authenticated
  using (public.is_staff());

create policy "activity_log: staff can create"
  on public.activity_log for insert
  to authenticated
  with check (public.is_staff() and actor = auth.uid());
