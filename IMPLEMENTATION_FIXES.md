# Implementation Fixes for All 16 Issues

## ISSUE 1: Report Card - One Page & Remove Graph
**Status**: ALREADY DONE
- Trend graph disabled in reportCardPdf.ts (drawTrendGraph returns immediately at line 285)
- COMPACT_MODE enabled (line 40)
- No changes needed - verify during testing

## ISSUE 2: School Admin - Set Next Term Start Date
**Files to modify**:
1. Create new file: `src/pages/dashboard/school-admin/SchoolSettings.tsx`
2. Modify: `src/App.tsx` - add route
3. Modify: `src/lib/reportCardPdf.ts` - display next term date on report cards

**Implementation**:
- Create settings page to update schools.next_term_start_date
- Display on report cards: "Next term will start on: [date]"

## ISSUE 3: Report Card - Show Previous Performance
**Files to modify**:
1. `src/lib/reportCardPdf.ts` - add logic to fetch and display previous performance
2. `src/pages/dashboard/student/ReportCard.tsx`
3. `src/pages/dashboard/parent/ChildReportCard.tsx`

**Implementation**:
- Query previous term/assessment results
- Display marks, %, and position from previous assessment
- Only show "No previous data" if truly no data exists

## ISSUE 4: Edge Function - Duplicate & Non-Sequential Admission Numbers
**Status**: MOSTLY DONE
- Duplicate check already per-class in Students.tsx
- Error messages already clear
- Test during validation phase

## ISSUE 5: Assessment Creation Page - Cannot Scroll on Laptop
**Files to modify**:
1. `src/pages/dashboard/school-admin/Assessments.tsx` - fix modal scrolling

**Implementation**:
- Change modal container from `flex items-center justify-center` to `flex items-start justify-center`
- Ensure content scrolls properly on desktop

## ISSUE 6: School Admin Dashboard - Results Not Showing
**Files to modify**:
1. `src/pages/dashboard/school-admin/Dashboard.tsx` or `StreamDashboard.tsx`

**Implementation**:
- Add AVG % calculation for each student
- Add SUBJECTS count for each student
- Add filters: Class, Term, Assessment Type

## ISSUE 7: Marks Entry Overview - Show Students Without Marks
**Files to modify**:
1. `src/pages/dashboard/school-admin/MarksOverview.tsx`

**Implementation**:
- Show students without marks
- Show subjects without marks
- Show teacher upload status

## ISSUE 8: Graduated Students - View by Class & Show KJSEA Results
**Files to modify**:
1. `src/pages/dashboard/school-admin/GraduatedStudents.tsx`

**Implementation**:
- Show all graduated students (fix "0" count)
- Filter by class/grade
- Filter by graduation year
- Show KJSEA/KCSE results if data was entered

## ISSUE 9: Class Teacher Dashboard - Duplicate Subjects & Incomplete Status
**Files to modify**:
1. `src/pages/dashboard/class-teacher/Dashboard.tsx`

**Implementation**:
- Prevent duplicate subject entries
- Status depends on number of learning areas:
  - Junior School (Grade 7-9): 9 subjects
  - Primary (Grade 1-6): 5 subjects
  - Senior School (Grade 10-12): 7 subjects
- Show "Complete" when all subjects have marks

## ISSUE 10: Results Analysis - Add Total Marks Column
**Files to modify**:
1. `src/pages/dashboard/class-teacher/Dashboard.tsx`

**Implementation**:
- Add Total Marks column to Results Analysis table

## ISSUE 11: Teacher Dashboard - Show "Uploaded" Status
**Files to modify**:
1. `src/pages/dashboard/teacher/Dashboard.tsx`

**Implementation**:
- Show "Uploaded" status next to subjects that have marks
- Disable "Upload" button after upload

## ISSUE 12: Teacher Timetable - Remove "Edit" Button
**Files to modify**:
1. `src/pages/dashboard/teacher/Timetable.tsx`

**Implementation**:
- Remove "Edit Timetable" button

## ISSUE 13: Subject Teacher Dashboard - Show Already Uploaded Marks
**Files to modify**:
1. `src/pages/dashboard/teacher/SubjectDashboard.tsx`

**Implementation**:
- Display marks, %, and grade for students after upload
- Show count of uploaded vs total

## ISSUE 14: DoS Portal - Class List Editable & Sorted
**Files to modify**:
1. `src/pages/dashboard/dean-of-studies/ClassList.tsx`
2. `src/pages/dashboard/school-admin/ClassList.tsx`
3. `src/pages/dashboard/teacher/ClassList.tsx`
4. `src/pages/dashboard/class-teacher/ClassList.tsx`

**Implementation**:
- Add "Add Columns" feature
- Sort ALL class lists by admission number (ascending)

## ISSUE 15: DoS Portal - Assessment Progress Shows Wrong Subjects & Missing Students
**Files to modify**:
1. `src/pages/dashboard/dean-of-studies/AssessmentProgress.tsx`

**Implementation**:
- Show ALL class subjects (not just teacher's subjects)
- Show which students are missing marks for each subject

## ISSUE 16: School Admin - View All Classes Attendance
**Files to modify**:
1. Create new file: `src/pages/dashboard/school-admin/Attendance.tsx`
2. Modify: `src/App.tsx` - add route

**Implementation**:
- View attendance for ALL classes
- Filter by date, class, or grade
- Show summary (present, absent, late)
- Click on class to see individual student attendance
- Export report (PDF/Excel)
