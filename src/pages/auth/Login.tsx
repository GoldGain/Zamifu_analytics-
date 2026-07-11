import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase/client';
import { Eye, EyeOff, Loader2, User, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import PWAInstallButton from '@/components/PWAInstallButton';
import SEO from '@/components/SEO';

interface StudentData {
  email: string;
  admission_number: string;
}

export default function Login() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [loginMethod, setLoginMethod] = useState<'email' | 'admission'>('email');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // If already logged in, redirect to appropriate dashboard
  useEffect(() => {
    if (!authLoading && user) {
      redirectByRole(user.role);
    }
  }, [user, authLoading]);

  const redirectByRole = (role: string) => {
    if (role === 'master_super_admin') navigate('/master-admin', { replace: true });
    else if (role === 'reseller_super_admin') navigate('/reseller-admin', { replace: true });
    else if (role === 'super_admin') navigate('/super-admin', { replace: true });
    else if (role === 'school_admin') navigate('/school-admin', { replace: true });
    else if (role === 'teacher') navigate('/teacher', { replace: true });
    else if (role === 'student') navigate('/student', { replace: true });
    else if (role === 'parent') navigate('/parent', { replace: true });
    else navigate('/', { replace: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!identifier || !password) {
      setError('Please enter your credentials');
      setLoading(false);
      return;
    }

    try {
      let email = identifier;

      // If using admission number, find the student's email
      if (loginMethod === 'admission') {
        const { data: student, error: studentError } = await supabase
          .from('students')
          .select('student_email, admission_number')
          .eq('admission_number', identifier.toUpperCase())
          .maybeSingle();

        if (studentError || !student) {
          setError('❌ Admission number not found. Please check with your school.');
          setLoading(false);
          return;
        }

        const studentData = student as unknown as any;
        const emailToUse = studentData.student_email || studentData.email;
        if (!emailToUse) {
          setError('❌ Student account not set up. Please contact your school administrator.');
          setLoading(false);
          return;
        }

        email = emailToUse;
      }

      // Attempt login via Supabase directly
      const { error: loginError, data } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (loginError) {
        setError('❌ Invalid credentials. Please check your email/admission number and password.');
        setLoading(false);
        return;
      }

      if (!data.user) {
        setError('❌ Login failed. Please try again.');
        setLoading(false);
        return;
      }

      // Get user role from profile directly
      const { data: profileData } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .maybeSingle();

      const profileRecord = profileData as unknown as { role: string } | null;
      const role = profileRecord?.role || data.user.user_metadata?.role;

      toast.success('Welcome back!');
      setLoading(false);

      // Redirect based on role
      if (role === 'master_super_admin') {
        navigate('/master-admin', { replace: true });
      } else if (role === 'reseller_super_admin') {
        navigate('/reseller-admin', { replace: true });
      } else if (role === 'super_admin') {
        navigate('/super-admin', { replace: true });
      } else if (role === 'school_admin') {
        navigate('/school-admin', { replace: true });
      } else if (role === 'teacher') {
        navigate('/teacher', { replace: true });
      } else if (role === 'student') {
        navigate('/student', { replace: true });
      } else if (role === 'parent') {
        navigate('/parent', { replace: true });
      } else {
        // Role not found - show error
        setError('❌ Account role not configured. Please contact your administrator.');
        await supabase.auth.signOut();
      }

    } catch (err) {
      console.error(err);
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  // Show loading while initial auth state is being determined
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F3EF]">
        <Loader2 className="w-8 h-8 animate-spin text-[#2563EB]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F3EF] flex items-center justify-center px-4">
      <SEO
        title="Login — Zamifu Analytics School Portal"
        description="Login to Zamifu Analytics, Kenya's intelligent school management portal for teachers, students, parents, and administrators."
        path="/login"
      />
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <img src="/icon-192.png" alt="Zamifu Analytics" className="w-12 h-12 rounded-xl object-contain" />
            <span className="text-2xl font-bold text-[#111111]">Zamifu Analytics</span>
          </Link>
          <h1 className="text-2xl font-bold text-[#111111]">Welcome Back</h1>
          <p className="text-sm text-[#666666] mt-1">Login to your school portal</p>
          <div className="mt-3 flex justify-center">
            <PWAInstallButton />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Login Method Toggle */}
          <div className="flex gap-2 mb-6 p-1 bg-gray-100 rounded-xl">
            <button
              type="button"
              onClick={() => setLoginMethod('email')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1 ${
                loginMethod === 'email' 
                  ? 'bg-[#2563EB] text-white' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Mail className="w-4 h-4" /> Email Login
            </button>
            <button
              type="button"
              onClick={() => setLoginMethod('admission')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1 ${
                loginMethod === 'admission' 
                  ? 'bg-[#2563EB] text-white' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <User className="w-4 h-4" /> Student Login
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#111111] mb-1.5">
                {loginMethod === 'email' ? 'Email Address' : 'Assessment Number'}
              </label>
              <input
                type={loginMethod === 'email' ? 'email' : 'text'}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={loginMethod === 'email' ? 'your@email.com' : 'e.g., GFA-2025-001'}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
                required
                autoFocus
              />
              {loginMethod === 'admission' && (
                <p className="text-xs text-gray-500 mt-1">Enter the assessment number given by your school</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-[#111111] mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent pr-10"
                  required
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

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-[#666666]">
                <input type="checkbox" className="rounded border-gray-300" />
                Remember me
              </label>
              <Link to="/auth/forgot-password" className="text-sm text-[#2563EB] hover:underline">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#2563EB] text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-[#1d4ed8] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-[#666666]">
            Don&apos;t have an account?{' '}
            <Link to="/auth/register" className="text-[#2563EB] font-medium hover:underline">
              Get Started
            </Link>
          </div>

          <div className="mt-6 text-center text-xs text-gray-400">
            <p>📧 School Admin / Teacher / Parent: Use Email Login</p>
            <p className="mt-1">🎓 Learners: Use Assessment Number Login or Email Login</p>
          </div>
        </div>
      </div>
    </div>
  );
}
