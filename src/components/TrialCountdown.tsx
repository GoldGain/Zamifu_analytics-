import React, { useState, useEffect } from 'react';
import { useTrial } from '@/contexts/TrialContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { Clock, AlertTriangle, CheckCircle, CreditCard, Info, Loader2 } from 'lucide-react';
import { PaystackButton } from './Payment/PaystackButton';

export const TrialCountdown: React.FC = () => {
  const { trialStatus, isLoading } = useTrial();
  const { user } = useAuth();
  const [showPayment, setShowPayment] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Auto-fetch learners count from Supabase
  const [learnersCount, setLearnersCount] = useState<number>(0);
  const [fetchingLearners, setFetchingLearners] = useState<boolean>(false);

  useEffect(() => {
    const fetchLearnersCount = async () => {
      if (!user?.schoolId) return;
      setFetchingLearners(true);
      try {
        const { count, error } = await supabase
          .from('students')
          .select('*', { count: 'exact', head: true })
          .eq('school_id', user.schoolId);
        if (!error && count !== null) {
          setLearnersCount(count);
        }
      } catch (err) {
        console.error('Error fetching learners count:', err);
      } finally {
        setFetchingLearners(false);
      }
    };
    fetchLearnersCount();
  }, [user?.schoolId]);

  if (isLoading || !trialStatus) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 animate-pulse">
        <div className="h-5 bg-gray-200 rounded w-48"></div>
      </div>
    );
  }

  const { isPaid, isExpired, daysRemaining, progressPercent } = trialStatus;

  // Paid users — show success badge
  if (isPaid) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 flex items-center gap-3">
        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-green-800">
            Subscription Active
          </p>
          <p className="text-xs text-green-600">
            Your school has an active subscription. Thank you for your payment!
          </p>
        </div>
      </div>
    );
  }

  // Trial expired — show payment lock
  if (isExpired) {
    return (
      <div className="space-y-4">
        <div className="bg-red-50 border-2 border-red-300 rounded-2xl px-4 py-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-base font-bold text-red-800">
                Trial Period Expired
              </h3>
              <p className="text-sm text-red-700 mt-1">
                Your 90-day free trial has ended. Subscribe now to continue using the system.
              </p>
            </div>
          </div>
        </div>

        {!showPayment ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-6 text-center shadow-sm">
            <CreditCard className="w-12 h-12 text-blue-600 mx-auto mb-3" />
            <h4 className="text-lg font-semibold text-gray-900 mb-2">
              Subscribe to Zamifu Analytics
            </h4>
            <p className="text-sm text-gray-600 mb-4">
              Ksh 50 per learner per term
            </p>

            {/* Auto-calculated learner count summary */}
            <div className="bg-gray-50 rounded-xl p-4 mb-5 text-left max-w-xs mx-auto">
              <div className="flex justify-between py-1.5 border-b border-gray-200">
                <span className="text-sm text-gray-600">Number of Learners</span>
                <span className="text-sm font-semibold">
                  {fetchingLearners ? (
                    <Loader2 className="w-4 h-4 animate-spin inline" />
                  ) : (
                    learnersCount
                  )}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-200">
                <span className="text-sm text-gray-600">Price per Learner</span>
                <span className="text-sm font-semibold">Ksh 50</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-sm font-bold text-gray-800">Total Amount</span>
                <span className="text-sm font-bold text-green-600">
                  {fetchingLearners ? (
                    <Loader2 className="w-4 h-4 animate-spin inline" />
                  ) : (
                    `Ksh ${(learnersCount * 50).toLocaleString()}`
                  )}
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowPayment(true)}
              disabled={fetchingLearners || learnersCount <= 0}
              className="bg-green-600 text-white px-8 py-3 rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 mx-auto"
            >
              {fetchingLearners ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  Subscribe Now — Ksh {(learnersCount * 50).toLocaleString()}
                </>
              )}
            </button>
            <p className="text-xs text-gray-400 mt-3">
              Secure payment powered by Paystack
            </p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <PaystackButton
              learnersCount={learnersCount}
              onSuccess={() => setShowPayment(false)}
              onClose={() => setShowPayment(false)}
            />
            <button
              onClick={() => setShowPayment(false)}
              className="w-full mt-3 text-sm text-gray-500 hover:text-gray-700 py-2"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    );
  }

  // Active trial — show countdown
  const progressColor = daysRemaining <= 7 ? 'bg-red-500' : daysRemaining <= 30 ? 'bg-orange-500' : 'bg-blue-500';
  const bgColor = daysRemaining <= 7 ? 'bg-red-50 border-red-200' : daysRemaining <= 30 ? 'bg-orange-50 border-orange-200' : 'bg-blue-50 border-blue-200';
  const textColor = daysRemaining <= 7 ? 'text-red-800' : daysRemaining <= 30 ? 'text-orange-800' : 'text-blue-800';
  const subTextColor = daysRemaining <= 7 ? 'text-red-600' : daysRemaining <= 30 ? 'text-orange-600' : 'text-blue-600';

  return (
    <div className={`${bgColor} border rounded-2xl px-4 py-3`}>
      <div className="flex items-center gap-3">
        <Clock className={`w-5 h-5 ${subTextColor} flex-shrink-0`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <p className={`text-sm font-semibold ${textColor}`}>
              Free Trial: {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining
            </p>
            <button
              onClick={() => setExpanded(!expanded)}
              className={`text-xs ${subTextColor} hover:underline ml-2 flex-shrink-0`}
            >
              {expanded ? 'Hide' : 'Details'}
            </button>
          </div>
          {/* Progress bar */}
          <div className="mt-2 h-2 bg-white/60 rounded-full overflow-hidden">
            <div
              className={`h-full ${progressColor} rounded-full transition-all duration-500`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          {expanded && (
            <div className="mt-3 pt-3 border-t border-current border-opacity-20">
              {!showPayment ? (
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 mt-0.5 flex-shrink-0 opacity-60" />
                  <div className={`text-xs ${subTextColor} space-y-1`}>
                    <p>Trial started: {new Date(trialStatus.trialData.trialStartDate).toLocaleDateString()}</p>
                    <p>Trial ends: {new Date(trialStatus.trialData.trialEndDate).toLocaleDateString()}</p>
                    <p>Price: Ksh 50 per learner per term</p>
                    <button
                      onClick={() => setShowPayment(true)}
                      className="mt-2 text-xs font-medium underline"
                    >
                      Subscribe early to avoid interruption
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <PaystackButton
                    learnersCount={learnersCount}
                    onSuccess={() => {
                      setShowPayment(false);
                      setExpanded(false);
                    }}
                    onClose={() => setShowPayment(false)}
                  />
                  <button
                    onClick={() => setShowPayment(false)}
                    className="w-full mt-2 text-[10px] text-gray-500 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TrialCountdown;
