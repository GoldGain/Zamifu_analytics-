# Zamifu Analytics report and librarian update plan

## Scope and required behavior
- Correct the single-class PDF Performance Distribution so it classifies the exact same learner summaries with the same school grading function as Top 10 Performers; make the displayed primary thresholds match the canonical Primary CBE scale (EE 76–100%, ME 51–75%, AE 26–50%, BE 0–25%).
- Add a learner-level deviation column to the single-class Class Summary learner table, using the same prior published assessment and metric conventions as the All-Streams summary; show an em dash when no prior published assessment is available.
- Add a `librarian` staff role that a school admin can create, reset access for, and deactivate; route librarian sign-ins to the existing Library workspace only. Keep the current school-admin Library route and access intact. Restrict librarian data access to the associated school's Library tables with RLS; do not expand the shared `can_access_school` helper to other tables. Restrict school-admin provisioning to that admin's school and prevent metadata from overriding the assigned role/school.

## Implementation approach
Reuse `src/pages/dashboard/school-admin/Results.tsx`'s existing `buildStudentSummary`, `overallGradeWithBand`, and `fetchPreviousAssessment` logic. Extend `supabase/migrations` with an idempotent `user_role` enum addition and a Library-only school-scope helper/policy update for `library_books` and `library_borrowings`. Update `src/types/database.ts`, `src/pages/auth/Login.tsx`, `src/App.tsx`, and `src/components/layout/DashboardLayout.tsx` for the new role, protected route, billing lock, and minimal navigation. Add a school-admin Librarians management page modeled on `Bursars.tsx`, with a generated one-time password and reversible account deactivation. Extend and production-deploy the `create-user` and `delete-user` Supabase Edge Functions. Deploy the web source by publishing its commit to the Vercel-linked `GoldGain/Zamifu_analytics-` `main` branch.

## Existing project structure and responsibilities
- `src/pages/dashboard/school-admin/Results.tsx`: reports, class summaries, and PDF generation.
- `src/pages/dashboard/school-admin/Library.tsx`: existing school Library workspace to retain and expose to librarians.
- `src/pages/dashboard/school-admin/Bursars.tsx`: existing school-admin-managed staff pattern for list/create/reset/revoke.
- `src/pages/auth/Login.tsx`, `src/App.tsx`, `src/components/layout/DashboardLayout.tsx`, `src/types/database.ts`: role recognition, redirects, protected routes, navigation, and client role types.
- `supabase/migrations`: production role enum and RLS changes.
- `supabase/functions/create-user` and `supabase/functions/delete-user`: server-side account provisioning and revocation.

## Design decisions
Reuse the existing Zamifu school-admin dashboard style and Library page rather than introducing a new visual system. The librarian receives a small Library-only navigation, while the school admin retains the Library route and gains a separate Librarians account-management entry. Credentials are randomly generated for each new librarian rather than reusing the bursar's static default password.
