import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { AlertCircle, Download, Printer, RefreshCw } from 'lucide-react';
import { formatTimeDisplay, summarizeSlots } from '@/lib/timetable-generator';

interface SchoolClass {
  id: string;
  name: string;
  level: number;
  grade_level?: number | null;
  stream?: string | null;
}

interface TimetableEntry {
  id: string;
  class_id: string;
  day_of_week: number;
  time_slot_id: string;
  teacher_id: string | null;
  subject_id: string | null;
  entry_type: 'lesson' | 'break' | 'lunch' | 'activities' | 'activity';
  activity_name: string | null;
  teacher_number?: number;
  teacher_first_name?: string;
  teacher_last_name?: string;
  subject_name?: string;
  subject_code?: string;
}

interface TimeSlot {
  id: string;
  slot_order: number;
  start_time: string;
  end_time: string;
  slot_type: 'lesson' | 'break' | 'lunch' | 'activities' | 'activity';
  label: string;
  level_group?: string | null;
}

interface TeacherKeyEntry {
  teacher_number: number;
  teacher_name: string;
  subjects: string[];
}

interface SchoolActivity {
  id: string;
  school_id: string;
  day_of_week: number;
  activity_name: string;
  start_time: string;
  end_time: string;
}

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI'];

const SUBJECT_CODE_MAP: Record<string, string> = {
  mathematics: 'MATH',
  math: 'MATH',
  english: 'ENG',
  kiswahili: 'KISW',
  'integrated science': 'INTSC',
  science: 'SC',
  'social studies': 'SST',
  cre: 'CRE',
  'christian religious education': 'CRE',
  agriculture: 'AGN',
  'pre-technical': 'PRET',
  'pre technical': 'PRET',
  'creative arts': 'CAS',
  'creative and sports': 'CAS',
  'home science': 'HSC',
  'business studies': 'BST',
  history: 'HIST',
  geography: 'GEO',
  physics: 'PHY',
  chemistry: 'CHEM',
  biology: 'BIO',
};

const getSubjectCode = (name: string, code: string): string => {
  const normalizedName = (name || '').trim().toLowerCase();
  const mappedByName = Object.entries(SUBJECT_CODE_MAP).find(([key]) =>
    normalizedName.includes(key.toLowerCase())
  );
  if (mappedByName) return mappedByName[1];

  const cleanCode = (code || '').trim().toUpperCase();
  if (cleanCode) {
    if (cleanCode.startsWith('MAT') || cleanCode === 'MA') return 'MATH';
    if (cleanCode.startsWith('ENG') || cleanCode === 'ELA') return 'ENG';
    if (cleanCode.startsWith('KIS') || cleanCode === 'KLA') return 'KISW';
    if (cleanCode.startsWith('BIO')) return 'BIO';
    if (cleanCode.startsWith('CHE')) return 'CHEM';
    if (cleanCode.startsWith('PHY')) return 'PHY';
    if (cleanCode.startsWith('INTSCI') || cleanCode.startsWith('ISC')) return 'INTSC';
    if (cleanCode.startsWith('SS')) return 'SST';
    if (cleanCode.startsWith('AGR')) return 'AGN';
    if (cleanCode.startsWith('PRE') || cleanCode.startsWith('PTS')) return 'PRET';
    if (cleanCode.startsWith('CAS') || cleanCode.startsWith('CA')) return 'CAS';
    if (cleanCode.startsWith('CRE') || cleanCode.startsWith('CHR')) return 'CRE';
    return cleanCode.replace(/\d+/g, '').substring(0, 5) || cleanCode.substring(0, 5);
  }

  return name.replace(/[^A-Za-z]/g, '').substring(0, 5).toUpperCase() || 'SUB';
};

const displayClassName = (cls: SchoolClass): string => {
  // Keep the full stored name (e.g. "Grade 7", "Class 3", "Form 1", "PP1")
  const name = cls.name?.trim() || String(cls.level);
  return name.toUpperCase();
};

