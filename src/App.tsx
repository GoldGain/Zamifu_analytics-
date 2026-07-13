import { Routes, Route, Navigate, Outlet } from 'react-router';
import { Toaster } from '@/components/ui/sonner';
import { Suspense } from 'react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { TrialProvider } from '@/contexts/TrialContext';
import MainLayout from '@/components/layout/MainLayout';
import DashboardLayout from '@/components/layout/DashboardLayout';
import ErrorBoundary from '@/components/ErrorBoundary';
import PWAInstallBanner from '@/components/PWAInstallBanner';
import PWAFloatingButton from '@/components/PWAFloatingButton';
import Home from '@/pages/Home';
import Login from '@/pages/auth/Login';
import Register from '@/pages/auth/Register';
import ForgotPassword from '@/pages/auth/ForgotPassword';
import ResetPassword from '@/pages/auth/ResetPassword';

// Master Admin pages
import MasterAdminDashboard from '@/pages/dashboard/master-admin/Dashboard';
import MasterAdminResellers from '@/pages/dashboard/master-admin/Resellers';
import MasterAdminSchools from '@/pages/dashboard/master-admin/Schools';
import MasterAdminStudents from '@/pages/dashboard/master-admin/Students';
import MasterAdminPayments from '@/pages/dashboard/master-admin/Payments';
import MasterAdminSettings from '@/pages/dashboard/master-admin/Settings';
// Reseller Admin pages
import ResellerDashboard from '@/pages/dashboard/reseller-admin/Dashboard';
import ResellerSchools from '@/pages/dashboard/reseller-admin/Schools';
import ResellerSchoolAdmins from '@/pages/dashboard/reseller-admin/SchoolAdmins';
import ResellerPayments from '@/pages/dashboard/reseller-admin/Payments';
import ResellerChangePassword from '@/pages/dashboard/reseller-admin/ChangePassword';
// Dashboard pages
import SuperAdminDashboard from '@/pages/dashboard/super-admin/Dashboard';
import SuperAdminSchools from '@/pages/dashboard/super-admin/Schools';
import SuperAdminAnalytics from '@/pages/dashboard/super-admin/Analytics';
import SuperAdminSettings from '@/pages/dashboard/super-admin/Settings';
import SchoolAdminDashboard from '@/pages/dashboard/school-admin/Dashboard';
import SchoolAdminStudents from '@/pages/dashboard/school-admin/Students';
import SchoolAdminTeachers from '@/pages/dashboard/school-admin/Teachers';
import SchoolAdminClasses from '@/pages/dashboard/school-admin/Classes';
import SchoolAdminFees from '@/pages/dashboard/school-admin/Fees';
import SchoolAdminResults from '@/pages/dashboard/school-admin/Results';
import SchoolAdminAnnouncements from '@/pages/dashboard/school-admin/Announcements';
import SchoolAdminSubjects from '@/pages/dashboard/school-admin/Subjects';
import SchoolAdminBranding from '@/pages/dashboard/school-admin/Branding';
import SchoolAdminTimetableSetup from '@/pages/dashboard/school-admin/TimetableSetup';
import SchoolAdminTimetableGenerate from '@/pages/dashboard/school-admin/TimetableGenerate';
import SchoolAdminAssignTeachers from '@/pages/dashboard/school-admin/AssignTeachers';
import SchoolAdminAssessments from '@/pages/dashboard/school-admin/Assessments';
import SchoolAdminAssignRoles from '@/pages/dashboard/school-admin/AssignRoles';
import SchoolAdminMarksOverview from '@/pages/dashboard/school-admin/MarksOverview';
import SchoolAdminCommunicate from '@/pages/dashboard/school-admin/Communicate';
import SchoolAdminPromoteClass from '@/pages/dashboard/school-admin/PromoteClass';
import DeanOfStudiesDashboard from '@/pages/dashboard/dean-of-studies/Dashboard';
import TeacherDashboard from '@/pages/dashboard/teacher/Dashboard';
import TeacherResultsUpload from '@/pages/dashboard/teacher/ResultsUpload';
import TeacherAttendance from '@/pages/dashboard/teacher/Attendance';
import TeacherHomework from '@/pages/dashboard/teacher/Homework';
import TeacherUploadPapers from '@/pages/dashboard/teacher/UploadPapers';
import TeacherAnalytics from '@/pages/dashboard/teacher/Analytics';
import TeacherStudents from '@/pages/dashboard/teacher/Students';
import TeacherLessonPlan from '@/pages/dashboard/teacher/LessonPlan';
import TeacherMySubjects from '@/pages/dashboard/teacher/MySubjects';
import TeacherExamTimetable from '@/pages/dashboard/teacher/ExamTimetable';
import TeacherViewMarks from '@/pages/dashboard/teacher/ViewMarks';
import TeacherAssessmentProgress from '@/pages/dashboard/teacher/AssessmentProgress';
import TeacherTimetable from '@/pages/dashboard/teacher/Timetable';
import ClassTeacherDashboard from '@/pages/dashboard/class-teacher/Dashboard';
import SubjectTeacherDashboard from '@/pages/dashboard/subject-teacher/Dashboard';
import StreamDashboard from '@/pages/dashboard/stream/Dashboard';
import StudentDashboard from '@/pages/dashboard/student/Dashboard';
import StudentResults from '@/pages/dashboard/student/Results';
import StudentFees from '@/pages/dashboard/student/Fees';
import StudentAttendance from '@/pages/dashboard/student/Attendance';
import StudentHomework from '@/pages/dashboard/student/Homework';
import ParentDashboard from '@/pages/dashboard/parent/Dashboard';
import ParentChildren from '@/pages/dashboard/parent/Children';
import ParentFees from '@/pages/dashboard/parent/Fees';
import ParentConferences from '@/pages/dashboard/parent/Conferences';
import ParentChatbot from '@/pages/dashboard/parent/Chatbot';
import ParentChildReportCard from '@/pages/dashboard/parent/ChildReportCard';
import StudentReportCard from '@/pages/dashboard/student/ReportCard';
import StudentChangePassword from '@/pages/dashboard/student/ChangePassword';
import StudentPortfolio from '@/pages/dashboard/student/Portfolio';
import SchoolAdminChangePassword from '@/pages/dashboard/school-admin/ChangePassword';
import TeacherChangePassword from '@/pages/dashboard/teacher/ChangePassword';
import ParentChangePassword from '@/pages/dashboard/parent/ChangePassword';
import TimetableView from '@/pages/dashboard/TimetableView';
import TeacherCurriculumNavigator from '@/pages/dashboard/teacher/CurriculumNavigator';
import TeacherProfile from '@/pages/dashboard/teacher/Profile';
import TeacherMarklist from '@/pages/dashboard/teacher/Marklist';
import PathwayFinder from '@/components/PathwayFinder';
import SchoolAdminProfile from '@/pages/dashboard/school-admin/Profile';
import ParentProfile from '@/pages/dashboard/parent/Profile';
import ParentFeeTranscript from '@/pages/dashboard/parent/FeeTranscript';

