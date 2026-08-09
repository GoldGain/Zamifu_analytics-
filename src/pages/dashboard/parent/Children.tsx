import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, supabaseUntyped } from '@/lib/supabase/client';
import { Award, ClipboardList, Lock, CreditCard, CheckCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

declare global {
  interface Window {
    PaystackPop?: {
      setup: (options: Record<string, any>) => { openIframe: () => void };
    };
  }
}

interface ChildRecord {
  id: string;
  first_name: string;
  last_name: string;
  admission_number: string;
  school_id: string;
  classes: { name: string } | null;
  curriculum: string;
  gender: string | null;
  photo_url?: string | null;
}

interface ResultRecord {
  id: string;
  marks: number | null;
  cbc_grade: string | null;
  cbc_points: number | null;
  points_: number | null;
  grade_: string | null;
  subjects: { name: string } | null;
}

interface AttendanceRecord {
  id: string;
  date: string;
  status: string;
}

interface SchoolPayConfig {
  parent_pay_enabled: boolean;
  view_results_fee: number;
  pdf_report_fee: number;
  reseller_id: string | null;
  reseller_paystack_public_key: string | null;
}

function loadPaystackScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.PaystackPop) return resolve();
    const existing = document.querySelector('script[src="https://js.paystack.co/v1/inline.js"]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load Paystack.')));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Paystack.'));
    document.body.appendChild(script);
  });
}