const fmt = (t: string): string => {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hour = parseInt(h, 10);
  const min = m || '00';
  return `${hour}:${min}`;
};


/** Map a class to timetable level_group key */
function resolveClassLevelGroup(cls: SchoolClass): string {
  const grade = Number(cls.grade_level ?? cls.level);
  const name = String(cls.name || '').toLowerCase();
  if (grade === -2 || grade === -1 || grade === 0 || /(pp\s*[12]|pre[\s-]?primary|playgroup|baby)/.test(name)) return 'pre-primary';
  if ((grade >= 1 && grade <= 3) || /grade\s*[123]\b/.test(name)) return 'lower-primary';
  if ((grade >= 4 && grade <= 6) || /grade\s*[456]\b/.test(name)) return 'upper-primary';
  if ((grade >= 7 && grade <= 9) || /grade\s*[789]\b/.test(name)) return 'junior';
  if ((grade >= 10 && grade <= 12) || /grade\s*(10|11|12)\b/.test(name)) return 'senior';
  if (/form\s*[12]\b/.test(name)) return 'form-3-4'; // treat early forms like 8-4-4 band if present
  if (/form\s*[34]\b/.test(name)) return 'form-3-4';
  // fallback by level number ranges
  if (!isNaN(grade)) {
    if (grade <= 0) return 'pre-primary';
    if (grade <= 3) return 'lower-primary';
    if (grade <= 6) return 'upper-primary';
    if (grade <= 9) return 'junior';
    if (grade <= 12) return 'senior';
  }
  return 'default';
}

const LEVEL_LABELS: Record<string, string> = {
  'pre-primary': 'Pre-Primary (6 lessons, 0 after lunch)',
  'lower-primary': 'Lower Primary (7 lessons, 1 after lunch)',
  'upper-primary': 'Upper Primary (7 lessons, 1 after lunch)',
  'combined-primary': 'Combined Primary (7 lessons, 1 after lunch)',
  'junior': 'Junior School (8 lessons, 2 after lunch)',
  'senior': 'Senior School (9 lessons, 3 after lunch)',
  'form-3-4': '8-4-4 Form 3-4 (8 lessons, 2 after lunch)',
  'default': 'Legacy default',
};

/** Pick the best slot set for a level from all school slots */
function pickSlotsForLevel(all: TimeSlot[], levelKey: string): TimeSlot[] {
  const byLevel = (lg: string) =>
    all
      .filter((s) => (s.level_group || 'default') === lg)
      .sort((a, b) => a.slot_order - b.slot_order);

  let slots = byLevel(levelKey);
  // combined-primary can fall back to lower-primary structure
  if (!slots.length && levelKey === 'combined-primary') {
    slots = byLevel('lower-primary');
  }
  // only use legacy default if no level-specific slots exist at all for this school
  if (!slots.length) {
    const anyLevelSpecific = all.some((s) => s.level_group && s.level_group !== 'default');
    if (!anyLevelSpecific) {
      slots = byLevel('default');
    }
  }
  // Deduplicate by slot_order within the chosen level only
  const seen = new Set<number>();
  const unique: TimeSlot[] = [];
  for (const s of slots) {
    if (!seen.has(s.slot_order)) {
      seen.add(s.slot_order);
      unique.push(s);
    }
  }
  return unique;
}

