-- 15% referral programme: additive migration.
alter table public.profiles add column if not exists referral_code text;
create unique index if not exists profiles_referral_code_unique on public.profiles (upper(referral_code)) where referral_code is not null;

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referred_school_id uuid not null references public.schools(id) on delete cascade,
  referral_code text not null,
  status text not null default 'pending',
  payment_amount numeric(12,2),
  commission_amount numeric(12,2),
  created_at timestamptz not null default now(),
  converted_at timestamptz,
  constraint referrals_referred_school_unique unique (referred_school_id),
  constraint referrals_status_check check (status in ('pending','converted','cancelled'))
);
create table if not exists public.referral_wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  balance numeric(12,2) not null default 0 check (balance >= 0),
  total_earned numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.referral_commissions (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null references public.referrals(id) on delete cascade,
  payment_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  payment_amount numeric(12,2) not null,
  commission_amount numeric(12,2) not null,
  created_at timestamptz not null default now(),
  constraint referral_commissions_payment_unique unique (payment_id)
);
create table if not exists public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  phone_number text not null,
  status text not null default 'pending',
  mpesa_reference text,
  admin_note text,
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  processed_by uuid references public.profiles(id),
  constraint withdrawal_requests_status_check check (status in ('pending','paid','rejected'))
);
create index if not exists withdrawal_requests_status_idx on public.withdrawal_requests (status, requested_at desc);
create index if not exists referrals_referrer_idx on public.referrals (referrer_id);

create or replace function public.generate_referral_code() returns text language plpgsql as $fn$
declare candidate text;
begin
  loop
    candidate := 'ZM' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    exit when not exists (select 1 from public.profiles where upper(referral_code) = candidate);
  end loop;
  return candidate;
end $fn$;

create or replace function public.assign_referral_code(p_user_id uuid) returns text
language plpgsql security definer set search_path = public as $fn$
declare existing text;
begin
  select referral_code into existing from public.profiles where id = p_user_id;
  if existing is not null and existing <> '' then return existing; end if;
  update public.profiles set referral_code = public.generate_referral_code() where id = p_user_id and (referral_code is null or referral_code = '');
  select referral_code into existing from public.profiles where id = p_user_id;
  return existing;
end $fn$;

create or replace function public.set_profile_referral_code() returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  if (new.referral_code is null or new.referral_code = '') and new.role::text in ('school_admin','teacher','bursar') then
    new.referral_code := public.generate_referral_code();
  end if;
  return new;
end $fn$;
drop trigger if exists profiles_set_referral_code on public.profiles;
create trigger profiles_set_referral_code before insert on public.profiles for each row execute function public.set_profile_referral_code();

do $fn$
declare r record;
begin
  for r in select id from public.profiles where (referral_code is null or referral_code = '') and role::text in ('school_admin','teacher','bursar') loop
    perform public.assign_referral_code(r.id);
  end loop;
end $fn$;

create or replace function public.redeem_referral_code(p_code text, p_school_code text) returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare referrer uuid; referrer_school uuid; sch uuid; owner_id uuid;
begin
  if p_code is null or length(trim(p_code)) < 4 then return jsonb_build_object('ok', false, 'reason', 'invalid_code'); end if;
  select id, school_id into referrer, referrer_school from public.profiles where upper(referral_code) = upper(trim(p_code)) limit 1;
  if referrer is null then return jsonb_build_object('ok', false, 'reason', 'unknown_code'); end if;
  select id, owner_id into sch, owner_id from public.schools where code = p_school_code limit 1;
  if sch is null then return jsonb_build_object('ok', false, 'reason', 'unknown_school'); end if;
  if referrer_school = sch or owner_id = referrer then return jsonb_build_object('ok', false, 'reason', 'self_referral'); end if;
  insert into public.referrals (referrer_id, referred_school_id, referral_code) values (referrer, sch, upper(trim(p_code))) on conflict (referred_school_id) do nothing;
  return jsonb_build_object('ok', true);
exception when others then return jsonb_build_object('ok', false, 'reason', sqlerrm);
end $fn$;

