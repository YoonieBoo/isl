-- Role separation (feedback, Oct 2026): sign-up no longer lets people pick a
-- role. Everyone who signs up becomes an educator, and nobody can change
-- their own role — only an admin (or the Supabase SQL editor) can.
alter table public.profiles alter column role set default 'educator';

create or replace function public.prevent_role_self_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- auth.uid() is null in the Supabase SQL editor / service role: allowed.
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Only an admin can change user roles.';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_role_self_change on public.profiles;
create trigger prevent_role_self_change
  before update on public.profiles
  for each row execute function public.prevent_role_self_change();
