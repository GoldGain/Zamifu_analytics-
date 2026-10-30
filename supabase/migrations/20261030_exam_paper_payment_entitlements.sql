create table if not exists public.exam_paper_payments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  purchased_by uuid not null references public.profiles(id) on delete cascade,
  paystack_reference text not null unique,
  amount_kes integer not null default 20 check (amount_kes = 20),
  currency text not null default 'KES' check (currency = 'KES'),
  status text not null default 'available' check (status in ('available', 'reserved', 'consumed')),
  generation_job_id uuid references public.exam_generation_jobs(id) on delete set null,
  paper_id uuid references public.exam_papers(id) on delete set null,
  verified_at timestamptz not null default now(),
  reserved_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists exam_paper_payments_owner_status_idx
  on public.exam_paper_payments (purchased_by, school_id, status);

alter table public.exam_paper_payments enable row level security;

drop policy if exists "Purchasers can read their exam paper payments" on public.exam_paper_payments;
create policy "Purchasers can read their exam paper payments"
  on public.exam_paper_payments for select to authenticated
  using (purchased_by = auth.uid());

drop policy if exists "School administrators can read school exam paper payments" on public.exam_paper_payments;
create policy "School administrators can read school exam paper payments"
  on public.exam_paper_payments for select to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.school_id = exam_paper_payments.school_id and p.role = 'school_admin'
  ));

create or replace function public.reserve_exam_paper_payment(
  p_reference text, p_user_id uuid, p_school_id uuid, p_job_id uuid
) returns boolean language plpgsql security definer set search_path = public as $$
begin
  update public.exam_paper_payments
     set status = 'reserved', generation_job_id = p_job_id,
         reserved_at = now(), updated_at = now()
   where paystack_reference = p_reference and purchased_by = p_user_id
     and school_id = p_school_id and status = 'available'
     and amount_kes = 20 and currency = 'KES';
  return found;
end;
$$;

create or replace function public.release_exam_paper_payment(
  p_reference text, p_user_id uuid, p_school_id uuid, p_job_id uuid
) returns boolean language plpgsql security definer set search_path = public as $$
begin
  update public.exam_paper_payments
     set status = 'available', generation_job_id = null,
         reserved_at = null, updated_at = now()
   where paystack_reference = p_reference and purchased_by = p_user_id
     and school_id = p_school_id and status = 'reserved'
     and generation_job_id = p_job_id and paper_id is null;
  return found;
end;
$$;

create or replace function public.consume_exam_paper_payment(
  p_reference text, p_user_id uuid, p_school_id uuid, p_job_id uuid, p_paper_id uuid
) returns boolean language plpgsql security definer set search_path = public as $$
begin
  update public.exam_paper_payments
     set status = 'consumed', paper_id = p_paper_id,
         consumed_at = now(), updated_at = now()
   where paystack_reference = p_reference and purchased_by = p_user_id
     and school_id = p_school_id and status = 'reserved'
     and generation_job_id = p_job_id;
  return found;
end;
$$;

revoke all on function public.reserve_exam_paper_payment(text, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.release_exam_paper_payment(text, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.consume_exam_paper_payment(text, uuid, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.reserve_exam_paper_payment(text, uuid, uuid, uuid) to service_role;
grant execute on function public.release_exam_paper_payment(text, uuid, uuid, uuid) to service_role;
grant execute on function public.consume_exam_paper_payment(text, uuid, uuid, uuid, uuid) to service_role;
