-- Stroked subjects: learning areas taught to every stream of a level in one shared period.
create table if not exists public.timetable_stroked_subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  level_group text not null,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, level_group, subject_id)
);
alter table public.timetable_stroked_subjects enable row level security;
drop policy if exists timetable_stroked_subjects_school on public.timetable_stroked_subjects;
create policy timetable_stroked_subjects_school on public.timetable_stroked_subjects
  for all to authenticated
  using (school_id = public.auth_school_id())
  with check (school_id = public.auth_school_id());
grant select, insert, update, delete on public.timetable_stroked_subjects to authenticated;
