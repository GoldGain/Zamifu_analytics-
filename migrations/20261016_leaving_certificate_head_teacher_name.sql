alter table public.leaving_certificates
  add column if not exists head_teacher_name text;
