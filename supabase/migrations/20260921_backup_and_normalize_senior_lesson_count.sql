-- Back up senior timetable configuration before normalizing the seven-lesson rows.
-- Applied to the CBC system Supabase project on 2026-09-21.
CREATE TABLE IF NOT EXISTS public.timetable_level_configs_backup_20260921 AS
SELECT * FROM public.timetable_level_configs WHERE false;

INSERT INTO public.timetable_level_configs_backup_20260921
SELECT tlc.*
FROM public.timetable_level_configs AS tlc
WHERE tlc.level_group = 'senior'
  AND NOT EXISTS (
    SELECT 1
    FROM public.timetable_level_configs_backup_20260921 AS backup
    WHERE backup.id = tlc.id
  );

UPDATE public.timetable_level_configs
SET lessons_per_day = 8,
    after_lunch_lessons = 2,
    updated_at = now()
WHERE level_group = 'senior'
  AND lessons_per_day = 7;
