-- What the AI read from a week's slides / workshop materials: the files used,
-- key concepts, what a good answer shows, and its suggested objectives and
-- skills (which the teacher confirms before they are used).
alter table public.workshops add column if not exists learning_context jsonb;
