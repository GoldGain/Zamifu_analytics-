import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const includes = (relativePath: string, fragment: string) => read(relativePath).includes(fragment);

// Pricing defaults must be consistent in shared code, reseller UI, and legacy migration SQL.
assert.equal(includes('src/lib/reseller.ts', 'DEFAULT_FEE_PER_LEARNER = 20'), true);
assert.equal(includes('src/lib/reseller.ts', 'DEFAULT_ANNUAL_FEE_PER_LEARNER = 50'), true);
assert.equal(includes('src/pages/dashboard/reseller-admin/Pricing.tsx', 'DEFAULT_ANNUAL_FEE_PER_LEARNER);'), true);
assert.equal(includes('src/pages/dashboard/reseller-admin/Pricing.tsx', 'value * 3'), false);
assert.equal(includes('src/pages/dashboard/reseller-admin/Schools.tsx', 'fee_per_learner_per_term: DEFAULT_FEE_PER_LEARNER'), true);
assert.equal(includes('src/pages/dashboard/reseller-admin/Schools.tsx', 'fee_per_learner_per_year: DEFAULT_ANNUAL_FEE_PER_LEARNER'), true);
assert.equal(includes('RESELLER_PORTAL_MIGRATION.sql', 'fee_per_learner_per_term INTEGER DEFAULT 20'), true);
assert.equal(includes('RESELLER_PORTAL_MIGRATION.sql', 'fee_per_learner INTEGER DEFAULT 20'), true);
assert.equal(includes('supabase/migrations/20260826_normalize_subscription_pricing_defaults.sql', 'ALTER COLUMN fee_per_learner_per_year SET DEFAULT 50'), true);

// Bulk templates accept assessment_number and retain admission-number compatibility.
assert.equal(includes('src/pages/dashboard/school-admin/BulkStudentImport.tsx', "'assessment_number', 'admission_number'"), true);
assert.equal(includes('src/pages/dashboard/school-admin/BulkStudentImport.tsx', 'row.assessment_number?.trim() || row.admission_number?.trim()'), true);
assert.equal(includes('src/pages/dashboard/school-admin/BulkStudentImport.tsx', 'metadata: { assessment_number:'), true);

// Learner attendance writes are restricted to class teachers at the database and UI layers.
const attendanceMigration = read('supabase/migrations/20260826_teacher_attendance_and_class_teacher_attendance.sql');
assert.match(attendanceMigration, /can_mark_class_attendance\(school_id, class_id\)/);
assert.match(attendanceMigration, /attendance_class_teacher_insert/);
assert.match(attendanceMigration, /current_profile_role\(\) IN \('school_admin'::user_role, 'super_admin'::user_role\)/);
assert.equal(includes('src/pages/dashboard/teacher/Attendance.tsx', 'classRow.class_teacher_id === user.id'), true);
assert.equal(includes('src/pages/dashboard/teacher/Attendance.tsx', 'assigned_class_id'), true);
assert.equal(includes('src/pages/dashboard/school-admin/Attendance.tsx', "from('attendance').insert"), false);
assert.equal(includes('src/pages/dashboard/school-admin/Attendance.tsx', "from('teacher_attendance').insert"), true);

// Admin bulk personalized timetable export must coexist with the teacher portal export.
assert.equal(includes('src/pages/dashboard/school-admin/Teachers.tsx', 'Download All Timetables'), true);
assert.equal(includes('src/pages/dashboard/school-admin/Teachers.tsx', 'PERSONALISED TEACHER TIMETABLE'), true);
assert.equal(includes('src/pages/dashboard/teacher/Timetable.tsx', 'exportPersonalTimetablePDF'), true);

// Invoice deletion is a soft delete, and payment lookup excludes hidden invoices.
assert.equal(includes('src/pages/dashboard/school-admin/Fees.tsx', "deleted_at: new Date().toISOString()"), true);
assert.equal(includes('src/pages/dashboard/school-admin/Fees.tsx', ".is('deleted_at', null)"), true);
assert.equal(includes('supabase/migrations/20260826_fee_invoice_soft_delete.sql', 'ADD COLUMN IF NOT EXISTS deleted_at'), true);
assert.equal(includes('src/pages/dashboard/school-admin/Fees.tsx', 'Payment history was preserved'), true);

// Calendar dates are stored with legacy opening-date compatibility and rendered by the shared PDF helper.
assert.equal(includes('src/pages/dashboard/school-admin/SchoolSettings.tsx', 'school_closes_on'), true);
assert.equal(includes('src/pages/dashboard/school-admin/SchoolSettings.tsx', 'next_term_start_date: form.school_opens_on || null'), true);
assert.equal(includes('src/lib/reportCardPdf.ts', 'School closes on:'), true);
assert.equal(includes('src/lib/reportCardPdf.ts', 'School opens on:'), true);
assert.equal(includes('src/pages/dashboard/school-admin/Results.tsx', 'school_closes_on, school_opens_on'), true);
assert.equal(includes('src/components/layout/DashboardLayout.tsx', "path: '/school-admin/settings'"), true);

// Class-list borders remain real table-cell borders, and no timetable scheduler files are changed here.
const classList = read('src/pages/dashboard/teacher/ClassList.tsx');
assert.match(classList, /border-collapse/);
assert.match(classList, /border border-gray-200/);

console.log('Nine-feature regression invariants passed.');
