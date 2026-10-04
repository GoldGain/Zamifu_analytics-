-- Add the school-scoped bursar role without assuming the enum exists.
-- This migration is intentionally not applied to any live database by this task.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'user_role'
      AND t.typtype = 'e'
  ) THEN
    EXECUTE 'ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS ''bursar''';
  END IF;
END $$;
