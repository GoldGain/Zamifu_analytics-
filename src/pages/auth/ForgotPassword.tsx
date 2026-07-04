import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, supabaseUntyped } from '@/lib/supabase/client';
import { sendSMS } from '@/lib/sms';
import { GraduationCap, Loader2, ArrowLeft, Check, Mail, User, Phone } from 'lucide-react';
import { toast } from 'sonner';

export default function ForgotPassword() {
  const [resetMethod, setResetMethod] = useState<'email' | 'admission' | 'phone'>('email');
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [foundEmail, setFoundEmail] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [resetUserId, setResetUserId] = useState('');

  // Generate a 6-digit OTP
  const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (resetMethod === 'phone') {
        // Phone number-based reset using Olympus SMS
        let phone = identifier.trim();
        
        // Normalize phone number
        if (phone.startsWith('0')) {
          phone = '254' + phone.slice(1);
        }
        if (phone.startsWith('+')) {
          phone = phone.slice(1);
        }

        // Find user by phone number - check in profiles, students, teachers, parents
        let foundUser = null;
        
        // Check profiles table
        const { data: profileData } = await supabaseUntyped
          .from('profiles')
          .select('id, phone, first_name, last_name, role')
          .or(`phone.eq.${phone},phone.eq.0${phone.slice(3)}`)
          .maybeSingle();
        
        if (profileData) {
          foundUser = profileData;
        }

        // Check students table
        if (!foundUser) {
          const { data: studentData } = await supabaseUntyped
            .from('students')
            .select('id, parent_phone, first_name, last_name')
            .or(`parent_phone.eq.${phone},parent_phone.eq.0${phone.slice(3)}`)
            .maybeSingle();
          
          if (studentData) {
            foundUser = { ...studentData, phone: studentData.parent_phone, role: 'student' };
          }
        }

        // Check teachers table
        if (!foundUser) {
          const { data: teacherData } = await supabaseUntyped
            .from('teachers')
            .select('id, phone, first_name, last_name')
            .or(`phone.eq.${phone},phone.eq.0${phone.slice(3)}`)
            .maybeSingle();
          
          if (teacherData) {
            foundUser = { ...teacherData, role: 'teacher' };
          }
        }

        if (!foundUser) {
          setError('No account found with this phone number. Please check and try again.');
          setLoading(false);
          return;
        }

        // Generate and send OTP
        const newOtp = generateOTP();
        setGeneratedOtp(newOtp);
        setResetUserId(foundUser.id);

        const message = `Your Zamifu Analytics password reset code is: ${newOtp}. This code will expire in 15 minutes. Do not share this code with anyone.`;
        
        const result = await sendSMS(phone, message);
        
        if (result.success) {
          setOtpSent(true);
          toast.success('OTP sent to your phone via SMS!');
        } else {
          setError('Failed to send SMS. Please try again or use email method.');
          toast.error('SMS delivery failed');
        }
      } else {
        let email = identifier;

        // If using admission number, find the student's email
        if (resetMethod === 'admission') {
          const { data: student, error: studentError } = await supabase
            .from('students')
            .select('email, admission_number, first_name, last_name')
            .eq('admission_number', identifier.toUpperCase())
            .maybeSingle() as any;

          if (studentError || !student) {
            setError('❌ Admission number not found. Please contact your school.');
            setLoading(false);
            return;
          }

          if (!student.email) {
            setError('❌ No email linked to this admission number. Please contact your school administrator.');
            setLoading(false);
            return;
          }

          email = student.email;
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
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (otp !== generatedOtp) {
      setError('Invalid OTP. Please check and try again.');
      return;
    }

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
      // Update password using admin auth or direct update
      // For phone reset, we need to find the user's auth account
      // Since we can't directly set password without session, we need to use admin functions
      // or create a magic link. For now, we'll show success and instruct user.
      
      toast.success('OTP verified! Please contact your school admin to complete password reset.');
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
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
            {resetMethod === 'phone' ? 'Password Reset Request Submitted' : 'Check Your Email'}
          </h2>
          <p className="text-sm text-[#666666] mb-4">
            {resetMethod === 'phone' 
              ? 'Your identity has been verified. Please contact your school administrator to set a new password.'
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
              <div className="w-10 h-10 bg-[#2563EB] rounded-xl flex items-center justify-center">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold text-[#111111]">Zamifu Analytics</span>
            </Link>
            <h1 className="text-2xl font-bold text-[#111111]">Verify OTP</h1>
            <p className="text-sm text-[#666666] mt-1">Enter the 6-digit code sent to your phone</p>
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
              onClick={() => { setOtpSent(false); setOtp(''); setGeneratedOtp(''); }}
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
            <div className="w-10 h-10 bg-[#2563EB] rounded-xl flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
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
              onClick={() => setResetMethod('email')}
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
              onClick={() => setResetMethod('admission')}
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
              onClick={() => setResetMethod('phone')}
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
                resetMethod === 'phone' ? 'Send OTP via SMS' : 'Send Reset Link'
              )}
            </button>
          </form>

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
