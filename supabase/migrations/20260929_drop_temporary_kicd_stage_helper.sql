-- The one-time staging helper is no longer needed after all 30 catalogs were staged and activated.
-- Keep this cleanup in migration history so the public schema does not retain a maintenance-only RPC.
DROP FUNCTION IF EXISTS public.stage_junior_kicd_catalog(jsonb);
