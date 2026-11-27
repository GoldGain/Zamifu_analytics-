/**
 * Shared helpers for the Geo-Biometric Staff Attendance module.
 *
 * The client computes the Haversine distance for instant UX feedback; the
 * database repeats the same calculation server-side before accepting a
 * clock-in so a tampered browser cannot fake its position.
 */

export const STAFF_ATTENDANCE_ROLES = ['teacher', 'school_admin', 'bursar', 'store_keeper'] as const;
export type StaffAttendanceRole = (typeof STAFF_ATTENDANCE_ROLES)[number];

export const STAFF_ROLE_LABELS: Record<string, string> = {
  teacher: 'Teacher',
  school_admin: 'School Admin',
  bursar: 'Bursar',
  store_keeper: 'Store Keeper',
};

export const WORKING_DAY_LABELS: { value: number; short: string; label: string }[] = [
  { value: 1, short: 'Mon', label: 'Monday' },
  { value: 2, short: 'Tue', label: 'Tuesday' },
  { value: 3, short: 'Wed', label: 'Wednesday' },
  { value: 4, short: 'Thu', label: 'Thursday' },
  { value: 5, short: 'Fri', label: 'Friday' },
  { value: 6, short: 'Sat', label: 'Saturday' },
  { value: 7, short: 'Sun', label: 'Sunday' },
];

export const TIMEZONE_OPTIONS = [
  { value: 'Africa/Nairobi', label: 'Africa/Nairobi (EAT, UTC+3)' },
  { value: 'Africa/Kampala', label: 'Africa/Kampala (EAT, UTC+3)' },
  { value: 'Africa/Dar_es_Salaam', label: 'Africa/Dar es Salaam (EAT, UTC+3)' },
  { value: 'Africa/Kigali', label: 'Africa/Kigali (CAT, UTC+2)' },
  { value: 'Africa/Addis_Ababa', label: 'Africa/Addis Ababa (EAT, UTC+3)' },
  { value: 'UTC', label: 'UTC' },
];

export interface SchoolAttendanceSettings {
  id: string;
  name: string;
  logo_url: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  attendance_radius: number;
  check_in_start: string;
  check_in_end: string;
  check_out_start: string;
  check_out_end: string;
  grace_period: number;
  attendance_timezone: string;
  attendance_working_days: number[];
  staff_attendance_enabled: boolean;
  staff_attendance_enabled_at?: string | null;
}

export interface StaffAttendanceRecord {
  id: string;
  school_id: string;
  user_id: string;
  date: string;
  clock_in_time: string | null;
  clock_out_time: string | null;
  clock_in_lat: number | null;
  clock_in_lng: number | null;
  clock_in_accuracy: number | null;
  clock_in_distance: number | null;
  clock_out_lat: number | null;
  clock_out_lng: number | null;
  clock_out_accuracy: number | null;
  clock_out_distance: number | null;
  status: 'Present' | 'Late' | 'Absent';
  method: 'GPS' | 'Manual';
  overridden_by: string | null;
  override_reason: string | null;
  overridden_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface StaffMember {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  role: StaffAttendanceRole;
  is_active: boolean | null;
  is_dean_of_studies?: boolean;
}

export const SCHOOL_ATTENDANCE_SELECT =
  'id, name, logo_url, address, latitude, longitude, attendance_radius, check_in_start, check_in_end, check_out_start, check_out_end, grace_period, attendance_timezone, attendance_working_days, staff_attendance_enabled, staff_attendance_enabled_at';

/** Great-circle distance in metres using the Haversine formula. */
export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const earthRadiusM = 6371000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusM * c;
}

/** Wraps the callback-based Geolocation API with the required options. */
export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      reject(Object.assign(new Error('Geolocation is not supported on this device.'), { code: 0 }));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      resolve,
      reject,
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  });
}

/** User-facing copy for every geolocation failure mode. */
export function geolocationErrorMessage(error: unknown): string {
  const code = (error as { code?: number } | null)?.code;
  if (code === 3) {
    return 'We could not get your location in time. Move to an open area, make sure GPS is switched on, and try again.';
  }
  if (code === 0) {
    return 'Location is required. Please enable GPS/Location on your phone and refresh.';
  }
  return 'Location is required. Please enable GPS/Location on your phone and refresh.';
}

