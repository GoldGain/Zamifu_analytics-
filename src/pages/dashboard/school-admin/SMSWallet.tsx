import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { AlertCircle, ArrowDownCircle, CheckCircle, CreditCard, Loader2, MessageSquare, RefreshCw, WalletCards } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabaseUntyped } from '@/lib/supabase/client';

const PAYSTACK_PUBLIC_KEY = 'pk_live_c15b4c6c95f06f7408326b14395eb727147a8935';
const QUICK_PACKAGES = [100, 500, 1000];

type WalletTransaction = {
  id: string;
  transaction_type: 'topup' | 'debit' | 'refund' | 'adjustment';
  credits: number;
  amount_ksh: number;
  status: string;
  payment_reference?: string | null;
  created_at: string;
  sms_segments?: number | null;
  error_message?: string | null;
};

function loadPaystackScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.getElementById('paystack-script');
    if (existing) return resolve();
    const script = document.createElement('script');
    script.id = 'paystack-script';
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Paystack'));
    document.body.appendChild(script);
  });
}

async function readFunctionError(error: any, fallback: string): Promise<string> {
  let message = error?.message || fallback;
  try {
    const body = await error?.context?.json?.();
    if (body?.error) message = body.error;
  } catch {
    // Keep the safe fallback when the response body is unavailable.
  }
  return message;
}

