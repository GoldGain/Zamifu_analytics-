import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Compass,
  Loader2,
  LocateFixed,
  MapPin,
  Save,
  ShieldCheck,
  Timer,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import GeofenceMap from '@/components/staff/GeofenceMap';
import { supabaseUntyped } from '@/lib/supabase/client';
import {
  SCHOOL_ATTENDANCE_SELECT,
  TIMEZONE_OPTIONS,
  WORKING_DAY_LABELS,
  geolocationErrorMessage,
  getCurrentPosition,
  lateCutoffLabel,
  timeToMinutes,
  toTimeInput,
  workingDaysLabel,
  type SchoolAttendanceSettings,
} from '@/lib/staffAttendance';

// The generated Database type does not yet include the new attendance table/RPC.
const db = supabaseUntyped as any;

interface SettingsForm {
  latitude: string;
  longitude: string;
  radius: string;
  check_in_start: string;
  check_in_end: string;
  check_out_start: string;
  check_out_end: string;
  grace_period: string;
  timezone: string;
  workingDays: number[];
  enabled: boolean;
}

const emptyForm: SettingsForm = {
  latitude: '',
  longitude: '',
  radius: '100',
  check_in_start: '06:30',
  check_in_end: '08:00',
  check_out_start: '16:00',
  check_out_end: '18:00',
  grace_period: '15',
  timezone: 'Africa/Nairobi',
  workingDays: [1, 2, 3, 4, 5],
  enabled: false,
};

