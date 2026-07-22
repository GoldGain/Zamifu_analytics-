import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase, supabaseUntyped } from '@/lib/supabase/client';
import { sendSMS } from '@/lib/sms';
import { Eye, EyeOff, Loader2, ArrowLeft, Phone, Check } from 'lucide-react';
import { toast } from 'sonner';

export default function Register() {
  const navigate = useNavigate();

  // Step state: 'email' → 'phone' → 'otp' → 'register'
  const [step, setStep] = useState<'email' | 'phone' | 'otp' | 'register'>('email');

  // Form values
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Internal state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userData, setUserData] = useState<any>(null);
  const [generatedOtp, setGeneratedOtp] = useState('');

  // Generate a 6-digit OTP - EXACTLY like ForgotPassword
  const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  // ─── Step 1: Validate email exists in database ───────────────────────────
  const validateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!email) {
      setError('Please enter your email address');
      setLoading(false);
      return;
    }

    try {
      // Check profiles table
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, first_name, last_name, school_id, role, phone')
        .eq('email', email.toLowerCase())
        .maybeSingle() as any;

      if (profile) {
        setUserData({
          role: profile.role,
          email: profile.email,
          first_name: profile.first_name,
          last_name: profile.last_name,
          school_id: profile.school_id,
        });
        if (profile.phone) setPhone(profile.phone);
        setStep('phone');
        toast.success(`Welcome ${profile.first_name}! Please verify your phone number.`);
        return;
      }

      // Check teachers table
      const { data: teacher } = await supabase
        .from('teachers')
        .select('email, first_name, last_name, school_id, phone')
        .eq('email', email.toLowerCase())
        .maybeSingle() as any;

      if (teacher) {
        setUserData({
          role: 'teacher',
          email: teacher.email,
          first_name: teacher.first_name,
          last_name: teacher.last_name,
          school_id: teacher.school_id,
        });
        if (teacher.phone) setPhone(teacher.phone);
        setStep('phone');
        toast.success(`Welcome ${teacher.first_name}! Please verify your phone number.`);
        return;
      }

      // Check students table for parent email
      const { data: student } = await supabase
        .from('students')
        .select('parent_email, parent_name, school_id, parent_phone')
        .eq('parent_email', email.toLowerCase())
        .maybeSingle() as any;

      if (student) {
        setUserData({
          role: 'parent',
          email: student.parent_email,
          first_name: student.parent_name?.split(' ')[0] || 'Parent',
          last_name: student.parent_name?.split(' ')[1] || '',
          school_id: student.school_id,
        });
        if (student.parent_phone) setPhone(student.parent_phone);
        setStep('phone');
        toast.success(`Welcome! Please verify your phone number.`);
        return;
      }

      setError(
        'Your email is not registered in the system. Please contact your school administrator or reseller to be added first.'
      );
    } catch (err) {
      console.error(err);
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Step 2: Send OTP to phone ────────────────────────────────────────────
  const sendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!phone) {
      setError('Please enter your phone number');
      return;
    }

    // Normalize phone number EXACTLY like ForgotPassword
    let normalizedPhone = phone.trim();
    if (normalizedPhone.startsWith('0')) {
      normalizedPhone = '254' + normalizedPhone.slice(1);
    }
    if (normalizedPhone.startsWith('+')) {
      normalizedPhone = normalizedPhone.slice(1);
    }

    setLoading(true);
    try {
      const newOtp = generateOTP();
      setGeneratedOtp(newOtp);

      // EXACT SAME MESSAGE FORMAT AS FORGOT PASSWORD
      const message = `Your Zamifu Analytics registration code is: ${newOtp}. This code will expire in 15 minutes. Do not share this code with anyone.`;
      
      const result = await sendSMS(normalizedPhone, message);

      if (result.success) {
        // Store OTP and phone in database - use supabaseUntyped for flexibility
        const { error: updateError } = await supabaseUntyped
          .from('profiles')
          .update({
            phone: normalizedPhone,
            otp_code: newOtp,
            otp_expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
            phone_verified: false,
          })
          .eq('email', userData.email);

        if (updateError) {
          console.error('Update error:', updateError);
          setError('Failed to initialize verification. Please try again.');
          return;
        }

        setStep('otp');
        toast.success('OTP sent to your phone via SMS!');
      } else {
        console.error('SMS Error:', result.error);
        setError(`Failed to send SMS: ${result.error || 'Unknown error'}. Please try again.`);
        toast.error('SMS delivery failed');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Step 3: Verify OTP ───────────────────────────────────────────────────
  const verifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!otp || otp.length !== 6) {
      setError('Please enter the 6-digit OTP code');
      return;
    }

    // STRICT COMPARISON - NO DEMO CODES
    if (otp !== generatedOtp) {
      setError('Invalid OTP code. Please check and try again.');
      return;
    }

    setLoading(true);
    try {
      // Mark phone as verified in database
      const { error: verifyError } = await supabaseUntyped
        .from('profiles')
        .update({
          phone_verified: true,
          otp_code: null,
          otp_expires_at: null,
        })
        .eq('email', userData.email);

      if (verifyError) {
        setError('Verification failed. Please try again.');
        return;
      }

      setStep('register');
      toast.success('Phone verified! Now create your password.');
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Step 4: Create account ───────────────────────────────────────────────
  const createAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email: userData.email,
        password: password,
        options: {
          data: {
            first_name: userData.first_name,
            last_name: userData.last_name,
            role: userData.role,
            school_id: userData.school_id,
          }
        }
      });

      if (signUpError) {
        if (
          signUpError.message.includes('User already registered') ||
          signUpError.message.includes('already been registered')
        ) {
          setError('An account with this email already exists. Please sign in instead.');
        } else {
          setError(signUpError.message || 'Failed to create account. Please try again.');
        }
        setLoading(false);
        return;
      }

      toast.success('Account created successfully! You can now sign in.');
      setTimeout(() => {
        navigate('/auth/login');
      }, 2000);

    } catch (err: any) {
      setError(err.message || 'Failed to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Render: Step 4 — Password creation ──────────────────────────────────
  if (step === 'register') {
    return (
      <div className="min-h-screen bg-[#F5F3EF] flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="mb-6">
            <button
              onClick={() => { setStep('otp'); setError(''); }}
              className="inline-flex items-center gap-1 text-sm text-[#666666] hover:text-[#111111] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          </div>

          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2 mb-6">
              <img src="/icon-192.png" alt="Zamifu Analytics" className="w-12 h-12 rounded-xl object-contain" />
              <span className="text-2xl font-bold text-[#111111]">Zamifu Analytics</span>
            </Link>
            <h1 className="text-2xl font-bold text-[#111111]">Complete Registration</h1>
            <p className="text-sm text-[#666666] mt-1">Create your password to get started</p>
          </div>

          <div className="bg-white rounded-2xl p-6 md:p-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="bg-gray-50 p-4 rounded-xl mb-6">
              <p className="text-sm"><strong>Role:</strong> {userData?.role?.replace(/_/g, ' ')}</p>
              <p className="text-sm mt-1"><strong>Name:</strong> {userData?.first_name} {userData?.last_name}</p>
              <p className="text-sm mt-1"><strong>Email:</strong> {userData?.email}</p>
              <p className="text-sm mt-1 flex items-center gap-1">
                <strong>Phone:</strong> {phone}
                <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium ml-1">
                  <Check className="w-3 h-3" /> Verified
                </span>
              </p>
            </div>

            <form onSubmit={createAccount} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#111111] mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a password (min 6 characters)"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent pr-10"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#111111] mb-1.5">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#2563EB] text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-[#1d4ed8] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Account'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ─── Render: Step 3 — OTP verification ───────────────────────────────────
  if (step === 'otp') {
    return (
      <div className="min-h-screen bg-[#F5F3EF] flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="mb-6">
            <button
              onClick={() => { setStep('phone'); setOtp(''); setError(''); }}
              className="inline-flex items-center gap-1 text-sm text-[#666666] hover:text-[#111111] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          </div>

          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2 mb-6">
              <img src="/icon-192.png" alt="Zamifu Analytics" className="w-12 h-12 rounded-xl object-contain" />
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

            <form onSubmit={verifyOTP} className="space-y-4">
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

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#2563EB] text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-[#1d4ed8] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify OTP'}
              </button>
            </form>

            <button
              onClick={sendOTP}
              disabled={loading}
              className="w-full mt-4 text-sm text-[#2563EB] hover:underline disabled:opacity-50"
            >
              Didn&apos;t receive OTP? Resend SMS
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Render: Step 2 — Phone entry ─────────────────────────────────────────
  if (step === 'phone') {
    return (
      <div className="min-h-screen bg-[#F5F3EF] flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="mb-6">
            <button
              onClick={() => { setStep('email'); setPhone(''); setError(''); }}
              className="inline-flex items-center gap-1 text-sm text-[#666666] hover:text-[#111111] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          </div>

          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2 mb-6">
              <img src="/icon-192.png" alt="Zamifu Analytics" className="w-12 h-12 rounded-xl object-contain" />
              <span className="text-2xl font-bold text-[#111111]">Zamifu Analytics</span>
            </Link>
            <h1 className="text-2xl font-bold text-[#111111]">Verify Phone Number</h1>
            <p className="text-sm text-[#666666] mt-1">We'll send a 6-digit code via SMS</p>
          </div>

          <div className="bg-white rounded-2xl p-6 md:p-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                {error}
              </div>
            )}

            <form onSubmit={sendOTP} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#111111] mb-1.5">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 0712345678"
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
                    required
                  />
                </div>
                <p className="text-[10px] text-gray-500 mt-1.5 px-1">
                  Format: 07XXXXXXXX or 254XXXXXXXXX
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#2563EB] text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-[#1d4ed8] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Verification Code'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ─── Render: Step 1 — Email entry ─────────────────────────────────────────
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
          <h1 className="text-2xl font-bold text-[#111111]">Create Account</h1>
          <p className="text-sm text-[#666666] mt-1">Enter your registered email to continue</p>
        </div>

        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={validateEmail} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#111111] mb-1.5">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your registered email"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#2563EB] text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-[#1d4ed8] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Continue'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-[#666666]">
              Already have an account?{' '}
              <Link to="/auth/login" className="text-[#2563EB] font-semibold hover:underline">
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
