import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, supabaseUntyped } from '@/lib/supabase/client';
import { Link } from 'react-router';
import { Users, CreditCard, Bell, BookOpen, AlertTriangle, ChevronRight, BarChart3, UserCheck } from 'lucide-react';
import PromoteToNextTermModal from '@/components/PromoteToNextTermModal';
import TrialCountdown from '@/components/TrialCountdown';

interface SchoolStats {
  totalStudents: number;
  totalTeachers: number;
  totalClasses: number;
  feeCollection: number;
  pendingFees: number;
}

interface AnnouncementRecord {
  id: string;
  title: string;
  content: string;
  type: string;
}

export default function SchoolAdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<SchoolStats>({ totalStudents: 0, totalTeachers: 0, totalClasses: 0, feeCollection: 0, pendingFees: 0 });
  const [loading, setLoading] = useState(true);
  const [announcements, setAnnouncements] = useState<AnnouncementRecord[]>([]);
  const [currentTerm, setCurrentTerm] = useState<any>(null);
  const [showPromoteTermModal, setShowPromoteTermModal] = useState(false);

  useEffect(() => {
    if (user?.schoolId) {
      fetchSchoolStats();
      fetchCurrentTerm();
    }
  }, [user]);

  const fetchCurrentTerm = async () => {
    try {
      const { data } = await supabase
        .from('terms')
        .select('*')
        .eq('school_id', user?.schoolId || '')
        .eq('is_current', true)
        .single();
      setCurrentTerm(data);
    } catch (err) {
      console.error('Error fetching current term:', err);
    }
  };

  const fetchSchoolStats = async () => {
    try {
      setLoading(true);
      const schoolId = user?.schoolId;
      
      const { count: studentsCount } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('school_id', schoolId ?? '');
      const { count: teachersCount } = await supabase.from('teachers').select('*', { count: 'exact', head: true }).eq('school_id', schoolId ?? '');
      const { count: classesCount } = await supabase.from('classes').select('*', { count: 'exact', head: true }).eq('school_id', schoolId ?? '');
      
      const [{ data: invoices, error: invoicesError }, { data: paymentRows, error: paymentsError }] = await Promise.all([
        supabaseUntyped
          .from('fee_invoices')
          .select('id, total_amount, amount_paid')
          .eq('school_id', schoolId)
          .is('deleted_at', null),
        supabaseUntyped
          .from('fee_payments')
          .select('invoice_id, amount')
          .eq('school_id', schoolId),
      ]);

      if (invoicesError) throw invoicesError;
      if (paymentsError) throw paymentsError;

      // Payment rows are authoritative. Retain amount_paid only for legacy
      // invoices that have no corresponding payment rows yet.
      const paymentsByInvoice = new Map<string, number>();
      (paymentRows || []).forEach((payment: any) => {
        const invoiceId = String(payment.invoice_id || '');
        if (!invoiceId) return;
        paymentsByInvoice.set(invoiceId, (paymentsByInvoice.get(invoiceId) || 0) + Number(payment.amount || 0));
      });

      let totalPaid = 0;
      let pendingFees = 0;
      (invoices || []).forEach((invoice: any) => {
        const invoiceId = String(invoice.id || '');
        const paid = paymentsByInvoice.has(invoiceId)
          ? paymentsByInvoice.get(invoiceId) || 0
          : Number(invoice.amount_paid || 0);
        totalPaid += paid;
        pendingFees += Math.max(0, Number(invoice.total_amount || 0) - paid);
      });
      
      setStats({
        totalStudents: studentsCount || 0,
        totalTeachers: teachersCount || 0,
        totalClasses: classesCount || 0,
        feeCollection: totalPaid,
        pendingFees,
      });

      const { data: anns } = await supabaseUntyped.from('announcements').select('*').eq('school_id', schoolId).eq('is_published', true).order('created_at', { ascending: false }).limit(5);
      setAnnouncements((anns || []) as AnnouncementRecord[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { label: 'Learners', value: stats.totalStudents, icon: <Users className="w-5 h-5" />, color: 'bg-blue-500', link: '/school-admin/students' },
    { label: 'Teachers', value: stats.totalTeachers, icon: <Users className="w-5 h-5" />, color: 'bg-green-500', link: '/school-admin/teachers' },
    { label: 'Classes', value: stats.totalClasses, icon: <BookOpen className="w-5 h-5" />, color: 'bg-purple-500', link: '/school-admin/classes' },
    { label: 'Fee Collection', value: `Ksh ${stats.feeCollection.toLocaleString()}`, icon: <CreditCard className="w-5 h-5" />, color: 'bg-orange-500', link: '/school-admin/fees' },
    { label: 'Assessments', value: 'Manage', icon: <BookOpen className="w-5 h-5" />, color: 'bg-indigo-500', link: '/school-admin/assessments' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        {user?.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={`${user.firstName} ${user.lastName}`}
            className="w-16 h-16 rounded-full object-cover border-4 border-white shadow-md"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xl border-4 border-white shadow-md">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold text-[#111111]">School Dashboard</h1>
          <p className="text-sm text-[#666666]">Welcome back, {user?.firstName}</p>
        </div>
      </div>

      {/* Trial Countdown Banner */}
      <TrialCountdown />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <Link key={i} to={card.link} className="bg-white rounded-2xl p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,0.12)] transition-all">
            <div className={`w-10 h-10 ${card.color} rounded-xl flex items-center justify-center text-white mb-3`}>{card.icon}</div>
            <div className="text-2xl font-bold text-[#111111]">{loading ? '...' : card.value}</div>
            <div className="text-xs text-[#666666] mt-1">{card.label}</div>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <h3 className="font-semibold text-[#111111]">Pending Fees</h3>
              <p className="text-xs text-[#666666]">Outstanding fee balance</p>
            </div>
          </div>
          <div className="text-3xl font-bold text-red-500">Ksh {stats.pendingFees.toLocaleString()}</div>
          <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-red-400 rounded-full" style={{ width: `${stats.pendingFees > 0 ? (stats.pendingFees / (stats.feeCollection + stats.pendingFees)) * 100 : 0}%` }} />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
          <h3 className="font-semibold text-[#111111] mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Add Learner', icon: <Users className="w-4 h-4" />, link: '/school-admin/students', color: 'bg-blue-50 text-blue-600' },
              { label: 'Add Teacher', icon: <Users className="w-4 h-4" />, link: '/school-admin/teachers', color: 'bg-green-50 text-green-600' },
              { label: 'Record Payment', icon: <CreditCard className="w-4 h-4" />, link: '/school-admin/fees', color: 'bg-orange-50 text-orange-600' },
              { label: 'Post Announcement', icon: <Bell className="w-4 h-4" />, link: '/school-admin/announcements', color: 'bg-purple-50 text-purple-600' },
              { label: 'Assign Roles', icon: <UserCheck className="w-4 h-4" />, link: '/school-admin/assign-roles', color: 'bg-indigo-50 text-indigo-600' },
              { label: 'Marks Overview', icon: <BarChart3 className="w-4 h-4" />, link: '/school-admin/marks-overview', color: 'bg-green-50 text-green-600' },
            ].map((action, i) => (
              <Link key={i} to={action.link} className={`flex items-center gap-2 p-3 rounded-xl ${action.color} hover:opacity-80 transition-opacity text-sm font-medium`}>
                {action.icon} {action.label}
              </Link>
            ))}
          </div>
          <button
            onClick={() => setShowPromoteTermModal(true)}
            className="w-full mt-3 flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-purple-50 to-pink-50 text-purple-600 hover:opacity-80 transition-opacity text-sm font-medium border border-purple-200"
          >
            <span>📅 Promote to Next Term</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-[#111111]">Recent Announcements</h3>
          <Link to="/school-admin/announcements" className="text-sm text-[#2563EB] hover:underline">View All</Link>
        </div>
        {announcements.length === 0 ? (
          <p className="text-sm text-[#666666] py-4 text-center">No announcements yet</p>
        ) : (
          <div className="space-y-3">
            {announcements.map((a) => (
              <div key={a.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                <Bell className="w-4 h-4 text-[#2563EB] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-[#111111]">{a.title}</p>
                  <p className="text-xs text-[#666666] mt-0.5 line-clamp-2">{a.content}</p>
                  <span className={`text-[10px] mt-1 inline-block px-2 py-0.5 rounded-full ${
                    a.type === 'fee_reminder' ? 'bg-orange-100 text-orange-600' :
                    a.type === 'assessment' ? 'bg-blue-100 text-blue-600' :
                    a.type === 'emergency' ? 'bg-red-100 text-red-600' :
                    'bg-gray-100 text-gray-600'
                  }`}>{a.type}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Promote to Next Term Modal */}
      {showPromoteTermModal && (
        <PromoteToNextTermModal
          schoolId={user?.schoolId || ''}
          currentTerm={currentTerm}
          onClose={() => setShowPromoteTermModal(false)}
          onSuccess={() => {
            setShowPromoteTermModal(false);
            fetchCurrentTerm();
            fetchSchoolStats();
          }}
        />
      )}
    </div>
  );
}
