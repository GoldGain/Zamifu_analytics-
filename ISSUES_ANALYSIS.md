# Zamifu School Management - 16 Issues Analysis & Implementation Plan

## Issue 1: Report Card — One Page Across All Portals & Remove Graph
**Status**: PARTIALLY DONE
- Trend graph already disabled in reportCardPdf.ts (drawTrendGraph returns immediately)
- COMPACT_MODE is enabled (line 40)
- Need to verify all portals render correctly on one page
- Files to check: reportCardPdf.ts, ReportCard.tsx (student), ChildReportCard.tsx (parent), Results.tsx (school-admin, teacher)

## Issue 2: School Admin — Set Next Term Start Date
**Status**: PARTIALLY DONE
- Migration exists: 20260811_add_next_term_start_date.sql
- Column added to schools table
- Need to create Settings page for School Admin to set the date
- Need to display on report cards: "Next term will start on: [date]"

## Issue 3: Report Card — Show Previous Performance
**Status**: NEEDS IMPLEMENTATION
- Report cards show "No previous data" even when previous data exists
- Need logic to:
  - Show previous term performance if it's a new term
  - Show previous assessment performance if it's the same term
  - Show marks and position from previous assessment
  - Only show "No previous data" if truly no data exists

## Issue 4: Edge Function Error — Duplicate & Non-Sequential Admission Numbers
**Status**: PARTIALLY DONE
- Duplicate check is already per-class (Students.tsx line 140-150)
- Non-sequential numbers should already work
- Error messages are clear
- May need to test edge function for any remaining issues

## Issue 5: Assessment Creation Page — Cannot Scroll on Laptop
**Status**: NEEDS INVESTIGATION
- CreateAssessment.tsx needs to be checked for scrolling issues
- Likely CSS/layout problem with fixed height containers

## Issue 6: School Admin Dashboard — Results Not Showing
**Status**: NEEDS INVESTIGATION
- Stream Dashboard not showing AVG % and SUBJECTS columns
- Need to check Dashboard.tsx or StreamDashboard.tsx
- May need to add calculation logic for averages

## Issue 7: Marks Entry Overview — Show Students Without Marks
**Status**: NEEDS IMPLEMENTATION
- MarksOverview.tsx needs to show:
  - Students without marks
  - Subjects without marks
  - Teacher upload status

## Issue 8: Graduated Students — View by Class & Show KJSEA Results
**Status**: NEEDS IMPLEMENTATION
- GraduatedStudents.tsx shows "0" graduates
- Need to:
  - Show all graduated students
  - Filter by class/grade
  - Filter by graduation year
  - Show KJSEA/KCSE results if data was entered

## Issue 9: Class Teacher Dashboard — Duplicate Subjects & Incomplete Status
**Status**: NEEDS IMPLEMENTATION
- Duplicate subjects appear (Kiswahili twice, C-Arts twice)
- Status shows "Incomplete" even when all marks entered
- Status should depend on number of learning areas for that level:
  - Junior School (Grade 7-9): 9 subjects
  - Primary (Grade 1-6): 5 subjects
  - Senior School (Grade 10-12): 7 subjects

## Issue 10: Results Analysis — Add Total Marks Column
**Status**: NEEDS IMPLEMENTATION
- Results Analysis table in Class Teacher Dashboard missing Total Marks column

## Issue 11: Teacher Dashboard — Show "Uploaded" Status
**Status**: NEEDS IMPLEMENTATION
- Teachers can't see which subjects they've already uploaded marks for
- Need to show "Uploaded" status next to subjects
- Disable "Upload" button after upload

## Issue 12: Teacher Timetable — Remove "Edit" Button
**Status**: NEEDS IMPLEMENTATION
- Remove "Edit Timetable" button from teacher's timetable page
- File: Timetable.tsx

## Issue 13: Subject Teacher Dashboard — Show Already Uploaded Marks
**Status**: NEEDS IMPLEMENTATION
- After uploading marks, page doesn't show the marks entered
- Need to display marks, %, and grade for students after upload
- Show count of uploaded vs total

## Issue 14: DoS Portal — Class List Should Be Editable & Sorted
**Status**: NEEDS IMPLEMENTATION
- DoS Class List is read-only (cannot add columns)
- Learners not sorted by admission number
- Need to:
  - Add "Add Columns" feature (like Teacher Dashboard)
  - Sort ALL class lists by admission number (ascending, smallest to largest)
- Files: ClassList.tsx (dean-of-studies, school-admin, teacher, class-teacher)

## Issue 15: DoS Portal — Assessment Progress Shows Wrong Subjects & Missing Students
**Status**: NEEDS IMPLEMENTATION
- Assessment Progress shows only teacher's subjects instead of all class subjects
- Does not show students without marks
- Need to:
  - Show ALL class subjects (not just teacher's subjects)
  - Show which students are missing marks for each subject

## Issue 16: School Admin — View All Classes Attendance
**Status**: NEEDS IMPLEMENTATION
- School Admin cannot view attendance for all classes in one place
- Need to:
  - View attendance for ALL classes
  - Filter by date, class, or grade
  - Show summary (present, absent, late)
  - Click on class to see individual student attendance
  - Export report (PDF/Excel)
- File: Attendance.tsx (school-admin) - may need to create

## Implementation Priority
1. Issues 1-4: Report cards and learner creation (foundational)
2. Issues 5-6: UI/UX fixes (scrolling, dashboard display)
3. Issues 7-10: Marks and results display
4. Issues 11-13: Teacher dashboards
5. Issues 14-15: DoS portal
6. Issue 16: Attendance reporting
