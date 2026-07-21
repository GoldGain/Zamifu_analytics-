import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Building2, CheckCircle2, Eye, EyeOff, Loader2,
  Mail, MapPin, Phone, School, Search, ShieldCheck, Sparkles, User,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/client';
import {
  KENYA_COUNTIES,
  SCHOOL_LEVELS,
  subCountiesFor,
  type SchoolLevel,
} from '@/lib/kenya-locations';

type Step = 1 | 2 | 3 | 4 | 5;

interface DirectorySchool {
  id: string;
  name: string;
  code?: string;
  knec_centre_code?: string;
  county?: string;
  sub_county?: string;
  school_level?: string;
}

interface FormState {
  school_name: string;
  school_level: SchoolLevel | '';
  county: string;
  sub_county: string;
  email: string;
  phone: string;
  knec_centre_code: string;
  admin_first_name: string;
  admin_last_name: string;
  password: string;
  confirm_password: string;
  selected_existing_id: string;
}

const initial: FormState = {
  school_name: '',
  school_level: '',
  county: '',
  sub_county: '',
  email: '',
  phone: '',
  knec_centre_code: '',
  admin_first_name: '',
  admin_last_name: '',
  password: '',
  confirm_password: '',
  selected_existing_id: '',
};

async function callRegister(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('register-school', { body });
  if (error) {
    let msg = error.message || 'Request failed';
    try {
      const ctx = (error as any)?.context;
      if (ctx?.json) {
        const j = await ctx.json();
        msg = j.error || msg;
      } else if (data && (data as any).error) {
        msg = (data as any).error;
      }
    } catch {
      if (data && (data as any).error) msg = (data as any).error;
    }
    throw new Error(msg);
  }
  if (data && (data as any).error) throw new Error((data as any).error);
  return data as any;
}