function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F3EF]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2563EB]" />
    </div>
  );
}

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles: string[] }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <LoadingSpinner />;
  }
  
  if (!user) return <Navigate to="/auth/login" replace />;
  if (!allowedRoles.includes(user.role)) return <Navigate to="/" replace />;
  
  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingSpinner />}>
        <DashboardLayout>{children}</DashboardLayout>
      </Suspense>
    </ErrorBoundary>
  );
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingSpinner />}>
        <MainLayout>{children}</MainLayout>
      </Suspense>
    </ErrorBoundary>
  );
}

function AppRoutes() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
      {/* Public routes */}
      <Route path="/" element={<PublicRoute><Home /></PublicRoute>} />
      <Route path="/auth/login" element={<Login />} />
      <Route path="/auth/register" element={<Register />} />
      <Route path="/auth/forgot-password" element={<ForgotPassword />} />
      <Route path="/auth/reset-password" element={<ResetPassword />} />

      {/* Master Super Admin routes */}
      <Route path="/master-admin" element={<ProtectedRoute allowedRoles={['master_super_admin']}><MasterAdminDashboard /></ProtectedRoute>} />
      <Route path="/master-admin/resellers" element={<ProtectedRoute allowedRoles={['master_super_admin']}><MasterAdminResellers /></ProtectedRoute>} />
      <Route path="/master-admin/schools" element={<ProtectedRoute allowedRoles={['master_super_admin']}><MasterAdminSchools /></ProtectedRoute>} />
      <Route path="/master-admin/students" element={<ProtectedRoute allowedRoles={['master_super_admin']}><MasterAdminStudents /></ProtectedRoute>} />
      <Route path="/master-admin/payments" element={<ProtectedRoute allowedRoles={['master_super_admin']}><MasterAdminPayments /></ProtectedRoute>} />
      <Route path="/master-admin/settings" element={<ProtectedRoute allowedRoles={['master_super_admin']}><MasterAdminSettings /></ProtectedRoute>} />
      {/* Reseller Super Admin routes */}
      <Route path="/reseller-admin" element={<ProtectedRoute allowedRoles={['reseller_super_admin']}><ResellerDashboard /></ProtectedRoute>} />
      <Route path="/reseller-admin/schools" element={<ProtectedRoute allowedRoles={['reseller_super_admin']}><ResellerSchools /></ProtectedRoute>} />
      <Route path="/reseller-admin/school-admins" element={<ProtectedRoute allowedRoles={['reseller_super_admin']}><ResellerSchoolAdmins /></ProtectedRoute>} />
      <Route path="/reseller-admin/payments" element={<ProtectedRoute allowedRoles={['reseller_super_admin']}><ResellerPayments /></ProtectedRoute>} />
      <Route path="/reseller-admin/change-password" element={<ProtectedRoute allowedRoles={['reseller_super_admin']}><ResellerChangePassword /></ProtectedRoute>} />
      {/* Super Admin routes */}
      <Route path="/super-admin" element={<ProtectedRoute allowedRoles={['super_admin']}><SuperAdminDashboard /></ProtectedRoute>} />
      <Route path="/super-admin/schools" element={<ProtectedRoute allowedRoles={['super_admin']}><SuperAdminSchools /></ProtectedRoute>} />
      <Route path="/super-admin/analytics" element={<ProtectedRoute allowedRoles={['super_admin']}><SuperAdminAnalytics /></ProtectedRoute>} />
      <Route path="/super-admin/settings" element={<ProtectedRoute allowedRoles={['super_admin']}><SuperAdminSettings /></ProtectedRoute>} />

      {/* School Admin routes */}
      <Route path="/school-admin" element={<ProtectedRoute allowedRoles={['school_admin']}><SchoolAdminDashboard /></ProtectedRoute>} />
      <Route path="/school-admin/stream-dashboard" element={<ProtectedRoute allowedRoles={['school_admin']}><StreamDashboard /></ProtectedRoute>} />
      <Route path="/school-admin/students" element={<ProtectedRoute allowedRoles={['school_admin']}><SchoolAdminStudents /></ProtectedRoute>} />
      <Route path="/school-admin/teachers" element={<ProtectedRoute allowedRoles={['school_admin']}><SchoolAdminTeachers /></ProtectedRoute>} />
      <Route path="/school-admin/classes" element={<ProtectedRoute allowedRoles={['school_admin']}><SchoolAdminClasses /></ProtectedRoute>} />
      <Route path="/school-admin/fees" element={<ProtectedRoute allowedRoles={['school_admin']}><SchoolAdminFees /></ProtectedRoute>} />
      <Route path="/school-admin/results" element={<ProtectedRoute allowedRoles={['school_admin']}><SchoolAdminResults /></ProtectedRoute>} />
      <Route path="/school-admin/announcements" element={<ProtectedRoute allowedRoles={['school_admin']}><SchoolAdminAnnouncements /></ProtectedRoute>} />
      <Route path="/school-admin/subjects" element={<ProtectedRoute allowedRoles={['school_admin']}><SchoolAdminSubjects /></ProtectedRoute>} />
      <Route path="/school-admin/branding" element={<ProtectedRoute allowedRoles={['school_admin']}><SchoolAdminBranding /></ProtectedRoute>} />
      <Route path="/school-admin/timetable/setup" element={<ProtectedRoute allowedRoles={['school_admin']}><SchoolAdminTimetableSetup /></ProtectedRoute>} />
      <Route path="/school-admin/timetable/generate" element={<ProtectedRoute allowedRoles={['school_admin']}><SchoolAdminTimetableGenerate /></ProtectedRoute>} />
      <Route path="/school-admin/timetable/assign" element={<ProtectedRoute allowedRoles={['school_admin']}><SchoolAdminAssignTeachers /></ProtectedRoute>} />
      <Route path="/school-admin/teacher-assignments" element={<ProtectedRoute allowedRoles={['school_admin']}><SchoolAdminAssignTeachers /></ProtectedRoute>} />
      <Route path="/school-admin/change-password" element={<ProtectedRoute allowedRoles={['school_admin']}><SchoolAdminChangePassword /></ProtectedRoute>} />
      <Route path="/school-admin/profile" element={<ProtectedRoute allowedRoles={['school_admin']}><SchoolAdminProfile /></ProtectedRoute>} />
      <Route path="/school-admin/assessments" element={<ProtectedRoute allowedRoles={['school_admin']}><SchoolAdminAssessments /></ProtectedRoute>} />
      <Route path="/school-admin/assign-roles" element={<ProtectedRoute allowedRoles={['school_admin']}><SchoolAdminAssignRoles /></ProtectedRoute>} />
      <Route path="/school-admin/marks-overview" element={<ProtectedRoute allowedRoles={['school_admin']}><SchoolAdminMarksOverview /></ProtectedRoute>} />
      <Route path="/school-admin/communicate" element={<ProtectedRoute allowedRoles={['school_admin']}><SchoolAdminCommunicate /></ProtectedRoute>} />
      <Route path="/school-admin/promote-class" element={<ProtectedRoute allowedRoles={['school_admin']}><SchoolAdminPromoteClass /></ProtectedRoute>} />
      <Route path="/school-admin/timetable/view" element={<ProtectedRoute allowedRoles={['school_admin']}><TimetableView /></ProtectedRoute>} />

      {/* Teacher routes */}
      <Route path="/teacher" element={<ProtectedRoute allowedRoles={['teacher']}><TeacherDashboard /></ProtectedRoute>} />
      <Route path="/teacher/class-dashboard" element={<ProtectedRoute allowedRoles={['teacher']}><ClassTeacherDashboard /></ProtectedRoute>} />
      <Route path="/teacher/subject-dashboard" element={<ProtectedRoute allowedRoles={['teacher']}><SubjectTeacherDashboard /></ProtectedRoute>} />
      <Route path="/teacher/results/upload" element={<ProtectedRoute allowedRoles={['teacher']}><TeacherResultsUpload /></ProtectedRoute>} />
      <Route path="/teacher/view-marks" element={<ProtectedRoute allowedRoles={['teacher']}><TeacherViewMarks /></ProtectedRoute>} />
      <Route path="/teacher/assessment-progress" element={<ProtectedRoute allowedRoles={['teacher']}><TeacherAssessmentProgress /></ProtectedRoute>} />
      <Route path="/teacher/attendance" element={<ProtectedRoute allowedRoles={['teacher']}><TeacherAttendance /></ProtectedRoute>} />
      <Route path="/teacher/homework" element={<ProtectedRoute allowedRoles={['teacher']}><TeacherHomework /></ProtectedRoute>} />
      <Route path="/teacher/upload-papers" element={<ProtectedRoute allowedRoles={['teacher']}><TeacherUploadPapers /></ProtectedRoute>} />
      <Route path="/teacher/analytics" element={<ProtectedRoute allowedRoles={['teacher']}><TeacherAnalytics /></ProtectedRoute>} />
      <Route path="/teacher/students" element={<ProtectedRoute allowedRoles={['teacher']}><TeacherStudents /></ProtectedRoute>} />
      <Route path="/teacher/lesson-plan" element={<ProtectedRoute allowedRoles={['teacher']}><TeacherLessonPlan /></ProtectedRoute>} />
      <Route path="/teacher/my-subjects" element={<ProtectedRoute allowedRoles={['teacher']}><TeacherMySubjects /></ProtectedRoute>} />
      <Route path="/teacher/timetable" element={<ProtectedRoute allowedRoles={['teacher']}><TeacherTimetable /></ProtectedRoute>} />
      <Route path="/teacher/exam-timetable" element={<ProtectedRoute allowedRoles={['teacher']}><TeacherExamTimetable /></ProtectedRoute>} />
      <Route path="/teacher/change-password" element={<ProtectedRoute allowedRoles={['teacher']}><TeacherChangePassword /></ProtectedRoute>} />
      <Route path="/teacher/profile" element={<ProtectedRoute allowedRoles={['teacher']}><TeacherProfile /></ProtectedRoute>} />
      <Route path="/teacher/curriculum" element={<ProtectedRoute allowedRoles={['teacher']}><TeacherCurriculumNavigator /></ProtectedRoute>} />
      <Route path="/teacher/marklist" element={<ProtectedRoute allowedRoles={['teacher']}><TeacherMarklist /></ProtectedRoute>} />
      {/* Issue 5: DoS can manage assessments - shared Assessments component for teachers */}
      <Route path="/teacher/assessments" element={<ProtectedRoute allowedRoles={['teacher']}><SchoolAdminAssessments /></ProtectedRoute>} />

      {/* Dean of Studies routes - accessible to teachers who are DoS */}
      <Route path="/dean-of-studies" element={<ProtectedRoute allowedRoles={['teacher']}><DeanOfStudiesDashboard /></ProtectedRoute>} />

      {/* Student routes */}
      <Route path="/student" element={<ProtectedRoute allowedRoles={['student']}><StudentDashboard /></ProtectedRoute>} />
      <Route path="/student/results" element={<ProtectedRoute allowedRoles={['student']}><StudentResults /></ProtectedRoute>} />
      <Route path="/student/fees" element={<ProtectedRoute allowedRoles={['student']}><StudentFees /></ProtectedRoute>} />
      <Route path="/student/attendance" element={<ProtectedRoute allowedRoles={['student']}><StudentAttendance /></ProtectedRoute>} />
      <Route path="/student/timetable" element={<ProtectedRoute allowedRoles={['student']}><TimetableView /></ProtectedRoute>} />
      <Route path="/student/homework" element={<ProtectedRoute allowedRoles={['student']}><StudentHomework /></ProtectedRoute>} />
      <Route path="/student/report-card" element={<ProtectedRoute allowedRoles={['student']}><StudentReportCard /></ProtectedRoute>} />
      <Route path="/student/change-password" element={<ProtectedRoute allowedRoles={['student']}><StudentChangePassword /></ProtectedRoute>} />
      <Route path="/student/portfolio" element={<ProtectedRoute allowedRoles={['student']}><StudentPortfolio /></ProtectedRoute>} />

      {/* Parent routes */}
      <Route path="/parent" element={<ProtectedRoute allowedRoles={['parent']}><ParentDashboard /></ProtectedRoute>} />
      <Route path="/parent/children" element={<ProtectedRoute allowedRoles={['parent']}><ParentChildren /></ProtectedRoute>} />
      <Route path="/parent/fees" element={<ProtectedRoute allowedRoles={['parent']}><ParentFees /></ProtectedRoute>} />
      <Route path="/parent/conferences" element={<ProtectedRoute allowedRoles={['parent']}><ParentConferences /></ProtectedRoute>} />
      <Route path="/parent/chatbot" element={<ProtectedRoute allowedRoles={['parent']}><ParentChatbot /></ProtectedRoute>} />
      <Route path="/parent/report-card" element={<ProtectedRoute allowedRoles={['parent']}><ParentChildReportCard /></ProtectedRoute>} />
      <Route path="/parent/change-password" element={<ProtectedRoute allowedRoles={['parent']}><ParentChangePassword /></ProtectedRoute>} />
      <Route path="/parent/profile" element={<ProtectedRoute allowedRoles={['parent']}><ParentProfile /></ProtectedRoute>} />
      <Route path="/parent/fee-transcript" element={<ProtectedRoute allowedRoles={['parent']}><ParentFeeTranscript /></ProtectedRoute>} />
      <Route path="/parent/timetable" element={<ProtectedRoute allowedRoles={['parent']}><TimetableView /></ProtectedRoute>} />

      {/* General routes */}
      <Route path="/timetable" element={<ProtectedRoute allowedRoles={['school_admin', 'teacher', 'student', 'parent', 'super_admin', 'reseller_super_admin', 'master_super_admin']}><TimetableView /></ProtectedRoute>} />

      {/* Public Pathway Finder route */}
      <Route path="/pathway-finder" element={<PublicRoute><PathwayFinder /></PublicRoute>} />

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <TrialProvider>
          <AppRoutes />
          <PWAInstallBanner />
          <PWAFloatingButton />
          <Toaster position="top-right" richColors closeButton />
        </TrialProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
