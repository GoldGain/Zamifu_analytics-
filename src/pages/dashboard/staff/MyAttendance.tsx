import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, CalendarDays, CheckCircle2, Clock, Loader2, MapPin, ShieldCheck, Timer } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import StaffClockCard from '@/components/staff/StaffClockCard';
import { supabaseUntyped } from '@/lib/supabase/client';
import {
  SCHOOL_ATTENDANCE_SELECT,
  addDaysToKey,
  datesInRange,
  formatDateLabel,
  formatDistance,
  formatTimeInZone,
  getMonthStart,
  isWorkingDay,
  statusClasses,
  todayInZone,
  type SchoolAttendanceSettings,
  type StaffAttendanceRecord,
} from '@/lib/staffAttendance';

// The generated Database type does not yet include the new attendance table/RPC.
const db = supabaseUntyped as any;

export default function MyAttendancePage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<SchoolAttendanceSettings | null>(null);
  const [records, setRecords] = useState<StaffAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [monthAnchor, setMonthAnchor] = useState('');

  const load = useCallback(async () => {
    if (!user?.schoolId || !user?.id) return;
    setLoading(true);
    setError('');
    try {
      const { data: school, error: schoolError } = await db
        .from('schools')
        .select(SCHOOL_ATTENDANCE_SELECT)
        .eq('id', user.schoolId)
        .maybeSingle();
      if (schoolError) throw schoolError;
      const typed = (school || null) as SchoolAttendanceSettings | null;
      setSettings(typed);
      const tz = typed?.attendance_timezone || 'Africa/Nairobi';
      if (!monthAnchor) setMonthAnchor(getMonthStart(todayInZone(tz)));

      const from = monthAnchor || getMonthStart(todayInZone(tz));
      const to = todayInZone(tz);
      const { data, error: recordsError } = await db
        .from('staff_attendance')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', from)
        .lte('date', to)
        .order('date', { ascending: false });
      if (recordsError) throw recordsError;
      setRecords((data || []) as StaffAttendanceRecord[]);
    } catch (err: any) {
      setError(err?.message || 'Could not load your attendance history.');
    } finally {
      setLoading(false);
    }
  }, [user?.schoolId, user?.id, monthAnchor]);

  useEffect(() => {
    void load();
  }, [load]);

  const timeZone = settings?.attendance_timezone || 'Africa/Nairobi';
  const today = todayInZone(timeZone);
  const workingDays = settings?.attendance_working_days || [1, 2, 3, 4, 5];

  const history = useMemo(() => {
    if (!monthAnchor) return [];
    const recordByDate = new Map(records.map((record) => [record.date, record]));
    return datesInRange(monthAnchor, today)
      .filter((date) => isWorkingDay(date, workingDays))
      .sort((a, b) => b.localeCompare(a))
      .map((date) => {
        const record = recordByDate.get(date) || null;
        const status = record?.status || (date === today ? null : 'Absent');
        return { date, record, status };
      });
  }, [monthAnchor, records, today, workingDays]);

  const summary = useMemo(() => {
    let present = 0;
    let late = 0;
    let absent = 0;
    history.forEach((row) => {
      if (row.status === 'Present') present += 1;
      else if (row.status === 'Late') late += 1;
      else if (row.status === 'Absent') absent += 1;
    });
    const total = present + late + absent;
    return {
      present,
      late,
      absent,
      total,
      rate: total ? Math.round(((present + late) / total) * 100) : 0,
    };
  }, [history]);

  const monthLabel = monthAnchor
    ? new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${monthAnchor}T12:00:00Z`))
    : '';

  const dashboardPath =
    user?.role === 'school_admin' ? '/school-admin/dashboard'
      : user?.role === 'bursar' ? '/bursar'
        : user?.role === 'store_keeper' ? '/store-keeper'
          : '/teacher';

  const shiftMonth = (delta: number) => {
    const base = monthAnchor || getMonthStart(today);
    const date = new Date(`${base}T12:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() + delta);
    setMonthAnchor(`${date.toISOString().slice(0, 8)}01`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to={dashboardPath} className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-800">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
          </Link>
          <h1 className="text-2xl font-bold text-[#111111]">My Attendance</h1>
          <p className="mt-1 text-sm text-[#666666]">
            Clock in and out at school, then review your punctuality record.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800">
          <ShieldCheck className="h-4 w-4" /> GPS-verified attendance
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <StaffClockCard onChanged={() => void load()} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Present" value={summary.present} icon={<CheckCircle2 className="h-4 w-4" />} tone="emerald" />
        <SummaryCard label="Late" value={summary.late} icon={<Timer className="h-4 w-4" />} tone="amber" />
        <SummaryCard label="Absent" value={summary.absent} icon={<CalendarDays className="h-4 w-4" />} tone="rose" />
        <SummaryCard label="Attendance rate" value={`${summary.rate}%`} icon={<Clock className="h-4 w-4" />} tone="blue" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,0.06)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="font-bold text-gray-900">Attendance history</h2>
            <p className="text-xs text-gray-500">Working days only · {monthLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setMonthAnchor(getMonthStart(today))}
              className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
            >
              This month
            </button>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              disabled={monthAnchor >= getMonthStart(today)}
              className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 p-8 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" /> Loading history…
          </div>
        ) : history.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-500">No working days recorded in this month yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-[11px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-5 py-3 font-bold">Date</th>
                  <th className="px-5 py-3 font-bold">Clock In</th>
                  <th className="px-5 py-3 font-bold">Clock Out</th>
                  <th className="px-5 py-3 font-bold">Distance</th>
                  <th className="px-5 py-3 font-bold">Status</th>
                  <th className="px-5 py-3 font-bold">Method</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {history.map((row) => (
                  <tr key={row.date} className="hover:bg-gray-50/60">
                    <td className="whitespace-nowrap px-5 py-3 font-semibold text-gray-900">{formatDateLabel(row.date)}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-gray-700">
                      {row.record?.clock_in_time ? formatTimeInZone(row.record.clock_in_time, timeZone) : '—'}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-gray-700">
                      {row.record?.clock_out_time ? formatTimeInZone(row.record.clock_out_time, timeZone) : '—'}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-gray-600">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-gray-400" />
                        {row.record ? formatDistance(row.record.clock_in_distance) : '—'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3">
                      <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-bold ${statusClasses(row.status)}`}>
                        {row.status || 'Pending'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-xs text-gray-500">
                      {row.record?.method || '—'}
                      {row.record?.method === 'Manual' && row.record.override_reason ? ` · ${row.record.override_reason}` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  tone: 'emerald' | 'amber' | 'rose' | 'blue';
}) {
  const tones: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    rose: 'bg-rose-50 text-rose-700 border-rose-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
  };
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-[3px_3px_0px_0px_rgba(0,0,0,0.06)]">
      <div className={`mb-2 inline-flex rounded-lg border p-2 ${tones[tone]}`}>{icon}</div>
      <p className="text-2xl font-black text-gray-900">{value}</p>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
    </div>
  );
}
