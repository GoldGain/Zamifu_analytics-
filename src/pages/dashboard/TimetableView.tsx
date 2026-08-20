import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { AlertCircle, Download, Printer, RefreshCw } from 'lucide-react';
import {
  formatTimeDisplay,
  summarizeSlots,
  generateSlots,
  resolveLessonTargets,
  type TimetableConfig,
  type TimetableSlot,
} from '@/lib/timetable-generator';
import { shiftSlotsAroundActivities } from '@/lib/timetable-activity';

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
  effective_start_time?: string | null;
  effective_end_time?: string | null;
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
  sourceSlotIds?: string[];
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
  target_classes?: string | null;
}

type TimelineSegment = {
  id: string;
  start_time: string;
  end_time: string;
  slot_type: TimeSlot['slot_type'];
  label: string;
  slot_order?: number;
  sourceSlotIds?: string[];
  activity?: SchoolActivity;
};

const timeToMinutesView = (value: string | null | undefined): number => {
  const [hours, minutes] = String(value || '').slice(0, 5).split(':').map(Number);
  return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : 0;
};

const minutesToTimeView = (minutes: number): string => {
  const safe = Math.max(0, Math.round(minutes));
  return `${String(Math.floor(safe / 60) % 24).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
};

const activityMatchesClass = (activity: SchoolActivity, cls: SchoolClass): boolean => {
  const target = String(activity.target_classes || 'All').trim().toLowerCase();
  if (!target || target === 'all') return true;
  const className = String(cls.name || '').toLowerCase();
  const grade = Number(cls.grade_level ?? cls.level);
  const isPrimary = (grade >= 1 && grade <= 6) || /grade\s*[1-6]\b|pp\s*[12]|pre[\s-]?primary/.test(className);
  const isJunior = (grade >= 7 && grade <= 9) || /grade\s*[789]\b|junior|jss/.test(className);
  const isSenior = (grade >= 10 && grade <= 12) || /grade\s*(10|11|12)\b|senior/.test(className);
  if (target.includes('primary') && isPrimary) return true;
  if (target.includes('junior') && isJunior) return true;
  if (target.includes('senior') && isSenior) return true;
  return target.split(',').some((part) => {
    const token = part.trim();
    const gradeToken = token.match(/grade\s*\d+/)?.[0];
    return Boolean(token && (className.includes(token) || token.includes(className) || (gradeToken && className.includes(gradeToken))));
  });
};

const normalizeBaseSlotsAroundAnchors = (baseSlots: TimeSlot[]): TimeSlot[] => {
  const slots = baseSlots.filter((slot) => slot.slot_type !== 'activity' && slot.slot_type !== 'activities');
  const anchors = slots.filter((slot) => slot.slot_type === 'break' || slot.slot_type === 'lunch');
  const lessons = slots
    .filter((slot) => slot.slot_type === 'lesson')
    .sort((a, b) => (a.slot_order ?? 0) - (b.slot_order ?? 0));
  const lunchAnchor = anchors.find((slot) => slot.slot_type === 'lunch');
  const zeroAfterLunch = Boolean(
    lunchAnchor && lessons.every((lesson) => (lesson.slot_order ?? 0) < (lunchAnchor.slot_order ?? 0))
  );
  // For zero-after-lunch levels, an older saved lunch clock may overlap
  // Lessons 5–6. Move lunch after the last pre-lunch lesson instead of
  // incorrectly moving those lessons into the afternoon.
  const lessonAnchors = zeroAfterLunch ? anchors.filter((slot) => slot.slot_type !== 'lunch') : anchors;
  let cursor = -Infinity;
  const normalizedLessons = lessons.map((slot) => {
    const duration = Math.max(1, timeToMinutesView(slot.end_time) - timeToMinutesView(slot.start_time));
    let start = Math.max(timeToMinutesView(slot.start_time), cursor);
    let guard = 0;
    while (guard++ < lessonAnchors.length + 2) {
      const end = start + duration;
      const overlap = lessonAnchors.find((anchor) =>
        start < timeToMinutesView(anchor.end_time) && end > timeToMinutesView(anchor.start_time)
      );
      if (!overlap) break;
      start = timeToMinutesView(overlap.end_time);
    }
    cursor = start + duration;
    return {
      ...slot,
      start_time: minutesToTimeView(start),
      end_time: minutesToTimeView(cursor),
    };
  });

  const normalizedAnchors = zeroAfterLunch && lunchAnchor && normalizedLessons.length > 0
    ? anchors.map((anchor) => {
        if (anchor.id !== lunchAnchor.id) return anchor;
        const originalDuration = Math.max(30, timeToMinutesView(anchor.end_time) - timeToMinutesView(anchor.start_time));
        const lunchStart = Math.max(timeToMinutesView(anchor.start_time), cursor);
        return {
          ...anchor,
          start_time: minutesToTimeView(lunchStart),
          end_time: minutesToTimeView(lunchStart + originalDuration),
        };
      })
    : anchors;

  return [...normalizedAnchors, ...normalizedLessons].sort((a, b) =>
    timeToMinutesView(a.start_time) - timeToMinutesView(b.start_time) ||
    (a.slot_order ?? 0) - (b.slot_order ?? 0)
  );
};

const shiftBaseSlotsForActivities = (baseSlots: TimeSlot[], dayActivities: SchoolActivity[]): TimeSlot[] =>
  shiftSlotsAroundActivities(
    normalizeBaseSlotsAroundAnchors(baseSlots),
    dayActivities,
  );

const buildTimelineSegments = (
  baseSlots: TimeSlot[],
  dayActivities: SchoolActivity[],
): TimelineSegment[] => {
  const shifted = shiftBaseSlotsForActivities(baseSlots, dayActivities).map((slot) => ({
    id: slot.id,
    start_time: slot.start_time,
    end_time: slot.end_time,
    slot_type: slot.slot_type,
    label: slot.label,
    slot_order: slot.slot_order,
    sourceSlotIds: slot.sourceSlotIds,
  }));
  const activities = dayActivities.map((activity) => ({
    id: `activity-${activity.id}`,
    start_time: String(activity.start_time).slice(0, 5),
    end_time: String(activity.end_time).slice(0, 5),
    slot_type: 'activity' as const,
    label: activity.activity_name,
    activity,
  }));
  return [...shifted, ...activities].sort((a, b) =>
    timeToMinutesView(a.start_time) - timeToMinutesView(b.start_time) ||
    timeToMinutesView(a.end_time) - timeToMinutesView(b.end_time)
  );
};

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
  'lower-primary': 'Lower Primary (6 lessons, 0 after lunch)',
  'upper-primary': 'Upper Primary (7 lessons, 1 after lunch)',
  'combined-primary': 'Combined Primary (7 lessons, 1 after lunch)',
  'junior': 'Junior School (8 lessons, 2 after lunch)',
  'senior': 'Senior School (9 lessons, 3 after lunch)',
  'form-3-4': '8-4-4 Form 3-4 (9 lessons, 3 after lunch)',
  'default': 'Legacy default',
};

/** Expected lesson structure per level (source of truth for columns) */
const LEVEL_LESSON_TARGETS: Record<string, { total: number; afterLunch: number }> = {
  'pre-primary': { total: 6, afterLunch: 0 },
  'lower-primary': { total: 6, afterLunch: 0 },
  'upper-primary': { total: 7, afterLunch: 1 },
  'combined-primary': { total: 7, afterLunch: 1 },
  'junior': { total: 8, afterLunch: 2 },
  'senior': { total: 9, afterLunch: 3 },
  'form-3-4': { total: 9, afterLunch: 3 },
  'default': { total: 8, afterLunch: 2 },
};

function countLessons(slots: { slot_type: string }[]): { total: number; afterLunch: number } {
  const lunchIdx = slots.findIndex((s) => s.slot_type === 'lunch');
  const lessons = slots.filter((s) => s.slot_type === 'lesson');
  const after =
    lunchIdx >= 0
      ? slots.slice(lunchIdx + 1).filter((s) => s.slot_type === 'lesson').length
      : 0;
  return { total: lessons.length, afterLunch: after };
}

function dedupeByOrder(slots: TimeSlot[]): TimeSlot[] {
  const seen = new Set<number>();
  const unique: TimeSlot[] = [];
  for (const s of [...slots].sort((a, b) => a.slot_order - b.slot_order)) {
    if (!seen.has(s.slot_order)) {
      seen.add(s.slot_order);
      unique.push(s);
    }
  }
  return unique;
}

/**
 * Build the COLUMN structure for a level.
 * - Prefer DB slots for that level_group when counts match expected structure
 * - Otherwise synthesize with generateSlots so Pre-Primary never shows L7–L9 etc.
 */
function buildDisplaySlotsForLevel(
  all: TimeSlot[],
  levelKey: string,
  levelConfig?: any | null
): TimeSlot[] {
  // Never treat unknown/default as a real level for column counts when we know the class level
  const key = levelKey === 'default' ? 'lower-primary' : levelKey;
  const targets = LEVEL_LESSON_TARGETS[key] || { total: 7, afterLunch: 1 };
  const byLevel = (lg: string) =>
    dedupeByOrder(all.filter((s) => (s.level_group || 'default') === lg));

  let candidates = byLevel(key);
  if (!candidates.length && key === 'combined-primary') {
    candidates = byLevel('lower-primary');
  }
  // Do NOT fall back to legacy "default" slots — they have wrong after-lunch counts

  const counts = countLessons(candidates);
  const countsMatch =
    candidates.length > 0 &&
    counts.total === targets.total &&
    counts.afterLunch === targets.afterLunch;

  // Prefer DB slots only when structure is exactly correct for this level
  if (countsMatch) {
    let slots = candidates;
      if (targets.afterLunch === 0) {
      // Zero-after-lunch levels hide generic post-lunch activities, but retain
      // explicitly scheduled activities that occur before lunch (for example Friday PPI).
      const lunchStartMinutes = (() => {
        const raw = String(levelConfig?.lunch_start || '').slice(0, 5);
        const [hours, minutes] = raw.split(':').map(Number);
        return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : Number.POSITIVE_INFINITY;
      })();
      slots = slots.filter((s) => {
        if (s.slot_type === 'lesson') return true;
        if (s.slot_type === 'activity') {
          const [hours, minutes] = String(s.start_time || '').slice(0, 5).split(':').map(Number);
          const startMinutes = Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : Number.POSITIVE_INFINITY;
          return startMinutes < lunchStartMinutes;
        }
        return s.slot_type !== 'activities';
      });
      // Extra safety: drop any lesson after lunch if present
      const lunchOrder = slots.find((s) => s.slot_type === 'lunch')?.slot_order;
      if (lunchOrder != null) {
        slots = slots.filter(
          (s) => !(s.slot_type === 'lesson' && s.slot_order > lunchOrder)
        );
      }
    }
    // Senior: ensure we have lessons through 9 — if DB missing a lesson, fall through to synth
    const lessonLabels = slots.filter((s) => s.slot_type === 'lesson').map((s) => s.label);
    if (targets.total === 9 && !lessonLabels.some((l) => /9/.test(l || ''))) {
      // fall through to synthesize
    } else {
      return slots;
    }
  }

  // Multi-tenant: never invent school clock times. Only use this school's Setup.
  const required = [
    levelConfig?.start_time,
    levelConfig?.first_break_start,
    levelConfig?.first_break_end,
    levelConfig?.second_break_start,
    levelConfig?.second_break_end,
    levelConfig?.lunch_start,
    levelConfig?.lunch_end,
  ];
  if (!levelConfig || required.some((v) => !v)) {
    if (candidates.length) return targets.afterLunch === 0
      ? candidates.filter((s) => s.slot_type !== 'activities' && s.slot_type !== 'activity')
      : candidates;
    return [];
  }

  const cfg: TimetableConfig = {
    lesson_duration: Number(levelConfig.period_duration) || 40,
    school_start: String(levelConfig.start_time).slice(0, 5),
    school_end: String(levelConfig.end_time || levelConfig.activities_end || levelConfig.lunch_end).slice(0, 5),
    first_break_start: String(levelConfig.first_break_start).slice(0, 5),
    first_break_end: String(levelConfig.first_break_end).slice(0, 5),
    second_break_start: String(levelConfig.second_break_start).slice(0, 5),
    second_break_end: String(levelConfig.second_break_end).slice(0, 5),
    lunch_start: String(levelConfig.lunch_start).slice(0, 5),
    lunch_end: String(levelConfig.lunch_end).slice(0, 5),
    activities_start: levelConfig.activities_start ? String(levelConfig.activities_start).slice(0, 5) : undefined,
    activities_end: levelConfig.activities_end ? String(levelConfig.activities_end).slice(0, 5) : undefined,
    lessons_per_day: typeof levelConfig.lessons_per_day === 'number' ? levelConfig.lessons_per_day : targets.total,
    after_lunch_lessons: typeof levelConfig.after_lunch_lessons === 'number' ? levelConfig.after_lunch_lessons : targets.afterLunch,
  };

  const generated = generateSlots(cfg, cfg.lessons_per_day || targets.total, key);
  const mapped = generated.map((s: TimetableSlot, i: number) => ({
    id: `synth-${key}-${s.slot_order}-${i}`,
    slot_order: s.slot_order,
    start_time: s.start_time.length === 5 ? s.start_time + ':00' : s.start_time,
    end_time: s.end_time.length === 5 ? s.end_time + ':00' : s.end_time,
    slot_type: (s.slot_type === 'activities' ? 'activity' : s.slot_type) as TimeSlot['slot_type'],
    label: s.label,
    level_group: key,
  }));
  return targets.afterLunch === 0
    ? mapped.filter((s) => s.slot_type !== 'activities' && s.slot_type !== 'activity')
    : mapped;
}

/** @deprecated name kept for call sites */
function pickSlotsForLevel(all: TimeSlot[], levelKey: string, levelConfig?: any | null): TimeSlot[] {
  return buildDisplaySlotsForLevel(all, levelKey, levelConfig);
}

export default function TimetableView() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [levelConfigs, setLevelConfigs] = useState<Record<string, any>>({});
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
        fetchLevelConfigs(),
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


  const fetchLevelConfigs = async () => {
    const { data, error: err } = await supabase
      .from('timetable_level_configs')
      .select('*')
      .eq('school_id', user?.schoolId);
    if (err) {
      console.warn('level configs', err);
      setLevelConfigs({});
      return;
    }
    const map: Record<string, any> = {};
    (data || []).forEach((row: any) => {
      if (row.level_group) map[row.level_group] = row;
    });
    setLevelConfigs(map);
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
        `id, class_id, day_of_week, time_slot_id, teacher_id, subject_id, entry_type, activity_name, level_group, effective_start_time, effective_end_time,
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
      effective_start_time: entry.effective_start_time,
      effective_end_time: entry.effective_end_time,
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
      .from('after_school_activities')
      .select('id, school_id, day_of_week, activity_name, start_time, end_time, target_classes')
      .eq('school_id', user?.schoolId)
      .order('day_of_week')
      .order('start_time');
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

  /** Active level for the grid: selected class ALWAYS wins (correct columns per class) */
  const activeLevelGroup = useMemo(() => {
    if (selectedClass !== 'all') {
      const cls = classes.find((c) => c.id === selectedClass);
      if (cls) return resolveClassLevelGroup(cls);
    }
    if (selectedLevelGroup !== 'auto') return selectedLevelGroup;
    const nonDefault = availableLevelGroups.find((g) => g !== 'default');
    return nonDefault || availableLevelGroups[0] || 'lower-primary';
  }, [selectedLevelGroup, selectedClass, classes, availableLevelGroups]);

  /**
   * Columns for the active level only.
   * Pre-primary → 6 lessons, 0 after lunch (no L7/L8/L9 columns).
   * Senior → 9 lessons, 3 after lunch (columns through Lesson 9).
   */
  const allSlots = useMemo(
    () => buildDisplaySlotsForLevel(timeSlots, activeLevelGroup, levelConfigs[activeLevelGroup]),
    [timeSlots, activeLevelGroup, levelConfigs]
  );

  /** Map real DB time_slot_id → slot_order for cell matching when display slots are synthetic */
  const slotIdToOrder = useMemo(() => {
    const m = new Map<string, number>();
    timeSlots.forEach((s) => m.set(s.id, s.slot_order));
    return m;
  }, [timeSlots]);

  /** Map slot_order → entries by day+class for robust matching */
  const entriesByOrder = useMemo(() => {
    const m = new Map<string, TimetableEntry[]>();
    entries.forEach((entry) => {
      const order = slotIdToOrder.get(entry.time_slot_id);
      if (order == null) return;
      const key = `${entry.day_of_week}-${entry.class_id}-${order}`;
      const list = m.get(key) || [];
      list.push(entry);
      m.set(key, list);
    });
    return m;
  }, [entries, slotIdToOrder]);

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

  const getEntries = (day: number, classId: string, slot: TimeSlot): TimetableEntry[] => {
    // A merged activity column can represent multiple legacy DB slot IDs.
    const sourceIds = slot.sourceSlotIds?.length ? slot.sourceSlotIds : [slot.id];
    const merged: TimetableEntry[] = [];
    sourceIds.forEach((sourceId) => {
      const byId = entryLookup.get(`${day}-${classId}-${sourceId}`) || [];
      merged.push(...byId);
    });
    if (merged.length) return merged;
    // Synthetic display slots: match by slot_order.
    return entriesByOrder.get(`${day}-${classId}-${slot.slot_order}`) || [];
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

  /** Get activities for a given day from the configured activity schedule table */
  const getActivitiesForDay = (dayIdx: number): string => {
    const dayNum = dayIdx + 1;
    const dayActivities = activities.filter(a => a.day_of_week === dayNum);
    if (dayActivities.length === 0) return '';
    // Return all activity names for this day, joined
    return Array.from(new Set(dayActivities.map(a => a.activity_name.trim().toUpperCase()))).join(' / ');
  };

  /** Active level groups represented by the school’s active classes. */
  const allLevelGroupsInView = useMemo(
    () => Array.from(new Set(classes.map(resolveClassLevelGroup))).sort(),
    [classes]
  );

  /** Classes to display (filtered if a specific class or level is selected) */
  const displayClasses = useMemo(() => {
    let list = classes;
    if (selectedClass !== 'all') {
      list = classes.filter(c => c.id === selectedClass);
    } else if (selectedLevelGroup !== 'auto') {
      list = classes.filter(c => resolveClassLevelGroup(c) === selectedLevelGroup);
    }
    // Auto + All Classes is the explicit All Levels view. The renderer below
    // splits it into one table per level so lesson counts and clock columns never mix.
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
          margin: [0.05, 0.05, 0.05, 0.05],
          filename,
          image: { type: 'jpeg', quality: 0.98 },
          pagebreak: { mode: ['css', 'legacy'], avoid: ['.bb-wrap', 'tr'] },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', scrollX: 0, scrollY: 0, windowWidth: 1600 },
          jsPDF: { unit: 'in', format: classId ? 'a4' : 'a3', orientation: 'landscape', compress: true },
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

  
  // Structure summary only. Clock times come from this school's Setup / generated slots.
  const isAllLevelsView = selectedClass === 'all' && selectedLevelGroup === 'auto';
  const structureTitle = isAllLevelsView
    ? 'All Active Levels (separate structures)'
    : (LEVEL_LABELS[activeLevelGroup] || activeLevelGroup);
  const summaryBanner = (
    <div className="mx-4 mb-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-semibold">Structure ({structureTitle}):</span>
        {isAllLevelsView ? (
          <span>Each active level is shown in its own timetable below.</span>
        ) : (
          <>
            <span><strong>{slotSummary.totalLessons}</strong> lessons/day</span>
            <span className="text-blue-300">|</span>
            <span><strong>{slotSummary.beforeLunch}</strong> before lunch</span>
            <span className="text-blue-300">|</span>
            <span>
              <strong>{slotSummary.afterLunch}</strong> after lunch
              {slotSummary.afterLunch === 0 ? ' (ends at lunch)' : ''}
            </span>
          </>
        )}
      </div>
      <p className="mt-1 text-xs text-blue-700">
        Break, lunch, and activities times come from Timetable Setup for this school. Edit Setup, then regenerate to refresh the grid.
      </p>
    </div>
  );

  const timetableStyles = `
    .bb-wrap {
      background-color: #ffffff;
      color: #111827;
      font-family: Arial, Helvetica, sans-serif;
      padding: 18px;
      border: 1px solid #cbd5e1;
      box-sizing: border-box;
      break-inside: avoid;
    }
    .tt-table {
      border-collapse: collapse;
      width: max-content;
      min-width: 100%;
      min-width: 1450px;
      table-layout: auto;
      page-break-inside: avoid;
    }
      .tt-table th, .tt-table td {
      border: 1px solid #555;
      padding: 6px 5px;
      text-align: center;
      vertical-align: middle;
      font-size: 0.78rem;
      line-height: 1.15;
      overflow-wrap: anywhere;
    }
    .tt-header {
      background-color: #222;
      color: #4da6ff;
      font-weight: bold;
      font-size: 0.62rem;
      white-space: normal;
      line-height: 1.05;
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
    .tt-break, .tt-lunch {
      writing-mode: horizontal-tb;
      font-weight: 900;
      font-size: 0.58rem;
      background-color: #1a1a1a;
      color: #4da6ff;
      width: 52px;
      min-width: 52px;
      padding: 4px 3px;
      text-align: center;
      white-space: nowrap;
      line-height: 1.05;
    }
    .tt-cell {
      min-width: 92px;
      height: 40px;
      color: #111827;
      font-size: 0.78rem;
      white-space: nowrap;
    }
    .tt-weekly-table {
      width: 100%;
      min-width: 760px;
      table-layout: fixed;
    }
    .tt-weekly-table .tt-time-header {
      min-width: 72px;
      padding: 5px 3px;
      font-size: 0.6rem;
      white-space: nowrap;
    }
    .tt-day-week-header,
    .tt-day-week {
      width: 56px;
      min-width: 56px;
      font-weight: 900;
      letter-spacing: 0.04em;
    }
    .tt-day-week {
      background: #1f2937;
      color: #bfdbfe;
      text-align: center;
      font-size: 0.72rem;
    }
    .tt-empty {
      min-width: 72px;
      height: 40px;
      color: #cbd5e1;
      background: #f8fafc;
      text-align: center;
      font-size: 0.7rem;
    }
    .tt-subtime,
    .tt-slot-label {
      display: block;
      margin-top: 2px;
      font-size: 0.48rem;
      line-height: 1.05;
      color: #64748b;
      font-weight: 600;
    }
    .tt-activity .tt-subtime { color: #166534; }
    .tt-break .tt-subtime,
    .tt-lunch .tt-subtime { color: #64748b; }
    .tt-weekly-board {
      --board-duration: 1;
      width: 100%;
      min-width: 720px;
      background: #ffffff;
      overflow-x: auto;
    }
    .tt-flex-ruler-row,
    .tt-flex-row {
      display: flex;
      width: 100%;
      min-width: 720px;
    }
    .tt-flex-ruler-row {
      background: #eff6ff;
      border-bottom: 1px solid #cbd5e1;
    }
    .tt-flex-ruler-day,
    .tt-flex-day {
      flex: 0 0 52px;
      width: 52px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #1f2937;
      color: #bfdbfe;
      font-weight: 900;
      font-size: 0.68rem;
      letter-spacing: 0.04em;
    }
    .tt-flex-ruler {
      position: relative;
      flex: 1;
      height: 26px;
    }
    .tt-flex-ruler-mark {
      position: absolute;
      top: 7px;
      transform: translateX(-50%);
      color: #475569;
      font-size: 0.52rem;
      font-weight: 800;
      white-space: nowrap;
    }
    .tt-flex-row {
      min-height: 48px;
      border-bottom: 1px solid #e2e8f0;
    }
    .tt-flex-timeline {
      display: flex;
      flex: 1;
      min-width: 0;
      align-items: stretch;
      background: #ffffff;
    }
    .tt-flex-segment,
    .tt-flex-gap {
      min-width: 0;
      min-height: 48px;
      border-right: 1px solid #cbd5e1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 3px 2px;
      text-align: center;
      overflow: hidden;
    }
    .tt-flex-segment strong {
      display: block;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: #111827;
      font-size: 0.68rem;
      line-height: 1.05;
    }
    .tt-flex-segment span,
    .tt-flex-segment small {
      display: block;
      margin-top: 2px;
      font-size: 0.47rem;
      line-height: 1;
      color: #64748b;
      white-space: nowrap;
    }
    .tt-flex-lesson { background: #ffffff; }
    .tt-flex-break { background: #eff6ff; }
    .tt-flex-break strong { color: #2563eb; }
    .tt-flex-lunch { background: #fffbeb; }
    .tt-flex-lunch strong { color: #b45309; }
    .tt-flex-activity { background: #ecfdf5; }
    .tt-flex-activity strong { color: #15803d; }
    .tt-flex-activity span { color: #166534; }
    .tt-flex-gap { background: #f8fafc; border-right-style: dashed; }
    .tt-activity {
      writing-mode: horizontal-tb;
      font-weight: bold;
      color: #15803d;
      width: 88px;
      min-width: 88px;
      font-size: 0.62rem;
      padding: 4px 3px;
      text-align: center;
      white-space: normal;
      overflow-wrap: anywhere;
      line-height: 1.05;
    }
    .tt-break-header {
      background-color: #222;
      color: #4da6ff;
      font-weight: bold;
      font-size: 0.58rem;
      white-space: pre-line;
      width: 52px;
      min-width: 52px;
      white-space: normal;
      line-height: 1.05;
    }
    @media print {
      .no-print { display: none !important; }
      .bb-wrap { border: none; box-shadow: none; background: white; color: black; }
      .tt-table th, .tt-table td { border: 1px solid black; color: black !important; }
      .tt-day, .tt-class, .tt-break, .tt-lunch, .tt-activity, .tt-cell, .tt-header, .tt-break-header { color: black !important; background: white !important; }
    }
  `;

  const renderTimetableTable = (classesToRender: SchoolClass[], tableId: string, slotsOverride?: TimeSlot[]) => {
    const rawSlotsForTable =
      slotsOverride ||
      (classesToRender.length === 1
        ? buildDisplaySlotsForLevel(
            timeSlots,
            resolveClassLevelGroup(classesToRender[0]),
            levelConfigs[resolveClassLevelGroup(classesToRender[0])]
          )
        : allSlots);
    // Defensive UI invariant: one column per shared activity interval, even if
    // older generated data contains several activity rows at the same time.
    const slotsForTable = rawSlotsForTable.reduce<TimeSlot[]>((merged, slot) => {
      if (slot.slot_type === 'activity' || slot.slot_type === 'activities') {
        const toMinutes = (value: string) => {
          const [h, m] = String(value || '').slice(0, 5).split(':').map(Number);
          return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
        };
      }
      if (slot.slot_type !== 'activity' && slot.slot_type !== 'activities') {
        merged.push(slot);
        return merged;
      }
      const existing = merged.find((candidate) =>
        (candidate.slot_type === 'activity' || candidate.slot_type === 'activities') &&
        candidate.start_time === slot.start_time && candidate.end_time === slot.end_time
      );
      if (!existing) {
        merged.push({ ...slot, sourceSlotIds: [slot.id] });
      } else {
        existing.sourceSlotIds = [...(existing.sourceSlotIds || [existing.id]), slot.id];
        if (!existing.label.includes(slot.label.replace(/^ACTIVITY:\s*/i, ''))) {
          existing.label = `${existing.label} / ${slot.label.replace(/^ACTIVITY:\s*/i, '')}`;
        }
      }
      return merged;
    }, []);
    if (!slotsForTable.length) {
      return (
        <div id={tableId} className="m-4 rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900 text-sm">
          No timetable slots for this level yet. Open Timetable Setup, save times for this school, then Generate Timetable.
        </div>
      );
    }

    const lessonSummary = countLessons(slotsForTable);
    const hasActivitySlots = slotsForTable.some((s) => s.slot_type === 'activities' || s.slot_type === 'activity');
    const showLegacyActivityColumn = !hasActivitySlots && lessonSummary.afterLunch > 0;


    return (

    <div id={tableId} className="bb-wrap rounded-lg overflow-hidden">
      <div className="mb-4 text-center">
        <h2 className="text-2xl font-black tracking-tighter text-blue-400 uppercase">
          {schoolName || 'School'} — SCHOOL TIMETABLE
        </h2>
        {classesToRender.length === 1 && (
          <p className="text-green-400 font-bold text-sm mt-1">
            Class: {displayClassName(classesToRender[0])}
            {' · '}
            {LEVEL_LABELS[resolveClassLevelGroup(classesToRender[0])] || resolveClassLevelGroup(classesToRender[0])}
          </p>
        )}
                <p className="text-blue-300 text-xs mt-1">
          {countLessons(slotsForTable).total} lessons/day · {countLessons(slotsForTable).afterLunch} after lunch
          {countLessons(slotsForTable).afterLunch === 0 ? ' · ends at lunch (no post-lunch lesson columns)' : ''}
        </p>
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
                  return (
                    <th key={slot.id} rowSpan={2} className="tt-header" style={{ color: '#33cc33' }}>
                      <span style={{display:'block'}}>ACTIVITY</span>
                      <span style={{fontSize:'0.5rem'}}>{fmt(slot.start_time)}—{fmt(slot.end_time)}</span>
                    </th>
                  );
                }
                return (
                  <th key={slot.id} className="tt-header">
                    {fmt(slot.start_time)}-{fmt(slot.end_time)}
                  </th>
                );
              })}
              {showLegacyActivityColumn && (
                <th rowSpan={2} className="tt-header" style={{ width: '72px', minWidth: '72px', color: '#33cc33' }}>
                  <span style={{display:'block'}}>ACTIVITIES</span>
                  <span style={{display:'block', fontSize:'0.55rem', color:'#8f8'}}>AFTER SCHOOL</span>
                </th>
              )}
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
                              <strong>BREAK</strong>
                              <span style={{fontSize:'0.45rem',color:'#aaa',display:'block',marginTop:'2px'}}>{fmt(slot.start_time)}–{fmt(slot.end_time)}</span>
                            </td>
                          );
                        }
                        return null;
                      }
                      if (slot.slot_type === 'lunch') {
                        if (clsIdx === 0) {
                          return (
                            <td key={slot.id} rowSpan={classesToRender.length} className="tt-lunch">
                              <strong>LUNCH</strong>
                              <span style={{fontSize:'0.45rem',color:'#aaa',display:'block',marginTop:'2px'}}>{fmt(slot.start_time)}–{fmt(slot.end_time)}</span>
                            </td>
                          );
                        }
                        return null;
                      }
                      const cellEntries = getEntries(dayIdx + 1, cls.id, slot);
                      const display = getCellDisplay(cellEntries);
                      return (
                        <td key={slot.id} className="tt-cell">
                          {display}
                        </td>
                      );
                    })}
                    {showLegacyActivityColumn && clsIdx === 0 && (
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
            onClick={() => { setSelectedLevelGroup('auto'); setSelectedClass('all'); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${selectedLevelGroup === 'auto' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            All Levels
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
          Active structure: <strong>{structureTitle}</strong>
          {!isAllLevelsView && <> {' '}· {slotSummary.totalLessons} lessons/day · {slotSummary.afterLunch} after lunch</>}
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

      {/* Main Timetable (all levels or a selected level/class) */}
      <div id="timetable-print-area">
        {selectedClass === 'all' && selectedLevelGroup === 'auto'
          ? allLevelGroupsInView.map((levelGroup) => {
              const groupClasses = classes.filter((cls) => resolveClassLevelGroup(cls) === levelGroup);
              const groupSlots = buildDisplaySlotsForLevel(
                timeSlots,
                levelGroup,
                levelConfigs[levelGroup]
              );
              return (
                <div key={levelGroup} className="mb-6">
                  {renderTimetableTable(groupClasses, `timetable-main-${levelGroup}`, groupSlots)}
                </div>
              );
            })
          : renderTimetableTable(displayClasses, 'timetable-main-view')}
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
