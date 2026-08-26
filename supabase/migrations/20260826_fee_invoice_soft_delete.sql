-- Safe School Admin invoice deletion: hide the invoice while preserving payment/audit history.
ALTER TABLE public.fee_invoices
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_fee_invoices_active_school
  ON public.fee_invoices (school_id, deleted_at);