create or replace function public.credit_referral_commission() returns trigger
language plpgsql security definer set search_path = public as $fn$
declare ref_row record; commission numeric(12,2);
begin
  if new.status is distinct from 'success' or new.school_id is null then return new; end if;
  select * into ref_row from public.referrals where referred_school_id = new.school_id limit 1;
  if ref_row.id is null or ref_row.status = 'cancelled' then return new; end if;
  if exists (select 1 from public.referral_commissions where payment_id = new.id) then return new; end if;
  commission := round(coalesce(new.amount, 0)::numeric * 0.15, 2);
  if commission <= 0 then return new; end if;
  insert into public.referral_commissions (referral_id, payment_id, user_id, payment_amount, commission_amount)
  values (ref_row.id, new.id, ref_row.referrer_id, coalesce(new.amount,0), commission) on conflict (payment_id) do nothing;
  if found then
    insert into public.referral_wallets (user_id, balance, total_earned) values (ref_row.referrer_id, commission, commission)
    on conflict (user_id) do update set balance = public.referral_wallets.balance + excluded.balance, total_earned = public.referral_wallets.total_earned + excluded.total_earned, updated_at = now();
    update public.referrals set status = 'converted', converted_at = coalesce(converted_at, now()), payment_amount = coalesce(new.amount, payment_amount), commission_amount = commission where id = ref_row.id;
  end if;
  return new;
end $fn$;
drop trigger if exists school_subscription_payments_referral on public.school_subscription_payments;
create trigger school_subscription_payments_referral after insert or update of status on public.school_subscription_payments for each row execute function public.credit_referral_commission();

create or replace function public.referral_dashboard() returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare uid uuid := auth.uid(); code text; bal numeric; earned numeric;
begin
  if uid is null then return jsonb_build_object('referral_code','','balance',0,'total_earned',0,'schools_referred',0,'converted',0,'withdrawals','[]'::jsonb,'recent_referrals','[]'::jsonb); end if;
  code := public.assign_referral_code(uid);
  select balance, total_earned into bal, earned from public.referral_wallets where user_id = uid;
  return jsonb_build_object(
    'referral_code', coalesce(code, ''), 'balance', coalesce(bal, 0), 'total_earned', coalesce(earned, 0),
    'schools_referred', (select count(*) from public.referrals where referrer_id = uid),
    'converted', (select count(*) from public.referrals where referrer_id = uid and status = 'converted'),
    'withdrawals', coalesce((select jsonb_agg(jsonb_build_object('id', w.id, 'amount', w.amount, 'phone_number', w.phone_number, 'status', w.status, 'requested_at', w.requested_at, 'processed_at', w.processed_at) order by w.requested_at desc) from public.withdrawal_requests w where w.user_id = uid), '[]'::jsonb),
    'recent_referrals', coalesce((select jsonb_agg(jsonb_build_object('school_name', s.name, 'status', r.status, 'commission_amount', r.commission_amount, 'created_at', r.created_at) order by r.created_at desc) from public.referrals r left join public.schools s on s.id = r.referred_school_id where r.referrer_id = uid), '[]'::jsonb)
  );
end $fn$;

create or replace function public.request_withdrawal(p_amount numeric, p_phone text) returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare uid uuid := auth.uid(); bal numeric; held numeric;
begin
  if uid is null then return jsonb_build_object('ok', false, 'reason', 'not_signed_in'); end if;
  if p_amount is null or p_amount <= 0 then return jsonb_build_object('ok', false, 'reason', 'invalid_amount'); end if;
  if p_phone is null or length(regexp_replace(p_phone, '\D', '', 'g')) < 9 then return jsonb_build_object('ok', false, 'reason', 'invalid_phone'); end if;
  insert into public.referral_wallets (user_id) values (uid) on conflict (user_id) do nothing;
  select balance into bal from public.referral_wallets where user_id = uid;
  select coalesce(sum(amount), 0) into held from public.withdrawal_requests where user_id = uid and status = 'pending';
  if round(p_amount, 2) > coalesce(bal, 0) - coalesce(held, 0) then return jsonb_build_object('ok', false, 'reason', 'insufficient_balance'); end if;
  insert into public.withdrawal_requests (user_id, amount, phone_number) values (uid, round(p_amount, 2), trim(p_phone));
  return jsonb_build_object('ok', true);
