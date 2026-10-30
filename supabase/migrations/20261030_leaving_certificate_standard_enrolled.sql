alter table public.leaving_certificates
  add column if not exists standard_enrolled integer;

alter table public.leaving_certificates
  drop constraint if exists leaving_certificates_standard_enrolled_check;

alter table public.leaving_certificates
  add constraint leaving_certificates_standard_enrolled_check
  check (standard_enrolled is null or standard_enrolled between 1 and 12);
