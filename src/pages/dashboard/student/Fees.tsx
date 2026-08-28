import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabaseUntyped } from '@/lib/supabase/client';
import { AlertTriangle, Receipt } from 'lucide-react';

export default function StudentFees() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchFees(); }, []);

  const fetchFees = async () => {
    setLoading(true);
    const { data: student } = await supabaseUntyped.from('students').select('id').eq('profile_id', user?.id).single();
    if (student) {
      const { data } = await supabaseUntyped.from('fee_invoices').select('*, terms(name)').eq('student_id', student.id).is('deleted_at', null).order('created_at', { ascending: false });
      setInvoices(data || []);
    }
    setLoading(false);
  };

  const totalBalance = invoices.reduce((s, i) => s + Number(i.balance ?? Math.max(0, Number(i.total_amount || 0) - Number(i.amount_paid || 0))), 0);
  const totalPaid = invoices.reduce((s, i) => s + (i.amount_paid || 0), 0);
  const totalDue = invoices.reduce((s, i) => s + (i.total_amount || 0), 0);

  const statusColor = (status: string) => {
    if (status === 'paid') return 'bg-green-100 text-green-700';
    if (status === 'partial') return 'bg-yellow-100 text-yellow-700';
    return 'bg-red-100 text-red-700';
  };

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-[#111111]">My Fees</h1><p className="text-sm text-[#666666]">View your fee statement</p></div>

      {/* Fee Summary */}
      <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-xl">
            <div className="text-lg font-bold text-blue-600">Ksh {totalDue.toLocaleString()}</div>
            <div className="text-xs text-blue-400 mt-1">Total Due</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-xl">
            <div className="text-lg font-bold text-green-600">Ksh {totalPaid.toLocaleString()}</div>
            <div className="text-xs text-green-400 mt-1">Amount Paid</div>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-xl">
            <div className="text-lg font-bold text-red-600">Ksh {totalBalance.toLocaleString()}</div>
            <div className="text-xs text-red-400 mt-1">Balance</div>
          </div>
        </div>
      </div>

      {/* Important Note */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-yellow-800">Payment Information</p>
          <p className="text-xs text-yellow-600 mt-1">Fees are paid physically at school (cash, bank, or M-Pesa directly to the school). This page is for viewing only. Contact the school admin for payment.</p>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="text-left text-xs font-medium text-[#666666] uppercase px-6 py-4">Term</th>
              <th className="text-left text-xs font-medium text-[#666666] uppercase px-6 py-4">Total</th>
              <th className="text-left text-xs font-medium text-[#666666] uppercase px-6 py-4">Paid</th>
              <th className="text-left text-xs font-medium text-[#666666] uppercase px-6 py-4">Balance</th>
              <th className="text-left text-xs font-medium text-[#666666] uppercase px-6 py-4">Status</th>
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={5} className="text-center py-8 text-sm text-[#666666]">Loading...</td></tr> :
               invoices.length === 0 ? <tr><td colSpan={5} className="text-center py-8 text-sm text-[#666666]">No fee records</td></tr> :
               invoices.map(inv => (
                <tr key={inv.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4"><div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-gray-400" />
                    <span className="text-sm">{inv.terms?.name} {inv.academic_year}</span>
                  </div></td>
                  <td className="px-6 py-4 text-sm">Ksh {inv.total_amount?.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-green-600">Ksh {inv.amount_paid?.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm font-medium text-red-500">Ksh {inv.balance?.toLocaleString()}</td>
                  <td className="px-6 py-4"><span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColor(inv.status)} capitalize`}>{inv.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