end $fn$;

create or replace function public.list_pending_withdrawals() returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare uid uuid := auth.uid();
begin
  if uid is null or not exists (select 1 from public.profiles where id = uid and role::text = 'reseller_super_admin') then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', w.id, 'user_name', coalesce(nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''), p.email, 'User'), 'user_email', p.email, 'phone_number', w.phone_number, 'amount', w.amount, 'requested_at', w.requested_at) order by w.requested_at)
    from public.withdrawal_requests w join public.profiles p on p.id = w.user_id where w.status = 'pending'
  ), '[]'::jsonb);
end $fn$;

create or replace function public.mark_withdrawal_paid(p_request_id uuid, p_reference text default null) returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare uid uuid := auth.uid(); req record; bal numeric;
begin
  if uid is null then return jsonb_build_object('ok', false, 'reason', 'not_signed_in'); end if;
  if not exists (select 1 from public.profiles where id = uid and role::text = 'reseller_super_admin') then return jsonb_build_object('ok', false, 'reason', 'not_allowed'); end if;
  select * into req from public.withdrawal_requests where id = p_request_id for update;
  if req.id is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if req.status <> 'pending' then return jsonb_build_object('ok', false, 'reason', 'not_pending'); end if;
  select balance into bal from public.referral_wallets where user_id = req.user_id for update;
  if coalesce(bal, 0) < req.amount then return jsonb_build_object('ok', false, 'reason', 'insufficient_balance'); end if;
  update public.referral_wallets set balance = balance - req.amount, updated_at = now() where user_id = req.user_id;
  update public.withdrawal_requests set status = 'paid', processed_at = now(), processed_by = uid, mpesa_reference = nullif(trim(coalesce(p_reference, '')), '') where id = req.id;
  return jsonb_build_object('ok', true);
end $fn$;

create or replace function public.reject_withdrawal(p_request_id uuid, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare uid uuid := auth.uid();
begin
  if uid is null or not exists (select 1 from public.profiles where id = uid and role::text = 'reseller_super_admin') then return jsonb_build_object('ok', false, 'reason', 'not_allowed'); end if;
  update public.withdrawal_requests set status = 'rejected', processed_at = now(), processed_by = uid, admin_note = p_note where id = p_request_id and status = 'pending';
  return jsonb_build_object('ok', found);
end $fn$;

alter table public.referrals enable row level security;
alter table public.referral_wallets enable row level security;
alter table public.withdrawal_requests enable row level security;
alter table public.referral_commissions enable row level security;
drop policy if exists referrals_owner_select on public.referrals;
create policy referrals_owner_select on public.referrals for select to authenticated using (referrer_id = auth.uid());
drop policy if exists referral_wallets_owner_select on public.referral_wallets;
create policy referral_wallets_owner_select on public.referral_wallets for select to authenticated using (user_id = auth.uid());
drop policy if exists withdrawal_requests_owner_select on public.withdrawal_requests;
create policy withdrawal_requests_owner_select on public.withdrawal_requests for select to authenticated using (user_id = auth.uid());
drop policy if exists referral_commissions_owner_select on public.referral_commissions;
create policy referral_commissions_owner_select on public.referral_commissions for select to authenticated using (user_id = auth.uid());
grant execute on function public.redeem_referral_code(text, text) to anon, authenticated;
grant execute on function public.referral_dashboard() to authenticated;
grant execute on function public.request_withdrawal(numeric, text) to authenticated;
grant execute on function public.list_pending_withdrawals() to authenticated;
grant execute on function public.mark_withdrawal_paid(uuid, text) to authenticated;
grant execute on function public.reject_withdrawal(uuid, text) to authenticated;
