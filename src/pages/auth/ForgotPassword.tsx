import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, supabaseUntyped } from '@/lib/supabase/client';
import { lookupPasswordResetAccounts, requestPasswordResetOTP, verifyPasswordResetOTP, resetPasswordWithOTP, type PasswordResetAccountSummary } from '@/lib/sms';
import { Loader2, ArrowLeft, Check, Mail, User, Phone } from 'lucide-react';
import { toast } from 'sonner';

export default function ForgotPassword() {
  const [resetMethod, setResetMethod] = useState<'email' | 'admission' | 'phone'>('email');
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [foundEmail, setFoundEmail] = useState('');
  const [matchedAccount, setMatchedAccount] = useState<PasswordResetAccountSummary | null>(null);
  const [accountChoices, setAccountChoices] = useState<PasswordResetAccountSummary[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (resetMethod === 'phone') {
        const phone = identifier.trim();
        setAccountChoices([]);
        setSelectedAccountId('');
        setMatchedAccount(null);
        const result = await lookupPasswordResetAccounts(phone);
        if (!result.accounts?.length) {
          setError(result.message || 'No account is registered with this phone number.');
          return;
        }
        setAccountChoices(result.accounts);
        setSelectedAccountId(result.accounts.length === 1 ? result.accounts[0].id : '');
        setError('');
        toast.success(result.accounts.length === 1 ? 'Account found. Confirm it to receive an OTP.' : 'Select the account you want to reset.');
      } else {
        let email = identifier;

        // If using admission number, find the student's email
        if (resetMethod === 'admission') {
          const { data: student, error: studentError } = await supabase
            .from('students')
            .select('email, student_email, admission_number, assessment_number, first_name, last_name')
            .or(`admission_number.ilike.${identifier.trim()},assessment_number.ilike.${identifier.trim()}`)
            .maybeSingle() as any;

          if (studentError || !student) {
            setError('❌ Admission number not found. Please contact your school.');
            setLoading(false);
            return;
          }

          const linkedEmail = student.email || student.student_email;
          if (!linkedEmail) {
            setError('❌ No email linked to this Admission No / Assessment No. Please contact your school administrator.');
            setLoading(false);
            return;
          }

          email = linkedEmail;
          setFoundEmail(email);
          toast.success(`Found student: ${student.first_name} ${student.last_name}`);
        }

        // Send password reset email
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/reset-password`,
        });

        if (resetError) {
          setError(resetError.message);
          setLoading(false);
          return;
        }
        
        setSuccess(true);
        toast.success('Password reset link sent! Check your email.');
      }
    } catch (err: any) {
      setError(err?.message || 'We could not process the request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendPhoneOtp = async () => {
    if (!selectedAccountId) {
      setError('Select the account you want to reset first.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const result = await requestPasswordResetOTP(identifier.trim(), selectedAccountId);
      if (!result.success) {
        setError(result.message || 'We could not send the reset code. Please try again.');
        return;
      }
      setMatchedAccount(result.account || accountChoices.find((account) => account.id === selectedAccountId) || null);
      setOtpSent(true);
      toast.success('A password reset code has been sent to your phone.');
    } catch (err: any) {
      setError(err?.message || 'We could not send the reset code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');


    if (!newPassword || newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      // Verify and reset through the server-side Edge Function. The OTP is
      // never trusted from browser state and the password is never changed client-side.
      if (!selectedAccountId) {
        throw new Error('Please select the account you want to reset.');
      }
      await verifyPasswordResetOTP(identifier.trim(), otp.trim(), selectedAccountId);
      await resetPasswordWithOTP(identifier.trim(), otp.trim(), newPassword, selectedAccountId);
      toast.success('Password reset successfully. You can now sign in.');
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password. Please request a new code.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#F5F3EF] flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-[#111111] mb-2">
            {resetMethod === 'phone' ? 'Password Reset Complete' : 'Check Your Email'}
          </h2>
          <p className="text-sm text-[#666666] mb-4">
            {resetMethod === 'phone' 
              ? 'Your password has been changed successfully. You can now sign in with the new password.'
              : `We sent a password reset link to ${foundEmail || identifier}`
            }
          </p>
          <Link
            to="/auth/login"
            className="inline-flex items-center gap-2 bg-[#2563EB] text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-[#1d4ed8] transition-colors"
          >
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  if (otpSent) {
    return (
      <div className="min-h-screen bg-[#F5F3EF] flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="mb-6">
            <Link to="/auth/login" className="inline-flex items-center gap-1 text-sm text-[#666666] hover:text-[#111111] transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back to Login
            </Link>
          </div>

          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2 mb-6">
              <img src="/icon-192.png" alt="Zamifu Analytics" className="w-12 h-12 rounded-xl object-contain" />
              <span className="text-2xl font-bold text-[#111111]">Zamifu Analytics</span>
            </Link>
            <h1 className="text-2xl font-bold text-[#111111]">Verify OTP</h1>
            <p className="text-sm text-[#666666] mt-1">Enter the 6-digit code sent to your phone</p>
            {matchedAccount && (
              <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-left text-xs text-blue-900">
                <p className="font-semibold">Account matched</p>
                <p>{matchedAccount.display_name} · {matchedAccount.role.replace(/_/g, ' ')}</p>
                {matchedAccount.masked_email && <p className="text-blue-700">{matchedAccount.masked_email}</p>}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl p-6 md:p-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                {error}
              </div>
            )}

            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#111111] mb-1.5">OTP Code</label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Enter 6-digit OTP"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent text-center text-2xl tracking-widest"
                  required
                  maxLength={6}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#111111] mb-1.5">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
                  required
                  minLength={6}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#111111] mb-1.5">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#2563EB] text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-[#1d4ed8] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Reset Password'}
              </button>
            </form>

            <button
              onClick={() => { setOtpSent(false); setOtp(''); setMatchedAccount(null); setAccountChoices([]); setSelectedAccountId(''); setError(''); }}
              className="w-full mt-4 text-sm text-[#2563EB] hover:underline"
            >
              Didn&apos;t receive OTP? Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F3EF] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <Link to="/auth/login" className="inline-flex items-center gap-1 text-sm text-[#666666] hover:text-[#111111] transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Login
          </Link>
        </div>

        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <img src="/icon-192.png" alt="Zamifu Analytics" className="w-12 h-12 rounded-xl object-contain" />
            <span className="text-2xl font-bold text-[#111111]">Zamifu Analytics</span>
          </Link>
          <h1 className="text-2xl font-bold text-[#111111]">Reset Password</h1>
          <p className="text-sm text-[#666666] mt-1">We&apos;ll send you a reset link or OTP</p>
        </div>

        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Toggle between Email, Assessment Number, and Phone */}
          <div className="flex gap-2 mb-6 p-1 bg-gray-100 rounded-xl">
            <button
              type="button"
              onClick={() => { setResetMethod('email'); setMatchedAccount(null); setAccountChoices([]); setSelectedAccountId(''); setError(''); }}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
                resetMethod === 'email' 
                  ? 'bg-[#2563EB] text-white' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Mail className="w-4 h-4" /> Email
            </button>
            <button
              type="button"
              onClick={() => { setResetMethod('admission'); setMatchedAccount(null); setAccountChoices([]); setSelectedAccountId(''); setError(''); }}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
                resetMethod === 'admission' 
                  ? 'bg-[#2563EB] text-white' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <User className="w-4 h-4" /> Admission
            </button>
            <button
              type="button"
              onClick={() => { setResetMethod('phone'); setMatchedAccount(null); setAccountChoices([]); setSelectedAccountId(''); setError(''); }}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
                resetMethod === 'phone' 
                  ? 'bg-[#2563EB] text-white' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Phone className="w-4 h-4" /> Phone
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#111111] mb-1.5">
                {resetMethod === 'email' ? 'Email Address' : resetMethod === 'admission' ? 'Admission Number' : 'Phone Number'}
              </label>
              <input
                type={resetMethod === 'email' ? 'email' : 'text'}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={
                  resetMethod === 'email' 
                    ? 'you@school.ac.ke' 
                    : resetMethod === 'admission' 
                    ? 'e.g., GFA-2025-001'
                    : 'e.g., 0712345678 or 254712345678'
                }
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
                required
                autoFocus
              />
              {resetMethod === 'phone' && (
                <p className="text-xs text-gray-500 mt-1">
                  Enter the phone number linked to your account. An OTP will be sent via SMS.
                </p>
              )}
              {resetMethod === 'admission' && (
                <p className="text-xs text-gray-500 mt-1">
                  Enter your admission number to reset your password
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#2563EB] text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-[#1d4ed8] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                resetMethod === 'phone'
                  ? accountChoices.length > 0 ? 'Find Different Number' : 'Find Account'
                  : 'Send Reset Link'
              )}
            </button>
          </form>

          {resetMethod === 'phone' && accountChoices.length > 0 && (
            <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50/70 p-4">
              <div className="mb-3">
                <h2 className="text-sm font-semibold text-blue-950">Select an account</h2>
                <p className="mt-1 text-xs text-blue-800">Choose the account whose password you want to reset. The OTP will be sent to the phone number above.</p>
              </div>
              <div className="space-y-2">
                {accountChoices.map((account) => {
                  const selected = selectedAccountId === account.id;
                  return (
                    <button
                      key={account.id}
                      type="button"
                      onClick={() => { setSelectedAccountId(account.id); setError(''); }}
                      className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${
                        selected ? 'border-[#2563EB] bg-white ring-2 ring-[#2563EB]/20' : 'border-blue-100 bg-white/70 hover:border-blue-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-[#111111]">{account.display_name}</p>
                          <p className="mt-0.5 text-xs capitalize text-gray-600">{account.role.replace(/_/g, ' ')}</p>
                          {account.masked_email && <p className="mt-0.5 text-xs text-gray-500">{account.masked_email}</p>}
                        </div>
                        <span className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 ${selected ? 'border-[#2563EB] bg-[#2563EB] ring-2 ring-white ring-inset' : 'border-gray-300'}`} />
                      </div>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={handleSendPhoneOtp}
                disabled={loading || !selectedAccountId}
                className="mt-4 w-full rounded-xl bg-[#2563EB] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Send OTP via SMS'}
              </button>
            </div>
          )}

          <div className="mt-6 text-center text-sm text-[#666666]">
            Remember your password?{' '}
            <Link to="/auth/login" className="text-[#2563EB] font-medium hover:underline">
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
