import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  ArrowRight,
  Building2,
  CreditCard,
  DollarSign,
  GraduationCap,
  Mail,
  MapPin,
  Pencil,
  Phone,
  RefreshCw,
  School,
  Shield,
  ShieldAlert,
  UserCog,
  UserRound,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getResellerForUser, money } from '@/lib/reseller';
import { loadResellerPortfolio, updateSchoolFee } from '@/lib/reseller-dashboard';
import type { ResellerPortfolio, SchoolPortfolioItem } from '@/lib/reseller-dashboard';

const EMPTY_PORTFOLIO: ResellerPortfolio = {
  schools: [],
  totals: {
    schools: 0,
    learners: 0,
    teachers: 0,
    parents: 0,
    admins: 0,
    revenueThisTerm: 0,
    revenuePerYear: 0,
  },
};

function StatCard({
  label,
  value,
  description,
  icon,
  accent,
}: {
  label: string;
  value: string | number;
  description: string;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
          <p className="mt-1 text-xs text-slate-500">{description}</p>
        </div>
        <div className={`rounded-xl p-3 ${accent}`}>{icon}</div>
      </div>
    </div>
  );
}

function SchoolMetric({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
      <div className="flex items-center gap-2 text-slate-500">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value.toLocaleString('en-KE')}</p>
    </div>
  );
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function ResellerDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [resellerId, setResellerId] = useState<string | null>(null);
  const [resellerName, setResellerName] = useState('');
  const [portfolio, setPortfolio] = useState<ResellerPortfolio>(EMPTY_PORTFOLIO);
  const [selectedSchool, setSelectedSchool] = useState<SchoolPortfolioItem | null>(null);
  const [feeInput, setFeeInput] = useState('');
  const [savingFee, setSavingFee] = useState(false);

  const loadDashboard = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const reseller = await getResellerForUser(user.id);
      if (!reseller) {
        setResellerId(null);
        setResellerName('');
        setPortfolio(EMPTY_PORTFOLIO);
        return;
      }

      setResellerId(reseller.id);
      setResellerName(reseller.name || 'Reseller');
      setPortfolio(await loadResellerPortfolio(reseller.id));
    } catch (error: unknown) {
      console.error('[reseller-dashboard] load', error);
      toast.error(errorMessage(error, 'Unable to load your reseller dashboard. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (!cancelled) void loadDashboard();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [loadDashboard]);

  const selectedFee = Number(feeInput);
  const feePreview = Number.isFinite(selectedFee) && selectedFee > 0
    ? Math.round(selectedFee)
    : selectedSchool?.feePerLearnerPerTerm || 0;
  const feeIsValid = Number.isFinite(selectedFee) && selectedFee >= 1 && selectedFee <= 1_000_000;
  const portfolioCurrencies = [...new Set(portfolio.schools.map((school) => school.currency))];
  const dashboardCurrency = portfolioCurrencies.length === 1 ? portfolioCurrencies[0] : null;

  const summaryCards = useMemo(() => [
    {
      label: 'Total schools',
      value: portfolio.totals.schools.toLocaleString('en-KE'),
      description: 'Schools in your network',
      icon: <School className="h-5 w-5" />,
      accent: 'bg-blue-50 text-blue-700',
    },
    {
      label: 'Total learners',
      value: portfolio.totals.learners.toLocaleString('en-KE'),
      description: 'Current enrolled learners',
      icon: <GraduationCap className="h-5 w-5" />,
      accent: 'bg-emerald-50 text-emerald-700',
    },
    {
      label: 'Total teachers',
      value: portfolio.totals.teachers.toLocaleString('en-KE'),
      description: 'Teachers across all schools',
      icon: <Users className="h-5 w-5" />,
      accent: 'bg-violet-50 text-violet-700',
    },
    {
      label: 'Total parents',
      value: portfolio.totals.parents.toLocaleString('en-KE'),
      description: 'Linked parent accounts',
      icon: <UserRound className="h-5 w-5" />,
      accent: 'bg-amber-50 text-amber-700',
    },
    {
      label: 'School administrators',
      value: portfolio.totals.admins.toLocaleString('en-KE'),
      description: 'Active school administration records',
      icon: <UserCog className="h-5 w-5" />,
      accent: 'bg-rose-50 text-rose-700',
    },
    {
      label: 'Projected annual revenue',
      value: dashboardCurrency ? money(portfolio.totals.revenuePerYear, dashboardCurrency) : 'By school',
      description: dashboardCurrency
        ? `${money(portfolio.totals.revenueThisTerm, dashboardCurrency)} this term`
        : 'Multiple currencies; see school-level amounts',
      icon: <DollarSign className="h-5 w-5" />,
      accent: 'bg-indigo-50 text-indigo-700',
    },
  ], [dashboardCurrency, portfolio]);

  const openFeeEditor = (school: SchoolPortfolioItem) => {
    setSelectedSchool(school);
    setFeeInput(String(school.feePerLearnerPerTerm));
  };

  const closeFeeEditor = () => {
    if (savingFee) return;
    setSelectedSchool(null);
    setFeeInput('');
  };

  const saveFee = async () => {
    if (!resellerId || !selectedSchool) return;

    setSavingFee(true);
    try {
      await updateSchoolFee(resellerId, selectedSchool.id, selectedFee);
      toast.success(`Fee updated for ${selectedSchool.name}. Revenue projections have been refreshed.`);
      setSelectedSchool(null);
      setFeeInput('');
      await loadDashboard();
    } catch (error: unknown) {
      console.error('[reseller-dashboard] update fee', error);
      toast.error(errorMessage(error, 'Unable to update the school fee. Please try again.'));
    } finally {
      setSavingFee(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 px-6 py-6 text-white shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-blue-200">
              <Building2 className="h-4 w-4" />
              RESELLER DASHBOARD
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              {resellerName ? `${resellerName} portfolio` : 'Your school portfolio'}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Monitor people, school-level pricing, and projected subscription revenue across your network.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadDashboard()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh data
          </button>
        </div>
      </section>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />
          ))}
        </div>
      ) : !resellerId ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-8 text-center">
          <ShieldAlert className="mx-auto h-8 w-8 text-amber-700" />
          <h2 className="mt-3 text-lg font-semibold text-amber-950">Reseller account not found</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-amber-800">
            This signed-in account is not currently connected to a reseller profile. Contact the platform administrator to complete the account setup.
          </p>
        </div>
      ) : (
        <>
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {summaryCards.map((card) => (
              <StatCard key={card.label} {...card} />
            ))}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">School portfolio</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Per-school people counts and fee projections based on the current learner enrolment.
                </p>
              </div>
              <Link
                to="/reseller-admin/schools"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              >
                Manage schools <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {portfolio.schools.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <School className="mx-auto h-9 w-9 text-slate-300" />
                <h3 className="mt-3 font-semibold text-slate-900">No schools in your portfolio yet</h3>
                <p className="mt-1 text-sm text-slate-500">Create your first school to begin managing fees and network-level metrics.</p>
                <Link
                  to="/reseller-admin/schools"
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  Add a school <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ) : (
              <div className="grid gap-4 p-5 xl:grid-cols-2">
                {portfolio.schools.map((school) => (
                  <article key={school.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold text-slate-900">{school.name}</h3>
                          {school.status && (
                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${school.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                              {school.status}
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-500">
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5" />
                            {[school.county, school.subCounty].filter(Boolean).join(' · ') || 'Location not recorded'}
                          </span>
                          {school.code && <span>Code: {school.code}</span>}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => openFeeEditor(school)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                      >
                        <Pencil className="h-4 w-4" />
                        Edit fee
                      </button>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-y border-slate-100 py-3 text-sm text-slate-500">
                      <span className="inline-flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5" />
                        {school.email || 'No email recorded'}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5" />
                        {school.phone || 'No phone recorded'}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <SchoolMetric label="Learners" value={school.learners} icon={<GraduationCap className="h-3.5 w-3.5" />} />
                      <SchoolMetric label="Teachers" value={school.teachers} icon={<Users className="h-3.5 w-3.5" />} />
                      <SchoolMetric label="Parents" value={school.parents} icon={<UserRound className="h-3.5 w-3.5" />} />
                      <SchoolMetric label="Admins" value={school.admins} icon={<UserCog className="h-3.5 w-3.5" />} />
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 rounded-xl bg-slate-950 p-4 text-white sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Fee per learner / term</p>
                        <p className="mt-1 text-lg font-semibold">{money(school.feePerLearnerPerTerm, school.currency)}</p>
                        <p className="mt-1 text-xs text-slate-400">{money(school.feePerLearnerPerTerm * 3, school.currency)} per learner / year</p>
                      </div>
                      <div className="sm:border-l sm:border-white/10 sm:pl-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Projected revenue</p>
                        <p className="mt-1 text-lg font-semibold">{money(school.revenueThisTerm, school.currency)} <span className="text-xs font-medium text-slate-400">/ term</span></p>
                        <p className="mt-1 text-xs text-slate-400">{money(school.revenuePerYear, school.currency)} per year</p>
                      </div>
                    </div>

                    {(school.adminPortalLocked || school.dosPortalLocked) && (
                      <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
                        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                        <span>
                          Portal access limited: {school.adminPortalLocked ? 'school administrator' : ''}
                          {school.adminPortalLocked && school.dosPortalLocked ? ' and ' : ''}
                          {school.dosPortalLocked ? 'Dean of Studies' : ''} portal{school.adminPortalLocked && school.dosPortalLocked ? 's are' : ' is'} locked.
                        </span>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Link to="/reseller-admin/access-control" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-amber-200 hover:shadow-md">
              <Shield className="h-5 w-5 text-amber-600" />
              <h2 className="mt-3 font-semibold text-slate-900">Access control</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">Review and manage school administrator and Dean of Studies portal access.</p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-blue-700">Manage access <ArrowRight className="h-4 w-4" /></span>
            </Link>
            <Link to="/reseller-admin/pricing" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-200 hover:shadow-md">
              <CreditCard className="h-5 w-5 text-emerald-600" />
              <h2 className="mt-3 font-semibold text-slate-900">Pricing defaults</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">Set the starting fee used when new schools are added to your portfolio.</p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-blue-700">Open pricing <ArrowRight className="h-4 w-4" /></span>
            </Link>
            <Link to="/reseller-admin/payments" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-200 hover:shadow-md">
              <DollarSign className="h-5 w-5 text-indigo-600" />
              <h2 className="mt-3 font-semibold text-slate-900">Payment activity</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">Review recorded subscription and parent-payment transactions for your network.</p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-blue-700">View payments <ArrowRight className="h-4 w-4" /></span>
            </Link>
          </section>
        </>
      )}

      <Dialog open={Boolean(selectedSchool)} onOpenChange={(open) => !open && closeFeeEditor()}>
        <DialogContent className="max-w-xl border-slate-200 bg-white">
          <DialogHeader>
            <DialogTitle>Edit school fees</DialogTitle>
            <DialogDescription>
              Update the fee per learner per term. The annual and revenue projections recalculate before you save.
            </DialogDescription>
          </DialogHeader>

          {selectedSchool && (
            <div className="space-y-5">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">School</p>
                <p className="mt-1 font-semibold text-slate-900">{selectedSchool.name}</p>
              </div>

              <div>
                <label htmlFor="school-fee" className="block text-sm font-semibold text-slate-800">Fee per learner per term</label>
                <div className="mt-2 flex overflow-hidden rounded-xl border border-slate-300 bg-white focus-within:ring-2 focus-within:ring-blue-500/20">
                  <span className="flex items-center border-r border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-600">{selectedSchool.currency === 'KES' ? 'KSh' : selectedSchool.currency}</span>
                  <input
                    id="school-fee"
                    type="number"
                    min="1"
                    max="1000000"
                    step="1"
                    value={feeInput}
                    onChange={(event) => setFeeInput(event.target.value)}
                    className="w-full px-3 py-2.5 text-sm outline-none"
                    disabled={savingFee}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">Enter a whole amount from 1 to 1,000,000.</p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-blue-50 p-4">
                  <p className="text-xs font-medium text-blue-700">Fee per learner per year</p>
                  <p className="mt-1 text-lg font-bold text-blue-950">{money(feePreview * 3, selectedSchool.currency)}</p>
                </div>
                <div className="rounded-xl bg-emerald-50 p-4">
                  <p className="text-xs font-medium text-emerald-700">Revenue per term</p>
                  <p className="mt-1 text-lg font-bold text-emerald-950">{money(feePreview * selectedSchool.learners, selectedSchool.currency)}</p>
                </div>
                <div className="rounded-xl bg-violet-50 p-4 sm:col-span-2">
                  <p className="text-xs font-medium text-violet-700">Projected revenue per year</p>
                  <p className="mt-1 text-xl font-bold text-violet-950">{money(feePreview * selectedSchool.learners * 3, selectedSchool.currency)}</p>
                  <p className="mt-1 text-xs text-violet-700">Based on {selectedSchool.learners.toLocaleString('en-KE')} learner{selectedSchool.learners === 1 ? '' : 's'} and three terms.</p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <button
              type="button"
              onClick={closeFeeEditor}
              disabled={savingFee}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void saveFee()}
              disabled={savingFee || !feeIsValid}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Pencil className="h-4 w-4" />
              {savingFee ? 'Saving changes…' : 'Save changes'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
