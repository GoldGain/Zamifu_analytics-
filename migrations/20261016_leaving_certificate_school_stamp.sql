alter table public.leaving_certificates
  add column if not exists school_stamp_url text,
  add column if not exists school_stamp_type text;