export default function ParentChildren() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [children, setChildren] = useState<ChildRecord[]>([]);
  const [selectedChild, setSelectedChild] = useState<ChildRecord | null>(null);
  const [childResults, setChildResults] = useState<ResultRecord[]>([]);
  const [childAttendance, setChildAttendance] = useState<AttendanceRecord[]>([]);
  const [schoolPayConfig, setSchoolPayConfig] = useState<SchoolPayConfig | null>(null);
  const [resultsPaid, setResultsPaid] = useState<Record<string, boolean>>({});
  const [paying, setPaying] = useState(false);

  useEffect(() => { fetchChildren(); }, []);

  const fetchChildren = async () => {
    // Load children linked via parent_student_links
    const { data: linked } = await supabaseUntyped
      .from('parent_student_links')
      .select('*, students(id, first_name, last_name, admission_number, school_id, class_id, classes(name), photo_url, curriculum, gender))')
      .eq('parent_id', user?.id);
    if (linked) {
      const kids = linked.map((l: any) => l.students as unknown as ChildRecord).filter(Boolean);
      setChildren(kids);
      if (kids.length > 0) selectChildDetails(kids[0]);
    }
  };

  /**
   * Fetches the school's payment config.
   * Payment is ONLY enabled if:
   * 1. The school's reseller has parent_pay_enabled = true
   * 2. The reseller has a valid paystack_public_key
   *
   * This means ONLY Theophillus's schools will show the payment button,
   * since only Theophillus's reseller records have these fields set.
   */
  const fetchSchoolPayConfig = async (schoolId: string): Promise<SchoolPayConfig | null> => {
    const { data: school } = await supabaseUntyped
      .from('schools')
      .select('parent_pay_enabled, view_results_fee, pdf_report_fee, reseller_id')
      .eq('id', schoolId)
      .maybeSingle();
    if (!school) return null;

    let resellerPaystackKey: string | null = null;
    let resellerPayEnabled = false;

    if (school.reseller_id) {
      const { data: reseller } = await supabaseUntyped
        .from('resellers')
        .select('paystack_public_key, parent_pay_enabled, name')
        .eq('id', school.reseller_id)
        .maybeSingle();

      // Only enable payment if reseller has both parent_pay_enabled AND a valid Paystack key
      if (reseller?.parent_pay_enabled && reseller?.paystack_public_key) {
        resellerPaystackKey = reseller.paystack_public_key;
        resellerPayEnabled = true;
      }
    }

    return {
      // Payment gate: school must have parent_pay_enabled AND reseller must have key
      parent_pay_enabled: !!(school.parent_pay_enabled && resellerPayEnabled && resellerPaystackKey),
      view_results_fee: school.view_results_fee || 50,
      pdf_report_fee: school.pdf_report_fee || 50,
      reseller_id: school.reseller_id,
      reseller_paystack_public_key: resellerPaystackKey,
    };
  };

  const checkResultsPaid = async (childId: string): Promise<boolean> => {
    if (resultsPaid[childId]) return true;
    const { data } = await supabaseUntyped
      .from('parent_payments')
      .select('id')
      .eq('parent_id', user?.id)
      .eq('student_id', childId)
      .eq('payment_type', 'view_results')
      .eq('status', 'success')
      .limit(1);
    const paid = !!(data && data.length > 0);
    if (paid) setResultsPaid(prev => ({ ...prev, [childId]: true }));
    return paid;
  };

  const loadResults = async (childId: string) => {
    const { data: results } = await supabase
      .from('results')
      .select('*, subjects(name)')
      .eq('student_id', childId)
      .order('created_at', { ascending: false });
    setChildResults((results || []) as unknown as ResultRecord[]);
  };

  const selectChildDetails = async (child: ChildRecord) => {
    setSelectedChild(child);
    setChildResults([]);
    setChildAttendance([]);

    const payConfig = await fetchSchoolPayConfig(child.school_id);
    setSchoolPayConfig(payConfig);

    const { data: attendance } = await supabase
      .from('attendance')
      .select('*')
      .eq('student_id', child.id)
      .order('date', { ascending: false })
      .limit(14);
    setChildAttendance((attendance || []) as unknown as AttendanceRecord[]);

    if (payConfig?.parent_pay_enabled) {
      const paid = await checkResultsPaid(child.id);
      if (paid) await loadResults(child.id);
    } else {
      // Free results for non-Theophillus schools
      await loadResults(child.id);
    }
  };

  const handlePayForResults = useCallback(async () => {
    if (!selectedChild || !schoolPayConfig || !user?.email) {
      toast.error('Missing payment information');
      return;
    }
    if (!schoolPayConfig.reseller_paystack_public_key) {
      toast.error('Payment not configured for this school');
      return;
    }
    setPaying(true);
    try {
      await loadPaystackScript();
      if (!window.PaystackPop) throw new Error('Paystack not loaded');

      const amount = schoolPayConfig.view_results_fee;
      const reference = `results_${selectedChild.id}_${Date.now()}`;

      const handler = window.PaystackPop.setup({
        key: schoolPayConfig.reseller_paystack_public_key,
        email: user.email,
        amount: amount * 100, // Paystack uses kobo/cents
        currency: 'KES',
        ref: reference,
        metadata: {
          custom_fields: [
            { display_name: 'Student', variable_name: 'student', value: `${selectedChild.first_name} ${selectedChild.last_name}` },
            { display_name: 'Payment Type', variable_name: 'type', value: 'View Results' },
          ],
        },
        // NOTE: Paystack V1 inline.js rejects async arrow functions in callbacks
        // ("Attribute callback must be a valid function") — wrap async logic in a
        // plain synchronous function
        callback: (response: any) => {
          supabaseUntyped.from('parent_payments').insert({
            parent_id: user.id,
            parent_name: `${user.firstName} ${user.lastName}`,
            student_id: selectedChild.id,
            student_name: `${selectedChild.first_name} ${selectedChild.last_name}`,
            school_id: selectedChild.school_id,
            reseller_id: schoolPayConfig.reseller_id,
            amount: amount,
            payment_type: 'view_results',
            status: 'success',
            paystack_reference: response.reference || reference,
          }).then(({ error }) => {
            if (error) {
              toast.error('Payment recorded but failed to save: ' + error.message);
            } else {
              toast.success(`Payment of KES ${amount} successful! Loading results...`);
              setResultsPaid(prev => ({ ...prev, [selectedChild.id]: true }));
              loadResults(selectedChild.id);
            }
            setPaying(false);
          });
        },
        onClose: () => {
          toast.info('Payment cancelled');
          setPaying(false);
        },
      });
      handler.openIframe();
    } catch (err: any) {
      toast.error(err.message || 'Payment failed');
      setPaying(false);
    }
  }, [selectedChild, schoolPayConfig, user]);

  const gradeColor = (grade: string | null) => {
    if (!grade) return 'bg-gray-100 text-gray-700';
    if (grade.startsWith('EE')) return 'bg-green-100 text-green-700';
    if (grade.startsWith('ME')) return 'bg-blue-100 text-blue-700';
    if (grade.startsWith('AE')) return 'bg-orange-100 text-orange-700';
    return 'bg-red-100 text-red-700';
  };

  const attendanceStatusIcon = (status: string) => {
    if (status === 'present') return <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-[10px] font-bold">P</div>;
    if (status === 'absent') return <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-[10px] font-bold">A</div>;
    return <div className="w-6 h-6 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-600 text-[10px] font-bold">L</div>;
  };

  const isResultsPaid = selectedChild ? !!resultsPaid[selectedChild.id] : false;
  const requiresPayment = !!(schoolPayConfig?.parent_pay_enabled && !isResultsPaid);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#111111]">My Children</h1>
        <p className="text-sm text-[#666666]">View your children&apos;s progress</p>
      </div>
      <div className="flex gap-3 flex-wrap">
        {children.length === 0 && (
          <p className="text-sm text-gray-500">No children linked to your account yet. Contact your school admin.</p>
        )}
        {children.map((child, i) => (
          <button key={i} onClick={() => selectChildDetails(child)} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${selectedChild?.id === child.id ? 'bg-[#2563EB] text-white' : 'bg-white text-[#111111] shadow-sm hover:bg-gray-50'}`}>
            {child.photo_url ? (
              <img src={child.photo_url} alt={child.first_name} className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${selectedChild?.id === child.id ? 'bg-white/20' : 'bg-blue-100 text-blue-600'}`}>
                {child.first_name?.[0]}{child.last_name?.[0]}
              </div>
            )}
            <span className="text-sm font-medium">{child.first_name} {child.last_name}</span>
          </button>
        ))}
      </div>
      {selectedChild && (
        <>
          <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
            <div className="flex items-center gap-4 mb-4">
              {selectedChild.photo_url ? (
                <img src={selectedChild.photo_url} alt={selectedChild.first_name} className="w-14 h-14 rounded-full object-cover border-2 border-blue-100" />
              ) : (
                <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-lg">{selectedChild.first_name?.[0]}{selectedChild.last_name?.[0]}</div>
              )}
              <div>
                <h3 className="text-lg font-semibold">{selectedChild.first_name} {selectedChild.last_name}</h3>
                <p className="text-sm text-[#666666]">{selectedChild.classes?.name} | {selectedChild.admission_number} | {selectedChild.curriculum}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
            <div className="flex items-center gap-2 mb-4">
              <ClipboardList className="w-5 h-5 text-green-500" />
              <h3 className="font-semibold text-[#111111]">Recent Attendance (Last 14 days)</h3>
            </div>
            {childAttendance.length === 0 ? <p className="text-sm text-[#666666]">No attendance records</p> : (
              <div className="flex flex-wrap gap-2">
                {childAttendance.map((a, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    {attendanceStatusIcon(a.status)}
                    <span className="text-[10px] text-[#666666]">{new Date(a.date).getDate()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
            <div className="flex items-center gap-2 mb-4">
              <Award className="w-5 h-5 text-purple-500" />
              <h3 className="font-semibold text-[#111111]">Results</h3>
              {isResultsPaid && <span className="ml-auto flex items-center gap-1 text-xs text-green-600 font-medium"><CheckCircle className="w-3.5 h-3.5" /> Paid</span>}
            </div>
            {requiresPayment ? (
              <div className="text-center py-8 space-y-4">
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto">
                  <Lock className="w-8 h-8 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-[#111111] text-lg">Results are locked</p>
                  <p className="text-sm text-[#666666] mt-1">
                    Pay <strong>KES {schoolPayConfig?.view_results_fee || 50}</strong> to view {selectedChild.first_name}&apos;s results
                  </p>
                </div>
                <button
                  onClick={handlePayForResults}
                  disabled={paying}
                  className="inline-flex items-center gap-2 bg-[#2563EB] text-white px-6 py-3 rounded-xl font-semibold hover:bg-[#1d4ed8] disabled:opacity-50 transition-colors"
                >
                  {paying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                  {paying ? 'Processing...' : `Pay KES ${schoolPayConfig?.view_results_fee || 50} to View Results`}
                </button>
                <p className="text-xs text-gray-400">Secure payment via Paystack</p>
              </div>
            ) : childResults.length === 0 ? (
              <p className="text-sm text-[#666666]">No results yet</p>
            ) : (
              <div className="space-y-3">
                {childResults.map(r => (
                  <div key={r.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div>
                      <p className="text-sm font-medium">{r.subjects?.name}</p>
                      <p className="text-xs text-[#666666]">{r.marks}%</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${gradeColor(r.cbc_grade || r.grade_)}`}>{r.cbc_grade || r.grade_}</span>
                      <span className="text-xs text-[#666666]">{r.cbc_points || r.points_} pts</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!requiresPayment && (
              <button onClick={() => navigate('/parent/report-card')} className="w-full mt-4 bg-[#E6F24B] text-[#111111] py-2.5 rounded-xl text-sm font-semibold hover:bg-[#d4e044]">
                Download Report Card PDF
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