export default function SMSWallet() {
  const { user } = useAuth();
  const schoolId = user?.schoolId || '';
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [creditsToBuy, setCreditsToBuy] = useState(100);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState(false);

  const loadWallet = async (silent = false) => {
    if (!schoolId) return;
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const [{ data: wallet, error: walletError }, { data: history, error: historyError }] = await Promise.all([
        supabaseUntyped.from('school_sms_wallets').select('sms_balance').eq('school_id', schoolId).maybeSingle(),
        supabaseUntyped
          .from('school_sms_transactions')
          .select('id, transaction_type, credits, amount_ksh, status, payment_reference, created_at, sms_segments, error_message')
          .eq('school_id', schoolId)
          .order('created_at', { ascending: false })
          .limit(30),
      ]);
      if (walletError) throw walletError;
      if (historyError) throw historyError;
      setBalance(Number(wallet?.sms_balance || 0));
      setTransactions((history || []) as WalletTransaction[]);
    } catch (error: any) {
      toast.error(error?.message || 'Could not load SMS wallet');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadWallet();
  }, [schoolId]);

  const credits = useMemo(() => Math.max(0, Math.floor(Number(creditsToBuy) || 0)), [creditsToBuy]);

  const handlePurchase = async () => {
    if (!schoolId || credits <= 0) return;
    try {
      setProcessing(true);
      await loadPaystackScript();
      const email = user?.email || 'school@example.com';
      const reference = `zamifu_sms_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      let callbackStarted = false;

      // @ts-ignore Paystack is loaded by the inline script.
      const handler = window.PaystackPop?.setup({
        key: PAYSTACK_PUBLIC_KEY,
        email,
        amount: credits * 100,
        currency: 'KES',
        ref: reference,
        metadata: {
          custom_fields: [
            { display_name: 'School', variable_name: 'school_id', value: schoolId },
            { display_name: 'Product', variable_name: 'product', value: 'sms_credits' },
            { display_name: 'SMS credits', variable_name: 'sms_credits', value: String(credits) },
          ],
        },
        callback: (response: any) => {
          callbackStarted = true;
          const paymentReference = response?.reference || reference;
          void supabaseUntyped.functions
            .invoke('verify-paystack-sms-topup', { body: { reference: paymentReference } })
            .then(async ({ data, error }) => {
              if (error) throw new Error(await readFunctionError(error, 'SMS top-up verification failed'));
              if (!data?.ok) throw new Error(data?.error || 'SMS top-up could not be verified');
              setBalance(Number(data.smsBalance || 0));
              toast.success(`Payment verified. ${Number(data.creditsAdded || credits).toLocaleString()} SMS credits added.`);
              await loadWallet(true);
            })
            .catch((error: any) => {
              toast.error(error?.message || 'Payment verification failed. Keep your reference and contact support before paying again.', { duration: 7000 });
            })
            .finally(() => setProcessing(false));
        },
        onClose: () => {
          if (callbackStarted) return;
          setProcessing(false);
          toast.info('Payment cancelled. You can try again anytime.');
        },
      });

      if (!handler) throw new Error('Paystack handler could not be initialized');
      handler.openIframe();
    } catch (error: any) {
      setProcessing(false);
      toast.error(error?.message || 'Could not start SMS credit purchase');
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-sm text-gray-500">Loading SMS wallet...</div>;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">School Admin</p>
          <h1 className="text-2xl font-bold text-gray-900 mt-1 flex items-center gap-2">
            <WalletCards className="w-7 h-7 text-blue-600" /> SMS Wallet
          </h1>
          <p className="text-sm text-gray-500 mt-1">Buy SMS credits at KES 1 per provider SMS segment.</p>
        </div>
        <button
          type="button"
          onClick={() => void loadWallet(true)}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh balance
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-1 rounded-2xl bg-gradient-to-br from-blue-700 to-indigo-700 text-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm text-blue-100">Available SMS credits</span>
            <MessageSquare className="w-5 h-5 text-blue-100" />
          </div>
          <p className="text-4xl font-bold mt-5">{balance.toLocaleString()}</p>
          <p className="text-sm text-blue-100 mt-2">KES {balance.toLocaleString()} sending value</p>
          <Link to="/school-admin/communicate" className="inline-flex items-center gap-1 text-xs text-white/90 underline mt-5">
            Go to Communicate
          </Link>
        </div>

        <div className="md:col-span-2 rounded-2xl bg-white border border-gray-100 shadow-sm p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Purchase SMS credits</h2>
              <p className="text-sm text-gray-500 mt-1">1 credit = 1 SMS segment. Long or Unicode messages may use more than one credit.</p>
            </div>
            <CreditCard className="w-6 h-6 text-green-600 flex-shrink-0" />
          </div>

          <div className="grid grid-cols-3 gap-2 mt-5">
            {QUICK_PACKAGES.map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => setCreditsToBuy(amount)}
                className={`rounded-xl border-2 p-3 text-left transition-colors ${credits === amount ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
              >
                <span className="block text-xs text-gray-500">SMS credits</span>
                <span className="block text-base font-bold text-gray-900">{amount.toLocaleString()}</span>
                <span className="block text-xs text-green-700">KES {amount.toLocaleString()}</span>
              </button>
            ))}
          </div>

          <div className="mt-4">
            <label htmlFor="sms-credit-amount" className="block text-sm font-medium text-gray-700 mb-1">Custom number of credits</label>
            <input
              id="sms-credit-amount"
              type="number"
              min={1}
              step={1}
              value={creditsToBuy}
              onChange={(event) => setCreditsToBuy(Number(event.target.value) || 0)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3 mt-4">
            <span className="text-sm text-gray-600">Amount to pay</span>
            <span className="text-lg font-bold text-gray-900">KES {credits.toLocaleString()}</span>
          </div>

          <button
            type="button"
            onClick={handlePurchase}
            disabled={processing || !schoolId || credits <= 0}
            className="w-full mt-4 inline-flex items-center justify-center gap-2 bg-green-600 text-white px-5 py-3 rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
            {processing ? 'Processing payment...' : `Buy ${credits.toLocaleString()} SMS credits with Paystack`}
          </button>
          <p className="text-xs text-gray-400 mt-3 text-center">Credits are added only after server-side Paystack verification.</p>
        </div>
      </div>

      <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 flex gap-3 text-sm text-amber-900">
        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-600" />
        <div>
          <p className="font-semibold">No free parent-SMS allowance is included in this wallet.</p>
          <p className="mt-1">Subscription and SMS credits are separate. The system reserves credits before sending and returns them automatically when the provider reports a failure.</p>
        </div>
      </div>

      <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Wallet activity</h2>
            <p className="text-xs text-gray-500 mt-1">Recent purchases, message usage, and provider-failure refunds.</p>
          </div>
          <ArrowDownCircle className="w-5 h-5 text-gray-400" />
        </div>
        {transactions.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-500">No SMS wallet activity yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Activity</th>
                  <th className="px-5 py-3">Credits</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => {
                  const isPositive = transaction.credits > 0;
                  const label = transaction.transaction_type === 'topup'
                    ? 'Credit purchase'
                    : transaction.transaction_type === 'debit'
                      ? 'SMS sent'
                      : transaction.transaction_type === 'refund'
                        ? 'Provider failure refund'
                        : 'Wallet adjustment';
                  return (
                    <tr key={transaction.id} className="border-t border-gray-100">
                      <td className="px-5 py-3 whitespace-nowrap text-gray-600">{new Date(transaction.created_at).toLocaleString()}</td>
                      <td className="px-5 py-3 font-medium text-gray-900">{label}</td>
                      <td className={`px-5 py-3 font-semibold ${isPositive ? 'text-green-700' : 'text-gray-700'}`}>{isPositive ? '+' : ''}{transaction.credits.toLocaleString()}</td>
                      <td className="px-5 py-3 text-gray-600">KES {Number(transaction.amount_ksh || 0).toLocaleString()}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${transaction.status === 'success' || transaction.status === 'refunded' ? 'bg-green-50 text-green-700' : transaction.status === 'failed' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
                          {transaction.status === 'success' || transaction.status === 'refunded' ? <CheckCircle className="w-3.5 h-3.5" /> : null}
                          {transaction.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
