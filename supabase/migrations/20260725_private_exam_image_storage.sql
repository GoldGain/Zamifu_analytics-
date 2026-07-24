-- Private storage for teacher-uploaded exam images.
-- Existing school-files content remains untouched because it may serve unrelated legacy workflows.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'exam-assets',
  'exam-assets',
  false,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp'];

DROP POLICY IF EXISTS "exam_assets_read_for_school" ON storage.objects;
CREATE POLICY "exam_assets_read_for_school"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'exam-assets'
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.school_id::text = (storage.foldername(name))[2]
  )
);

DROP POLICY IF EXISTS "exam_assets_write_for_teacher" ON storage.objects;
CREATE POLICY "exam_assets_write_for_teacher"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'exam-assets'
  AND (storage.foldername(name))[1] = 'exam_images'
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.school_id::text = (storage.foldername(name))[2]
      AND p.role IN ('teacher', 'school_admin')
  )
);

DROP POLICY IF EXISTS "exam_assets_delete_for_teacher" ON storage.objects;
CREATE POLICY "exam_assets_delete_for_teacher"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'exam-assets'
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.school_id::text = (storage.foldername(name))[2]
      AND p.role IN ('teacher', 'school_admin')
  )
);
