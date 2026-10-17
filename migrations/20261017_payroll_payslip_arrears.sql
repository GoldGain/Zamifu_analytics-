-- Zamifu Analytics - 2026-10-17
-- Issue 3: payslip detail and arrears / partial payments. Additive only.
-- Applied to project naihzzlszvrkxrxogsuz via the Supabase management API.
BEGIN;
ALTER TABLE public.payroll_lines ADD COLUMN IF NOT EXISTS paid_amount numeric NOT NULL DEFAULT 0;
ALTER TABLE public.payroll_lines ADD COLUMN IF NOT EXISTS arrears numeric NOT NULL DEFAULT 0;
ALTER TABLE public.payroll_lines ADD COLUMN IF NOT EXISTS opening_arrears numeric NOT NULL DEFAULT 0;
COMMIT;

-- payroll_mark_paid: fifth parameter p_amount_paid. Records what was actually
-- paid and stores the shortfall as arrears (net_pay - paid_amount).
-- (Full body applied in the live database; see commit message for the diff.)

-- payroll_guard_line: paid_amount and arrears join the allowed payment columns
-- so a pending->paid recording can carry the amount without breaking the
-- snapshot immutability guard.
-- payroll_build_draft: after rebuilding lines it sets
--   opening_arrears = sum(arrears of earlier confirmed runs for that staff),
-- carrying the shortfall into the next month's payroll.
