-- Fix profile and learner photo upload/update permissions.
-- Paths used by the app: avatars/{role-folder}/{profile-id}.ext and
-- student-photos/students/{student-id}.ext.

DROP POLICY IF EXISTS "Authenticated upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload student-photos" ON storage.objects;
DROP POLICY IF EXISTS "avatars_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "avatars_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "avatars_owner_delete" ON storage.objects;
DROP POLICY IF EXISTS "student_photos_staff_insert" ON storage.objects;
DROP POLICY IF EXISTS "student_photos_staff_update" ON storage.objects;
DROP POLICY IF EXISTS "student_photos_staff_delete" ON storage.objects;

CREATE POLICY avatars_owner_insert ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'avatars'
  AND auth.role() = 'authenticated'
  AND split_part((storage.foldername(name))[2], '.', 1) = auth.uid()::text
  AND (storage.foldername(name))[1] IN ('teachers', 'school-admins', 'parents')
);

CREATE POLICY avatars_owner_update ON storage.objects
FOR UPDATE USING (
  bucket_id = 'avatars'
  AND auth.role() = 'authenticated'
  AND split_part((storage.foldername(name))[2], '.', 1) = auth.uid()::text
) WITH CHECK (
  bucket_id = 'avatars'
  AND auth.role() = 'authenticated'
  AND split_part((storage.foldername(name))[2], '.', 1) = auth.uid()::text
);

CREATE POLICY avatars_owner_delete ON storage.objects
FOR DELETE USING (
  bucket_id = 'avatars'
  AND auth.role() = 'authenticated'
  AND split_part((storage.foldername(name))[2], '.', 1) = auth.uid()::text
);

CREATE POLICY student_photos_staff_insert ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'student-photos'
  AND auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1
    FROM public.students s
    JOIN public.profiles p ON p.school_id = s.school_id
    WHERE s.id::text = split_part((storage.foldername(name))[2], '.', 1)
      AND p.id = auth.uid()
      AND p.role IN ('school_admin'::user_role, 'teacher'::user_role)
  )
);

CREATE POLICY student_photos_staff_update ON storage.objects
FOR UPDATE USING (
  bucket_id = 'student-photos'
  AND auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1
    FROM public.students s
    JOIN public.profiles p ON p.school_id = s.school_id
    WHERE s.id::text = split_part((storage.foldername(name))[2], '.', 1)
      AND p.id = auth.uid()
      AND p.role IN ('school_admin'::user_role, 'teacher'::user_role)
  )
) WITH CHECK (
  bucket_id = 'student-photos'
  AND auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1
    FROM public.students s
    JOIN public.profiles p ON p.school_id = s.school_id
    WHERE s.id::text = split_part((storage.foldername(name))[2], '.', 1)
      AND p.id = auth.uid()
      AND p.role IN ('school_admin'::user_role, 'teacher'::user_role)
  )
);

CREATE POLICY student_photos_staff_delete ON storage.objects
FOR DELETE USING (
  bucket_id = 'student-photos'
  AND auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1
    FROM public.students s
    JOIN public.profiles p ON p.school_id = s.school_id
    WHERE s.id::text = split_part((storage.foldername(name))[2], '.', 1)
      AND p.id = auth.uid()
      AND p.role IN ('school_admin'::user_role, 'teacher'::user_role)
  )
);
