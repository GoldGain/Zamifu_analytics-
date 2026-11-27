import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Filter,
  Loader2,
  MapPin,
  PencilLine,
  RefreshCw,
  Search,
  Settings2,
  Timer,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabaseUntyped } from '@/lib/supabase/client';
import { downloadStaffAttendancePdf, type PdfAttendanceRow, type PdfSummary } from '@/lib/staffAttendancePdf';
import {
  SCHOOL_ATTENDANCE_SELECT,
  STAFF_ATTENDANCE_ROLES,
  addDaysToKey,
  countWorkingDays,
  datesInRange,
  formatDateLabel,
  formatDistance,
  formatLongDate,
  formatTimeInZone,
  getMonthStart,
  getWeekStart,
  isWorkingDay,
  staffDisplayName,
  staffRoleLabel,
  statusClasses,
  timeInputInZone,
  timeToMinutes,
  todayInZone,
  toTimeInput,
  workingDaysLabel,
  zonedWallTimeToIso,
  type SchoolAttendanceSettings,
  type StaffAttendanceRecord,
  type StaffMember,
} from '@/lib/staffAttendance';

// The generated Database type does not yet include the new attendance table/RPC.
const db = supabaseUntyped as any;

type Preset = 'today' | 'week' | 'month' | 'custom';
type RangeRow = { staff: StaffMember; workingDays: number; presentDays: number; lateDays: number; absentDays: number; rate: number };
type DailyRow = { staff: StaffMember; record: StaffAttendanceRecord | null; status: string | null };

type SchoolWithDos = SchoolAttendanceSettings & { dean_of_studies_id?: string | null };

