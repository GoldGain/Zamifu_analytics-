import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  LocateFixed,
  LogIn,
  LogOut,
  MapPin,
  Navigation,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabaseUntyped } from '@/lib/supabase/client';
import {
  SCHOOL_ATTENDANCE_SELECT,
  formatDistance,
  formatTimeInZone,
  geolocationErrorMessage,
  getCurrentPosition,
  haversineDistanceMeters,
  lateCutoffLabel,
  nowTimeInZone,
  parseStaffAttendanceError,
  statusClasses,
  timeToMinutes,
  todayInZone,
  type SchoolAttendanceSettings,
  type StaffAttendanceRecord,
} from '@/lib/staffAttendance';

// The generated Database type does not yet include the new attendance table/RPC.
const db = supabaseUntyped as any;

interface StaffClockCardProps {
  compact?: boolean;
  className?: string;
  onChanged?: () => void;
}

export default function StaffClockCard({ compact = false, className = '', onChanged }: StaffClockCardProps) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<SchoolAttendanceSettings | null>(null);
  const [record, setRecord] = useState<StaffAttendanceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState<'in' | 'out' | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [now, setNow] = useState(new Date());

  const load = useCallback(async () => {
    if (!user?.schoolId || !user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data: school, error: schoolError } = await db
        .from('schools')
        .select(SCHOOL_ATTENDANCE_SELECT)
        .eq('id', user.schoolId)
        .maybeSingle();
      if (schoolError) throw schoolError;
      const typedSchool = (school || null) as SchoolAttendanceSettings | null;
      setSettings(typedSchool);
      if (typedSchool) {
        const today = todayInZone(typedSchool.attendance_timezone || 'Africa/Nairobi');
        const { data: existing, error: recordError } = await db
          .from('staff_attendance')
          .select('*')
          .eq('user_id', user.id)
          .eq('date', today)
          .maybeSingle();
        if (recordError) throw recordError;
        setRecord((existing || null) as StaffAttendanceRecord | null);
      }
    } catch (err: any) {
      setError(err?.message || 'Could not load your attendance status.');
    } finally {
      setLoading(false);
    }
  }, [user?.schoolId, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const timeZone = settings?.attendance_timezone || 'Africa/Nairobi';
  const currentTime = nowTimeInZone(timeZone, now);
  const inStart = settings ? timeToMinutes(settings.check_in_start) : 0;
  const inEnd = settings ? timeToMinutes(settings.check_in_end) : 0;
  const outStart = settings ? timeToMinutes(settings.check_out_start) : 0;
  const outEnd = settings ? timeToMinutes(settings.check_out_end) : 0;
  const clockInOpen = Boolean(settings) && currentTime.minutes >= inStart && currentTime.minutes <= inEnd;
  const clockOutOpen = Boolean(settings) && currentTime.minutes >= outStart && currentTime.minutes <= outEnd;
  const configured = Boolean(
    settings &&
      settings.staff_attendance_enabled &&
      settings.latitude !== null &&
      settings.longitude !== null,
  );

  const statusLabel = useMemo(() => {
    if (!record) return 'Not clocked in';
    return record.status;
  }, [record]);

  const requirePosition = async () => {
    if (!settings) throw new Error('School settings are still loading.');
    if (settings.latitude === null || settings.longitude === null) {
      throw new Error('Your school location has not been configured yet.');
    }
    const position = await getCurrentPosition();
    const distance = haversineDistanceMeters(
      position.coords.latitude,
      position.coords.longitude,
      Number(settings.latitude),
      Number(settings.longitude),
    );
    return { position, distance };
  };

  const handleClockIn = async () => {
    if (!user?.id || !settings) return;
    setError('');
    setSuccess('');
    if (!configured) {
      setError('Staff attendance has not been set up for your school yet. Please contact the school admin.');
      return;
    }
    if (record) {
      setError('You have already clocked in today.');
      return;
    }
    if (!clockInOpen) {
      setError(`Clock-in is currently closed. The allowed window is ${lateCutoffLabel({ check_in_start: settings.check_in_start, grace_period: 0 })} to ${formatClock(settings.check_in_end)}.`);
      return;
    }
    setLocating('in');
    try {
      const { position, distance } = await requirePosition();
      if (distance > Number(settings.attendance_radius)) {
        setError(`You must be at school to mark attendance. You are currently ${Math.round(distance).toLocaleString()} meters away.`);
        return;
      }
      const today = todayInZone(timeZone);
      const { data, error: insertError } = await db
        .from('staff_attendance')
        .insert({
          school_id: settings.id,
          user_id: user.id,
          date: today,
          clock_in_lat: position.coords.latitude,
          clock_in_lng: position.coords.longitude,
          clock_in_accuracy: position.coords.accuracy,
          status: 'Present',
          method: 'GPS',
        })
        .select('*')
        .single();
      if (insertError) {
        const parsed = parseStaffAttendanceError(insertError);
        setError(parsed.message);
        return;
      }
      const saved = data as StaffAttendanceRecord;
      setRecord(saved);
      const message = `Clock-in recorded at ${formatTimeInZone(saved.clock_in_time, timeZone)} — marked ${saved.status}. You were ${formatDistance(saved.clock_in_distance ?? distance)} from the school centre.`;
      setSuccess(message);
      toast.success(`Clocked in — ${saved.status}`);
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error && err.message.startsWith('Your school') ? err.message : geolocationErrorMessage(err));
    } finally {
      setLocating(null);
    }
  };

  const handleClockOut = async () => {
    if (!user?.id || !settings) return;
    setError('');
    setSuccess('');
    if (!configured) {
      setError('Staff attendance has not been set up for your school yet. Please contact the school admin.');
      return;
    }
    if (!record) {
      setError('You have not clocked in today.');
      return;
    }
    if (record.clock_out_time) {
      setError('You have already clocked out today.');
      return;
    }
    if (!clockOutOpen) {
      setError(`Clock-out is currently closed. The allowed window is ${formatClock(settings.check_out_start)} to ${formatClock(settings.check_out_end)}.`);
      return;
    }
    setLocating('out');
    try {
      const { position, distance } = await requirePosition();
      if (distance > Number(settings.attendance_radius)) {
        setError(`You must be at school to clock out. You are currently ${Math.round(distance).toLocaleString()} meters away.`);
        return;
      }
      const { data, error: rpcError } = await db.rpc('staff_clock_out', {
        p_lat: position.coords.latitude,
        p_lng: position.coords.longitude,
        p_accuracy: position.coords.accuracy,
      });
      if (rpcError) {
        setError(parseStaffAttendanceError(rpcError).message);
        return;
      }
      const result = (data || {}) as { success?: boolean; message?: string; distance?: number; record?: StaffAttendanceRecord };
      if (!result.success) {
        setError(result.message || 'Could not record your clock-out.');
        return;
      }
      if (result.record) setRecord(result.record);
      else await load();
      setSuccess(`Clock-out recorded at ${formatTimeInZone(result.record?.clock_out_time, timeZone)}. You were ${formatDistance(result.distance ?? distance)} from the school centre.`);
      toast.success('Clocked out successfully');
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error && err.message.startsWith('Your school') ? err.message : geolocationErrorMessage(err));
    } finally {
      setLocating(null);
    }
  };

  if (loading) {
    return (
      <div className={`rounded-2xl border border-gray-100 bg-white p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)] ${className}`}>
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" /> Loading your attendance status…
        </div>
      </div>
    );
  }

  return (
    <section className={`overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-[4px_4px_0px_0px_rgba(37,99,235,0.12)] ${className}`} aria-label="Staff attendance clock">
      <div className="bg-gradient-to-r from-[#1E40AF] via-[#2563EB] to-[#3B82F6] px-5 py-4 text-white">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              <h2 className="text-base font-bold">Staff Attendance</h2>
            </div>
            <p className="mt-0.5 text-xs text-blue-100">
              {settings?.name || 'Your school'} · Geofenced clock-in
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black tabular-nums leading-none">{currentTime.label}</p>
            <p className="mt-1 text-[11px] uppercase tracking-wider text-blue-100">{timeZone.replace('_', ' ')}</p>
          </div>
        </div>
      </div>

      <div className="p-5">
        {!settings?.staff_attendance_enabled ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <p>Staff attendance is not enabled for your school yet. Please contact your school administrator.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-500">Today&apos;s status</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-bold ${statusClasses(record?.status)}`}>
                    {statusLabel}
                  </span>
                  {record?.method === 'Manual' && (
                    <span className="rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-bold uppercase text-purple-700">
                      Manual override
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void load()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">Clock In</p>
                <p className="mt-1 text-lg font-black text-emerald-900">
                  {record?.clock_in_time ? formatTimeInZone(record.clock_in_time, timeZone) : '—'}
                </p>
                <p className="text-[11px] text-emerald-800">
                  {record ? `${formatDistance(record.clock_in_distance)} from centre` : 'Not recorded'}
                </p>
              </div>
              <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-blue-700">Clock Out</p>
                <p className="mt-1 text-lg font-black text-blue-900">
                  {record?.clock_out_time ? formatTimeInZone(record.clock_out_time, timeZone) : '—'}
                </p>
                <p className="text-[11px] text-blue-800">
                  {record?.clock_out_time ? `${formatDistance(record.clock_out_distance)} from centre` : 'Not recorded'}
                </p>
              </div>
            </div>

            {error && (
              <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div role="status" className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{success}</span>
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => void handleClockIn()}
                disabled={Boolean(record) || locating !== null || !clockInOpen}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {locating === 'in' ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                {record ? 'Clocked In' : 'Clock In'}
              </button>
              <button
                type="button"
                onClick={() => void handleClockOut()}
                disabled={!record || Boolean(record?.clock_out_time) || locating !== null || !clockOutOpen}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {locating === 'out' ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                {record?.clock_out_time ? 'Clocked Out' : 'Clock Out'}
              </button>
            </div>

            {!compact && (
              <div className="mt-4 grid gap-2 rounded-xl bg-gray-50 p-3 text-xs text-gray-600 sm:grid-cols-2">
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-blue-600" />
                  <span>Allowed radius: <strong className="text-gray-900">{formatDistance(settings.attendance_radius)}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-blue-600" />
                  <span>Late after: <strong className="text-gray-900">{lateCutoffLabel(settings)}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <Navigation className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Clock-in: <strong className="text-gray-900">{formatClock(settings.check_in_start)} – {formatClock(settings.check_in_end)}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <Navigation className="h-3.5 w-3.5 text-blue-600" />
                  <span>Clock-out: <strong className="text-gray-900">{formatClock(settings.check_out_start)} – {formatClock(settings.check_out_end)}</strong></span>
                </div>
              </div>
            )}

            {!clockInOpen && !record && (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-700">
                <Clock className="h-3.5 w-3.5" /> Clock-in opens at {formatClock(settings.check_in_start)} and closes at {formatClock(settings.check_in_end)}.
              </p>
            )}
            {record && !record.clock_out_time && !clockOutOpen && (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-700">
                <Clock className="h-3.5 w-3.5" /> Clock-out opens at {formatClock(settings.check_out_start)} and closes at {formatClock(settings.check_out_end)}.
              </p>
            )}

            <div className="mt-4 flex items-center justify-between gap-2 border-t border-gray-100 pt-3">
              <p className="flex items-center gap-1.5 text-[11px] text-gray-500">
                <LocateFixed className="h-3.5 w-3.5 text-blue-600" /> GPS is checked on this device before every action.
              </p>
              <Link to="/staff/attendance" className="text-xs font-bold text-[#2563EB] hover:underline">
                My attendance history →
              </Link>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function formatClock(value: string | null | undefined): string {
  if (!value) return '—';
  return lateCutoffLabel({ check_in_start: value, grace_period: 0 });
}
