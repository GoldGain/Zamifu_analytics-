-- Securely delete an archived learner and the linked Auth user in one transaction.
-- The function validates the caller's school-admin scope before touching auth.users.
create or replace function public.permanently_delete_school_user(
  p_record_id uuid,
  p_target_type text,
  p_school_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_caller_school_id uuid;
  v_caller_role text;
  v_profile_id uuid;
  v_deleted_record boolean := false;
begin
  select p.school_id, p.role
    into v_caller_school_id, v_caller_role
  from public.profiles p
  where p.id = auth.uid();

  if auth.uid() is null or v_caller_role not in ('school_admin', 'super_admin', 'master_super_admin') then
    raise exception 'Only an authorized administrator can permanently delete accounts';
  end if;

  if v_caller_role = 'school_admin' and v_caller_school_id is distinct from p_school_id then
    raise exception 'Account deletion is restricted to the administrator''s school';
  end if;

  if lower(coalesce(p_target_type, '')) not in ('student', 'learner') then
    raise exception 'This function only deletes learner accounts';
  end if;

  select s.profile_id into v_profile_id
  from public.students s
  where s.id = p_record_id
    and s.school_id = p_school_id
    and s.is_active = false;

  if not found then
    raise exception 'Archived learner was not found in the requested school';
  end if;

  delete from public.students where id = p_record_id and school_id = p_school_id;
  v_deleted_record := found;

  if v_profile_id is not null then
    delete from auth.users where id = v_profile_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'target_type', 'student',
    'deleted_record', v_deleted_record,
    'deleted_auth_account', v_profile_id is not null
  );
end;
$$;

revoke all on function public.permanently_delete_school_user(uuid, text, uuid) from public;
grant execute on function public.permanently_delete_school_user(uuid, text, uuid) to authenticated;

comment on function public.permanently_delete_school_user(uuid, text, uuid)
is 'Permanently deletes an archived learner and linked Auth account after school-admin scope validation.';

-- Keep the archived-only invariant enforced at the database boundary.
create or replace function public.prevent_active_learner_permanent_delete()
returns trigger
language plpgsql
as $$
begin
  if old.is_active is distinct from false then
    raise exception 'Only archived learners can be permanently deleted';
  end if;
  return old;
end;
$$;

drop trigger if exists students_archived_delete_guard on public.students;
create trigger students_archived_delete_guard
before delete on public.students
for each row execute function public.prevent_active_learner_permanent_delete();

-- New five-plan catalog used by the Free Trial Countdown page.
alter table if exists public.schools
  add column if not exists subscription_plan_id text;

alter table if exists public.schools
  add column if not exists subscription_features jsonb not null default '{}'::jsonb;

create table if not exists public.subscription_plan_catalog (
  id text primary key,
  name text not null,
  price_kes integer not null check (price_kes >= 0),
  billing_unit text not null check (billing_unit in ('learner', 'school')),
  billing_period text not null default 'term' check (billing_period = 'term'),
  feature_summary text not null,
  includes_sms boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.subscription_plan_catalog (id, name, price_kes, billing_unit, billing_period, feature_summary, includes_sms)
values
  ('full_access_20', 'Full Access (Per Learner)', 20, 'learner', 'term', 'Full access to all features', true),
  ('full_access_50', 'Full Access (Per Learner)', 50, 'learner', 'annual', 'Full access to all features', true),
  ('results_only', 'Results Access Only', 1000, 'school', 'term', 'Results access only; SMS at KES 1 each', false),
  ('timetabler_only', 'Timetabler Access Only', 500, 'school', 'term', 'Timetable generation only', false),
  ('generator_only', 'Generator Access Only', 500, 'school', 'term', 'Exam Generator + Scheme of Work + Notes + Lesson Plan', false)
on conflict (id) do update set
  name = excluded.name,
  price_kes = excluded.price_kes,
  billing_unit = excluded.billing_unit,
  billing_period = excluded.billing_period,
  feature_summary = excluded.feature_summary,
  includes_sms = excluded.includes_sms,
  updated_at = now();

alter table public.subscription_plan_catalog enable row level security;
drop policy if exists subscription_plan_catalog_read on public.subscription_plan_catalog;
create policy subscription_plan_catalog_read on public.subscription_plan_catalog
for select to authenticated using (is_active = true);

create index if not exists students_school_active_admission_idx
  on public.students (school_id, is_active, admission_number);