export default function StaffAttendanceReportPage() {
  const { user } = useAuth();
  const [school, setSchool] = useState<SchoolWithDos | null>(null);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [records, setRecords] = useState<StaffAttendanceRecord[]>([]);
  const [preset, setPreset] = useState<Preset>('today');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [error, setError] = useState('');
  const [overrideTarget, setOverrideTarget] = useState<StaffMember | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  const loadBase = useCallback(async () => {
    if (!user?.schoolId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data: schoolData, error: schoolError } = await db
        .from('schools')
        .select(`${SCHOOL_ATTENDANCE_SELECT}, dean_of_studies_id`)
        .eq('id', user.schoolId)
        .maybeSingle();
      if (schoolError) throw schoolError;
      const typedSchool = (schoolData || null) as SchoolWithDos | null;
      setSchool(typedSchool);

      const { data: profileRows, error: profileError } = await db
        .from('profiles')
        .select('id, first_name, last_name, email, role, is_active')
        .eq('school_id', user.schoolId)
        .in('role', STAFF_ATTENDANCE_ROLES as unknown as string[])
        .or('is_active.is.null,is_active.eq.true')
        .order('first_name', { ascending: true });
      if (profileError) throw profileError;

      const { data: teacherRows } = await db
        .from('teachers')
        .select('id, profile_id, is_dean_of_studies')
        .eq('school_id', user.schoolId);
      const dosProfileIds = new Set<string>();
      (teacherRows || []).forEach((teacher: any) => {
        if (teacher.is_dean_of_studies || (typedSchool?.dean_of_studies_id && teacher.id === typedSchool.dean_of_studies_id)) {
          if (teacher.profile_id) dosProfileIds.add(teacher.profile_id);
        }
      });

      const staffList = ((profileRows || []) as any[]).map((profile) => ({
        id: profile.id,
        first_name: profile.first_name,
        last_name: profile.last_name,
        email: profile.email,
        role: profile.role,
        is_active: profile.is_active,
        is_dean_of_studies: dosProfileIds.has(profile.id),
      })) as StaffMember[];
      setStaff(staffList);

      if (!from && typedSchool) {
        const today = todayInZone(typedSchool.attendance_timezone || 'Africa/Nairobi');
        setFrom(today);
        setTo(today);
      }
    } catch (err: any) {
      setError(err?.message || 'Could not load the staff attendance report.');
    } finally {
      setLoading(false);
    }
  }, [user?.schoolId, from]);

  useEffect(() => {
    void loadBase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.schoolId]);

  const loadRecords = useCallback(async () => {
    if (!user?.schoolId || !from || !to) return;
    if (from > to) {
      setError('The start date must be on or before the end date.');
      setRecords([]);
      return;
    }
    setRecordsLoading(true);
    setError('');
    try {
      const { data, error: fetchError } = await db
        .from('staff_attendance')
        .select('*')
        .eq('school_id', user.schoolId)
        .gte('date', from)
        .lte('date', to)
        .order('date', { ascending: false })
        .limit(20000);
      if (fetchError) throw fetchError;
      setRecords((data || []) as StaffAttendanceRecord[]);
    } catch (err: any) {
      setError(err?.message || 'Could not load attendance records.');
    } finally {
      setRecordsLoading(false);
    }
  }, [user?.schoolId, from, to]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const timeZone = school?.attendance_timezone || 'Africa/Nairobi';
  const today = todayInZone(timeZone);
  const workingDays = school?.attendance_working_days?.length ? school.attendance_working_days : [1, 2, 3, 4, 5];
  const singleDay = Boolean(from && to && from === to);
  const reportDateIsWorkingDay = from ? isWorkingDay(from, workingDays) : true;

  const applyPreset = (next: Preset) => {
    setPreset(next);
    if (next === 'custom') return;
    const base = todayInZone(timeZone);
    if (next === 'today') {
      setFrom(base);
      setTo(base);
    } else if (next === 'week') {
      setFrom(getWeekStart(base));
      setTo(base);
    } else if (next === 'month') {
      setFrom(getMonthStart(base));
      setTo(base);
    }
  };

  const filteredStaff = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return staff.filter((member) => {
      if (roleFilter === 'dean' && !member.is_dean_of_studies) return false;
      if (roleFilter !== 'all' && roleFilter !== 'dean' && member.role !== roleFilter) return false;
      if (!needle) return true;
      return `${member.first_name || ''} ${member.last_name || ''} ${member.email || ''}`.toLowerCase().includes(needle);
    });
  }, [staff, roleFilter, search]);

  const staffById = useMemo(() => new Map(staff.map((member) => [member.id, member])), [staff]);

  const recordLookup = useMemo(() => {
    const map = new Map<string, StaffAttendanceRecord>();
    records.forEach((record) => map.set(`${record.user_id}|${record.date}`, record));
    return map;
  }, [records]);

  const dailyRows: DailyRow[] = useMemo(() => {
    if (!singleDay || !from) return [];
    const isFuture = from > today;
    return filteredStaff.map((member) => {
      const record = recordLookup.get(`${member.id}|${from}`) || null;
      const status = record?.status || (!isFuture && reportDateIsWorkingDay ? 'Absent' : null);
      return { staff: member, record, status };
    });
  }, [filteredStaff, recordLookup, singleDay, from, today, reportDateIsWorkingDay]);

  const summaryRows: RangeRow[] = useMemo(() => {
    if (!from || !to) return [];
    const effectiveTo = to > today ? today : to;
    return filteredStaff.map((member) => {
      const memberRecords = records.filter((record) => record.user_id === member.id);
      const working = countWorkingDays(from, effectiveTo, workingDays);
      const presentDays = memberRecords.filter((record) => record.status === 'Present').length;
      const lateDays = memberRecords.filter((record) => record.status === 'Late').length;
      const absentDays = Math.max(0, working - presentDays - lateDays);
      const rate = working ? Math.min(100, Math.round(((presentDays + lateDays) / working) * 100)) : 0;
      return { staff: member, workingDays: working, presentDays, lateDays, absentDays, rate };
    });
  }, [filteredStaff, records, from, to, today, workingDays]);

  const summary: PdfSummary = useMemo(() => {
    if (singleDay) {
      const present = dailyRows.filter((row) => row.status === 'Present').length;
      const late = dailyRows.filter((row) => row.status === 'Late').length;
      const absent = dailyRows.filter((row) => row.status === 'Absent').length;
      const eligible = dailyRows.filter((row) => row.status !== null).length;
      return {
        totalStaff: filteredStaff.length,
        present,
        late,
        absent,
        rate: eligible ? Math.round(((present + late) / eligible) * 100) : null,
      };
    }
    const present = summaryRows.reduce((total, row) => total + row.presentDays, 0);
    const late = summaryRows.reduce((total, row) => total + row.lateDays, 0);
    const absent = summaryRows.reduce((total, row) => total + row.absentDays, 0);
    const working = summaryRows.reduce((total, row) => total + row.workingDays, 0);
    return {
      totalStaff: filteredStaff.length,
      present,
      late,
      absent,
      rate: working ? Math.min(100, Math.round(((present + late) / working) * 100)) : null,
    };
  }, [singleDay, dailyRows, summaryRows, filteredStaff.length]);

  const reportLabel = useMemo(() => {
    if (!from || !to) return '—';
    return singleDay ? formatLongDate(from) : `${formatDateLabel(from)} — ${formatDateLabel(to)}`;
  }, [from, to, singleDay]);

  const exportBulkPdf = async () => {
    if (!school || !from || !to) return;
    if (!filteredStaff.length) {
      toast.error('There are no staff members to export.');
      return;
    }
    setPdfBusy(true);
    try {
      const rows: PdfAttendanceRow[] = singleDay
        ? dailyRows.map((row) => ({
            name: staffDisplayName(row.staff),
            role: staffRoleLabel(row.staff),
            clockIn: row.record?.clock_in_time || null,
            clockOut: row.record?.clock_out_time || null,
            distance: row.record?.clock_in_distance ?? null,
            status: row.status,
            method: row.record?.method || null,
          }))
        : summaryRows.map((row) => ({
            name: staffDisplayName(row.staff),
            role: staffRoleLabel(row.staff),
            workingDays: row.workingDays,
            presentDays: row.presentDays,
            lateDays: row.lateDays,
            absentDays: row.absentDays,
            rate: row.rate,
          }));
      await downloadStaffAttendancePdf({
        schoolName: school.name,
        logoUrl: school.logo_url,
        address: school.address,
        from,
        to,
        mode: singleDay ? 'daily' : 'summary',
        rows,
        summary,
        timeZone,
        generatedBy: `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.email,
      });
      toast.success('PDF report downloaded.');
    } catch (err: any) {
      toast.error(err?.message || 'Could not generate the PDF report.');
    } finally {
      setPdfBusy(false);
    }
  };

  const exportIndividualPdf = async (member: StaffMember, rowStats?: RangeRow) => {
    if (!school || !from || !to) return;
    setPdfBusy(true);
    try {
      const effectiveTo = to > today ? today : to;
      const memberRecords = records.filter((record) => record.user_id === member.id);
      const recordByDate = new Map(memberRecords.map((record) => [record.date, record]));
      const dayKeys = datesInRange(from, effectiveTo).filter((date) => isWorkingDay(date, workingDays));
      const pdfRows: PdfAttendanceRow[] = dayKeys.map((date) => {
        const record = recordByDate.get(date) || null;
        return {
          date,
          name: staffDisplayName(member),
          role: staffRoleLabel(member),
          clockIn: record?.clock_in_time || null,
          clockOut: record?.clock_out_time || null,
          distance: record?.clock_in_distance ?? null,
          status: record?.status || (date <= today ? 'Absent' : null),
          method: record?.method || null,
        };
      });
      const working = rowStats?.workingDays ?? countWorkingDays(from, effectiveTo, workingDays);
      const presentDays = rowStats?.presentDays ?? memberRecords.filter((record) => record.status === 'Present').length;
      const lateDays = rowStats?.lateDays ?? memberRecords.filter((record) => record.status === 'Late').length;
      const absentDays = rowStats?.absentDays ?? Math.max(0, working - presentDays - lateDays);
      const rate = working ? Math.min(100, Math.round(((presentDays + lateDays) / working) * 100)) : 0;
      await downloadStaffAttendancePdf({
        schoolName: school.name,
        logoUrl: school.logo_url,
        address: school.address,
        from,
        to,
        mode: 'individual',
        rows: pdfRows,
        summary: { totalStaff: 1, present: presentDays, late: lateDays, absent: absentDays, rate },
        individual: {
          name: staffDisplayName(member),
          role: staffRoleLabel(member),
          workingDays: working,
          presentDays,
          lateDays,
          absentDays,
          rate,
        },
        timeZone,
        generatedBy: `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.email,
      });
      toast.success(`Individual report for ${staffDisplayName(member)} downloaded.`);
    } catch (err: any) {
      toast.error(err?.message || 'Could not generate the individual PDF.');
    } finally {
      setPdfBusy(false);
    }
  };

  const notConfigured = Boolean(school && (!school.staff_attendance_enabled || school.latitude === null || school.longitude === null));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-gray-500">
            <Link to="/school-admin/dashboard" className="hover:text-gray-800">School Admin</Link>
            <span>/</span>
            <span className="text-gray-800">Staff Attendance Report</span>
          </div>
          <h1 className="text-2xl font-bold text-[#111111]">Staff Attendance Report</h1>
          <p className="mt-1 max-w-2xl text-sm text-[#666666]">
            Monitor punctuality, review GPS clock-ins and export signed-off attendance reports.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void loadRecords()}
            disabled={recordsLoading}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${recordsLoading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <Link
            to="/school-admin/settings/staff-attendance"
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <Settings2 className="h-4 w-4" /> Setup
          </Link>
          <button
            type="button"
            onClick={() => void exportBulkPdf()}
            disabled={pdfBusy || !filteredStaff.length}
            className="inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {pdfBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Download Report (PDF)
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" /> <span>{error}</span>
        </div>
      )}

      {notConfigured && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            Staff attendance is not fully configured yet. Set the school location, radius and hours before staff can clock in.
          </p>
          <Link to="/school-admin/settings/staff-attendance" className="font-bold text-amber-900 underline">Open setup</Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Total staff" value={summary.totalStaff} icon={<Users className="h-4 w-4" />} tone="blue" />
        <StatCard label={singleDay ? 'Present' : 'Present (staff-days)'} value={summary.present} icon={<UserCheck className="h-4 w-4" />} tone="emerald" />
        <StatCard label={singleDay ? 'Late' : 'Late (staff-days)'} value={summary.late} icon={<Timer className="h-4 w-4" />} tone="amber" />
        <StatCard label={singleDay ? 'Absent' : 'Absent (staff-days)'} value={summary.absent} icon={<CalendarDays className="h-4 w-4" />} tone="rose" />
        <StatCard label="Attendance rate" value={summary.rate === null ? '—' : `${summary.rate}%`} icon={<CheckCircle2 className="h-4 w-4" />} tone="slate" />
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.06)] sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {(['today', 'week', 'month', 'custom'] as Preset[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => applyPreset(option)}
                className={`rounded-lg px-3 py-2 text-xs font-bold capitalize transition ${preset === option ? 'bg-[#2563EB] text-white' : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                {option === 'custom' ? 'Custom range' : `This ${option}`}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-2 py-1.5">
              <CalendarDays className="h-3.5 w-3.5 text-gray-400" />
              <input
                type="date"
                value={from}
                max={to || undefined}
                onChange={(event) => { setFrom(event.target.value); setPreset('custom'); }}
                className="bg-transparent text-xs font-semibold text-gray-700 outline-none"
                aria-label="Start date"
              />
              <span className="text-xs text-gray-400">to</span>
              <input
                type="date"
                value={to}
                min={from || undefined}
                max={today}
                onChange={(event) => { setTo(event.target.value); setPreset('custom'); }}
                className="bg-transparent text-xs font-semibold text-gray-700 outline-none"
                aria-label="End date"
              />
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search staff name"
                className="w-44 rounded-lg border border-gray-200 py-2 pl-8 pr-2 text-xs font-semibold text-gray-700 outline-none focus:border-blue-400"
              />
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-2 py-1.5">
              <Filter className="h-3.5 w-3.5 text-gray-400" />
              <select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
                className="bg-transparent text-xs font-semibold text-gray-700 outline-none"
                aria-label="Filter by role"
              >
                <option value="all">All roles</option>
                <option value="teacher">Teachers</option>
                <option value="dean">Deans of Studies</option>
                <option value="bursar">Bursars</option>
                <option value="store_keeper">Store Keepers</option>
                <option value="school_admin">School Admins</option>
              </select>
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3 text-xs text-gray-500">
          <p className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-gray-400" />
            {reportLabel} · {timeZone.replace('_', ' ')} · Working days: {workingDaysLabel(workingDays)}
          </p>
          <p>
            {filteredStaff.length} of {staff.length} staff shown
            {singleDay && !reportDateIsWorkingDay ? ' · non-working day (absences not counted)' : ''}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,0.06)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="font-bold text-gray-900">{singleDay ? 'Daily staff roster' : 'Staff attendance summary'}</h2>
            <p className="text-xs text-gray-500">
              {singleDay
                ? 'Every active staff member for the selected day. Absent = no clock-in recorded on a working day.'
                : 'Present, late and absent days per staff member across the selected period.'}
            </p>
          </div>
          {recordsLoading && (
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" /> Loading records…
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 p-8 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" /> Loading staff…
          </div>
        ) : filteredStaff.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-500">No staff members match these filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-[11px] uppercase tracking-wide text-gray-500">
                {singleDay ? (
                  <tr>
                    <th className="px-4 py-3 font-bold">Staff member</th>
                    <th className="px-4 py-3 font-bold">Role</th>
                    <th className="px-4 py-3 font-bold">Clock in</th>
                    <th className="px-4 py-3 font-bold">Clock out</th>
                    <th className="px-4 py-3 font-bold">Distance</th>
                    <th className="px-4 py-3 font-bold">Status</th>
                    <th className="px-4 py-3 font-bold">Method</th>
                    <th className="px-4 py-3 text-right font-bold">Actions</th>
                  </tr>
                ) : (
                  <tr>
                    <th className="px-4 py-3 font-bold">Staff member</th>
                    <th className="px-4 py-3 font-bold">Role</th>
                    <th className="px-4 py-3 text-center font-bold">Working days</th>
                    <th className="px-4 py-3 text-center font-bold">Present</th>
                    <th className="px-4 py-3 text-center font-bold">Late</th>
                    <th className="px-4 py-3 text-center font-bold">Absent</th>
                    <th className="px-4 py-3 font-bold">Rate</th>
                    <th className="px-4 py-3 text-right font-bold">Actions</th>
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-gray-100">
                {singleDay
                  ? dailyRows.map((row) => {
                      const overrideAdmin = row.record?.overridden_by ? staffById.get(row.record.overridden_by) : null;
                      return (
                        <tr key={row.staff.id} className="hover:bg-gray-50/70">
                          <td className="whitespace-nowrap px-4 py-3">
                            <p className="font-semibold text-gray-900">{staffDisplayName(row.staff)}</p>
                            <p className="text-[11px] text-gray-500">{row.staff.email || '—'}</p>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">{staffRoleLabel(row.staff)}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                            {row.record?.clock_in_time ? formatTimeInZone(row.record.clock_in_time, timeZone) : '—'}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                            {row.record?.clock_out_time ? formatTimeInZone(row.record.clock_out_time, timeZone) : '—'}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5 text-gray-400" />
                              {row.record ? formatDistance(row.record.clock_in_distance) : '—'}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-bold ${statusClasses(row.status)}`}>
                              {row.status || 'Not due'}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500" title={overrideAdmin ? `Overridden by ${staffDisplayName(overrideAdmin)}` : undefined}>
                            {row.record?.method || '—'}
                            {row.record?.method === 'Manual' && overrideAdmin ? ` · ${staffDisplayName(overrideAdmin)}` : ''}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setOverrideTarget(row.staff)}
                                className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-800 hover:bg-amber-100"
                                title="Manual override"
                              >
                                <PencilLine className="h-3 w-3" /> Override
                              </button>
                              <button
                                type="button"
                                onClick={() => void exportIndividualPdf(row.staff)}
                                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11px] font-bold text-gray-600 hover:bg-gray-50"
                                title="Download individual PDF"
                              >
                                <FileText className="h-3 w-3" /> PDF
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  : summaryRows.map((row) => (
                      <tr key={row.staff.id} className="hover:bg-gray-50/70">
                        <td className="whitespace-nowrap px-4 py-3">
                          <p className="font-semibold text-gray-900">{staffDisplayName(row.staff)}</p>
                          <p className="text-[11px] text-gray-500">{row.staff.email || '—'}</p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">{staffRoleLabel(row.staff)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-center text-gray-700">{row.workingDays}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-center font-bold text-emerald-700">{row.presentDays}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-center font-bold text-amber-700">{row.lateDays}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-center font-bold text-rose-700">{row.absentDays}</td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100">
                              <div
                                className={`h-full rounded-full ${row.rate >= 90 ? 'bg-emerald-500' : row.rate >= 70 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                style={{ width: `${row.rate}%` }}
                              />
                            </div>
                            <span className="text-xs font-bold text-gray-700">{row.rate}%</span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setOverrideTarget(row.staff)}
                              className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-800 hover:bg-amber-100"
                              title="Manual override"
                            >
                              <PencilLine className="h-3 w-3" /> Override
                            </button>
                            <button
                              type="button"
                              onClick={() => void exportIndividualPdf(row.staff, row)}
                              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11px] font-bold text-gray-600 hover:bg-gray-50"
                              title="Download individual PDF"
                            >
                              <FileText className="h-3 w-3" /> PDF
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {overrideTarget && school && (
        <ManualOverrideModal
          staff={overrideTarget}
          school={school}
          timeZone={timeZone}
          initialDate={singleDay ? from : today}
          maxDate={today}
          onClose={() => setOverrideTarget(null)}
          onSaved={() => {
            setOverrideTarget(null);
            void loadRecords();
          }}
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  tone: 'blue' | 'emerald' | 'amber' | 'rose' | 'slate';
}) {
  const tones: Record<string, string> = {
    blue: 'border-blue-100 bg-blue-50 text-blue-700',
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-100 bg-amber-50 text-amber-700',
    rose: 'border-rose-100 bg-rose-50 text-rose-700',
    slate: 'border-slate-100 bg-slate-50 text-slate-700',
  };
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-[3px_3px_0px_0px_rgba(0,0,0,0.06)]">
      <div className={`mb-2 inline-flex rounded-lg border p-2 ${tones[tone]}`}>{icon}</div>
      <p className="text-2xl font-black text-gray-900">{value}</p>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
    </div>
  );
}

function ManualOverrideModal({
  staff,
  school,
  timeZone,
  initialDate,
  maxDate,
  onClose,
  onSaved,
}: {
  staff: StaffMember;
  school: SchoolWithDos;
  timeZone: string;
  initialDate: string;
  maxDate: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [date, setDate] = useState(initialDate);
  const [status, setStatus] = useState<'Present' | 'Late' | 'Absent'>('Present');
  const [clockIn, setClockIn] = useState(toTimeInput(school.check_in_start) || '07:00');
  const [clockOut, setClockOut] = useState('');
  const [reason, setReason] = useState('');
  const [existing, setExisting] = useState<StaffAttendanceRecord | null>(null);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const loadRecord = async () => {
      if (!date) return;
      setLoadingRecord(true);
      const { data, error: fetchError } = await db
        .from('staff_attendance')
        .select('*')
        .eq('user_id', staff.id)
        .eq('date', date)
        .maybeSingle();
      if (cancelled) return;
      if (fetchError) {
        setError(fetchError.message);
        setLoadingRecord(false);
        return;
      }
      const record = (data || null) as StaffAttendanceRecord | null;
      setExisting(record);
      if (record) {
        setStatus(record.status);
        setClockIn(record.clock_in_time ? timeInputInZone(record.clock_in_time, timeZone) : '');
        setClockOut(record.clock_out_time ? timeInputInZone(record.clock_out_time, timeZone) : '');
        setReason(record.override_reason || '');
      } else {
        setStatus('Present');
        setClockIn(toTimeInput(school.check_in_start) || '07:00');
        setClockOut('');
        setReason('');
      }
      setLoadingRecord(false);
    };
    void loadRecord();
    return () => { cancelled = true; };
  }, [date, staff.id, school.check_in_start, timeZone]);

  const handleSave = async () => {
    setError('');
    if (!user?.id) return;
    if (status !== 'Absent' && !clockIn) {
      setError('Enter the clock-in time, or choose Absent.');
      return;
    }
    if (status !== 'Absent' && clockOut && timeToMinutes(clockOut) <= timeToMinutes(clockIn)) {
      setError('Clock-out must be after clock-in.');
      return;
    }
    setSaving(true);
    try {
      const clockInIso = status === 'Absent' ? null : zonedWallTimeToIso(date, clockIn, timeZone);
      const clockOutIso = status === 'Absent' || !clockOut ? null : zonedWallTimeToIso(date, clockOut, timeZone);
      const { error: upsertError } = await db
        .from('staff_attendance')
        .upsert(
          {
            school_id: school.id,
            user_id: staff.id,
            date,
            status,
            method: 'Manual',
            clock_in_time: clockInIso,
            clock_out_time: clockOutIso,
            overridden_by: user.id,
            override_reason: reason.trim() || null,
          },
          { onConflict: 'user_id,date' },
        )
        .select('*')
        .single();
      if (upsertError) throw upsertError;
      toast.success(`Attendance override saved for ${staffDisplayName(staff)}.`);
      onSaved();
    } catch (err: any) {
      setError(err?.message || 'Could not save the manual override.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label="Manual attendance override">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="flex items-center gap-2 font-bold text-gray-900">
              <PencilLine className="h-4 w-4 text-amber-600" /> Manual attendance override
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              {staffDisplayName(staff)} · {staffRoleLabel(staff)}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">Date</span>
              <input
                type="date"
                value={date}
                max={maxDate}
                onChange={(event) => setDate(event.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">Status</span>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as 'Present' | 'Late' | 'Absent')}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                <option value="Present">Present</option>
                <option value="Late">Late</option>
                <option value="Absent">Absent</option>
              </select>
            </label>
          </div>

          {status !== 'Absent' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">Clock-in time</span>
                <input
                  type="time"
                  value={clockIn}
                  onChange={(event) => setClockIn(event.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">Clock-out time (optional)</span>
                <input
                  type="time"
                  value={clockOut}
                  onChange={(event) => setClockOut(event.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </label>
            </div>
          )}

          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">Reason (recorded for audit)</span>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={2}
              placeholder="e.g. Phone battery died; verified with gate register."
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </label>

          {loadingRecord ? (
            <p className="flex items-center gap-1.5 text-xs text-gray-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking for an existing record…
            </p>
          ) : existing ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
              This day already has a <strong>{existing.method}</strong> record ({existing.status}). Saving replaces it and marks it as a manual override by you.
            </p>
          ) : (
            <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-[11px] text-gray-600">
              No record exists for this day. A new manual record will be created.
            </p>
          )}

          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" /> <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || loadingRecord}
            className="inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Save override
          </button>
        </div>
      </div>
    </div>
  );
}