export default function SchoolRegister() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormState>(initial);
  const [loading, setLoading] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [matches, setMatches] = useState<DirectorySchool[]>([]);
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpHint, setOtpHint] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [result, setResult] = useState<any>(null);

  const subCounties = useMemo(() => subCountiesFor(form.county), [form.county]);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    if (!searchQ || searchQ.trim().length < 2) {
      setMatches([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await callRegister({ action: 'search_schools', query: searchQ.trim() });
        setMatches(data.schools || []);
      } catch {
        setMatches([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [searchQ]);

  const validateStep1 = async () => {
    if (!form.school_name.trim()) return toast.error('Enter school name');
    if (!form.school_level) return toast.error('Select school level');
    if (!form.county) return toast.error('Select county');
    if (!form.sub_county) return toast.error('Select sub-county');
    if (!form.email.trim() || !form.email.includes('@')) return toast.error('Enter a valid official email');
    if (!form.phone.trim() || form.phone.replace(/\D/g, '').length < 9) return toast.error('Enter a valid phone number');

    setLoading(true);
    setConflicts([]);
    try {
      const data = await callRegister({
        action: 'check_availability',
        name: form.school_name,
        email: form.email,
        phone: form.phone,
        knec_centre_code: form.knec_centre_code,
      });
      if (!data.available) {
        setConflicts(data.conflicts || ['Details already in use']);
        toast.error('Some details are already registered to another school');
        return;
      }
      setStep(2);
    } catch (e: any) {
      toast.error(e.message || 'Could not validate school details');
    } finally {
      setLoading(false);
    }
  };

  const sendOtp = async () => {
    setLoading(true);
    try {
      const data = await callRegister({ action: 'send_otp', email: form.email, phone: form.phone });
      setOtpSent(true);
      setOtpVerified(false);
      setOtp('');
      if (data.demo_code) {
        setOtpHint(`Demo verification code: ${data.demo_code}`);
        setOtp(String(data.demo_code));
      } else {
        setOtpHint(`Code sent to ${form.email} / ${form.phone}`);
      }
      toast.success('Verification code sent');
    } catch (e: any) {
      toast.error(e.message || 'Failed to send code');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!otp.trim()) return toast.error('Enter the verification code');
    setLoading(true);
    try {
      const data = await callRegister({
        action: 'verify_otp',
        email: form.email,
        phone: form.phone,
        code: otp.trim(),
      });
      if (!data.verified) throw new Error(data.error || 'Invalid code');
      setOtpVerified(true);
      toast.success('Contact verified');
      setStep(3);
    } catch (e: any) {
      toast.error(e.message || 'Invalid or expired code');
    } finally {
      setLoading(false);
    }
  };

  const validateAdmin = () => {
    if (!form.admin_first_name.trim() || !form.admin_last_name.trim()) {
      return toast.error('Enter administrator name');
    }
    if (form.password.length < 8) return toast.error('Password must be at least 8 characters');
    if (form.password !== form.confirm_password) return toast.error('Passwords do not match');
    setStep(4);
  };

  const submitRegistration = async () => {
    if (!otpVerified) return toast.error('Verify your contact first');
    setLoading(true);
    try {
      const data = await callRegister({
        action: 'register',
        school_name: form.school_name.trim(),
        school_level: form.school_level,
        county: form.county,
        sub_county: form.sub_county,
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        knec_centre_code: form.knec_centre_code.trim(),
        admin_first_name: form.admin_first_name.trim(),
        admin_last_name: form.admin_last_name.trim(),
        password: form.password,
        otp_verified: true,
        selected_existing_id: form.selected_existing_id || undefined,
      });
      setResult(data);
      setStep(5);
      toast.success('School registered successfully');
    } catch (e: any) {
      toast.error(e.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const pickSchool = (s: DirectorySchool) => {
    setForm((f) => ({
      ...f,
      school_name: s.name || f.school_name,
      knec_centre_code: s.knec_centre_code || s.code || f.knec_centre_code,
      county: s.county || f.county,
      sub_county: s.sub_county || f.sub_county,
      school_level: (s.school_level as SchoolLevel) || f.school_level,
      selected_existing_id: '',
    }));
    toast.message('Details filled from directory. Confirm they are unique before continuing.');
    setSearchQ('');
    setMatches([]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-blue-700">
            <ArrowLeft className="w-4 h-4" /> Back to home
          </Link>
          <Link to="/auth/login" className="text-sm font-medium text-blue-700 hover:underline">
            Already registered? Sign in
          </Link>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-8 text-white">
            <div className="inline-flex items-center gap-2 bg-white/15 rounded-full px-3 py-1 text-xs font-medium mb-3">
              <Sparkles className="w-3.5 h-3.5" /> No subscription required at registration
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Register Your School</h1>
            <p className="text-blue-100 mt-2 text-sm sm:text-base max-w-xl">
              Create your Zamifu workspace, verify school contacts, and get school admin login credentials in minutes.
            </p>
          </div>

          <div className="px-6 pt-6">
            <div className="flex items-center justify-between gap-2 mb-8">
              {[
                { n: 1, t: 'School' },
                { n: 2, t: 'Verify' },
                { n: 3, t: 'Admin' },
                { n: 4, t: 'Confirm' },
                { n: 5, t: 'Done' },
              ].map((s, idx) => (
                <div key={s.n} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center min-w-[52px]">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                        step > s.n
                          ? 'bg-emerald-500 text-white'
                          : step === s.n
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {step > s.n ? <CheckCircle2 className="w-4 h-4" /> : s.n}
                    </div>
                    <span className="text-[10px] mt-1 text-slate-500 hidden sm:block">{s.t}</span>
                  </div>
                  {idx < 4 && <div className={`h-0.5 flex-1 mx-1 ${step > s.n ? 'bg-emerald-400' : 'bg-slate-200'}`} />}
                </div>
              ))}
            </div>
          </div>

          <div className="px-6 pb-8">
            {step === 1 && (
              <div className="space-y-5">
                <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                  <label className="text-sm font-semibold text-slate-800 flex items-center gap-2 mb-2">
                    <Search className="w-4 h-4 text-blue-600" /> Find existing school (optional)
                  </label>
                  <input
                    value={searchQ}
                    onChange={(e) => setSearchQ(e.target.value)}
                    placeholder="Search by school name or KNEC / centre code"
                    className="input"
                  />
                  {searching && <p className="text-xs text-slate-500 mt-2">Searching directory…</p>}
                  {matches.length > 0 && (
                    <div className="mt-2 max-h-40 overflow-auto rounded-xl border border-slate-200 bg-white divide-y">
                      {matches.map((s) => (
                        <button key={s.id} type="button" onClick={() => pickSchool(s)} className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm">
                          <div className="font-medium text-slate-800">{s.name}</div>
                          <div className="text-xs text-slate-500">
                            {[s.code || s.knec_centre_code, s.county, s.sub_county].filter(Boolean).join(' · ')}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="text-[11px] text-slate-500 mt-2">
                    Pick a known school to auto-fill, or enter details manually. School name, contacts and centre code must be unique.
                  </p>
                </div>

                <Field label="School name" icon={<Building2 className="w-4 h-4" />} required>
                  <input value={form.school_name} onChange={(e) => set('school_name', e.target.value)} className="input" placeholder="e.g. Green Valley Junior School" />
                </Field>

                <Field label="School level" icon={<School className="w-4 h-4" />} required>
                  <select value={form.school_level} onChange={(e) => set('school_level', e.target.value as SchoolLevel)} className="input">
                    <option value="">Select level</option>
                    {SCHOOL_LEVELS.map((l) => (
                      <option key={l.value} value={l.value}>{l.label}</option>
                    ))}
                  </select>
                </Field>

                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="County" icon={<MapPin className="w-4 h-4" />} required>
                    <select
                      value={form.county}
                      onChange={(e) => {
                        set('county', e.target.value);
                        set('sub_county', '');
                      }}
                      className="input"
                    >
                      <option value="">Select county</option>
                      {KENYA_COUNTIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Sub-county" required>
                    <select value={form.sub_county} onChange={(e) => set('sub_county', e.target.value)} className="input" disabled={!form.county}>
                      <option value="">{form.county ? 'Select sub-county' : 'Select county first'}</option>
                      {subCounties.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </Field>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Official email" icon={<Mail className="w-4 h-4" />} required>
                    <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className="input" placeholder="admin@school.ac.ke" />
                  </Field>
                  <Field label="Official / admin phone" icon={<Phone className="w-4 h-4" />} required>
                    <input value={form.phone} onChange={(e) => set('phone', e.target.value)} className="input" placeholder="07XXXXXXXX" />
                  </Field>
                </div>

                <Field label="KNEC centre code (recommended)">
                  <input
                    value={form.knec_centre_code}
                    onChange={(e) => set('knec_centre_code', e.target.value.toUpperCase())}
                    className="input"
                    placeholder="e.g. 27503001"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Used as unique school identity when provided.</p>
                </Field>

                {conflicts.length > 0 && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 space-y-1">
                    {conflicts.map((c) => (
                      <div key={c}>• {c}</div>
                    ))}
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button type="button" disabled={loading} onClick={validateStep1} className="btn-primary">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Continue <ArrowRight className="w-4 h-4" /></>}
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
                  <div className="text-sm font-semibold text-slate-800 mb-1">Verify school contact</div>
                  <p className="text-xs text-slate-600">
                    We will verify <span className="font-medium">{form.email}</span> and <span className="font-medium">{form.phone}</span> before creating your admin account.
                  </p>
                </div>

                {!otpSent ? (
                  <button type="button" disabled={loading} onClick={sendOtp} className="btn-primary w-full justify-center">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ShieldCheck className="w-4 h-4" /> Send verification code</>}
                  </button>
                ) : (
                  <>
                    {otpHint && <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">{otpHint}</p>}
                    <Field label="Enter 6-digit code" required>
                      <input
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="input tracking-[0.35em] text-center text-lg font-semibold"
                        placeholder="••••••"
                        maxLength={6}
                      />
                    </Field>
                    <div className="flex flex-wrap gap-3 justify-between">
                      <button type="button" className="btn-ghost" onClick={() => setStep(1)}>Back</button>
                      <div className="flex gap-2">
                        <button type="button" disabled={loading} onClick={sendOtp} className="btn-ghost">Resend</button>
                        <button type="button" disabled={loading} onClick={verifyOtp} className="btn-primary">
                          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify & continue'}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Contact verified. Create the school administrator account.
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Admin first name" icon={<User className="w-4 h-4" />} required>
                    <input className="input" value={form.admin_first_name} onChange={(e) => set('admin_first_name', e.target.value)} />
                  </Field>
                  <Field label="Admin last name" required>
                    <input className="input" value={form.admin_last_name} onChange={(e) => set('admin_last_name', e.target.value)} />
                  </Field>
                </div>
                <Field label="Admin login email">
                  <input className="input bg-slate-50" value={form.email} disabled />
                </Field>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Create password" required>
                    <div className="relative">
                      <input
                        type={showPass ? 'text' : 'password'}
                        className="input pr-10"
                        value={form.password}
                        onChange={(e) => set('password', e.target.value)}
                        placeholder="Min. 8 characters"
                      />
                      <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" onClick={() => setShowPass((v) => !v)}>
                        {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </Field>
                  <Field label="Confirm password" required>
                    <input type={showPass ? 'text' : 'password'} className="input" value={form.confirm_password} onChange={(e) => set('confirm_password', e.target.value)} />
                  </Field>
                </div>
                <div className="flex justify-between pt-2">
                  <button type="button" className="btn-ghost" onClick={() => setStep(2)}>Back</button>
                  <button type="button" className="btn-primary" onClick={validateAdmin}>
                    Review <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-5">
                <h3 className="font-semibold text-slate-900">Confirm registration</h3>
                <div className="rounded-2xl border border-slate-200 divide-y text-sm">
                  {[
                    ['School', form.school_name],
                    ['Level', SCHOOL_LEVELS.find((l) => l.value === form.school_level)?.label || form.school_level],
                    ['Location', `${form.sub_county}, ${form.county}`],
                    ['Email', form.email],
                    ['Phone', form.phone],
                    ['KNEC / centre code', form.knec_centre_code || 'Auto-generated'],
                    ['Administrator', `${form.admin_first_name} ${form.admin_last_name}`],
                  ].map(([k, v]) => (
                    <div key={k as string} className="flex justify-between gap-4 px-4 py-3">
                      <span className="text-slate-500">{k}</span>
                      <span className="font-medium text-slate-900 text-right">{v}</span>
                    </div>
                  ))}
                </div>
                <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-xs text-amber-900">
                  No subscription payment is required now. Your school starts on a trial workspace and appears in the reseller portal after creation.
                </div>
                <div className="flex justify-between pt-2">
                  <button type="button" className="btn-ghost" onClick={() => setStep(3)}>Back</button>
                  <button type="button" disabled={loading} className="btn-primary" onClick={submitRegistration}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create school & admin account'}
                  </button>
                </div>
              </div>
            )}

            {step === 5 && result && (
              <div className="space-y-5 text-center">
                <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">School workspace ready</h3>
                  <p className="text-sm text-slate-600 mt-1">{result.message}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 text-left text-sm divide-y">
                  <div className="px-4 py-3"><span className="text-slate-500">School:</span> <strong>{result.school?.name}</strong></div>
                  <div className="px-4 py-3"><span className="text-slate-500">School code:</span> <strong>{result.school?.code}</strong></div>
                  <div className="px-4 py-3"><span className="text-slate-500">Admin email:</span> <strong>{result.admin?.email}</strong></div>
                  <div className="px-4 py-3"><span className="text-slate-500">Role:</span> <strong>School Admin</strong></div>
                </div>
                <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 text-left text-xs text-blue-900 space-y-1">
                  <div className="font-semibold mb-1">Next steps</div>
                  {(result.next_steps || []).map((s: string) => (
                    <div key={s}>• {s}</div>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn-primary w-full justify-center"
                  onClick={() => navigate('/auth/login', { state: { email: result.admin?.email } })}
                >
                  Go to login
                </button>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          Teachers and learners are onboarded by the school admin after login — not during registration.
        </p>
      </div>

      <style>{`
        .input { width: 100%; border-radius: 0.75rem; border: 1px solid #e2e8f0; padding: 0.65rem 0.85rem; font-size: 0.875rem; outline: none; }
        .input:focus { box-shadow: 0 0 0 2px rgba(37,99,235,.35); border-color: #2563eb; }
        .btn-primary { display:inline-flex; align-items:center; gap:0.5rem; background:#2563eb; color:white; font-weight:600; font-size:0.875rem; padding:0.7rem 1.1rem; border-radius:0.9rem; }
        .btn-primary:hover { background:#1d4ed8; }
        .btn-primary:disabled { opacity:0.55; }
        .btn-ghost { display:inline-flex; align-items:center; gap:0.4rem; color:#475569; font-size:0.875rem; font-weight:500; padding:0.65rem 0.9rem; border-radius:0.9rem; border:1px solid #e2e8f0; background:white; }
      `}</style>
    </div>
  );
}

function Field({
  label,
  children,
  required,
  icon,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-1.5">
        {icon}
        {label}
        {required && <span className="text-rose-500">*</span>}
      </span>
      {children}
    </label>
  );
}