export function formatDistance(meters: number | null | undefined): string {
  if (meters === null || meters === undefined || Number.isNaN(Number(meters))) return '—';
  const value = Number(meters);
  if (value < 1000) return `${Math.round(value).toLocaleString()} m`;
  return `${(value / 1000).toFixed(value < 10000 ? 2 : 1)} km`;
}

export function formatTimeInZone(value: string | Date | null | undefined, timeZone: string): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true }).format(date);
  }
}

/** Returns YYYY-MM-DD for the given instant in the school's timezone. */
export function dateKeyInZone(value: Date | string, timeZone: string): string {
  const date = value instanceof Date ? value : new Date(value);
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const get = (type: string) => parts.find((part) => part.type === type)?.value || '';
    return `${get('year')}-${get('month')}-${get('day')}`;
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export function todayInZone(timeZone: string): string {
  return dateKeyInZone(new Date(), timeZone);
}

/** First date (school timezone) on which absences should be counted. */
export function attendanceTrackingStart(
  settings: Pick<SchoolAttendanceSettings, 'staff_attendance_enabled_at'> | null | undefined,
  timeZone: string,
): string | null {
  if (!settings?.staff_attendance_enabled_at) return null;
  const key = dateKeyInZone(settings.staff_attendance_enabled_at, timeZone);
  return Number.isNaN(new Date(`${key}T00:00:00Z`).getTime()) ? null : key;
}

export function formatDateLabel(dateKey: string | null | undefined): string {
  if (!dateKey) return '—';
  const date = new Date(`${dateKey}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return dateKey;
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function formatLongDate(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00Z`);
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

/** Converts a Postgres time ('07:30:00') into an <input type="time"> value. */
export function toTimeInput(value: string | null | undefined): string {
  if (!value) return '';
  return value.slice(0, 5);
}

/** Converts a timestamp into an HH:MM value in the school's timezone. */
export function timeInputInZone(value: string | null | undefined, timeZone: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  } catch {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }
}

export function timeToMinutes(value: string | null | undefined): number {
  if (!value) return 0;
  const [hours, minutes] = value.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

export function minutesToTimeLabel(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hours24 = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  const suffix = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${String(hours12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

/** Current wall-clock time in a timezone, as minutes since midnight and a label. */
export function nowTimeInZone(timeZone: string, at: Date = new Date()): { minutes: number; label: string } {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(at);
    const hour = Number(parts.find((part) => part.type === 'hour')?.value || 0);
    const minute = Number(parts.find((part) => part.type === 'minute')?.value || 0);
    const minutes = (hour === 24 ? 0 : hour) * 60 + minute;
    return { minutes, label: minutesToTimeLabel(minutes) };
  } catch {
    const minutes = at.getHours() * 60 + at.getMinutes();
    return { minutes, label: minutesToTimeLabel(minutes) };
  }
}

/** The official arrival time after which a clock-in is Late. */
export function lateCutoffLabel(settings: Pick<SchoolAttendanceSettings, 'check_in_start' | 'grace_period'>): string {
  return minutesToTimeLabel(timeToMinutes(settings.check_in_start) + Number(settings.grace_period || 0));
}

export function staffRoleLabel(member: Pick<StaffMember, 'role' | 'is_dean_of_studies'>): string {
  if (member.role === 'teacher' && member.is_dean_of_studies) return 'Dean of Studies';
  return STAFF_ROLE_LABELS[member.role] || member.role;
}

export function staffDisplayName(member: Pick<StaffMember, 'first_name' | 'last_name' | 'email'>): string {
  const name = `${member.first_name || ''} ${member.last_name || ''}`.trim();
  return name || member.email || 'Unnamed staff';
}

/**
 * Converts a wall-clock date/time in a timezone into a UTC ISO timestamp.
 * Handles zones with or without DST by measuring the zone offset at that moment.
 */
export function zonedWallTimeToIso(dateKey: string, time: string, timeZone: string): string | null {
  if (!dateKey || !time) return null;
  const [year, month, day] = dateKey.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  if (!year || !month || !day || Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  const utcGuess = Date.UTC(year, month - 1, day, hours, minutes, 0);
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(new Date(utcGuess));
    const get = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);
    const zoneHour = get('hour') === 24 ? 0 : get('hour');
    const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), zoneHour, get('minute'), get('second'));
    const offset = asUtc - utcGuess;
    return new Date(utcGuess - offset).toISOString();
  } catch {
    return new Date(utcGuess).toISOString();
  }
}

export function parseStaffAttendanceError(error: { message?: string; code?: string } | null | undefined): {
  code: string;
  message: string;
  distance?: number;
} {
  const raw = error?.message || '';
  if (error?.code === '23505' || raw.includes('staff_attendance_user_date_key')) {
    return { code: 'ALREADY_CLOCKED_IN', message: 'You have already clocked in today.' };
  }
  const match = raw.match(/STAFF_ATTENDANCE:([A-Z_]+)(?::([0-9.]+))?/);
  if (match) {
    const code = match[1];
    const value = match[2] ? Number(match[2]) : undefined;
    switch (code) {
      case 'OUT_OF_RANGE':
        return {
          code,
          distance: value,
          message: `You must be at school to mark attendance. You are currently ${Math.round(value || 0).toLocaleString()} meters away.`,
        };
      case 'OUTSIDE_WINDOW':
        return {
          code,
          message: `Clock-in is currently closed. The allowed window is ${match[2] ? match[2].replace('-', ' to ') : 'outside the school operating hours'}.`,
        };
      case 'NOT_CONFIGURED':
        return { code, message: 'Your school has not set up staff attendance yet. Please contact the school admin.' };
      case 'NOT_ADMIN':
        return { code, message: 'Only a school admin can record a manual override.' };
      case 'NOT_SELF':
        return { code, message: 'You can only record attendance for your own account.' };
      case 'NOT_STAFF':
        return { code, message: 'Your account is not registered as staff for attendance.' };
      default:
        return { code, message: raw.replace('STAFF_ATTENDANCE:', '') };
    }
  }
  if (raw.toLowerCase().includes('row-level security')) {
    return { code: 'RLS', message: 'You do not have permission to record this attendance.' };
  }
  return { code: 'UNKNOWN', message: raw || 'Could not record attendance. Please try again.' };
}

/** ISO weekday number (1 = Monday ... 7 = Sunday) for a YYYY-MM-DD key. */
export function isoWeekday(dateKey: string): number {
  const day = new Date(`${dateKey}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

export function addDaysToKey(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function datesInRange(from: string, to: string): string[] {
  if (!from || !to) return [];
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];
  const dates: string[] = [];
  const cursor = new Date(start);
  let guard = 0;
  while (cursor <= end && guard < 3700) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    guard += 1;
  }
  return dates;
}

export function isWorkingDay(dateKey: string, workingDays: number[] | null | undefined): boolean {
  const days = workingDays && workingDays.length ? workingDays : [1, 2, 3, 4, 5];
  return days.includes(isoWeekday(dateKey));
}

export function countWorkingDays(from: string, to: string, workingDays: number[] | null | undefined): number {
  return datesInRange(from, to).filter((date) => isWorkingDay(date, workingDays)).length;
}

export function getWeekStart(dateKey: string): string {
  return addDaysToKey(dateKey, -(isoWeekday(dateKey) - 1));
}

export function getMonthStart(dateKey: string): string {
  return `${dateKey.slice(0, 7)}-01`;
}

export function statusClasses(status: string | null | undefined): string {
  switch (status) {
    case 'Present':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'Late':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'Absent':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    default:
      return 'bg-gray-50 text-gray-600 border-gray-200';
  }
}

export function workingDaysLabel(days: number[] | null | undefined): string {
  const list = days && days.length ? days : [1, 2, 3, 4, 5];
  return list
    .slice()
    .sort((a, b) => a - b)
    .map((day) => WORKING_DAY_LABELS.find((item) => item.value === day)?.short || '')
    .filter(Boolean)
    .join(', ');
}