export default function TimetableView() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [activities, setActivities] = useState<SchoolActivity[]>([]);
  const [teacherKey, setTeacherKey] = useState<TeacherKeyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedLevelGroup, setSelectedLevelGroup] = useState<string>('auto');
  const [downloadingClass, setDownloadingClass] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user?.schoolId) fetchAll();
  }, [user?.schoolId]);

  const fetchAll = async () => {
    try {
      setLoading(true);
      setError(null);
      await Promise.all([
        fetchSchoolName(),
        fetchClasses(),
        fetchTimeSlots(),
        fetchEntries(),
        fetchTeacherKey(),
        fetchActivities(),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load timetable');
    } finally {
      setLoading(false);
    }
  };

  const fetchSchoolName = async () => {
    const { data } = await supabase
      .from('schools')
      .select('name')
      .eq('id', user?.schoolId)
      .single();
    if (data) setSchoolName(data.name);
  };

  const fetchClasses = async () => {
    const { data, error: err } = await supabase
      .from('classes')
      .select('id, name, level, grade_level, stream')
      .eq('school_id', user?.schoolId)
      .eq('is_active', true)
      .order('level')
      .order('name');
    if (err) throw err;
    setClasses((data || []) as SchoolClass[]);
  };

  const fetchTimeSlots = async () => {
    const { data, error: err } = await supabase
      .from('timetable_time_slots')
      .select('*')
      .eq('school_id', user?.schoolId)
      .order('slot_order');
    if (err) throw err;
    setTimeSlots(((data || []) as TimeSlot[]).length ? (data as TimeSlot[]) : []);
  };

  const fetchEntries = async () => {
    const { data, error: err } = await supabase
      .from('timetable_entries')
      .select(
        `id, class_id, day_of_week, time_slot_id, teacher_id, subject_id, entry_type, activity_name, level_group,
        teachers(teacher_number, first_name, last_name), subjects(name, code)`
      )
      .eq('school_id', user?.schoolId);
    if (err) throw err;
    const mapped: TimetableEntry[] = (data || []).map((entry: any) => ({
      id: entry.id,
      class_id: entry.class_id,
      day_of_week: entry.day_of_week,
      time_slot_id: entry.time_slot_id,
      teacher_id: entry.teacher_id,
      subject_id: entry.subject_id,
      entry_type: entry.entry_type,
      activity_name: entry.activity_name,
      teacher_number: entry.teachers?.teacher_number,
      teacher_first_name: entry.teachers?.first_name,
      teacher_last_name: entry.teachers?.last_name,
      subject_name: entry.subjects?.name,
      subject_code: entry.subjects?.code,
    }));
    setEntries(mapped);
  };

  const fetchActivities = async () => {
    const { data, error: err } = await supabase
      .from('school_activities')
      .select('*')
      .eq('school_id', user?.schoolId)
      .order('day_of_week');
    if (err) {
      console.warn('Could not fetch activities:', err);
      setActivities([]);
      return;
    }
    setActivities((data || []) as SchoolActivity[]);
  };

  const fetchTeacherKey = async () => {
    const { data: teachers, error: teachersErr } = await supabase
      .from('teachers')
      .select('id, teacher_number, first_name, last_name')
      .eq('school_id', user?.schoolId)
      .eq('is_active', true)
      .order('teacher_number');
    if (teachersErr) throw teachersErr;

    const { data: assignments, error: assignmentsErr } = await supabase
      .from('teacher_subject_assignments')
      .select('teacher_id, subjects(name, code)')
      .eq('school_id', user?.schoolId)
      .eq('is_active', true);
    if (assignmentsErr) throw assignmentsErr;

    const keyMap: Record<string, TeacherKeyEntry> = {};
    (teachers || []).forEach((teacher: any) => {
      if (teacher.teacher_number) {
        keyMap[teacher.id] = {
          teacher_number: teacher.teacher_number,
          teacher_name: `${teacher.first_name} ${teacher.last_name}`,
          subjects: [],
        };
      }
    });

    (assignments || []).forEach((assignment: any) => {
      if (keyMap[assignment.teacher_id] && assignment.subjects) {
        const code = getSubjectCode(assignment.subjects.name, assignment.subjects.code);
        if (!keyMap[assignment.teacher_id].subjects.includes(code))
          keyMap[assignment.teacher_id].subjects.push(code);
      }
    });

    setTeacherKey(
      Object.values(keyMap).sort((a, b) => a.teacher_number - b.teacher_number)
    );
  };

  /** Available level groups that actually have slots */
  const availableLevelGroups = useMemo(() => {
    const set = new Set<string>();
    timeSlots.forEach((s) => set.add(s.level_group || 'default'));
    // Prefer non-default first
    return Array.from(set).sort((a, b) => {
      if (a === 'default') return 1;
      if (b === 'default') return -1;
      return a.localeCompare(b);
    });
  }, [timeSlots]);

  /** Active level for the grid: explicit filter, or inferred from selected class, or first non-default */
  const activeLevelGroup = useMemo(() => {
    if (selectedLevelGroup !== 'auto') return selectedLevelGroup;
    if (selectedClass !== 'all') {
      const cls = classes.find((c) => c.id === selectedClass);
      if (cls) {
        const lg = resolveClassLevelGroup(cls);
        // prefer that level's slots if present
        if (timeSlots.some((s) => (s.level_group || 'default') === lg)) return lg;
      }
    }
    const nonDefault = availableLevelGroups.find((g) => g !== 'default');
    return nonDefault || availableLevelGroups[0] || 'default';
  }, [selectedLevelGroup, selectedClass, classes, timeSlots, availableLevelGroups]);

  /** CRITICAL: only slots for the active level — never merge levels by slot_order */
  const allSlots = useMemo(
    () => pickSlotsForLevel(timeSlots, activeLevelGroup),
    [timeSlots, activeLevelGroup]
  );

  const lessonSlots = useMemo(() => allSlots.filter(s => s.slot_type === 'lesson'), [allSlots]);

  const slotSummary = useMemo(() => summarizeSlots(allSlots as any), [allSlots]);

  const entryLookup = useMemo(() => {
    const lookup = new Map<string, TimetableEntry[]>();
    entries.forEach((entry) => {
      const key = `${entry.day_of_week}-${entry.class_id}-${entry.time_slot_id}`;
      const existing = lookup.get(key) || [];
      existing.push(entry);
      lookup.set(key, existing);
    });
    return lookup;
  }, [entries]);

  const getEntries = (day: number, classId: string, slotId: string): TimetableEntry[] => {
    return entryLookup.get(`${day}-${classId}-${slotId}`) || [];
  };

  const getCellDisplay = (entriesForCell: TimetableEntry[]): string => {
    if (!entriesForCell || entriesForCell.length === 0) return '';
    const parts: string[] = [];
    entriesForCell.forEach((entry) => {
      if (entry.entry_type === 'activity' || entry.entry_type === 'activities') {
        if (entry.activity_name) parts.push(entry.activity_name.toUpperCase());
        return;
      }
      if (!entry.subject_name && !entry.subject_code) return;
      const code = getSubjectCode(entry.subject_name || '', entry.subject_code || '');
      const teacherNum = entry.teacher_number ? String(entry.teacher_number) : '';
      parts.push(`${code}${teacherNum}`);
    });
    return parts.join(' ') || '';
  };

  /** Get activities for a given day from school_activities table */
  const getActivitiesForDay = (dayIdx: number): string => {
    const dayNum = dayIdx + 1;
    const dayActivities = activities.filter(a => a.day_of_week === dayNum);
    if (dayActivities.length === 0) return '';
    // Return all activity names for this day, joined
    return dayActivities.map(a => a.activity_name.trim().toUpperCase()).join(' / ');
  };

  /** Classes to display (filtered if a specific class is selected) */
  const displayClasses = useMemo(() => {
    let list = classes;
    if (selectedClass !== 'all') {
      list = classes.filter(c => c.id === selectedClass);
    } else if (selectedLevelGroup !== 'auto') {
      list = classes.filter(c => resolveClassLevelGroup(c) === selectedLevelGroup);
    } else if (activeLevelGroup && activeLevelGroup !== 'default') {
      // When showing "all" with auto level, only show classes that match active level
      // so the column structure matches their lesson count.
      const matched = classes.filter(c => resolveClassLevelGroup(c) === activeLevelGroup);
      list = matched.length > 0 ? matched : classes;
    }
    return list;
  }, [classes, selectedClass, selectedLevelGroup, activeLevelGroup]);

  const downloadPdf = async (classId?: string, className?: string) => {
    const targetId = classId ? `timetable-class-${classId}` : 'timetable-print-area';
    const element = document.getElementById(targetId);
    if (!element) return;
    const key = classId || 'all';
    setDownloadingClass(key);
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const filename = classId
        ? `${(schoolName || 'school').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${(className || classId).replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-timetable.pdf`
        : `${(schoolName || 'school').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-full-timetable.pdf`;
      await html2pdf()
        .set({
          margin: [0.2, 0.1, 0.2, 0.1],
          filename,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: '#1a1a1a' },
          jsPDF: { unit: 'in', format: 'a3', orientation: 'landscape' },
        })
        .from(element)
        .save();
    } finally {
      setDownloadingClass(null);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
    </div>
  );

  if (error) return (
    <div className="flex items-center gap-3 p-6 bg-red-50 text-red-700 rounded-xl m-4">
      <AlertCircle size={20} />
      <span>{error}</span>
      <button onClick={fetchAll} className="ml-auto text-sm underline">Retry</button>
    </div>
  );

  
  // Summary strip for lesson counts (from generated slots in DB)
  const summaryBanner = (
    <div className="mx-4 mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
      <span className="font-semibold">Timetable structure ({activeLevelGroup}):</span>
      <span><strong>{slotSummary.totalLessons}</strong> lessons/day</span>
      <span className="text-blue-300">|</span>
      <span><strong>{slotSummary.beforeLunch}</strong> before lunch</span>
      <span className="text-blue-300">|</span>
      <span>
        <strong>{slotSummary.afterLunch}</strong> after lunch
        {slotSummary.afterLunch === 0 ? ' (ends at lunch)' : ''}
      </span>
      {slotSummary.hasActivities && (
        <>
          <span className="text-blue-300">|</span>
          <span>Activities until {formatTimeDisplay(slotSummary.schoolEnd)}</span>
        </>
      )}
      {slotSummary.lunchEnd && (
        <>
          <span className="text-blue-300">|</span>
          <span>Lunch ends {formatTimeDisplay(slotSummary.lunchEnd)}</span>
        </>
      )}
    </div>
  );

const timetableStyles = `
    .bb-wrap {
      background-color: #1a1a1a;
      color: #e0e0e0;
      font-family: 'Courier New', Courier, monospace;
      padding: 16px;
      border: 8px solid #4a3728;
      box-shadow: inset 0 0 40px rgba(0,0,0,0.5);
    }
    .tt-table {
      border-collapse: collapse;
      width: 100%;
      table-layout: auto;
    }
    .tt-table th, .tt-table td {
      border: 1px solid #555;
      padding: 3px 4px;
      text-align: center;
      vertical-align: middle;
      font-size: 0.68rem;
      line-height: 1.2;
    }
    .tt-header {
      background-color: #222;
      color: #4da6ff;
      font-weight: bold;
      font-size: 0.65rem;
      white-space: nowrap;
    }
    .tt-day {
      writing-mode: vertical-lr;
      text-orientation: mixed;
      font-weight: 900;
      font-size: 1rem;
      background-color: #1e1e1e;
      color: #e0e0e0;
      width: 28px;
      min-width: 28px;
      text-align: center;
    }
    .tt-class {
      font-weight: bold;
      background-color: #252525;
      color: #e0e0e0;
      width: 42px;
      min-width: 42px;
      font-size: 0.7rem;
    }
    .tt-break {
      writing-mode: vertical-lr;
      text-orientation: mixed;
      font-weight: 900;
      font-size: 0.85rem;
      background-color: #1a1a1a;
      color: #4da6ff;
      width: 22px;
      min-width: 22px;
      letter-spacing: 0.05rem;
      padding: 4px 2px;
      text-align: center;
    }
    .tt-lunch {
      writing-mode: vertical-lr;
      text-orientation: mixed;
      font-weight: 900;
      font-size: 0.85rem;
      background-color: #1a1a1a;
      color: #4da6ff;
      width: 22px;
      min-width: 22px;
      letter-spacing: 0.05rem;
      padding: 4px 2px;
      text-align: center;
    }
    .tt-cell {
      min-width: 70px;
      height: 28px;
      color: #e0e0e0;
      font-size: 0.68rem;
    }
    .tt-activity {
      writing-mode: vertical-lr;
      text-orientation: mixed;
      font-weight: bold;
      color: #33cc33;
      width: 30px;
      min-width: 30px;
      font-size: 0.62rem;
      padding: 4px 2px;
      text-align: center;
    }
    .tt-break-header {
      background-color: #222;
      color: #4da6ff;
      font-weight: bold;
      font-size: 0.58rem;
      white-space: pre-line;
      width: 22px;
      min-width: 22px;
    }
    @media print {
      .no-print { display: none !important; }
      .bb-wrap { border: none; box-shadow: none; background: white; color: black; }
      .tt-table th, .tt-table td { border: 1px solid black; color: black !important; }
      .tt-day, .tt-class, .tt-break, .tt-lunch, .tt-activity, .tt-cell, .tt-header, .tt-break-header { color: black !important; background: white !important; }
    }
  `;

  const renderTimetableTable = (classesToRender: SchoolClass[], tableId: string, slotsOverride?: TimeSlot[]) => {
    const slotsForTable =
      slotsOverride ||
      (classesToRender.length === 1
        ? pickSlotsForLevel(timeSlots, resolveClassLevelGroup(classesToRender[0]))
        : allSlots);
    return (

    <div id={tableId} className="bb-wrap rounded-lg overflow-hidden">
      <div className="mb-4 text-center">
        <h2 className="text-2xl font-black tracking-tighter text-blue-400 uppercase">
          {schoolName || 'School'} — SCHOOL TIMETABLE
        </h2>
        {classesToRender.length === 1 && (
          <p className="text-green-400 font-bold text-sm mt-1">
            Class: {displayClassName(classesToRender[0])}
          </p>
        )}
        <div className="h-0.5 w-24 bg-blue-400 mx-auto mt-2"></div>
      </div>
      <div className="overflow-x-auto">
        <table className="tt-table">
          <thead>
            <tr>
              <th rowSpan={2} className="tt-header">DAYS</th>
              <th rowSpan={2} className="tt-header">CLASS</th>
              {slotsForTable.map(slot => {
                if (slot.slot_type === 'break') {
                  return (
                    <th key={slot.id} rowSpan={2} className="tt-break-header">
                      <span style={{fontWeight:'900',color:'#4da6ff',display:'block'}}>BREAK</span>
                      <span style={{fontSize:'0.5rem',color:'#aaa',display:'block'}}>{fmt(slot.start_time)}</span>
                      <span style={{fontSize:'0.5rem',color:'#aaa',display:'block'}}>—</span>
                      <span style={{fontSize:'0.5rem',color:'#aaa',display:'block'}}>{fmt(slot.end_time)}</span>
                    </th>
                  );
                }
                if (slot.slot_type === 'lunch') {
                  return (
                    <th key={slot.id} rowSpan={2} className="tt-break-header">
                      <span style={{fontWeight:'900',color:'#4da6ff',display:'block'}}>LUNCH</span>
                      <span style={{fontSize:'0.5rem',color:'#aaa',display:'block'}}>{fmt(slot.start_time)}</span>
                      <span style={{fontSize:'0.5rem',color:'#aaa',display:'block'}}>—</span>
                      <span style={{fontSize:'0.5rem',color:'#aaa',display:'block'}}>{fmt(slot.end_time)}</span>
                    </th>
                  );
                }
                if (slot.slot_type === 'activities' || slot.slot_type === 'activity') {
                  return null;
                }
                return (
                  <th key={slot.id} className="tt-header">
                    {fmt(slot.start_time)}-{fmt(slot.end_time)}
                  </th>
                );
              })}
              <th rowSpan={2} className="tt-header" style={{ width: '60px', minWidth: '60px', color: '#33cc33' }}>
                AFTER-SCHOOL ACTIVITIES
              </th>
            </tr>
            <tr>
              {slotsForTable.map(slot => {
                if (slot.slot_type === 'break' || slot.slot_type === 'lunch') return null;
                if (slot.slot_type === 'activities' || slot.slot_type === 'activity') return null;
                return (
                  <th key={`sub-${slot.id}`} className="tt-header" style={{ fontSize: '0.58rem', color: '#aaa' }}>
                    {slot.label || ''}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {DAYS.map((day, dayIdx) => (
              <React.Fragment key={day}>
                {classesToRender.map((cls, clsIdx) => (
                  <tr key={`${day}-${cls.id}`}>
                    {clsIdx === 0 && (
                      <td rowSpan={classesToRender.length} className="tt-day">
                        {day}
                      </td>
                    )}
                    <td className="tt-class">{displayClassName(cls)}</td>
                    {slotsForTable.map(slot => {
                      if (slot.slot_type === 'break') {
                        if (clsIdx === 0) {
                          return (
                            <td key={slot.id} rowSpan={classesToRender.length} className="tt-break">
                              B<br/>R<br/>E<br/>A<br/>K<br/>
                              <span style={{fontSize:'0.45rem',color:'#aaa',display:'block',marginTop:'2px'}}>{fmt(slot.start_time)}</span>
                              <span style={{fontSize:'0.45rem',color:'#aaa',display:'block'}}>—</span>
                              <span style={{fontSize:'0.45rem',color:'#aaa',display:'block'}}>{fmt(slot.end_time)}</span>
                            </td>
                          );
                        }
                        return null;
                      }
                      if (slot.slot_type === 'lunch') {
                        if (clsIdx === 0) {
                          return (
                            <td key={slot.id} rowSpan={classesToRender.length} className="tt-lunch">
                              L<br/>U<br/>N<br/>C<br/>H<br/>
                              <span style={{fontSize:'0.45rem',color:'#aaa',display:'block',marginTop:'2px'}}>{fmt(slot.start_time)}</span>
                              <span style={{fontSize:'0.45rem',color:'#aaa',display:'block'}}>—</span>
                              <span style={{fontSize:'0.45rem',color:'#aaa',display:'block'}}>{fmt(slot.end_time)}</span>
                            </td>
                          );
                        }
                        return null;
                      }
                      if (slot.slot_type === 'activities' || slot.slot_type === 'activity') {
                        return null;
                      }
                      const cellEntries = getEntries(dayIdx + 1, cls.id, slot.id);
                      const display = getCellDisplay(cellEntries);
                      return (
                        <td key={slot.id} className="tt-cell">
                          {display}
                        </td>
                      );
                    })}
                    {clsIdx === 0 && (
                      <td rowSpan={classesToRender.length} className="tt-activity">
                        {getActivitiesForDay(dayIdx) || '—'}
                      </td>
                    )}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {teacherKey.length > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-700">
          <h3 className="text-blue-400 font-black text-xs uppercase mb-3 tracking-widest">Teacher Reference Key</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {teacherKey.map(t => (
              <div key={t.teacher_number} className="text-[0.65rem] flex flex-col">
                <span className="text-blue-300 font-bold">T{t.teacher_number}: {t.teacher_name}</span>
                <span className="text-gray-500 italic">({t.subjects.join(', ')})</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
  };

  return (
    <div className="max-w-full mx-auto space-y-4 p-4 bg-gray-100 min-h-screen">
      <style>{timetableStyles}</style>

      {/* Top Controls */}
      <div className="flex flex-wrap justify-between items-center no-print mb-4 gap-3">
        <h1 className="text-2xl font-black text-gray-800 uppercase tracking-tight">School Timetable</h1>
        <div className="flex flex-wrap gap-2 items-center">
          <button
            onClick={() => fetchAll()}
            className="flex items-center gap-2 bg-white text-gray-700 px-3 py-2 rounded-xl border border-gray-200 font-bold text-sm hover:bg-gray-50"
          >
            <RefreshCw size={15} /> Refresh
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-white text-gray-700 px-3 py-2 rounded-xl border border-gray-200 font-bold text-sm hover:bg-gray-50"
          >
            <Printer size={15} /> Print
          </button>
          <button
            onClick={() => downloadPdf()}
            disabled={downloadingClass === 'all'}
            className="flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-xl font-bold text-sm hover:bg-blue-700 shadow-lg shadow-blue-200 disabled:opacity-60"
          >
            <Download size={15} />
            {downloadingClass === 'all' ? 'Downloading...' : 'Download Full PDF'}
          </button>
        </div>
      </div>

      {/* Per-Class Download Section */}
      {classes.length > 0 && (
        <div className="no-print bg-white rounded-2xl p-4 shadow-sm border border-gray-200">
          <h2 className="font-black text-gray-900 text-sm mb-3 uppercase tracking-wide">Download Timetable Per Class</h2>
          <div className="flex flex-wrap gap-2">
            {classes.map(cls => (
              <button
                key={cls.id}
                onClick={() => downloadPdf(cls.id, displayClassName(cls))}
                disabled={downloadingClass === cls.id}
                className="flex items-center gap-1.5 bg-green-600 text-white px-3 py-1.5 rounded-lg font-bold text-xs hover:bg-green-700 disabled:opacity-60 transition-all"
              >
                <Download size={12} />
                {downloadingClass === cls.id ? 'Downloading...' : `${displayClassName(cls)} PDF`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filter by level group — each level has its own lesson count / after-lunch structure */}
      <div className="no-print bg-white rounded-2xl p-4 shadow-sm border border-gray-200 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-gray-700 text-sm">Level:</span>
          <button
            type="button"
            onClick={() => setSelectedLevelGroup('auto')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${selectedLevelGroup === 'auto' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            Auto
          </button>
          {availableLevelGroups.map((lg) => (
            <button
              key={lg}
              type="button"
              onClick={() => { setSelectedLevelGroup(lg); setSelectedClass('all'); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${selectedLevelGroup === lg ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              title={LEVEL_LABELS[lg] || lg}
            >
              {lg}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500">
          Active structure: <strong>{LEVEL_LABELS[activeLevelGroup] || activeLevelGroup}</strong>
          {' '}· {slotSummary.totalLessons} lessons/day · {slotSummary.afterLunch} after lunch
          {availableLevelGroups.includes('default') && availableLevelGroups.length > 1 ? (
            <span className="text-amber-600"> · Tip: re-generate each level to replace legacy &quot;default&quot; slots</span>
          ) : null}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-bold text-gray-700 text-sm">Class:</span>
          <button
            onClick={() => setSelectedClass('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${selectedClass === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            All Classes
          </button>
          {classes.map(cls => (
            <button
              key={cls.id}
              onClick={() => {
                setSelectedClass(cls.id);
                // snap level to this class so lesson columns match
                setSelectedLevelGroup(resolveClassLevelGroup(cls));
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${selectedClass === cls.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              {displayClassName(cls)}
              <span className="ml-1 opacity-60 font-normal">({resolveClassLevelGroup(cls)})</span>
            </button>
          ))}
        </div>
      </div>

      {summaryBanner}

      {/* Main Timetable (full or filtered) */}
      <div id="timetable-print-area">
        {renderTimetableTable(displayClasses, 'timetable-main-view')}
      </div>

      {/* Hidden per-class timetables for PDF generation */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0, width: '1200px' }}>
        {classes.map(cls => (
          <div key={cls.id} id={`timetable-class-${cls.id}`} style={{ marginBottom: '40px' }}>
            {renderTimetableTable([cls], `timetable-class-inner-${cls.id}`)}
          </div>
        ))}
      </div>
    </div>
  );
}
