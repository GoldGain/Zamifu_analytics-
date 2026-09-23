-- Preserve the source exams and configured weights used to build a combined exam.
-- This is additive; existing combined exams remain readable through the equal-weight
-- legacy fallback until their source metadata is saved again.
create table if not exists public.school_exam_components (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  combined_exam_id uuid not null references public.school_exams(id) on delete cascade,
  source_exam_id uuid not null references public.school_exams(id) on delete restrict,
  weight numeric(8,4) not null default 1 check (weight > 0),
  component_order integer not null default 0,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint school_exam_components_not_self check (combined_exam_id <> source_exam_id),
  constraint school_exam_components_unique_source unique (combined_exam_id, source_exam_id)
);

create index if not exists school_exam_components_combined_idx
  on public.school_exam_components (school_id, combined_exam_id, component_order);

alter table public.school_exam_components enable row level security;

drop policy if exists school_exam_components_select on public.school_exam_components;
create policy school_exam_components_select on public.school_exam_components
  for select using (public.can_access_school(school_id));

drop policy if exists school_exam_components_insert on public.school_exam_components;
create policy school_exam_components_insert on public.school_exam_components
  for insert with check (
    public.can_access_school(school_id)
    and public.current_profile_role() in ('school_admin'::public.user_role, 'super_admin'::public.user_role)
  );

drop policy if exists school_exam_components_update on public.school_exam_components;
create policy school_exam_components_update on public.school_exam_components
  for update using (
    public.can_access_school(school_id)
    and public.current_profile_role() in ('school_admin'::public.user_role, 'super_admin'::public.user_role)
  ) with check (
    public.can_access_school(school_id)
    and public.current_profile_role() in ('school_admin'::public.user_role, 'super_admin'::public.user_role)
  );

drop policy if exists school_exam_components_delete on public.school_exam_components;
create policy school_exam_components_delete on public.school_exam_components
  for delete using (
    public.can_access_school(school_id)
    and public.current_profile_role() in ('school_admin'::public.user_role, 'super_admin'::public.user_role)
  );

comment on table public.school_exam_components is
  'Source exams and positive weights used to calculate a combined assessment.';