export default function StaffAttendanceSettingsPage() {
  const { user } = useAuth();
  const [form, setForm] = useState<SettingsForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.schoolId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data, error: fetchError } = await db
        .from('schools')
        .select(`${SCHOOL_ATTENDANCE_SELECT}, updated_at`)
        .eq('id', user.schoolId)
        .maybeSingle();
      if (fetchError) throw fetchError;
      if (!data) {
        setError('Could not find your school record.');
        return;
      }
      const settings = data as SchoolAttendanceSettings & { updated_at?: string };
      setForm({
        latitude: settings.latitude === null || settings.latitude === undefined ? '' : String(settings.latitude),
        longitude: settings.longitude === null || settings.longitude === undefined ? '' : String(settings.longitude),
        radius: String(settings.attendance_radius ?? 100),
        check_in_start: toTimeInput(settings.check_in_start) || '06:30',
        check_in_end: toTimeInput(settings.check_in_end) || '08:00',
        check_out_start: toTimeInput(settings.check_out_start) || '16:00',
        check_out_end: toTimeInput(settings.check_out_end) || '18:00',
        grace_period: String(settings.grace_period ?? 15),
        timezone: settings.attendance_timezone || 'Africa/Nairobi',
        workingDays: settings.attendance_working_days?.length ? settings.attendance_working_days : [1, 2, 3, 4, 5],
        enabled: Boolean(settings.staff_attendance_enabled),
      });
      setLastUpdated(settings.updated_at || null);
    } catch (err: any) {
      setError(err?.message || 'Could not load staff attendance settings.');
    } finally {
      setLoading(false);
    }
  }, [user?.schoolId]);

  useEffect(() => {
    void load();
  }, [load]);

  const latitude = form.latitude.trim() === '' ? null : Number(form.latitude);
  const longitude = form.longitude.trim() === '' ? null : Number(form.longitude);
  const radius = Number(form.radius || 0);

  const validation = useMemo(() => {
    const issues: string[] = [];
    if (latitude === null || Number.isNaN(latitude)) issues.push('Drop a pin on the map or enter a latitude.');
    else if (latitude < -90 || latitude > 90) issues.push('Latitude must be between -90 and 90.');
    if (longitude === null || Number.isNaN(longitude)) issues.push('Drop a pin on the map or enter a longitude.');
    else if (longitude < -180 || longitude > 180) issues.push('Longitude must be between -180 and 180.');
    if (!Number.isFinite(radius) || radius < 10 || radius > 100000) issues.push('Allowed radius must be between 10 m and 100,000 m.');
    if (!form.check_in_start || !form.check_in_end) issues.push('Set the check-in window.');
    else if (timeToMinutes(form.check_in_start) >= timeToMinutes(form.check_in_end)) issues.push('Check-in start must be before check-in end.');
    if (!form.check_out_start || !form.check_out_end) issues.push('Set the check-out window.');
    else if (timeToMinutes(form.check_out_start) >= timeToMinutes(form.check_out_end)) issues.push('Check-out start must be before check-out end.');
    const grace = Number(form.grace_period);
    if (!Number.isFinite(grace) || grace < 0 || grace > 240) issues.push('Grace period must be between 0 and 240 minutes.');
    if (!form.workingDays.length) issues.push('Select at least one working day.');
    return issues;
  }, [latitude, longitude, radius, form]);

  const setField = <K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setSaved(false);
  };

  const handleMapChange = (lat: number, lng: number) => {
    setForm((current) => ({
      ...current,
      latitude: lat.toFixed(6),
      longitude: lng.toFixed(6),
    }));
    setSaved(false);
  };

  const handleUseCurrentLocation = async () => {
    setError('');
    setLocating(true);
    try {
      const position = await getCurrentPosition();
      setForm((current) => ({
        ...current,
        latitude: position.coords.latitude.toFixed(6),
        longitude: position.coords.longitude.toFixed(6),
      }));
      setSaved(false);
      toast.success(`Location captured (accurate to about ${Math.round(position.coords.accuracy)} m).`);
    } catch (err) {
      setError(geolocationErrorMessage(err));
    } finally {
      setLocating(false);
    }
  };

  const handleSave = async () => {
    if (!user?.schoolId) return;
    setError('');
    if (validation.length) {
      setError(validation[0]);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        latitude,
        longitude,
        attendance_radius: Math.round(radius),
        check_in_start: form.check_in_start,
        check_in_end: form.check_in_end,
        check_out_start: form.check_out_start,
        check_out_end: form.check_out_end,
        grace_period: Math.round(Number(form.grace_period)),
        attendance_timezone: form.timezone,
        attendance_working_days: form.workingDays.slice().sort((a, b) => a - b),
        staff_attendance_enabled: form.enabled,
      };
      const { data, error: updateError } = await db
        .from('schools')
        .update(payload)
        .eq('id', user.schoolId)
        .select(`${SCHOOL_ATTENDANCE_SELECT}, updated_at`)
        .single();
      if (updateError) throw updateError;
      setSaved(true);
      setLastUpdated((data as any)?.updated_at || new Date().toISOString());
      toast.success('Staff attendance settings saved.');
    } catch (err: any) {
      setError(err?.message || 'Could not save staff attendance settings.');
      toast.error('Could not save settings.');
    } finally {
      setSaving(false);
    }
  };

  const toggleWorkingDay = (day: number) => {
    setForm((current) => ({
      ...current,
      workingDays: current.workingDays.includes(day)
        ? current.workingDays.filter((value) => value !== day)
        : [...current.workingDays, day].sort((a, b) => a - b),
    }));
    setSaved(false);
  };

  const previewLateCutoff = lateCutoffLabel({
    check_in_start: form.check_in_start,
    grace_period: Number(form.grace_period) || 0,
  });

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl bg-white p-8 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin text-blue-600" /> Loading attendance settings…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-gray-500">
            <Link to="/school-admin/dashboard" className="hover:text-gray-800">School Admin</Link>
            <span>/</span>
            <span>Settings</span>
            <span>/</span>
            <span className="text-gray-800">Staff Attendance</span>
          </div>
          <h1 className="text-2xl font-bold text-[#111111]">Staff Attendance Setup</h1>
          <p className="mt-1 max-w-2xl text-sm text-[#666666]">
            Set the exact school location and the rules staff must satisfy on their phones before a clock-in or clock-out is accepted.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/school-admin/staff-attendance"
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <Users className="h-4 w-4" /> Attendance report <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save settings
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {saved && (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4" /> Settings saved. Staff will see the new rules immediately.
        </div>
      )}

      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.06)] sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-bold text-gray-900">
              <MapPin className="h-4 w-4 text-blue-600" /> School location & geofence
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Tap the map to drop the pin at the school gate or centre. Drag the pin to fine-tune. The blue circle is the allowed radius.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleUseCurrentLocation()}
            disabled={locating}
            className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-60"
          >
            {locating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LocateFixed className="h-3.5 w-3.5" />}
            Use my current location
          </button>
        </div>
        <GeofenceMap
          latitude={latitude !== null && Number.isFinite(latitude) ? latitude : null}
          longitude={longitude !== null && Number.isFinite(longitude) ? longitude : null}
          radius={Number.isFinite(radius) ? radius : 100}
          onChange={handleMapChange}
          height={400}
        />
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">Latitude</span>
            <input
              type="number"
              step="0.000001"
              value={form.latitude}
              onChange={(event) => setField('latitude', event.target.value)}
              placeholder="-4.043500"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">Longitude</span>
            <input
              type="number"
              step="0.000001"
              value={form.longitude}
              onChange={(event) => setField('longitude', event.target.value)}
              placeholder="39.668200"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">Allowed radius (metres)</span>
            <input
              type="number"
              min={10}
              max={100000}
              value={form.radius}
              onChange={(event) => setField('radius', event.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </label>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {[50, 100, 200, 500, 1000].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setField('radius', String(preset))}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${Number(form.radius) === preset ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              {preset >= 1000 ? `${preset / 1000} km` : `${preset} m`}
            </button>
          ))}
        </div>
        <p className="mt-2 flex items-start gap-1.5 text-[11px] text-gray-500">
          <Compass className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
          Tip: phone GPS is usually accurate to 5–50 m outdoors. A radius of 100–200 m works well for most schools; avoid going below 50 m.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.06)]">
          <h2 className="flex items-center gap-2 font-bold text-gray-900">
            <Clock className="h-4 w-4 text-blue-600" /> Operating hours
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">Clock-ins outside the check-in window and clock-outs outside the check-out window are rejected.</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">Check-in opens</span>
              <input
                type="time"
                value={form.check_in_start}
                onChange={(event) => setField('check_in_start', event.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">Check-in closes</span>
              <input
                type="time"
                value={form.check_in_end}
                onChange={(event) => setField('check_in_end', event.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">Check-out opens</span>
              <input
                type="time"
                value={form.check_out_start}
                onChange={(event) => setField('check_out_start', event.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">Check-out closes</span>
              <input
                type="time"
                value={form.check_out_end}
                onChange={(event) => setField('check_out_end', event.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </label>
          </div>

          <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs text-amber-900">
            <p className="flex items-center gap-1.5 font-bold"><Timer className="h-3.5 w-3.5" /> Late grace period</p>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={240}
                value={form.grace_period}
                onChange={(event) => setField('grace_period', event.target.value)}
                className="w-24 rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-sm font-semibold focus:border-amber-500 focus:outline-none"
              />
              <span>minutes</span>
            </div>
            <p className="mt-2">
              Staff who clock in after <strong>{previewLateCutoff}</strong> are marked <strong>Late</strong>. Everyone inside the radius before that time is <strong>Present</strong>.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.06)]">
          <h2 className="flex items-center gap-2 font-bold text-gray-900">
            <ShieldCheck className="h-4 w-4 text-emerald-600" /> Attendance policy
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">These rules apply to every staff member: teachers, bursars, deans of studies, store keepers and admins.</p>

          <div className="mt-4 space-y-4">
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">School timezone</span>
              <select
                value={form.timezone}
                onChange={(event) => setField('timezone', event.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                {TIMEZONE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <div>
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">Working days</span>
              <div className="flex flex-wrap gap-1.5">
                {WORKING_DAY_LABELS.map((day) => {
                  const active = form.workingDays.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleWorkingDay(day.value)}
                      aria-pressed={active}
                      className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold ${active ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}
                    >
                      {day.short}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 text-[11px] text-gray-500">Reports only count absences on these days. Currently: {workingDaysLabel(form.workingDays)}.</p>
            </div>

            <div className="rounded-xl border border-gray-200 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-gray-900">Enable staff attendance</p>
                  <p className="text-[11px] text-gray-500">Show the clock-in card to staff and accept GPS check-ins.</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.enabled}
                  onClick={() => setField('enabled', !form.enabled)}
                  className={`relative h-7 w-12 flex-shrink-0 rounded-full transition-colors ${form.enabled ? 'bg-emerald-500' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${form.enabled ? 'left-6' : 'left-1'}`} />
                </button>
              </div>
            </div>

            {lastUpdated && (
              <p className="text-[11px] text-gray-400">
                Last saved {new Date(lastUpdated).toLocaleString('en-GB')}.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4">
        <p className="text-xs text-blue-900">
          Saving applies the rules immediately. Staff must be inside the <strong>{radius ? `${radius.toLocaleString()} m` : '—'}</strong> radius to clock in or out.
        </p>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save settings
        </button>
      </div>
    </div>
  );
}
