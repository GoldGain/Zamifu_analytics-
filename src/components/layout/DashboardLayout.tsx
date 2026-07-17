import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import PWAInstallButton from '@/components/PWAInstallButton';
import PhotoZoomModal from '@/components/PhotoZoomModal';
import {
  GraduationCap,
  LayoutDashboard,
  Users,
  BookOpen,
  Library,
  FileText,
  Bell,
  Settings,
  LogOut,
  Menu,
  X,
  Eye,
  School,
  UserCheck,
  CreditCard,
  BarChart3,
  MessageSquare,
  Bot,
  Send,
  Home,
  Upload,
  ClipboardList,
  Award,
  Clock,
  Download,
  Palette,
  Sparkles,
  Share2,
  DollarSign,
  Building2,
  Calendar,
  Zap,
  Brain,
  User,
  RefreshCw,
  FileSpreadsheet,
  Shield,
} from 'lucide-react';

interface NavItem {
  label: string;
  icon: React.ReactNode;
  path: string;
  children?: { label: string; path: string }[];
}

const navConfig: Record<string, NavItem[]> = {
  'master-super-admin': [
    { label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" />, path: '/master-admin' },
    { label: 'Resellers', icon: <Building2 className="w-5 h-5" />, path: '/master-admin/resellers' },
    { label: 'All Schools', icon: <School className="w-5 h-5" />, path: '/master-admin/schools' },
    { label: 'All Learners', icon: <Users className="w-5 h-5" />, path: '/master-admin/students' },
    { label: 'All Payments', icon: <DollarSign className="w-5 h-5" />, path: '/master-admin/payments' },
    { label: 'Platform Settings', icon: <Settings className="w-5 h-5" />, path: '/master-admin/settings' },
  ],
  'reseller-super-admin': [
    { label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" />, path: '/reseller-admin' },
    { label: 'My Schools', icon: <School className="w-5 h-5" />, path: '/reseller-admin/schools' },
    { label: 'Learners', icon: <Users className="w-5 h-5" />, path: '/reseller-admin/students' },
    { label: 'School Admins', icon: <UserCheck className="w-5 h-5" />, path: '/reseller-admin/school-admins' },
    { label: 'Payments', icon: <DollarSign className="w-5 h-5" />, path: '/reseller-admin/payments' },
    { label: 'Pricing', icon: <CreditCard className="w-5 h-5" />, path: '/reseller-admin/pricing' },
    { label: 'Access Control', icon: <Shield className="w-5 h-5" />, path: '/reseller-admin/access-control' },
    { label: 'Change Password', icon: <Settings className="w-5 h-5" />, path: '/reseller-admin/change-password' },
  ],
  'super-admin': [
    { label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" />, path: '/super-admin' },
    { label: 'Schools', icon: <School className="w-5 h-5" />, path: '/super-admin/schools' },
    { label: 'Analytics', icon: <BarChart3 className="w-5 h-5" />, path: '/super-admin/analytics' },
    { label: 'Settings', icon: <Settings className="w-5 h-5" />, path: '/super-admin/settings' },
  ],
  'school-admin': [
    { label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" />, path: '/school-admin' },
    { label: 'Learners', icon: <Users className="w-5 h-5" />, path: '/school-admin/students' },
    { label: 'Graduated Students', icon: <GraduationCap className="w-5 h-5" />, path: '/school-admin/graduated-students' },
    { label: 'Teachers', icon: <UserCheck className="w-5 h-5" />, path: '/school-admin/teachers' },
    { label: 'Grades', icon: <School className="w-5 h-5" />, path: '/school-admin/classes' },
    { label: 'Learning Areas', icon: <Library className="w-5 h-5" />, path: '/school-admin/subjects' },
    { label: 'Communicate', icon: <MessageSquare className="w-5 h-5" />, path: '/school-admin/communicate' },
    { label: 'Teacher Assignments', icon: <UserCheck className="w-5 h-5" />, path: '/school-admin/teacher-assignments' },
    { label: 'Timetable Setup', icon: <Settings className="w-5 h-5" />, path: '/school-admin/timetable/setup' },
    { label: 'Generate Timetable', icon: <Zap className="w-5 h-5" />, path: '/school-admin/timetable/generate' },
    { label: 'View Timetable', icon: <Calendar className="w-5 h-5" />, path: '/school-admin/timetable/view' },
    { label: 'Fees', icon: <CreditCard className="w-5 h-5" />, path: '/school-admin/fees' },
    { label: 'Results', icon: <FileText className="w-5 h-5" />, path: '/school-admin/results' },
    { label: 'Assessments', icon: <BookOpen className="w-5 h-5" />, path: '/school-admin/assessments' },
    { label: 'Marks Overview', icon: <BarChart3 className="w-5 h-5" />, path: '/school-admin/marks-overview' },
    { label: 'Assign Roles', icon: <UserCheck className="w-5 h-5" />, path: '/school-admin/assign-roles' },
    { label: 'Stream Dashboard', icon: <BarChart3 className="w-5 h-5" />, path: '/school-admin/stream-dashboard' },
    { label: 'Promote Grade', icon: <GraduationCap className="w-5 h-5" />, path: '/school-admin/promote-class' },
    { label: 'Announcements', icon: <Bell className="w-5 h-5" />, path: '/school-admin/announcements' },
    { label: 'Branding & Notifications', icon: <Palette className="w-5 h-5" />, path: '/school-admin/branding' },
    { label: 'Access Control', icon: <Shield className="w-5 h-5" />, path: '/school-admin/access-control' },
    { label: 'My Profile', icon: <User className="w-5 h-5" />, path: '/school-admin/profile' },
    { label: 'Change Password', icon: <Settings className="w-5 h-5" />, path: '/school-admin/change-password' },
  ],
  'teacher': [
    { label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" />, path: '/teacher' },
    { label: 'Grade Dashboard', icon: <Users className="w-5 h-5" />, path: '/teacher/class-dashboard' },
    { label: 'DoS Dashboard', icon: <GraduationCap className="w-5 h-5" />, path: '/dean-of-studies' },
    { label: 'Subject Dashboard', icon: <BookOpen className="w-5 h-5" />, path: '/teacher/subject-dashboard' },
    { label: 'My Learning Areas', icon: <BookOpen className="w-5 h-5" />, path: '/teacher/my-subjects' },
    { label: 'View Timetable', icon: <Calendar className="w-5 h-5" />, path: '/timetable' },
    { label: 'Upload Results', icon: <Upload className="w-5 h-5" />, path: '/teacher/results/upload' },
    { label: 'View My Marks', icon: <Eye className="w-5 h-5" />, path: '/teacher/view-marks' },
    { label: 'Marklist', icon: <FileSpreadsheet className="w-5 h-5" />, path: '/teacher/marklist' },
    { label: 'Class List', icon: <FileSpreadsheet className="w-5 h-5" />, path: '/teacher/class-list' },
    { label: 'Assessment Progress', icon: <BarChart3 className="w-5 h-5" />, path: '/teacher/assessment-progress' },
    { label: 'Attendance', icon: <ClipboardList className="w-5 h-5" />, path: '/teacher/attendance' },
    { label: 'Homework & Papers', icon: <BookOpen className="w-5 h-5" />, path: '/teacher/homework' },
    { label: 'Upload Papers', icon: <Upload className="w-5 h-5" />, path: '/teacher/upload-papers' },
    { label: 'Analytics', icon: <BarChart3 className="w-5 h-5" />, path: '/teacher/analytics' },
    { label: 'My Learners', icon: <Users className="w-5 h-5" />, path: '/teacher/students' },
    { label: 'Lesson Plans', icon: <Sparkles className="w-5 h-5" />, path: '/teacher/lesson-plan' },
    { label: 'Curriculum Navigator', icon: <Brain className="w-5 h-5" />, path: '/teacher/curriculum' },
    { label: 'My Profile', icon: <User className="w-5 h-5" />, path: '/teacher/profile' },
    { label: 'Change Password', icon: <Settings className="w-5 h-5" />, path: '/teacher/change-password' },
  ],
  'student': [
    { label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" />, path: '/student' },
    { label: 'Timetable', icon: <Calendar className="w-5 h-5" />, path: '/timetable' },
    { label: 'My Results', icon: <Award className="w-5 h-5" />, path: '/student/results' },
    { label: 'Fees', icon: <CreditCard className="w-5 h-5" />, path: '/student/fees' },
    { label: 'Attendance', icon: <ClipboardList className="w-5 h-5" />, path: '/student/attendance' },
    { label: 'Homework', icon: <BookOpen className="w-5 h-5" />, path: '/student/homework' },
    { label: 'Papers', icon: <FileText className="w-5 h-5" />, path: '/student/papers' },
    { label: 'Report Card', icon: <FileText className="w-5 h-5" />, path: '/student/report-card' },
    { label: 'My Portfolio', icon: <Award className="w-5 h-5" />, path: '/student/portfolio' },
    { label: 'Change Password', icon: <Settings className="w-5 h-5" />, path: '/student/change-password' },
  ],
  'parent': [
    { label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" />, path: '/parent' },
    { label: 'My Children', icon: <Users className="w-5 h-5" />, path: '/parent/children' },
    { label: 'Timetable', icon: <Calendar className="w-5 h-5" />, path: '/parent/timetable' },
    { label: 'Fees', icon: <CreditCard className="w-5 h-5" />, path: '/parent/fees' },
    { label: 'Fee Transcript', icon: <FileText className="w-5 h-5" />, path: '/parent/fee-transcript' },
    { label: 'Conferences', icon: <MessageSquare className="w-5 h-5" />, path: '/parent/conferences' },
    { label: 'AI Assistant', icon: <Bot className="w-5 h-5" />, path: '/parent/chatbot' },
    { label: 'Report Card', icon: <FileText className="w-5 h-5" />, path: '/parent/report-card' },
    { label: 'My Profile', icon: <User className="w-5 h-5" />, path: '/parent/profile' },
    { label: 'Change Password', icon: <Settings className="w-5 h-5" />, path: '/parent/change-password' },
  ],
};

const ROLE_DASHBOARDS: Record<string, string> = {
  'school_admin': '/school-admin',
  'teacher': '/teacher',
  'student': '/student',
  'parent': '/parent',
  'super_admin': '/super-admin',
  'reseller_super_admin': '/reseller-admin',
  'master_super_admin': '/master-admin',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [zoomAvatar, setZoomAvatar] = useState(false);
  const { user, signOut, schoolData } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [additionalRoles, setAdditionalRoles] = useState<string[]>([]);
  const [isClassTeacher, setIsClassTeacher] = useState(false);
  const [isDoS, setIsDoS] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    const checkRoles = async () => {
      try {
        const { data: profileData } = await (supabase as any)
          .from('profiles')
          .select('secondary_roles')
          .eq('id', user.id)
          .maybeSingle();
        if (profileData?.secondary_roles && Array.isArray(profileData.secondary_roles)) {
          setAdditionalRoles(profileData.secondary_roles);
        }
      } catch (err) { /* secondary_roles column may not exist yet */ }

      if (user.role === 'teacher') {
        const { data: teacherData } = await (supabase as any)
          .from('teachers')
          .select('is_class_teacher, id, school_id')
          .eq('profile_id', user.id)
          .maybeSingle();
        if (teacherData?.is_class_teacher) setIsClassTeacher(true);
        if (teacherData?.school_id) {
          const { data: schoolInfo } = await (supabase as any)
            .from('schools')
            .select('dean_of_studies_id')
            .eq('id', teacherData.school_id)
            .maybeSingle();
          if (schoolInfo?.dean_of_studies_id === teacherData.id) setIsDoS(true);
        }
      }
    };
    checkRoles();
  }, [user?.id, user?.role]);

  const roleKey = user?.role?.replace(/_/g, '-') || '';
  let navItems = [...(navConfig[roleKey] || [])];

  // Add Assessments nav link for DoS users
  if (user?.role === 'teacher' && isDoS) {
    // Insert the Assessments link after Assessment Progress
    const assessmentProgressIndex = navItems.findIndex(item => item.path === '/teacher/assessment-progress');
    const assessmentsLink: NavItem = { 
      label: 'Manage Assessments', 
      icon: <BookOpen className="w-5 h-5" />, 
      path: '/teacher/assessments' 
    };
    if (assessmentProgressIndex >= 0) {
      navItems.splice(assessmentProgressIndex + 1, 0, assessmentsLink);
    } else {
      navItems.push(assessmentsLink);
    }
  }

  if (user?.role === 'teacher') {
    navItems = navItems.filter(item => {
      if (item.path === '/teacher/class-dashboard' && !isClassTeacher) return false;
      if (item.path === '/dean-of-studies' && !isDoS) return false;
      return true;
    });
  }

  const canSwitchToAdmin = user?.role === 'teacher' && additionalRoles.includes('school_admin');
  const canSwitchToTeacher = user?.role === 'school_admin' && additionalRoles.includes('teacher');

  const handleLogout = async () => {
    await signOut();
    navigate('/auth/login');
  };

  const handleWhatsAppShare = () => {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(`Check out Zamifu Analytics - Intelligent School Management System: ${window.location.origin}`);
    window.open(`https://wa.me/?text=${text}%20${url}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-[#F5F3EF]">
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`fixed top-0 left-0 z-50 h-full w-64 bg-[#1A1A1A] text-white transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <Link to="/" className="flex items-center gap-2">
            {schoolData?.logo_url ? (
              <img src={schoolData.logo_url} alt={schoolData.name} className="w-8 h-8 rounded-lg object-contain bg-white p-0.5" />
            ) : (
              <img src="/logo.png" alt="Zamifu Analytics" className="w-8 h-8 rounded-lg object-contain" />
            )}
            <span className="text-lg font-bold truncate max-w-[140px]">{schoolData?.name || 'Zamifu Analytics'}</span>
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 flex flex-col h-[calc(100%-65px)]">
          <div className="flex items-center gap-3 mb-6 px-2 py-3 bg-gray-800/50 rounded-xl">
            <div
              className="w-16 h-16 rounded-full bg-[#2563EB] flex items-center justify-center text-sm font-bold overflow-hidden flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => user?.avatarUrl && setZoomAvatar(true)}
              title={user?.avatarUrl ? 'Click to zoom' : undefined}
            >
              {user?.avatarUrl ? <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" /> : <>{user?.firstName?.[0]}{user?.lastName?.[0]}</>}
            </div>
            <div>
              <p className="text-sm font-medium">{user?.firstName} {user?.lastName}</p>
              <p className="text-xs text-gray-400 capitalize">{user?.role?.replace(/_/g, ' ')}</p>
              {isDoS && (
                <p className="text-xs text-purple-400 mt-0.5 font-medium">Dean of Studies</p>
              )}
              {additionalRoles.length > 0 && (
                <p className="text-xs text-blue-400 mt-0.5">+{additionalRoles.map(r => r.replace(/_/g, ' ')).join(', ')}</p>
              )}
            </div>
          </div>

          <nav className="space-y-1 flex-1 overflow-y-auto">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                  location.pathname === item.path 
                    ? 'bg-[#2563EB] text-white' 
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="mt-4 pt-4 border-t border-gray-800 space-y-2">
            {canSwitchToAdmin && (
              <Link
                to="/school-admin"
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-yellow-400 hover:bg-yellow-600 hover:text-white transition-all w-full font-medium"
              >
                <RefreshCw className="w-5 h-5" />
                Switch to Admin View
              </Link>
            )}
            {canSwitchToTeacher && (
              <Link
                to="/teacher"
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-yellow-400 hover:bg-yellow-600 hover:text-white transition-all w-full font-medium"
              >
                <RefreshCw className="w-5 h-5" />
                Switch to Teacher View
              </Link>
            )}
            <button
              onClick={handleWhatsAppShare}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-green-400 hover:bg-green-600 hover:text-white transition-all w-full font-medium"
            >
              <Share2 className="w-5 h-5" />
              Share via WhatsApp
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white transition-all w-full font-medium"
            >
              <LogOut className="w-5 h-5" />
              Logout
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:ml-64 min-h-screen">
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-[#E5E5E5] px-4 md:px-6 py-3">
          <div className="flex items-center justify-between">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden lg:flex items-center gap-2">
              {schoolData?.logo_url ? (
                <img src={schoolData.logo_url} alt={schoolData.name} className="w-7 h-7 rounded-lg object-contain bg-gray-100 p-0.5" />
              ) : (
                <img src="/logo.png" alt="Zamifu Analytics" className="w-7 h-7 rounded-lg object-contain" />
              )}
              <span className="text-base font-bold text-[#111111]">{schoolData?.name || 'Zamifu Analytics'}</span>
            </div>
            <div className="flex items-center gap-3">
              <PWAInstallButton variant="icon" />
              <Link to="/" className="text-sm text-[#666666] hover:text-[#111111] flex items-center gap-1">
                <Home className="w-4 h-4" />
                <span className="hidden sm:inline">Home</span>
              </Link>
              <button
                onClick={handleWhatsAppShare}
                className="hidden md:flex items-center gap-1.5 text-sm text-green-600 hover:text-green-800 font-medium"
                title="Share via WhatsApp"
              >
                <Share2 className="w-4 h-4" />
                <span className="hidden lg:inline">Share</span>
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-800 font-medium"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
              {zoomAvatar && user?.avatarUrl && (
                <PhotoZoomModal
                  photoUrl={user.avatarUrl}
                  altText={`${user.firstName} ${user.lastName}`}
                  onClose={() => setZoomAvatar(false)}
                />
              )}
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.firstName}
                  className="w-16 h-16 rounded-full object-cover border-2 border-gray-200 cursor-zoom-in hover:border-blue-400 hover:shadow-md transition-all"
                  onClick={() => setZoomAvatar(true)}
                  title="Click to zoom"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-[#2563EB] flex items-center justify-center text-white text-sm font-bold">
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
