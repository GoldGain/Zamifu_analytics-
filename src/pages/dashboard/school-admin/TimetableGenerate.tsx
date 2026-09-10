import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { supabaseUntyped } from '@/lib/supabase/client';
import { Zap, CheckCircle, Loader2, Clock, AlertCircle, Info } from 'lucide-react';
import { toast } from 'sonner';
import { canUseAssignmentDay, classifySubject, generateSlots, getDefaultPriorityBand, getDefaultPriorityLesson, getLessonCountForLevel, getLevelConfig, isFillerSubject, isValidDoubleLessonPair, orderAssignmentDays, resolveLessonTargets, shouldSkipPreferredSlot, strictSubjectAllowsLesson, violatesMathScienceSequence } from '@/lib/timetable-generator';
import { LEVEL_GROUPS } from './TimetableSetup';
import {
  activityBlocksLessons,
  activityMatchesLevel,
  isPostLessonActivity,
  resolveActivityLessonSlot,
} from '@/lib/timetable-activity';

function fmtTime(t?: string | null): string {
  if (!t) return '—';
  const raw = String(t).slice(0, 5);
  const [hStr, mStr] = raw.split(':');
  const h = Number(hStr);
  const m = mStr || '00';
  if (Number.isNaN(h)) return raw;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}


// Frontend config interface (matches what timetable-generator expects)
interface ScheduledActivity {
  id?: string;
  day_of_week: number;
  activity_name: string;
  start_time: string;
  end_time: string;
  target_classes?: string | null;
  target_level_group?: string | null;
  blocks_lessons?: boolean | null;
}

interface FrontendConfig {
  lesson_duration: number;
  school_start: string;
  school_end: string;
  first_break_start: string;
  first_break_end: string;
  second_break_start: string;
  second_break_end: string;
  lunch_start: string;
  lunch_end: string;
  activities_start?: string;
  activities_end?: string;
  activities: Record<string, string>;
  lessons_per_day?: number;
  after_lunch_lessons?: number;
  scheduledActivities?: ScheduledActivity[];
}

const timeToMinutes = (value: string | null | undefined): number => {
  const [hours, minutes] = String(value || '').slice(0, 5).split(':').map(Number);
  return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : 0;
};
const toMinutes = timeToMinutes;
const TIMETABLE_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const;

const normalizeDayName = (value: unknown): string => {
  const raw = String(value ?? '').trim().toLowerCase();
  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : '';
};

const normalizeDayNames = (value: unknown): string[] => {
  let values: unknown[] = [];
  if (Array.isArray(value)) values = value;
  else if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      values = Array.isArray(parsed) ? parsed : value.split(',');
    } catch {
      values = value.split(',');
    }
  }
  return values
    .map(normalizeDayName)
    .filter((day): day is string => TIMETABLE_DAYS.includes(day as typeof TIMETABLE_DAYS[number]));
};

const isEnabledFlag = (value: unknown): boolean =>
  value === true || value === 1 || value === '1' || String(value).trim().toLowerCase() === 'true';

const normalizePriorityBand = (value: unknown, isPriority = false, subjectName?: string): string => {
  const raw = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  // Canonical four-window contract: Early Morning L1–2, Mid Morning L3–4,
  // Late Morning L5–6, and Afternoon L7+. Keep legacy aliases readable.
  if (raw === 'auto' || raw === 'automatic' || raw === 'default') return getDefaultPriorityBand(subjectName);
  if (raw === 'morning' || raw === 'early' || raw === 'early_morning') return 'early_morning';
  if (raw === 'mid' || raw === 'mid_morning') return 'mid_morning';
  if (raw === 'late' || raw === 'late_morning') return 'late_morning';
  if (raw === 'afternoon') return 'afternoon';
  if (isPriority) return 'early_morning';
  // Null/undefined values predate the priority-band column. Apply the subject
  // default only for those legacy rows; an explicit "none" remains unprioritized.
  return value == null ? getDefaultPriorityBand(subjectName) : 'none';
};

const priorityBandLabel = (band: string): string => ({
  early_morning: 'Early Morning (Lessons 1–2)',
  morning: 'Early Morning (Lessons 1–2)',
  mid_morning: 'Mid Morning (Lessons 3–4)',
  late_morning: 'Late Morning (Lessons 5–6)',
  afternoon: 'Afternoon (Lesson 7+)',
  auto: 'Automatic subject default',
  none: 'No fixed priority',
}[band] || band);

const stableRotation = (value: string): number => {
  let hash = 0;
  for (let index = 0; index < value.length; index++) hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  return hash;
};

const rotateList = <T,>(items: T[], offset: number): T[] => {
  if (items.length === 0) return items;
  const start = ((offset % items.length) + items.length) % items.length;
  return [...items.slice(start), ...items.slice(0, start)];
};

// Map level config DB row to frontend config
const mapLevelConfigToFrontend = (dbConfig: any, dbActivities: Record<string, string>): FrontendConfig => ({
  // Multi-tenant: only use this school's saved Setup values. No invented school times.
  lesson_duration: dbConfig.period_duration || 40,
  school_start: dbConfig.start_time?.slice(0, 5) || '',
  school_end: (dbConfig.end_time || dbConfig.activities_end || dbConfig.lunch_end)?.slice(0, 5) || '',
  first_break_start: dbConfig.first_break_start?.slice(0, 5) || '',
  first_break_end: dbConfig.first_break_end?.slice(0, 5) || '',
  second_break_start: dbConfig.second_break_start?.slice(0, 5) || '',
  second_break_end: dbConfig.second_break_end?.slice(0, 5) || '',
  lunch_start: dbConfig.lunch_start?.slice(0, 5) || '',
  lunch_end: dbConfig.lunch_end?.slice(0, 5) || '',
  activities_start: dbConfig.activities_start?.slice(0, 5) || undefined,
  activities_end: dbConfig.activities_end?.slice(0, 5) || undefined,
  activities: dbActivities,
  lessons_per_day: typeof dbConfig.lessons_per_day === 'number' ? dbConfig.lessons_per_day : undefined,
  after_lunch_lessons: typeof dbConfig.after_lunch_lessons === 'number' ? dbConfig.after_lunch_lessons : undefined,
});

// Map legacy school_timetable_config to frontend config
const mapDbToFrontend = (dbConfig: any, dbActivities: Record<string, string>): FrontendConfig | null => {
  if (!dbConfig) return null;
  return {
    lesson_duration: dbConfig.lesson_duration_minutes || 40,
    school_start: dbConfig.school_start_time?.slice(0, 5) || '',
    school_end: dbConfig.school_end_time?.slice(0, 5) || '',
    first_break_start: dbConfig.morning_break_start?.slice(0, 5) || '',
    first_break_end: dbConfig.morning_break_end?.slice(0, 5) || '',
    second_break_start: dbConfig.afternoon_break_start?.slice(0, 5) || '',
    second_break_end: dbConfig.afternoon_break_end?.slice(0, 5) || '',
    lunch_start: dbConfig.lunch_start?.slice(0, 5) || '',
    lunch_end: dbConfig.lunch_end?.slice(0, 5) || '',
    activities: dbActivities,
  };
};

// Map level group key to class grade_level ranges
const LEVEL_GROUP_GRADE_RANGES: Record<string, number[]> = {
  'pre-primary': [-3, -2, -1, 0],
  'lower-primary': [1, 2, 3],
  'upper-primary': [4, 5, 6],
  'combined-primary': [1, 2, 3, 4, 5, 6],
  'junior': [7, 8, 9],
  'senior': [10, 11, 12],
  'form-3-4': [11, 12], // Form 3=11, Form 4=12 in 8-4-4
};

const classMatchesLevel = (cls: any, levelKey: string): boolean => {
  const gradeLevel = Number(cls.grade_level ?? cls.level);
  if ((LEVEL_GROUP_GRADE_RANGES[levelKey] || []).includes(gradeLevel)) return true;
  const name = String(cls.name || '').toLowerCase();
  if (levelKey === 'pre-primary' && /(pp\s*[12]|pre[\s-]?primary|playgroup|baby)/.test(name)) return true;
  if (levelKey === 'lower-primary' && /grade\s*[123]\b/.test(name)) return true;
  if (levelKey === 'upper-primary' && /grade\s*[456]\b/.test(name)) return true;
  if (levelKey === 'combined-primary' && /grade\s*[1-6]\b/.test(name)) return true;
  if (levelKey === 'junior' && /grade\s*[789]\b/.test(name)) return true;
  if (levelKey === 'senior' && /grade\s*(10|11|12)\b/.test(name)) return true;
  return levelKey === 'form-3-4' && /form\s*[34]\b/.test(name);
};

// Display info for each level's lesson structure
// Senior (Grade 10-12): 9 lessons/day, 3 after lunch
// Form 3 & 4 (8-4-4): 9 lessons/day, 3 after lunch
type GenerationReport = {
  kind: 'success' | 'warning' | 'error';
  title: string;
  details: string[];
  suggestions: string[];
};

const LEVEL_LESSON_INFO: Record<string, { lessons: number; afterLunch: number; note: string }> = {
  'pre-primary': { lessons: 6, afterLunch: 0, note: 'School ends at lunch time' },
  'lower-primary': { lessons: 6, afterLunch: 0, note: '6 lessons ending before lunch' },
  'upper-primary': { lessons: 6, afterLunch: 0, note: '6 lessons ending before lunch' },
  'combined-primary': { lessons: 6, afterLunch: 0, note: '6 lessons ending before lunch' },
  'junior': { lessons: 8, afterLunch: 2, note: '2 lessons after lunch' },
  'senior': { lessons: 7, afterLunch: 1, note: '1 lesson after lunch' },
  'form-3-4': { lessons: 7, afterLunch: 1, note: '1 lesson after lunch' },
};

export default function TimetableGenerate() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [legacyConfig, setLegacyConfig] = useState<FrontendConfig | null>(null);
  const [levelConfigs, setLevelConfigs] = useState<Record<string, any>>({});
  const [assignmentCount, setAssignmentCount] = useState(0);
  const [teacherCount, setTeacherCount] = useState(0);
  const [classCount, setClassCount] = useState(0);
  const [lastGenerated, setLastGenerated] = useState<string | null>(null);
  const [selectedLevels, setSelectedLevels] = useState<Set<string>>(new Set());
  const [scheduledActivities, setScheduledActivities] = useState<ScheduledActivity[]>([]);
  const [generationReport, setGenerationReport] = useState<GenerationReport | null>(null);

  useEffect(() => {
    if (user?.schoolId) fetchData();
  }, [user?.schoolId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const schoolId = user?.schoolId;

      // Fetch legacy config (fallback)
      const { data: configData } = await supabase
        .from('school_timetable_config').select('*').eq('school_id', schoolId).maybeSingle();

      // Fetch explicit activity schedules. The richer after_school_activities table
      // supports day, type/name, exact time, and target class scope.
      const { data: activityRows, error: activityError } = await supabaseUntyped
        .from('after_school_activities')
        .select('id, day_of_week, activity_name, start_time, end_time, target_classes, target_level_group, blocks_lessons')
        .eq('school_id', schoolId)
        .order('day_of_week')
        .order('start_time');
      if (activityError) console.warn('[timetable] activities load warning:', activityError.message);
      const loadedActivities = (activityRows || []).map((a: any) => ({
        id: a.id,
        day_of_week: Number(a.day_of_week),
        activity_name: a.activity_name,
        start_time: String(a.start_time || '').slice(0, 5),
        end_time: String(a.end_time || '').slice(0, 5),
        target_classes: a.target_classes || 'All',
        target_level_group: a.target_level_group || 'all',
        blocks_lessons: a.blocks_lessons !== false,
      }));
      setScheduledActivities(loadedActivities);
      const activities: Record<string, string> = {};
      loadedActivities.forEach((a) => { activities[String(a.day_of_week)] = a.activity_name; });
      setLegacyConfig(mapDbToFrontend(configData, activities));

      // Fetch level-specific configs
      const { data: levelConfigsData } = await supabaseUntyped
        .from('timetable_level_configs')
        .select('*')
        .eq('school_id', schoolId);

      const lcMap: Record<string, any> = {};
      (levelConfigsData || []).forEach((lc: any) => {
        lcMap[lc.level_group] = lc;
      });
      setLevelConfigs(lcMap);

      const { count: ac } = await supabase
        .from('teacher_subject_assignments').select('*', { count: 'exact', head: true })
        .eq('school_id', schoolId).eq('is_active', true);
      setAssignmentCount(ac || 0);

      const { count: tc } = await supabase
        .from('teachers').select('*', { count: 'exact', head: true }).eq('school_id', schoolId).eq('is_active', true);
      setTeacherCount(tc || 0);

      const { count: cc } = await supabase
        .from('classes').select('*', { count: 'exact', head: true }).eq('school_id', schoolId).eq('is_active', true);
      setClassCount(cc || 0);

      // Start on levels that actually have both classes and teacher assignments.
      // This prevents a new school from defaulting to Lower Primary when its
      // configured classes are, for example, Grade 7–9 Junior School.
      const { data: readinessClasses } = await supabase
        .from('classes').select('id, name, level, grade_level').eq('school_id', schoolId).eq('is_active', true);
      const { data: readinessAssignments } = await supabase
        .from('teacher_subject_assignments').select('class_id').eq('school_id', schoolId).eq('is_active', true);
      const assignedClassIds = new Set((readinessAssignments || []).map((row: any) => String(row.class_id)));
      const readyLevels = LEVEL_GROUPS
        .map((group) => group.key)
        .filter((key) => (readinessClasses || []).some((cls: any) => classMatchesLevel(cls, key) && assignedClassIds.has(String(cls.id))));
      if (readyLevels.length > 0) setSelectedLevels(new Set(readyLevels));

      const { data: ttData } = await supabase
        .from('timetable_entries').select('created_at').eq('school_id', schoolId).limit(1).order('created_at', { ascending: false });
      setLastGenerated(ttData && ttData.length > 0 ? new Date(ttData[0].created_at).toLocaleString() : null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load timetable readiness data');
    } finally {
      setLoading(false);
    }
  };

  const toggleLevel = (key: string) => {
    setSelectedLevels(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleGenerateTimetable = async () => {
    if (selectedLevels.size === 0) {
      const report: GenerationReport = {
        kind: 'error',
        title: 'Timetable generation stopped',
        details: ['No level group is selected.'],
        suggestions: ['Select at least one level group and try again.'],
      };
      setGenerationReport(report);
      toast.error(report.title);
      return;
    }

    setGenerationReport(null);
    try {
      setGenerating(true);
      const schoolId = user?.schoolId;
      if (!schoolId) throw new Error('No school ID — please log in again.');

      // ALWAYS re-fetch level configs from DB at generate-time so edited times from
      // Timetable Setup are applied (never rely on stale React state).
      const { data: freshLevelConfigs, error: lcErr } = await supabaseUntyped
        .from('timetable_level_configs')
        .select('*')
        .eq('school_id', schoolId);
      if (lcErr) throw new Error('Could not load timetable setup: ' + lcErr.message);
      const freshLcMap: Record<string, any> = {};
      (freshLevelConfigs || []).forEach((lc: any) => {
        if (lc.level_group) freshLcMap[lc.level_group] = lc;
      });
      setLevelConfigs(freshLcMap);

      // Fetch all active classes
      const { data: allClasses } = await supabase.from('classes').select('id, name, level, grade_level, stream, school_id, is_active').eq('school_id', schoolId).eq('is_active', true);
      const { data: rawAssignments } = await supabase
        .from('teacher_subject_assignments')
        .select('*, subjects(name, code), teachers(first_name, last_name, teacher_number)')
        .eq('school_id', schoolId)
        .eq('is_active', true);

      const invalidAssignments = (rawAssignments || []).filter((assignment: any) =>
        !assignment.subject_id || !String(assignment.subjects?.name || '').trim() || isFillerSubject(assignment.subjects?.name),
      );
      if (invalidAssignments.length > 0) {
        const invalidNames = [...new Set(invalidAssignments.map((assignment: any) => String(assignment.subjects?.name || 'Unnamed learning area')))].join(', ');
        throw new Error(`Remove invalid or filler learning areas from Teacher Assignments before generating: ${invalidNames}. Timetables only use real subjects assigned by teachers.`);
      }
      const assignments = (rawAssignments || []).filter((assignment: any) => assignment.subject_id && String(assignment.subjects?.name || '').trim());

      if (!allClasses?.length || !assignments.length) {
        throw new Error('Classes or assignments missing. Please set up classes and teacher assignments first.');
      }

      // Re-fetch activity schedules at generation time so recent Setup changes apply.
      const { data: activityRows } = await supabaseUntyped
        .from('after_school_activities')
        .select('id, day_of_week, activity_name, start_time, end_time, target_classes, target_level_group, blocks_lessons')
        .eq('school_id', schoolId)
        .order('day_of_week')
        .order('start_time');
      const freshActivities: ScheduledActivity[] = (activityRows || []).map((a: any) => ({
        id: a.id,
        day_of_week: Number(a.day_of_week),
        activity_name: a.activity_name,
        start_time: String(a.start_time || '').slice(0, 5),
        end_time: String(a.end_time || '').slice(0, 5),
        target_classes: a.target_classes || 'All',
        target_level_group: a.target_level_group || 'all',
        blocks_lessons: a.blocks_lessons !== false,
      }));
      setScheduledActivities(freshActivities);
      const activities: Record<string, string> = {};
      freshActivities.forEach((a) => { activities[String(a.day_of_week)] = a.activity_name; });

      // Require a saved Setup config for each selected level (prevents silent default times)
      const missingSetup = Array.from(selectedLevels).filter((k) => !freshLcMap[k]);
      if (missingSetup.length > 0) {
        const labels = missingSetup
          .map((k) => LEVEL_GROUPS.find((l) => l.key === k)?.label || k)
          .join(', ');
        throw new Error(
          `Save Timetable Setup first for: ${labels}. Open Timetable Setup → edit times → Save Configuration, then generate.`
        );
      }

      // Upper Primary uses only direct class-linked assignments. Do not clear or
      // generate an apparently empty Grade 4–6 timetable when those assignments
      // are absent; Junior and every other level keep their existing path.
      if (selectedLevels.has('upper-primary')) {
        const upperPrimaryClasses = allClasses.filter((cls: any) => {
          const gradeLevel = Number(cls.grade_level ?? cls.level);
          if ([4, 5, 6].includes(gradeLevel)) return true;
          return /grade\s*[456]\b/i.test(String(cls.name || ''));
        });
        const upperPrimaryClassIds = new Set(upperPrimaryClasses.map((cls: any) => String(cls.id)));
        const upperPrimaryAssignments = (assignments || []).filter((assignment: any) =>
          upperPrimaryClassIds.has(String(assignment.class_id))
        );
        if (upperPrimaryClasses.length > 0 && upperPrimaryAssignments.length === 0) {
          throw new Error(
            'Upper Primary has no active teacher assignments linked to the Grade 4–6 classes. Assign each learning area and its weekly lesson count in Teacher Assignments, then generate again.'
          );
        }
      }

      // Clear existing entries/slots for selected levels + legacy "default" (old generator)
      // so View Timetable never mixes wrong lesson counts across levels.
      const levelsToClear = new Set<string>([...Array.from(selectedLevels), 'default']);
      for (const levelKey of Array.from(levelsToClear)) {
        await (supabase as any).from('timetable_entries').delete().eq('school_id', schoolId).eq('level_group', levelKey);
        await (supabase as any).from('timetable_time_slots').delete().eq('school_id', schoolId).eq('level_group', levelKey);
      }

      const teacherBusy = new Set<string>();
      const classBusy = new Set<string>();
      const allEntries: any[] = [];
      type AssignmentPlacementContext = {
        assignmentKey: string;
        assignment: any;
        cls: any;
        levelKey: string;
        subjectName: string;
        isMath: boolean;
        isScience: boolean;
        priorityBand: string;
        preferredLessonSlots: any[];
        availableDays: string[];
        lessonsPerWeek: number;
        isDoubleLesson: boolean;
        configuredDoubleDays: string[];
        requiredDoubleDays: string[];
        placedDoubleDays: Set<string>;
        dayUsage: Map<number, number>;
        lessonSlots: any[];
        nextLessonById: Map<string, any>;
        config: FrontendConfig;
        classSubjectBySlot: Map<string, string>;
        getDaySlotTiming: (day: number, cls: any) => {
          blockingActivities: ScheduledActivity[];
          times: Map<string, { start_time: string; end_time: string }>;
        };
      };
      type LessonPlacementRecord = {
        context: AssignmentPlacementContext;
        unitSize: 1 | 2;
        day: number;
        slots: any[];
        classKeys: string[];
        teacherKeys: string[];
        entries: any[];
        subjectDayKey: string;
      };
      const assignmentContexts = new Map<string, AssignmentPlacementContext>();
      const placementRecords: LessonPlacementRecord[] = [];
      const generatedSummary: string[] = [];
      const underScheduled: Array<{
        className: string;
        subjectName: string;
        teacherName: string;
        priorityBand: string;
        configured: number;
        scheduled: number;
        assignmentKey: string;
      }> = [];

      // Process each selected level group
      for (const levelKey of Array.from(selectedLevels)) {
        // ALWAYS use fresh DB config for this level (edited times from Setup)
        const levelDbConfig = freshLcMap[levelKey];
        if (!levelDbConfig) {
          throw new Error(`No saved setup for ${levelKey}. Save it in Timetable Setup first.`);
        }
        const config: FrontendConfig = mapLevelConfigToFrontend(levelDbConfig, activities);
        console.info(`[timetable] using DB times for ${levelKey}`, {
          start: config.school_start,
          lunch: `${config.lunch_start}-${config.lunch_end}`,
          activities: `${config.activities_start || '—'}-${config.activities_end || '—'}`,
          duration: config.lesson_duration,
          after_lunch: config.after_lunch_lessons,
        });

        // Validate required fields
        const requiredFields = ['school_start', 'first_break_start', 'first_break_end', 'second_break_start', 'second_break_end', 'lunch_start', 'lunch_end'];
        for (const field of requiredFields) {
          if (!config[field as keyof FrontendConfig]) {
            const levelLabel = LEVEL_GROUPS.find((level) => level.key === levelKey)?.label || levelKey;
            throw new Error(`Missing ${field.replace(/_/g, ' ')} for ${levelLabel}. Save the complete Timetable Setup (start, breaks, and lunch) before generating.`);
          }
        }

        const classesToProcess = (allClasses || []).filter((cls: any) => classMatchesLevel(cls, levelKey));
        if (classesToProcess.length === 0) {
          throw new Error(`No active classes match ${LEVEL_GROUPS.find(l => l.key === levelKey)?.label || levelKey}. Select a level that has classes and teacher assignments, or update the class grade level first.`);
        }

        // Generate the normal level-specific clock once. Explicit activities do
        // not shift this clock and do not add lesson columns. A blocking activity
        // that overlaps a lesson owns that existing lesson slot; only a genuine
        // post-school activity is allowed to create a final activity segment.
        const targets = resolveLessonTargets(levelKey, config);
        const lessonCount = targets.totalLessons;
        const generationConfig = {
          ...config,
          // Explicit activities replace the generic activities window. They are
          // classified below by exact day/time and target scope.
          activities_start: freshActivities.length ? undefined : config.activities_start,
          activities_end: freshActivities.length ? undefined : config.activities_end,
          lessons_per_day: targets.totalLessons,
          after_lunch_lessons: targets.afterLunch,
        };
        const baseSlots = generateSlots(generationConfig, lessonCount, levelKey);

        const activityCandidates = freshActivities
          .filter(a => activityMatchesLevel(a.target_level_group, levelKey))
          .filter(a => a.activity_name && toMinutes(a.end_time) > toMinutes(a.start_time))
          // Lower Primary and Pre-Primary end at lunch: do not generate any
          // activity after lunch for those levels.
          .filter(a => !(['lower-primary', 'pre-primary'].includes(levelKey)) || toMinutes(a.start_time) < toMinutes(config.lunch_start));
        const postLessonActivities = activityCandidates.filter((activity) =>
          isPostLessonActivity(baseSlots, activity),
        );
        const inLessonActivities = activityCandidates.filter((activity) =>
          Boolean(resolveActivityLessonSlot(baseSlots, activity)),
        );
        const unplacedActivities = activityCandidates.filter((activity) =>
          !postLessonActivities.includes(activity) && !inLessonActivities.includes(activity),
        );
        if (unplacedActivities.length > 0) {
          console.warn(
            `[timetable] ${levelKey}: activities not aligned to a lesson or post-school window were not inserted as extra columns`,
            unplacedActivities.map((activity) => `${activity.activity_name} ${activity.start_time}-${activity.end_time}`),
          );
        }
        // Only post-school activities are structural segments. In-lesson
        // activities such as Friday PPI replace a normal lesson entry later.
        const activityGroups = new Map<string, ScheduledActivity[]>();
        postLessonActivities.forEach((activity) => {
          const key = `${activity.start_time}-${activity.end_time}`;
          const group = activityGroups.get(key) || [];
          group.push(activity);
          activityGroups.set(key, group);
        });
        const combinedSlots = [
          ...baseSlots,
          ...Array.from(activityGroups.values()).map(group => ({
            slot_order: 0,
            label: `ACTIVITY: ${group.map(a => a.activity_name).join(' / ')}`,
            slot_type: 'activities' as const,
            start_time: group[0].start_time,
            end_time: group[0].end_time,
            activityMeta: group,
          })),
        ]
          .sort((a, b) => toMinutes(a.start_time) - toMinutes(b.start_time) || (a.slot_type === 'activities' ? 1 : -1))
          .map((slot, index) => ({ ...slot, slot_order: index + 1 }));
        const activityMetaByOrder = new Map<number, ScheduledActivity[]>();
        combinedSlots.forEach((slot: any) => { if (slot.activityMeta) activityMetaByOrder.set(slot.slot_order, slot.activityMeta); });
        const slots = combinedSlots.map(({ activityMeta: _activityMeta, ...slot }: any) => slot);
        console.info(`[timetable] ${levelKey}: ${targets.totalLessons} lessons (${targets.afterLunch} after lunch), ${slots.filter(s => s.slot_type === 'lesson').length} lesson slots generated, ${activityMetaByOrder.size} explicit activities`);

        const { data: createdSlots, error: slotError } = await (supabase as any)
          .from('timetable_time_slots')
          .insert(slots.map(s => ({
            ...s,
            school_id: schoolId,
            level_group: levelKey,
            slot_type: s.slot_type === 'activities' ? 'activity' : s.slot_type,
          })))
          .select();
        if (slotError) throw slotError;

        const lessonN = (createdSlots || []).filter((s: any) => s.slot_type === 'lesson').length;
        const afterN = targets.afterLunch;
        generatedSummary.push(
          `${LEVEL_GROUPS.find((l) => l.key === levelKey)?.label || levelKey}: ${lessonN} lessons (${afterN} after lunch), start ${config.school_start}`
        );

        // Remove any leftover entries for these classes under other level_groups.
        const classIds = classesToProcess.map((c: any) => c.id);
        await (supabase as any)
          .from('timetable_entries')
          .delete()
          .eq('school_id', schoolId)
          .in('class_id', classIds);

        const orderedSlots = (createdSlots || []).slice().sort((a: any, b: any) => a.slot_order - b.slot_order);
        const fixedSlots = orderedSlots.filter((s: any) => ['break', 'lunch', 'activity', 'activities'].includes(s.slot_type));
        const lessonSlots = orderedSlots.filter((s: any) => s.slot_type === 'lesson');
        const nextLessonById = new Map<string, any>();
        for (let index = 0; index < orderedSlots.length - 1; index++) {
          const current = orderedSlots[index];
          const next = orderedSlots[index + 1];
          if (current.slot_type === 'lesson' && next.slot_type === 'lesson') {
            nextLessonById.set(String(current.id), next);
          }
        }
        const lessonNumberOf = (slot: any) => {
          const parsed = Number(String(slot.label || '').match(/lesson\s+(\d+)/i)?.[1]);
          return Number.isFinite(parsed) ? parsed : lessonSlots.indexOf(slot) + 1;
        };
        const isJuniorLevel = levelKey === 'junior';
        const isPrimaryLevel = ['pre-primary', 'lower-primary', 'upper-primary', 'combined-primary'].includes(levelKey);
        // Default lesson placement windows derived from subject name + level only.
        // No stored priority is read anywhere in the generator.
        const prioritySlots = {
          early_morning: lessonSlots.filter((slot: any) => lessonNumberOf(slot) >= 1 && lessonNumberOf(slot) <= 2),
          mid_morning: lessonSlots.filter((slot: any) => {
            const n = lessonNumberOf(slot);
            return n >= 3 && n <= 4;
          }),
          late_morning: lessonSlots.filter((slot: any) => {
            const n = lessonNumberOf(slot);
            return isJuniorLevel ? (n >= 5 && n <= 7) : (n >= 5 && n <= 6);
          }),
          afternoon: lessonSlots.filter((slot: any) => {
            const n = lessonNumberOf(slot);
            if (isJuniorLevel) return n >= 6 && n <= 8;
            if (isPrimaryLevel) return n >= 5 && n <= 7;
            return n >= 5;
          }),
        };
        const priorityBandMinLesson: Record<string, number> = {
          early_morning: 1,
          mid_morning: 3,
          late_morning: 5,
          afternoon: isJuniorLevel ? 6 : 5,
        };
        const priorityBandSpillCeiling: Record<string, number> = {
          early_morning: 6,
          mid_morning: 6,
          late_morning: isJuniorLevel ? 7 : 6,
          afternoon: isJuniorLevel ? 8 : (isPrimaryLevel ? 7 : 9),
        };
        const defaultBandFor = (subject: string | null | undefined): string => {
          const name = String(subject || '').trim().toLowerCase();
          if (name.includes('mathemat')) return 'early_morning';
          if (name.includes('english')) return 'early_morning';
          if (name.includes('kiswahili')) return isPrimaryLevel ? 'mid_morning' : 'late_morning';
          if (name.includes('agricultur')) return 'afternoon';
          if (name.includes('pre-tech') || name.includes('pretechnical') || name.includes('pre technical')) return 'mid_morning';
          if (name.includes('science') || name.includes('environment') || name.includes('chem') || name.includes('physic') || name.includes('biolog')) return 'mid_morning';
          if (name.includes('religious') || classifySubject(name) === 'religious') return 'afternoon';
          if (name.includes('creative')) return 'afternoon';
          if (name.includes('social')) return 'afternoon';
          if (name.includes('business')) return 'afternoon';
          if (name.includes('health')) return 'afternoon';
          return 'none';
        };
        // Spill order: preferred band first, then EVERY remaining lesson slot.
        // The band is a soft preference, never a wall \u2014 a class can never be
        // left with a blank because a subject's own window was full.
        const orderedSpillSlotsFor = (band: string): any[] => {
          const minLesson = priorityBandMinLesson[band];
          const maxLesson = priorityBandSpillCeiling[band];
          const preferred = (minLesson != null && maxLesson != null)
            ? lessonSlots.filter((slot: any) => {
                const n = lessonNumberOf(slot);
                return n >= minLesson && n <= maxLesson;
              })
            : [];
          const preferredIds = new Set(preferred.map((slot: any) => String(slot.id)));
          const remainder = lessonSlots.filter((slot: any) => !preferredIds.has(String(slot.id)));
          const combined = [...preferred, ...remainder];
          return combined
            .filter((slot: any) => band !== 'late_morning' || lessonNumberOf(slot) <= 7)
            .sort((a: any, b: any) => lessonNumberOf(a) - lessonNumberOf(b));
        };

        // During backfill every free slot is eligible so the timetable is always
        // complete. The only named cross-band cap is Kiswahili never beyond
        // Lesson 7 (Junior). Mathematics/Science adjacency and once-per-day are
        // enforced separately by the placement guards.
        const bandAllowsSlot = (band: string, slot: any): boolean => {
          if (band === 'late_morning' && lessonNumberOf(slot) > 7) return false;
          return true;
        };
        const classSubjectBySlot = new Map<string, string>();
        const subjectDayUsage = new Map<string, number>();
        const subjectDemandByClass = new Map<string, number>();
        const classesInLevel = new Set(classesToProcess.map((classItem: any) => String(classItem.id)));
        assignments
          .filter((assignment: any) => classesInLevel.has(String(assignment.class_id)))
          .forEach((assignment: any) => {
            const key = `${assignment.class_id}:${assignment.subject_id}`;
            subjectDemandByClass.set(key, (subjectDemandByClass.get(key) || 0) + Math.max(0, Number(assignment.lessons_per_week || 0)));
          });

        // Reserve each teacher’s configured double-day priority window before
        // any single lesson is placed. Without this, Grade 7 Science singles
        // can consume Wednesday Lesson 3/4 and make Grade 8 Science’s explicitly
        // configured Wednesday double impossible when the same teacher serves
        // both classes.
        const teacherDoubleReservedSlotKeys = new Set<string>();
        assignments.forEach((assignment: any) => {
          if (!classesInLevel.has(String(assignment.class_id)) || !isEnabledFlag(assignment.is_double_lesson)) return;
          const assignmentBand = defaultBandFor(String(assignment.subjects?.name || ''));
          const assignmentPreferredSlots = assignmentBand === 'early_morning'
            ? prioritySlots.early_morning
            : assignmentBand === 'mid_morning'
              ? prioritySlots.mid_morning
              : assignmentBand === 'late_morning'
                ? prioritySlots.late_morning
                : assignmentBand === 'afternoon'
                  ? prioritySlots.afternoon
                  : lessonSlots;
          const reservationSlots = assignmentPreferredSlots.length > 0 ? assignmentPreferredSlots : lessonSlots;
          const assignmentAvailableDays = normalizeDayNames(assignment.available_days);
          const assignmentDoubleDays: string[] = [];
          // A double flag without selected weekdays means “double days not yet
          // configured”, not “reserve every day”. Do not block ordinary lessons
          // for this teacher until the administrator explicitly chooses days.
          if (assignmentDoubleDays.length === 0) return;
          const reservationDays = assignmentDoubleDays;
          reservationDays.forEach((dayName) => {
            const dayNumber = TIMETABLE_DAYS.indexOf(dayName) + 1;
            if (dayNumber < 1) return;
            reservationSlots.forEach((slot: any) => {
              teacherDoubleReservedSlotKeys.add(`${assignment.teacher_id}-${dayNumber}-${slot.id}`);
            });
          });
        });
        const overlaps = (startA: string, endA: string, startB: string, endB: string) =>
          toMinutes(startA) < toMinutes(endB) && toMinutes(endA) > toMinutes(startB);
        const matchesTarget = (activity: ScheduledActivity, cls: any) => {
          const target = String(activity.target_classes || 'All').trim().toLowerCase();
          if (!target || target === 'all') return true;
          const className = String(cls.name || '').toLowerCase();
          const grade = Number(cls.grade_level ?? cls.level);
          const isPrimary = (grade >= -3 && grade <= 6) || /grade\s*[1-6]\b|playgroup|pp\s*[12]|pre[\s-]?primary/.test(className);
          const isJunior = (grade >= 7 && grade <= 9) || /grade\s*[789]\b|junior|jss/.test(className);
          const isSenior = (grade >= 10 && grade <= 12) || /grade\s*(10|11|12)\b|senior/.test(className);
          if (target.includes('primary') && isPrimary) return true;
          if (target.includes('junior') && isJunior) return true;
          if (target.includes('senior') && isSenior) return true;
          return target.split(',').some(part => {
            const token = part.trim();
            const gradeToken = token.match(/grade\s*\d+/)?.[0];
            return token && (className.includes(token) || token.includes(className) || (gradeToken && className.includes(gradeToken)));
          });
        };

        const getDaySlotTiming = (day: number, cls: any) => {
          const matchingActivities = freshActivities.filter((activity) =>
            activity.day_of_week === day &&
            activityMatchesLevel(activity.target_level_group, levelKey) &&
            matchesTarget(activity, cls)
          );
          const rawBlockingActivities = matchingActivities.filter(activityBlocksLessons);
          // The shared level clock is fixed for every class and day. Activities
          // reserve entries in this clock; they never shift breaks or lunch.
          // Normalize an in-lesson activity to the exact duration of the one
          // lesson slot it owns, so an old 60-minute PPI row cannot block two
          // lesson positions in a 35- or 40-minute level structure.
          const blockingActivities = rawBlockingActivities.map((activity) => {
            const lessonSlot = resolveActivityLessonSlot(baseSlots, activity);
            return lessonSlot
              ? { ...activity, start_time: lessonSlot.start_time, end_time: lessonSlot.end_time }
              : activity;
          });
          const times = new Map<string, { start_time: string; end_time: string }>();
          baseSlots.forEach((slot: any) => times.set(String(slot.label), {
            start_time: slot.start_time,
            end_time: slot.end_time,
          }));
          return { matchingActivities, blockingActivities, times };
        };

        // Fill breaks, lunch, post-school activity windows, and in-lesson
        // activities. A blocking activity inside the lesson structure replaces
        // one existing lesson slot instead of creating a new column.
        for (const cls of classesToProcess) {
          for (let day = 1; day <= 5; day++) {
            const { blockingActivities: dayActivities, times: daySlotTimes } = getDaySlotTiming(day, cls);
            const lessonActivitiesByOrder = new Map<number, ScheduledActivity[]>();
            dayActivities.forEach((activity) => {
              const lessonSlot = resolveActivityLessonSlot(baseSlots, activity);
              if (!lessonSlot) return;
              const order = Number(lessonSlot.slot_order);
              const existing = lessonActivitiesByOrder.get(order) || [];
              existing.push(activity);
              lessonActivitiesByOrder.set(order, existing);
            });
            for (const slot of fixedSlots) {
              const isActivity = slot.slot_type === 'activities' || slot.slot_type === 'activity';
              const activitiesAtSlot = isActivity ? (activityMetaByOrder.get(Number(slot.slot_order)) || []) : [];
              const matchingActivities = activitiesAtSlot.filter((activity) =>
                activity.day_of_week === day && matchesTarget(activity, cls)
              );
              if (isActivity && matchingActivities.length === 0) continue;
              const effectiveTiming = isActivity
                ? { start_time: slot.start_time, end_time: slot.end_time }
                : (daySlotTimes.get(String(slot.label)) || { start_time: slot.start_time, end_time: slot.end_time });
              // Post-school activity segments are the only extra structural
              // slots. Mark them busy before lesson allocation.
              if (isActivity) {
                classBusy.add(`${cls.id}-${day}-${slot.id}`);
              }
              allEntries.push({
                school_id: schoolId,
                day_of_week: day,
                time_slot_id: slot.id,
                class_id: cls.id,
                level_group: levelKey,
                effective_start_time: effectiveTiming.start_time,
                effective_end_time: effectiveTiming.end_time,
                entry_type: isActivity ? 'activity' : slot.slot_type,
                activity_name: isActivity
                  ? (matchingActivities.map(a => a.activity_name.trim()).join(' / ') || config.activities?.[String(day)] || 'Activity')
                  : slot.label,
              });
            }
            for (const [slotOrder, scheduledAtLesson] of lessonActivitiesByOrder) {
              const lessonSlot = lessonSlots.find((slot: any) => Number(slot.slot_order) === slotOrder);
              if (!lessonSlot) continue;
              classBusy.add(`${cls.id}-${day}-${lessonSlot.id}`);
              allEntries.push({
                school_id: schoolId,
                day_of_week: day,
                time_slot_id: lessonSlot.id,
                class_id: cls.id,
                level_group: levelKey,
                effective_start_time: lessonSlot.start_time,
                effective_end_time: lessonSlot.end_time,
                entry_type: 'activity',
                activity_name: scheduledAtLesson.map((activity) => activity.activity_name.trim()).join(' / ') || 'Activity',
              });
            }
          }
        }

        // Allocate lessons. Priority assignments are processed first, so they
        // naturally receive the earliest available morning lesson slots.
        for (const cls of classesToProcess) {
          const classAssignments = assignments
            .filter(a => a.class_id === cls.id)
            .sort((a, b) => {
              const aName = String(a.subjects?.name || '').toLowerCase();
              const bName = String(b.subjects?.name || '').toLowerCase();
              const aBand = defaultBandFor(aName);
              const bBand = defaultBandFor(bName);
              const bandOrder: Record<string, number> = { early_morning: 0, mid_morning: 1, late_morning: 2, afternoon: 3, none: 4 };
              const coreOrder = (name: string) => /mathemat/.test(name) ? 0 : /english/.test(name) ? 1 : 2;
              const aSciencePriority = Boolean(aBand === 'mid_morning' && /integrated\s*science/.test(aName));
              const bSciencePriority = Boolean(bBand === 'mid_morning' && /integrated\s*science/.test(bName));
              const aDoublePriority = isEnabledFlag(a.is_double_lesson);
              const bDoublePriority = isEnabledFlag(b.is_double_lesson);
              const aLessons = Number(a.lessons_per_week || 0);
              const bLessons = Number(b.lessons_per_week || 0);
              // Hard priority bands must be allocated before ordinary subjects;
              // otherwise an unprioritized Maths/English assignment can consume
              // the only cells reserved for a prioritized subject in the same class.
              return (bandOrder[aBand] ?? 4) - (bandOrder[bBand] ?? 4)
                || Number(bDoublePriority) - Number(aDoublePriority)
                || Number(bSciencePriority) - Number(aSciencePriority)
                || coreOrder(aName) - coreOrder(bName)
                || bLessons - aLessons
                || aName.localeCompare(bName);
            });
          for (const assignment of classAssignments) {
            const lessonsToSchedule = Number(assignment.lessons_per_week || 0);
            const isDoubleLesson = isEnabledFlag(assignment.is_double_lesson);
            const rawAvailableDays = normalizeDayNames(assignment.available_days);
            const availableDays = rawAvailableDays.length > 0 ? rawAvailableDays : [...TIMETABLE_DAYS];
            const rawDoubleDays: string[] = [];
            // Only explicitly selected weekdays are double days. The Teacher
            // Assignments screen displays “Set double days” when the double flag
            // is on but no weekdays have been chosen; those lessons must remain
            // schedulable as singles instead of turning the whole week into pairs.
            const configuredDoubleDays = rawDoubleDays.length > 0
              ? rawDoubleDays.filter((day) => availableDays.includes(day))
              : [];
            const requiredDoubleDays = configuredDoubleDays.slice(0, Math.floor(lessonsToSchedule / 2));
            const subjectName = String(assignment.subjects?.name || '').toLowerCase();
            const isMath = /mathemat/.test(subjectName);
            const isScience = /integrated\s*science|science|environment/.test(subjectName);
            const priorityBand = defaultBandFor(subjectName);
            const preferredBandSlots = priorityBand === 'early_morning'
              ? prioritySlots.early_morning
              : priorityBand === 'mid_morning'
                ? prioritySlots.mid_morning
                : priorityBand === 'late_morning'
                  ? prioritySlots.late_morning
                  : priorityBand === 'afternoon'
                    ? prioritySlots.afternoon
                    : lessonSlots;
            // Mathematics and English PREFER their anchor lesson (Maths L1,
            // English L2) but may also use the other slot in the same priority
            // window when the anchor is occupied by another stream taught by the
            // same teacher. This keeps the subject inside its correct band instead
            // of silently dropping it whenever one teacher serves several parallel
            // classes (e.g. Grade 7/8/9 all needing English at L2).
            const defaultAnchor = getDefaultPriorityLesson(subjectName);
            const preferredLessonSlots = defaultAnchor
              ? [
                  ...preferredBandSlots.filter((slot: any) => lessonNumberOf(slot) === defaultAnchor),
                  ...preferredBandSlots.filter((slot: any) => lessonNumberOf(slot) !== defaultAnchor),
                ]
              : preferredBandSlots;
            const hasExplicitPriority = priorityBand !== 'none';
            // An explicit band with zero slots is a real configuration
            // conflict, not permission to spill into another band.
            const candidateLessonSlots = preferredLessonSlots.length > 0 || !hasExplicitPriority
              ? (preferredLessonSlots.length > 0 ? preferredLessonSlots : lessonSlots)
              : [];
            let scheduled = 0;
            // A double lesson is an atomic unit. We validate the whole pair before
            // mutating either busy set or adding either entry, so a conflict can
            // never leave a half-scheduled practical block behind.
            const tryPlaceUnit = (
              startSlot: any,
              day: number,
              dayActivities: ScheduledActivity[],
              daySlotTimes: Map<string, { start_time: string; end_time: string }>,
              unitSize: 1 | 2,
            ): number => {
              const secondSlot = unitSize === 2 ? nextLessonById.get(String(startSlot.id)) : null;
              if (unitSize === 2 && !secondSlot) return 0;
              // Configured double days are preferred anchors, not an impossible
              // hard constraint. If two double assignments share a teacher on
              // the same configured day, the pair must move as a whole to
              // another available day rather than leaving the timetable blank.
              if (unitSize === 2 && !isDoubleLesson) return 0;
              if (unitSize === 2 && !isValidDoubleLessonPair(subjectName, startSlot, secondSlot)) return 0;
              if (!canUseAssignmentDay(placementContext.dayUsage, day, isDoubleLesson, lessonsToSchedule, unitSize)) return 0;
              if (unitSize === 1 && teacherDoubleReservedSlotKeys.has(`${assignment.teacher_id}-${day}-${startSlot.id}`)) return 0;
              const unitSlots = secondSlot ? [startSlot, secondSlot] : [startSlot];
              const subjectDayKey = `${cls.id}-${day}-${assignment.subject_id}`;
              const subjectAlreadyUsedToday = (subjectDayUsage.get(subjectDayKey) || 0) > 0;
              // A subject may appear only once per day. A configured double is
              // still one lesson occurrence occupying two consecutive cells.
              if (subjectAlreadyUsedToday) return 0;
              const timings = unitSlots.map((slot: any) =>
                daySlotTimes.get(String(slot.label)) || { start_time: slot.start_time, end_time: slot.end_time },
              );

              const keys = unitSlots.map((slot: any) => ({
                teacherKey: `${assignment.teacher_id}-${day}-${slot.id}`,
                classKey: `${cls.id}-${day}-${slot.id}`,
              }));
              if (keys.some(({ teacherKey, classKey }) => teacherBusy.has(teacherKey) || classBusy.has(classKey))) return 0;
              if (dayActivities.some((activity) => timings.some((timing) =>
                overlaps(timing.start_time, timing.end_time, activity.start_time, activity.end_time)))) return 0;

              const previousLesson = lessonSlots
                .filter((slot: any) => slot.slot_order < startSlot.slot_order)
                .sort((a: any, b: any) => b.slot_order - a.slot_order)[0];
              const earlier = previousLesson ? classSubjectBySlot.get(`${cls.id}-${day}-${previousLesson.id}`) : undefined;
              const finalSlot = unitSlots[unitSlots.length - 1];
              const nextLesson = lessonSlots
                .filter((slot: any) => slot.slot_order > finalSlot.slot_order)
                .sort((a: any, b: any) => a.slot_order - b.slot_order)[0];
              const later = nextLesson ? classSubjectBySlot.get(`${cls.id}-${day}-${nextLesson.id}`) : undefined;
              // Mathematics and Science may not be adjacent in either order.
              // The check applies to both sides of a placement unit so repair
              // passes cannot reintroduce the forbidden sequence.
              if (
                violatesMathScienceSequence(subjectName, earlier)
                || violatesMathScienceSequence(subjectName, later)
              ) return 0;

              // FINAL STRICT placement windows (L1-2 Math/English, L3-5
              // Science/Pre-Tech, Kiswahili L5-7). Every slot of a unit must
              // honour its subject family, otherwise the unit is rejected.
              if (
                !unitSlots.every((slot: any) => strictSubjectAllowsLesson(subjectName, lessonNumberOf(slot)))
              ) return 0;

              unitSlots.forEach((slot: any, index: number) => {
                const timing = timings[index];
                allEntries.push({
                  school_id: schoolId,
                  day_of_week: day,
                  time_slot_id: slot.id,
                  class_id: cls.id,
                  level_group: levelKey,
                  effective_start_time: timing.start_time,
                  effective_end_time: timing.end_time,
                  subject_id: assignment.subject_id,
                  teacher_id: assignment.teacher_id,
                  entry_type: unitSize === 2 ? 'lesson_double' : 'lesson',
                });
                teacherBusy.add(keys[index].teacherKey);
                classBusy.add(keys[index].classKey);
                classSubjectBySlot.set(keys[index].classKey, subjectName);
              });
              placementRecords.push({
                context: placementContext,
                unitSize,
                day,
                slots: unitSlots,
                classKeys: keys.map(({ classKey }) => classKey),
                teacherKeys: keys.map(({ teacherKey }) => teacherKey),
                entries: allEntries.slice(-unitSlots.length),
                subjectDayKey,
              });
              subjectDayUsage.set(subjectDayKey, (subjectDayUsage.get(subjectDayKey) || 0) + unitSize);
              placementContext.dayUsage.set(day, (placementContext.dayUsage.get(day) || 0) + 1);
              if (unitSize === 2 && requiredDoubleDays.length > 0) {
                // A pair placed on a fallback weekday still fulfils the one
                // configured double unit for this assignment.
                const requirement = requiredDoubleDays.find((doubleDay) => !placementContext.placedDoubleDays.has(doubleDay));
                if (requirement) placementContext.placedDoubleDays.add(requirement);
              }
              return unitSize;
            };

            const rotation = stableRotation(`${levelKey}:${cls.id}:${assignment.subject_id}:${assignment.teacher_id}`);
            const preferredSlotIds = new Set<string>(preferredLessonSlots.map((preferred: any) => String(preferred.id)));
            const placementContext: AssignmentPlacementContext = {
              assignmentKey: `${levelKey}:${cls.id}:${assignment.subject_id}:${assignment.teacher_id}`,
              assignment,
              cls,
              levelKey,
              subjectName,
              isMath,
              isScience,
              priorityBand,
              preferredLessonSlots,
              availableDays,
              lessonsPerWeek: lessonsToSchedule,
              isDoubleLesson,
              configuredDoubleDays,
              requiredDoubleDays,
              placedDoubleDays: new Set<string>(),
              dayUsage: new Map<number, number>(),
              lessonSlots,
              nextLessonById,
              config,
              classSubjectBySlot,
              getDaySlotTiming,
            };
            assignmentContexts.set(placementContext.assignmentKey, placementContext);
            // When one teacher teaches the same learning area in multiple
            // classes, alternate the preferred column pattern by peer class.
            // This keeps Grade 8 and Grade 9 CRE from selecting the same L7/L8
            // cells and leaving one class with only a single lesson.
            const sameTeacherSubjectPeerIndex = assignments
              .filter((peer: any) => peer.teacher_id === assignment.teacher_id && peer.subject_id === assignment.subject_id)
              .sort((a: any, b: any) => String(a.class_id).localeCompare(String(b.class_id)))
              .findIndex((peer: any) => peer.class_id === assignment.class_id);
            const teacherSubjectSlotOffset = Math.max(0, sameTeacherSubjectPeerIndex);
            const schedulePass = (
              slotsToTry: any[],
              skipPreferredStarts: boolean,
              rotationOffset: number,
              allowRepeatedDays: boolean,
            ) => {
              // Reserve configured double-lesson weekdays for pair placement, then
              // rotate the deterministic search order per class/subject/teacher.
              // For non-double assignments, every unused weekday is exhausted before
              // a fallback pass is allowed to reuse a day.
              const baseDayOrder = [1, 2, 3, 4, 5].sort((a, b) => {
                const aName = TIMETABLE_DAYS[a - 1];
                const bName = TIMETABLE_DAYS[b - 1];
                const aDoubleDay = isDoubleLesson && configuredDoubleDays.includes(aName);
                const bDoubleDay = isDoubleLesson && configuredDoubleDays.includes(bName);
                return Number(bDoubleDay) - Number(aDoubleDay) || a - b;
              });
              const dayOrder = orderAssignmentDays(
                baseDayOrder,
                placementContext.dayUsage,
                rotationOffset,
                allowRepeatedDays,
              );

              for (const day of dayOrder) {
                if (scheduled >= lessonsToSchedule) break;
                // Rotate preferred columns by weekday. This prevents a five-
                // lesson afternoon subject from occupying the same L7/L8
                // column every day and blocking another class’s CRE teacher.
                const rotatedSlots = rotateList(slotsToTry, rotationOffset + day + teacherSubjectSlotOffset);
                const dayName = TIMETABLE_DAYS[day - 1];
                if (!availableDays.includes(dayName)) continue;
                const pendingConfiguredDouble = false;
                // Try configured double days first. If a configured day is
                // unavailable because of a teacher/class conflict, the atomic
                // pair is allowed to move to another available weekday.
                const { blockingActivities: dayActivities, times: daySlotTimes } = getDaySlotTiming(day, cls);
                for (const slot of rotatedSlots) {
                  if (shouldSkipPreferredSlot(skipPreferredStarts, preferredSlotIds, lessonSlots.length, String(slot.id))) continue;
                  // A configured double day is an atomic pair. It may not be
                  // downgraded to one lesson when the pair is still required.
                  const preferredUnitSize: 1 | 2 = isDoubleLesson && scheduled + 2 <= lessonsToSchedule ? 2 : 1;
                  let placed = tryPlaceUnit(slot, day, dayActivities, daySlotTimes, preferredUnitSize);
                  if (placed === 0 && isDoubleLesson && scheduled + 2 <= lessonsToSchedule) continue;
                  if (placed > 0) {
                    scheduled += placed;
                    break;
                  }
                }
              }
            };

            schedulePass(candidateLessonSlots, false, rotation % 5, false);
            // If the preferred band cannot fit all weekly lessons because of
            // teacher/class conflicts, fill remaining units in other slots
            // rather than silently dropping the subject.
            if (scheduled < lessonsToSchedule) {
              // Explicit priority and the two core subject anchors are hard
              // placement windows. Retry within the selected cells, but never
              // move them into another band or lesson number during fallback.
              const hasHardPlacement = hasExplicitPriority || defaultAnchor !== null;
              schedulePass(
                hasHardPlacement ? candidateLessonSlots : lessonSlots,
                hasHardPlacement ? false : true,
                (rotation + 2) % 5,
                true,
              );
            }
            if (scheduled < lessonsToSchedule) {
              // Over-capacity spill (approved behaviour). When a shared teacher
              // physically cannot fit every lesson inside the subject's priority
              // window (e.g. English 5 lessons/week x 3 streams but only two
              // early-morning teacher slots per day), place the remaining lessons
              // in the next available free periods instead of leaving the class
              // blank. Every spilled lesson is surfaced as a generation note so
              // administrators can rebalance staff for the next term.
              schedulePass(orderedSpillSlotsFor(priorityBand), true, (rotation + 4) % 5, true);
            }
            if (scheduled < lessonsToSchedule) {
              const teacher = assignment.teachers;
              const teacherName = [teacher?.first_name, teacher?.last_name].filter(Boolean).join(' ') || `Teacher ${assignment.teacher_id}`;
              underScheduled.push({
                className: `${cls.name || 'Class'}${cls.stream ? ` (${cls.stream})` : ''}`,
                subjectName: String(assignment.subjects?.name || 'Learning area'),
                teacherName,
                priorityBand,
                configured: lessonsToSchedule,
                scheduled,
                assignmentKey: placementContext.assignmentKey,
              });
            }
          }
        }

        const removePlacement = (placement: LessonPlacementRecord) => {
          const currentDayUsage = placement.context.dayUsage.get(placement.day) || 0;
          if (currentDayUsage <= 1) placement.context.dayUsage.delete(placement.day);
          else placement.context.dayUsage.set(placement.day, currentDayUsage - 1);
          placement.entries.forEach((entry) => {
            const index = allEntries.indexOf(entry);
            if (index >= 0) allEntries.splice(index, 1);
          });
          placement.teacherKeys.forEach((key) => teacherBusy.delete(key));
          placement.classKeys.forEach((key) => {
            classBusy.delete(key);
            placement.context.classSubjectBySlot.delete(key);
          });
          const subjectDayCount = (subjectDayUsage.get(placement.subjectDayKey) || 0) - placement.unitSize;
          if (subjectDayCount > 0) subjectDayUsage.set(placement.subjectDayKey, subjectDayCount);
          else subjectDayUsage.delete(placement.subjectDayKey);
          const recordIndex = placementRecords.indexOf(placement);
          if (recordIndex >= 0) placementRecords.splice(recordIndex, 1);
        };

        const getUnitSlots = (context: AssignmentPlacementContext, startSlot: any, unitSize: 1 | 2) => {
          const secondSlot = unitSize === 2 ? context.nextLessonById.get(String(startSlot.id)) : null;
          if (unitSize === 2 && !secondSlot) return null;
          return secondSlot ? [startSlot, secondSlot] : [startSlot];
        };

          const canPlaceContextAt = (
            context: AssignmentPlacementContext,
            startSlot: any,
            day: number,
            unitSize: 1 | 2,
          ) => {
            const unitSlots = getUnitSlots(context, startSlot, unitSize);
            if (!unitSlots) return false;
            if (unitSize === 2 && !isValidDoubleLessonPair(context.subjectName, unitSlots[0], unitSlots[1])) return false;
            const subjectDayKey = `${context.cls.id}-${day}-${context.assignment.subject_id}`;
          const subjectAlreadyUsedToday = (subjectDayUsage.get(subjectDayKey) || 0) > 0;
          // A subject may appear only once per day. A configured double is
          // still one lesson occurrence occupying two consecutive cells.
          if (subjectAlreadyUsedToday) return false;
          const dayName = TIMETABLE_DAYS[day - 1];
          if (!context.availableDays.includes(dayName)) return false;
            if (unitSize === 2 && !context.isDoubleLesson) return false;
          if (!canUseAssignmentDay(context.dayUsage, day, context.isDoubleLesson, context.lessonsPerWeek, unitSize)) return false;
          if (unitSize === 1 && teacherDoubleReservedSlotKeys.has(`${context.assignment.teacher_id}-${day}-${startSlot.id}`)) return false;
          const { blockingActivities, times } = context.getDaySlotTiming(day, context.cls);
          const timings = unitSlots.map((slot: any) =>
            times.get(String(slot.label)) || { start_time: slot.start_time, end_time: slot.end_time },
          );
          const keys = unitSlots.map((slot: any) => ({
            teacherKey: `${context.assignment.teacher_id}-${day}-${slot.id}`,
            classKey: `${context.cls.id}-${day}-${slot.id}`,
          }));
          if (keys.some(({ teacherKey, classKey }) => teacherBusy.has(teacherKey) || classBusy.has(classKey))) return false;
          if (blockingActivities.some((activity) => timings.some((timing) =>
            overlaps(timing.start_time, timing.end_time, activity.start_time, activity.end_time)))) return false;

          const previousLesson = context.lessonSlots
            .filter((slot: any) => slot.slot_order < startSlot.slot_order)
            .sort((a: any, b: any) => b.slot_order - a.slot_order)[0];
          const earlier = previousLesson
            ? context.classSubjectBySlot.get(`${context.cls.id}-${day}-${previousLesson.id}`)
            : undefined;
          const finalSlot = unitSlots[unitSlots.length - 1];
          const nextLesson = context.lessonSlots
            .filter((slot: any) => slot.slot_order > finalSlot.slot_order)
            .sort((a: any, b: any) => a.slot_order - b.slot_order)[0];
          const later = nextLesson
            ? context.classSubjectBySlot.get(`${context.cls.id}-${day}-${nextLesson.id}`)
            : undefined;
          if (
            violatesMathScienceSequence(context.subjectName, earlier)
            || violatesMathScienceSequence(context.subjectName, later)
          ) return false;
          if (!unitSlots.every((slot: any) => strictSubjectAllowsLesson(context.subjectName, lessonNumberOf(slot)))) return false;
          return true;
        };

        const addPlacementAt = (
          context: AssignmentPlacementContext,
          startSlot: any,
          day: number,
          unitSize: 1 | 2,
        ): LessonPlacementRecord | null => {
          const unitSlots = getUnitSlots(context, startSlot, unitSize);
          if (!unitSlots || !canPlaceContextAt(context, startSlot, day, unitSize)) return null;
          const { times } = context.getDaySlotTiming(day, context.cls);
          const entries = unitSlots.map((slot: any) => {
            const timing = times.get(String(slot.label)) || { start_time: slot.start_time, end_time: slot.end_time };
            return {
              school_id: schoolId,
              day_of_week: day,
              time_slot_id: slot.id,
              class_id: context.cls.id,
              level_group: context.levelKey,
              effective_start_time: timing.start_time,
              effective_end_time: timing.end_time,
              subject_id: context.assignment.subject_id,
              teacher_id: context.assignment.teacher_id,
              entry_type: unitSize === 2 ? 'lesson_double' : 'lesson',
            };
          });
          const classKeys = unitSlots.map((slot: any) => `${context.cls.id}-${day}-${slot.id}`);
          const teacherKeys = unitSlots.map((slot: any) => `${context.assignment.teacher_id}-${day}-${slot.id}`);
          const subjectDayKey = `${context.cls.id}-${day}-${context.assignment.subject_id}`;
          allEntries.push(...entries);
          teacherKeys.forEach((key) => teacherBusy.add(key));
          classKeys.forEach((key) => {
            classBusy.add(key);
            context.classSubjectBySlot.set(key, context.subjectName);
          });
          subjectDayUsage.set(subjectDayKey, (subjectDayUsage.get(subjectDayKey) || 0) + unitSize);
          context.dayUsage.set(day, (context.dayUsage.get(day) || 0) + 1);
          const placement = { context, unitSize, day, slots: unitSlots, classKeys, teacherKeys, entries, subjectDayKey };
          placementRecords.push(placement);
          return placement;
        };

        const orderedRepairSlots = (context: AssignmentPlacementContext) => {
          const preferred = context.preferredLessonSlots;
          const preferredIds = new Set(preferred.map((slot: any) => String(slot.id)));
          const remainingSlots = context.lessonSlots.filter((slot: any) => !preferredIds.has(String(slot.id)));
          const combined = [...preferred, ...remainingSlots];
          if (context.priorityBand === 'late_morning') {
            return combined.filter((slot: any) => lessonNumberOf(slot) <= 7);
          }
          return combined;
        };

        const tryRepairGap = (gap: typeof underScheduled[number]) => {
          const context = assignmentContexts.get(gap.assignmentKey);
          if (!context) return;
          const repairSlots = orderedRepairSlots(context);
          let guard = 0;
          while (gap.scheduled < gap.configured && guard < context.lessonSlots.length * TIMETABLE_DAYS.length * 2) {
            guard += 1;
            let repaired = false;
            const remaining = gap.configured - gap.scheduled;
            const dayOrder = [
              ...orderAssignmentDays([1, 2, 3, 4, 5], context.dayUsage, 0, false),
              ...orderAssignmentDays([1, 2, 3, 4, 5], context.dayUsage, 0, true)
                .filter((day) => !orderAssignmentDays([1, 2, 3, 4, 5], context.dayUsage, 0, false).includes(day)),
            ];
            for (const day of dayOrder) {
              if (repaired) break;
              const dayName = TIMETABLE_DAYS[day - 1];
              if (!context.availableDays.includes(dayName)) continue;
              const pendingRequiredDouble = context.requiredDoubleDays.some((doubleDay) => !context.placedDoubleDays.has(doubleDay));
              const onConfiguredDoubleDay = context.isDoubleLesson && context.requiredDoubleDays.includes(dayName);
              if (pendingRequiredDouble && !onConfiguredDoubleDay) continue;
              if (onConfiguredDoubleDay && remaining < 2) continue;
              const desiredUnit: 1 | 2 = onConfiguredDoubleDay ? 2 : 1;
              for (const slot of repairSlots) {
                if (canPlaceContextAt(context, slot, day, desiredUnit)) {
                  if (addPlacementAt(context, slot, day, desiredUnit)) {
                    gap.scheduled += desiredUnit;
                    repaired = true;
                    break;
                  }
                }

                // If the target class period is occupied by a lesson and the
                // target teacher is also occupied, move that single lesson to a
                // different valid period, then fill the target period.
                if (desiredUnit !== 1) continue;
                const targetClassKey = `${context.cls.id}-${day}-${slot.id}`;
                const targetTeacherKey = `${context.assignment.teacher_id}-${day}-${slot.id}`;
                const blockers = placementRecords.filter((placement) =>
                  placement.context.levelKey === context.levelKey
                  && (placement.classKeys.includes(targetClassKey) || placement.teacherKeys.includes(targetTeacherKey))
                );
                const uniqueBlockers = blockers.filter((placement, index) => blockers.indexOf(placement) === index);
                if (uniqueBlockers.length !== 1 || uniqueBlockers[0].unitSize !== 1) continue;
                const blocker = uniqueBlockers[0];
                const originalDay = blocker.day;
                const originalSlot = blocker.slots[0];
                removePlacement(blocker);
                const targetPlacement = addPlacementAt(context, slot, day, 1);
                if (targetPlacement) {
                  let blockerMoved = false;
                  for (const blockerDay of [1, 2, 3, 4, 5]) {
                    if (blockerMoved) break;
                    for (const blockerSlot of orderedRepairSlots(blocker.context)) {
                      if (blockerDay === originalDay && String(blockerSlot.id) === String(originalSlot.id)) continue;
                      if (canPlaceContextAt(blocker.context, blockerSlot, blockerDay, 1)
                        && addPlacementAt(blocker.context, blockerSlot, blockerDay, 1)) {
                        blockerMoved = true;
                        break;
                      }
                    }
                  }
                  if (blockerMoved) {
                    gap.scheduled += 1;
                    repaired = true;
                    break;
                  }
                  removePlacement(targetPlacement);
                }
                addPlacementAt(blocker.context, originalSlot, originalDay, 1);
              }
            }
            if (!repaired) break;
          }
        };

        // Repair every known shortfall before persisting entries. A repaired
        // warning is updated to its final count and is not shown as an error.
        underScheduled.forEach(tryRepairGap);

        const restorePlacement = (placement: LessonPlacementRecord) => {
          allEntries.push(...placement.entries);
          placement.teacherKeys.forEach((key) => teacherBusy.add(key));
          placement.classKeys.forEach((key) => {
            classBusy.add(key);
            placement.context.classSubjectBySlot.set(key, placement.context.subjectName);
          });
          subjectDayUsage.set(placement.subjectDayKey, (subjectDayUsage.get(placement.subjectDayKey) || 0) + placement.unitSize);
          placement.context.dayUsage.set(placement.day, (placement.context.dayUsage.get(placement.day) || 0) + 1);
          placementRecords.push(placement);
        };

        const normalizeNonDoubleDayDistribution = (context: AssignmentPlacementContext) => {
          // Five-or-fewer non-double lessons should normally occupy distinct
          // weekdays. Only move a lesson when an unused valid weekday has a
          // conflict-free slot; otherwise retain the safe existing placement.
          if (context.isDoubleLesson || context.lessonsPerWeek > TIMETABLE_DAYS.length) return;
          const availableDayNumbers = context.availableDays
            .map((dayName) => TIMETABLE_DAYS.indexOf(dayName) + 1)
            .filter((day) => day > 0);
          let guard = 0;
          while (guard < context.lessonsPerWeek * TIMETABLE_DAYS.length) {
            guard += 1;
            const repeatedDay = availableDayNumbers
              .filter((day) => (context.dayUsage.get(day) || 0) > 1)
              .sort((a, b) => (context.dayUsage.get(b) || 0) - (context.dayUsage.get(a) || 0))[0];
            if (!repeatedDay) break;

            const unusedDays = orderAssignmentDays(availableDayNumbers, context.dayUsage, 0, false);
            if (unusedDays.length === 0) break;
            const sourcePlacements = placementRecords
              .filter((placement) => placement.context === context && placement.unitSize === 1 && placement.day === repeatedDay)
              .sort((a, b) => Number(b.slots[0]?.slot_order || 0) - Number(a.slots[0]?.slot_order || 0));
            let moved = false;

            for (const sourcePlacement of sourcePlacements) {
              let target: { day: number; slot: any } | null = null;
              for (const day of unusedDays) {
                for (const slot of orderedRepairSlots(context)) {
                  if (canPlaceContextAt(context, slot, day, 1)) {
                    target = { day, slot };
                    break;
                  }
                }
                if (target) break;
              }
              if (!target) continue;

              removePlacement(sourcePlacement);
              const replacement = addPlacementAt(context, target.slot, target.day, 1);
              if (replacement) {
                moved = true;
                break;
              }
              restorePlacement(sourcePlacement);
            }
            if (!moved) break;
          }
        };

        assignmentContexts.forEach(normalizeNonDoubleDayDistribution);

        const commitFill = (
          context: AssignmentPlacementContext,
          gap: typeof underScheduled[number],
          cls: any,
          fillDay: number,
          fillSlot: any,
          timing: { start_time: string; end_time: string },
          teacherKey: string,
          fillClassKey: string,
        ) => {
          allEntries.push({
            school_id: schoolId,
            day_of_week: fillDay,
            time_slot_id: fillSlot.id,
            class_id: cls.id,
            level_group: levelKey,
            effective_start_time: timing.start_time,
            effective_end_time: timing.end_time,
            subject_id: context.assignment.subject_id,
            teacher_id: context.assignment.teacher_id,
            entry_type: 'lesson',
          });
          teacherBusy.add(teacherKey);
          classBusy.add(fillClassKey);
          classSubjectBySlot.set(fillClassKey, context.subjectName);
          const subjectDayKey = `${cls.id}-${fillDay}-${context.assignment.subject_id}`;
          subjectDayUsage.set(subjectDayKey, (subjectDayUsage.get(subjectDayKey) || 0) + 1);
          const currentDayUsage = context.dayUsage.get(fillDay) || 0;
          context.dayUsage.set(fillDay, currentDayUsage + 1);
          gap.scheduled += 1;
        };

        // GUARANTEED-FILL PASS — a generated timetable must never contain a
        // blank lesson slot. Priority bands were honoured during the main
        // pass, so anything still open here is unavoidable overflow: place the
        // remaining under-scheduled lessons as singles into their class's free
        // cells. A non-adjacent, once-per-day placement is tried first; only
        // when none exists do the math/science adjacency and once-per-day
        // rules relax, so completion is always achieved.
        let fillProgress = true;
        while (fillProgress) {
          fillProgress = false;
          for (const cls of classesToProcess) {
            const classGaps = underScheduled.filter((gap) =>
              gap.assignmentKey.startsWith(`${levelKey}:${cls.id}:`) && gap.scheduled < gap.configured,
            );
            if (classGaps.length === 0) continue;
            for (let fillDay = 1; fillDay <= TIMETABLE_DAYS.length; fillDay++) {
              const fillDayName = TIMETABLE_DAYS[fillDay - 1];
              for (const fillSlot of lessonSlots) {
                const fillClassKey = `${cls.id}-${fillDay}-${fillSlot.id}`;
                if (classBusy.has(fillClassKey)) continue;
                let placed = false;
                // Phase A: strict (non-adjacent + once-per-day) placement.
                for (const gap of classGaps) {
                  const context = assignmentContexts.get(gap.assignmentKey);
                  if (!context || !context.availableDays.includes(fillDayName)) continue;
                  if (context.requiredDoubleDays.some((doubleDay) => !context.placedDoubleDays.has(doubleDay))) continue;
                  if (!bandAllowsSlot(context.priorityBand, fillSlot)) continue;
                  if (!strictSubjectAllowsLesson(context.subjectName, lessonNumberOf(fillSlot))) continue;
                  if (subjectDayUsage.get(`${cls.id}-${fillDay}-${context.assignment.subject_id}`)) continue;
                  const teacherKey = `${context.assignment.teacher_id}-${fillDay}-${fillSlot.id}`;
                  if (teacherBusy.has(teacherKey)) continue;
                  const previousSlot = context.lessonSlots
                    .filter((slot: any) => slot.slot_order < fillSlot.slot_order)
                    .sort((a: any, b: any) => b.slot_order - a.slot_order)[0];
                  const earlier = previousSlot ? classSubjectBySlot.get(`${cls.id}-${fillDay}-${previousSlot.id}`) : undefined;
                  const nextSlot = context.lessonSlots
                    .filter((slot: any) => slot.slot_order > fillSlot.slot_order)
                    .sort((a: any, b: any) => a.slot_order - b.slot_order)[0];
                  const later = nextSlot ? classSubjectBySlot.get(`${cls.id}-${fillDay}-${nextSlot.id}`) : undefined;
                  if (violatesMathScienceSequence(context.subjectName, earlier) || violatesMathScienceSequence(context.subjectName, later)) continue;
                  const { blockingActivities, times } = context.getDaySlotTiming(fillDay, context.cls);
                  const timing = times.get(String(fillSlot.label)) || { start_time: fillSlot.start_time, end_time: fillSlot.end_time };
                  if (blockingActivities.some((activity) => overlaps(timing.start_time, timing.end_time, activity.start_time, activity.end_time))) continue;
                  commitFill(context, gap, cls, fillDay, fillSlot, timing, teacherKey, fillClassKey);
                  placed = true;
                  fillProgress = true;
                  break;
                }
                // Phase B: relax once-per-day as a last resort, but keep the
                // Math/Science adjacency and priority-band rules hard. A blank
                // period must be filled without ever placing Maths next to
                // Science or an Early Morning subject in the afternoon.
                if (!placed) {
                for (const gap of classGaps) {
                  const context = assignmentContexts.get(gap.assignmentKey);
                  if (!context || !context.availableDays.includes(fillDayName)) continue;
                  if (context.requiredDoubleDays.some((doubleDay) => !context.placedDoubleDays.has(doubleDay))) continue;
                  if (!bandAllowsSlot(context.priorityBand, fillSlot)) continue;
                  if (!strictSubjectAllowsLesson(context.subjectName, lessonNumberOf(fillSlot))) continue;
                  if (subjectDayUsage.get(`${cls.id}-${fillDay}-${context.assignment.subject_id}`)) continue;
                  const teacherKey = `${context.assignment.teacher_id}-${fillDay}-${fillSlot.id}`;
                    if (teacherBusy.has(teacherKey)) continue;
                    const prevForB = context.lessonSlots
                      .filter((slot: any) => slot.slot_order < fillSlot.slot_order)
                      .sort((a: any, b: any) => b.slot_order - a.slot_order)[0];
                    const earlierB = prevForB ? classSubjectBySlot.get(`${cls.id}-${fillDay}-${prevForB.id}`) : undefined;
                    const nextForB = context.lessonSlots
                      .filter((slot: any) => slot.slot_order > fillSlot.slot_order)
                      .sort((a: any, b: any) => a.slot_order - b.slot_order)[0];
                    const laterB = nextForB ? classSubjectBySlot.get(`${cls.id}-${fillDay}-${nextForB.id}`) : undefined;
                    if (violatesMathScienceSequence(context.subjectName, earlierB) || violatesMathScienceSequence(context.subjectName, laterB)) continue;
                    const { blockingActivities, times } = context.getDaySlotTiming(fillDay, context.cls);
                    const timing = times.get(String(fillSlot.label)) || { start_time: fillSlot.start_time, end_time: fillSlot.end_time };
                    if (blockingActivities.some((activity) => overlaps(timing.start_time, timing.end_time, activity.start_time, activity.end_time))) continue;
                    commitFill(context, gap, cls, fillDay, fillSlot, timing, teacherKey, fillClassKey);
                    placed = true;
                    fillProgress = true;
                    break;
                  }
                }
              }
            }
          }
        }

        const generatedSubjectNames = new Map<string, string>();
        assignments
          .filter((assignment: any) => classesInLevel.has(String(assignment.class_id)))
          .forEach((assignment: any) => generatedSubjectNames.set(String(assignment.subject_id), String(assignment.subjects?.name || '')));

        {
          // ================================================================
          // RECONCILIATION PASS — guarantee EXACT lesson counts so a
          // regenerated timetable has no blank cells and no over/under
          // assignment. Trim over-scheduled lessons (freeing cells), then
          // backfill under-scheduled subjects into the nearest valid periods
          // in priority order. Operates on the authoritative entry array.
          // ================================================================
          const isLessonEntry = (e: any) => e.entry_type === 'lesson' || e.entry_type === 'lesson_double';
          const otherEntries = allEntries.filter((e: any) => !(e.level_group === levelKey && isLessonEntry(e)));
          let reconEntries = allEntries.filter((e: any) => e.level_group === levelKey && isLessonEntry(e));

          const reconSubjectName = new Map<string, string>();
          const reconSubjectMeta = new Map<string, { teacherId: string; availableDays: string[]; band: string }>();
          const reconDemand = new Map<string, number>();
          assignments
            .filter((a: any) => classesInLevel.has(String(a.class_id)))
            .forEach((a: any) => {
              reconSubjectName.set(String(a.subject_id), String(a.subjects?.name || ''));
              reconSubjectMeta.set(`${a.class_id}:${a.subject_id}`, {
                teacherId: a.teacher_id,
                availableDays: normalizeDayNames(a.available_days),
                band: defaultBandFor(String(a.subjects?.name || '')),
              });
              const k = `${a.class_id}:${a.subject_id}`;
              reconDemand.set(k, (reconDemand.get(k) || 0) + Math.max(0, Number(a.lessons_per_week || 0)));
            });

          const reconSlotOrder = new Map<string, number>();
          lessonSlots.forEach((slot: any) => reconSlotOrder.set(String(slot.id), slot.slot_order));

          // 1) Remove over-scheduled lessons: drop the latest-slot placements
          //    (afternoon/evening spill) first, keeping the priority-band core.
          const reconGrouped = new Map<string, any[]>();
          reconEntries.forEach((e: any) => {
            const k = `${e.class_id}:${e.subject_id}`;
            const list = reconGrouped.get(k) || [];
            list.push(e);
            reconGrouped.set(k, list);
          });
          for (const [key, recs] of reconGrouped.entries()) {
            const dm = reconDemand.get(key) || 0;
            if (recs.length <= dm) continue;
            recs.sort((a: any, b: any) => (reconSlotOrder.get(String(b.time_slot_id)) || 0) - (reconSlotOrder.get(String(a.time_slot_id)) || 0));
            const excess = recs.length - dm;
            const dropEntries: any[] = [];
            const assignmentContext = [...assignmentContexts.values()].find((candidate) =>
              String(candidate.cls.id) === String(recs[0]?.class_id)
              && String(candidate.assignment.subject_id) === String(recs[0]?.subject_id),
            );
            // Trim normal single lessons first. A lesson_double row is never
            // eligible for independent removal.
            dropEntries.push(...recs.filter((entry: any) => entry.entry_type !== 'lesson_double').slice(0, excess));
            let remainingToDrop = excess - dropEntries.length;
            if (remainingToDrop > 0) {
              const doubleGroups = new Map<string, any[]>();
              recs.filter((entry: any) => entry.entry_type === 'lesson_double').forEach((entry: any) => {
                const unitKey = `${entry.day_of_week}:${entry.teacher_id || ''}`;
                const group = doubleGroups.get(unitKey) || [];
                group.push(entry);
                doubleGroups.set(unitKey, group);
              });
              for (const group of doubleGroups.values()) {
                if (remainingToDrop <= 0) break;
                dropEntries.push(...group);
                const removedDay = TIMETABLE_DAYS[Number(group[0]?.day_of_week) - 1];
                if (removedDay) assignmentContext?.placedDoubleDays.delete(removedDay);
                remainingToDrop -= group.length;
              }
            }
            const idsToDrop = new Set<any>(dropEntries);
            reconEntries = reconEntries.filter((e: any) => !idsToDrop.has(e));
          }

          // 2) Backfill under-scheduled subjects into freed / blank cells.
          const reconCellSubject = new Map<string, string>();
          const reconClassBusy = new Set<string>();
          const reconTeacherBusy = new Set<string>();
          const reconSubjectDay = new Map<string, number>();
          const slotById = new Map<string, any>(lessonSlots.map((s: any) => [String(s.id), s]));
          for (const e of reconEntries) {
            const slot = slotById.get(String(e.time_slot_id));
            if (!slot) continue;
            const day = e.day_of_week;
            const classKey = `${e.class_id}-${day}-${slot.id}`;
            reconClassBusy.add(classKey);
            if (e.teacher_id) reconTeacherBusy.add(`${e.teacher_id}-${day}-${slot.id}`);
            reconCellSubject.set(classKey, reconSubjectName.get(String(e.subject_id)) || '');
            const sdk = `${e.class_id}-${day}-${e.subject_id}`;
            reconSubjectDay.set(sdk, (reconSubjectDay.get(sdk) || 0) + 1);
          }

          const reconHave = new Map<string, number>();
          reconEntries.forEach((e: any) => {
            const k = `${e.class_id}:${e.subject_id}`;
            reconHave.set(k, (reconHave.get(k) || 0) + 1);
          });

          const orderedLessonSlots = lessonSlots.slice().sort((a: any, b: any) => (a.slot_order || 0) - (b.slot_order || 0));

          for (const [key, dm] of reconDemand.entries()) {
            const have = reconHave.get(key) || 0;
            if (have >= dm) continue;
            const [classId, subjectId] = key.split(':');
            const subjectName = reconSubjectName.get(subjectId) || '';
            const meta = reconSubjectMeta.get(key);
            const teacherId = meta?.teacherId;
            const assignmentContext = [...assignmentContexts.values()].find((candidate) =>
              String(candidate.cls.id) === classId && String(candidate.assignment.subject_id) === subjectId,
            );
            const pendingRequiredDouble = (assignmentContext?.requiredDoubleDays || [])
              .some((doubleDay) => !assignmentContext?.placedDoubleDays.has(doubleDay));
            const availDays = meta && meta.availableDays.length ? meta.availableDays : [...TIMETABLE_DAYS];
            const backfillSlots = orderedSpillSlotsFor(meta?.band || 'none');
            let deficit = dm - have;
            let guard = 0;
            while (deficit > 0 && guard++ < 300) {
              let placedNow = false;
              for (let day = 1; day <= TIMETABLE_DAYS.length; day++) {
                const dayName = TIMETABLE_DAYS[day - 1];
                if (!availDays.includes(dayName)) continue;
                if (pendingRequiredDouble) continue;
                for (const slot of backfillSlots) {
                  if (deficit <= 0) break;
                  const classKey = `${classId}-${day}-${slot.id}`;
                  if (reconClassBusy.has(classKey)) continue;
                  if (teacherId && reconTeacherBusy.has(`${teacherId}-${day}-${slot.id}`)) continue;
                  if (reconSubjectDay.get(`${classId}-${day}-${subjectId}`)) continue;
                  if (!strictSubjectAllowsLesson(subjectName, lessonNumberOf(slot))) continue;
                  const idx = orderedLessonSlots.findIndex((s: any) => String(s.id) === String(slot.id));
                  const prevSlot = idx > 0 ? orderedLessonSlots[idx - 1] : null;
                  const nextSlot = idx >= 0 && idx < orderedLessonSlots.length - 1 ? orderedLessonSlots[idx + 1] : null;
                  const prevSubj = prevSlot ? reconCellSubject.get(`${classId}-${day}-${prevSlot.id}`) : undefined;
                  const nextSubj = nextSlot ? reconCellSubject.get(`${classId}-${day}-${nextSlot.id}`) : undefined;
                  if (violatesMathScienceSequence(subjectName, prevSubj) || violatesMathScienceSequence(subjectName, nextSubj)) continue;
                  reconEntries.push({
                    school_id: schoolId,
                    day_of_week: day,
                    time_slot_id: slot.id,
                    class_id: classId,
                    level_group: levelKey,
                    effective_start_time: slot.start_time,
                    effective_end_time: slot.end_time,
                    subject_id: subjectId,
                    teacher_id: teacherId,
                    entry_type: 'lesson',
                  });
                  reconClassBusy.add(classKey);
                  if (teacherId) reconTeacherBusy.add(`${teacherId}-${day}-${slot.id}`);
                  reconCellSubject.set(classKey, subjectName);
                  reconSubjectDay.set(`${classId}-${day}-${subjectId}`, (reconSubjectDay.get(`${classId}-${day}-${subjectId}`) || 0) + 1);
                  deficit -= 1;
                  placedNow = true;
                }
              }
              if (!placedNow) break;
            }
          }


          // 3) LEGAL-MOVE CASCADE — resolve the remaining hard blanks where a
          //    short subject's only free cell is occupied by its own teacher
          //    (teaching another class). Relocate that one lesson to a legal
          //    free cell in its own class first, then fill the target cell.
          //    No rule is relaxed: teacher single-occupancy, once-per-day,
          //    Math/Science adjacency, band ceiling, and double pairing persist.
          const reconCellSubject2 = new Map<string, string>();
          const reconClassBusy2 = new Set<string>();
          const reconTeacherBusy2 = new Set<string>();
          const reconSubjectDay2 = new Map<string, number>();
          reconEntries.forEach((e: any) => {
            reconClassBusy2.add(`${e.class_id}-${e.day_of_week}-${e.time_slot_id}`);
            if (e.teacher_id) reconTeacherBusy2.add(`${e.teacher_id}-${e.day_of_week}-${e.time_slot_id}`);
            reconCellSubject2.set(`${e.class_id}-${e.day_of_week}-${e.time_slot_id}`, reconSubjectName.get(String(e.subject_id)) || '');
            const sdk = `${e.class_id}-${e.day_of_week}-${e.subject_id}`;
            reconSubjectDay2.set(sdk, (reconSubjectDay2.get(sdk) || 0) + 1);
          });
          const add2 = (e: any) => {
            reconClassBusy2.add(`${e.class_id}-${e.day_of_week}-${e.time_slot_id}`);
            if (e.teacher_id) reconTeacherBusy2.add(`${e.teacher_id}-${e.day_of_week}-${e.time_slot_id}`);
            reconCellSubject2.set(`${e.class_id}-${e.day_of_week}-${e.time_slot_id}`, reconSubjectName.get(String(e.subject_id)) || '');
            const sdk = `${e.class_id}-${e.day_of_week}-${e.subject_id}`;
            reconSubjectDay2.set(sdk, (reconSubjectDay2.get(sdk) || 0) + 1);
          };
          const del2 = (e: any) => {
            reconClassBusy2.delete(`${e.class_id}-${e.day_of_week}-${e.time_slot_id}`);
            if (e.teacher_id) reconTeacherBusy2.delete(`${e.teacher_id}-${e.day_of_week}-${e.time_slot_id}`);
            reconCellSubject2.delete(`${e.class_id}-${e.day_of_week}-${e.time_slot_id}`);
            const sdk = `${e.class_id}-${e.day_of_week}-${e.subject_id}`;
            const n = (reconSubjectDay2.get(sdk) || 0) - 1;
            if (n > 0) reconSubjectDay2.set(sdk, n); else reconSubjectDay2.delete(sdk);
          };
          const adjOk2 = (subjectName: string, classId: string, day: number, slotId: string) => {
            const idx = orderedLessonSlots.findIndex((s: any) => String(s.id) === slotId);
            if (idx < 0) return true;
            const prevSlot = idx > 0 ? orderedLessonSlots[idx - 1] : null;
            const nextSlot = idx >= 0 && idx < orderedLessonSlots.length - 1 ? orderedLessonSlots[idx + 1] : null;
            const prevSubj = prevSlot ? reconCellSubject2.get(`${classId}-${day}-${prevSlot.id}`) : undefined;
            const nextSubj = nextSlot ? reconCellSubject2.get(`${classId}-${day}-${nextSlot.id}`) : undefined;
            return !violatesMathScienceSequence(subjectName, prevSubj) && !violatesMathScienceSequence(subjectName, nextSubj);
          };
          for (const [key, dm] of reconDemand.entries()) {
            const haveMap = new Map<string, number>();
            reconEntries.forEach((e: any) => { const k = `${e.class_id}:${e.subject_id}`; haveMap.set(k, (haveMap.get(k) || 0) + 1); });
            const need = dm - (haveMap.get(key) || 0);
            if (need <= 0) continue;
            const [classId, subjectId] = key.split(':');
            const subjectName = reconSubjectName.get(subjectId) || '';
            const meta = reconSubjectMeta.get(key);
            const teacherId = meta?.teacherId;
            const assignmentContext = [...assignmentContexts.values()].find((candidate) =>
              String(candidate.cls.id) === classId && String(candidate.assignment.subject_id) === subjectId,
            );
            const pendingRequiredDouble = (assignmentContext?.requiredDoubleDays || [])
              .some((doubleDay) => !assignmentContext?.placedDoubleDays.has(doubleDay));
            const availDays = meta && meta.availableDays.length ? meta.availableDays : [...TIMETABLE_DAYS];
            let placed = 0;
            let guard = 0;
            while (placed < need && guard++ < 250) {
              let progressed = false;
              for (let day = 1; day <= TIMETABLE_DAYS.length && placed < need; day++) {
                const dayName = TIMETABLE_DAYS[day - 1];
                if (!availDays.includes(dayName)) continue;
                if (pendingRequiredDouble) continue;
                for (const slot of orderedLessonSlots) {
                  if (placed >= need) break;
                  const cellKey = `${classId}-${day}-${slot.id}`;
                  if (reconClassBusy2.has(cellKey)) continue;
                  if (reconSubjectDay2.get(`${classId}-${day}-${subjectId}`)) continue;
                  if (!teacherId) continue;
                  const teacherKey = `${teacherId}-${day}-${slot.id}`;
                  if (!reconTeacherBusy2.has(teacherKey)) {
                    if (meta?.band && !bandAllowsSlot(meta.band, slot)) continue;
                    if (!strictSubjectAllowsLesson(subjectName, lessonNumberOf(slot))) continue;
                    if (!adjOk2(subjectName, classId, day, slot.id)) continue;
                    const e2 = { school_id: schoolId, day_of_week: day, time_slot_id: slot.id, class_id: classId, level_group: levelKey, effective_start_time: slot.start_time, effective_end_time: slot.end_time, subject_id: subjectId, teacher_id: teacherId, entry_type: 'lesson' };
                    reconEntries.push(e2); add2(e2); placed += 1; progressed = true; continue;
                  }
                  // teacher busy here — find the blocker
                  const bi = reconEntries.findIndex((e: any) => e.teacher_id === teacherId && e.day_of_week === day && String(e.time_slot_id) === String(slot.id));
                  if (bi < 0) continue;
                  const blocker = reconEntries[bi];
                  const bKey = `${blocker.class_id}:${blocker.subject_id}`;
                  const bMeta = reconSubjectMeta.get(bKey);
                  const bDays = bMeta && bMeta.availableDays.length ? bMeta.availableDays : [...TIMETABLE_DAYS];
                  const bName = reconSubjectName.get(String(blocker.subject_id)) || '';
                  let moved = false;
                  for (let d2 = 1; d2 <= TIMETABLE_DAYS.length && !moved; d2++) {
                    const d2n = TIMETABLE_DAYS[d2 - 1];
                    if (!bDays.includes(d2n)) continue;
                    for (const s2 of orderedLessonSlots) {
                      if (d2 === day && String(s2.id) === String(slot.id)) continue;
                      if (bMeta?.band && !bandAllowsSlot(bMeta.band, s2)) continue;
                      if (!strictSubjectAllowsLesson(bName, lessonNumberOf(s2))) continue;
                      if (reconClassBusy2.has(`${blocker.class_id}-${d2}-${s2.id}`)) continue;
                      if (blocker.teacher_id && reconTeacherBusy2.has(`${blocker.teacher_id}-${d2}-${s2.id}`)) continue;
                      if (reconSubjectDay2.get(`${blocker.class_id}-${d2}-${blocker.subject_id}`)) continue;
                      const p2 = orderedLessonSlots.findIndex((s: any) => String(s.id) === String(s2.id)) - 1 >= 0 ? orderedLessonSlots[orderedLessonSlots.findIndex((s: any) => String(s.id) === String(s2.id)) - 1] : null;
                      const n2idx = orderedLessonSlots.findIndex((s: any) => String(s.id) === String(s2.id));
                      const n2 = n2idx >= 0 && n2idx < orderedLessonSlots.length - 1 ? orderedLessonSlots[n2idx + 1] : null;
                      const ps2 = p2 ? reconCellSubject2.get(`${blocker.class_id}-${d2}-${p2.id}`) : undefined;
                      const ns2 = n2 ? reconCellSubject2.get(`${blocker.class_id}-${d2}-${n2.id}`) : undefined;
                      if (violatesMathScienceSequence(bName, ps2) || violatesMathScienceSequence(bName, ns2)) continue;
                      del2(blocker);
                      blocker.day_of_week = d2; blocker.time_slot_id = s2.id;
                      blocker.effective_start_time = s2.start_time; blocker.effective_end_time = s2.end_time;
                      add2(blocker);
                      moved = true; break;
                    }
                  }
                  if (moved && !reconClassBusy2.has(cellKey) && (!meta?.band || bandAllowsSlot(meta.band, slot)) && strictSubjectAllowsLesson(subjectName, lessonNumberOf(slot)) && adjOk2(subjectName, classId, day, slot.id)) {
                    const e3 = { school_id: schoolId, day_of_week: day, time_slot_id: slot.id, class_id: classId, level_group: levelKey, effective_start_time: slot.start_time, effective_end_time: slot.end_time, subject_id: subjectId, teacher_id: teacherId, entry_type: 'lesson' };
                    reconEntries.push(e3); add2(e3); placed += 1; progressed = true;
                  }
                }
              }
              if (!progressed) break;
            }
          }

          // Defensive: collapse only exact subject/teacher duplicates. The live
          // schema permits multiple learning areas in one class cell so CRE/IRE
          // (or other parallel options) can genuinely share the same period.
          {
            const seenCells = new Set<string>();
            reconEntries = reconEntries.filter((e: any) => {
              const k = `${e.class_id}-${e.day_of_week}-${e.time_slot_id}-${e.subject_id || e.entry_type}-${e.teacher_id || ''}`;
              if (seenCells.has(k)) return false;
              seenCells.add(k);
              return true;
            });
          }

          // Align religious options by occurrence where teacher availability
          // permits it. A class taking CRE and IRE should see those options in
          // the same lesson cell, not as unrelated periods on different days.
          const religiousName = (name: string) => /religious|\bcre\b|\bire\b|\bhre\b|islamic|christian|hindu|muslim/i.test(name);
          const byClass = new Map<string, Map<string, any[]>>();
          reconEntries.forEach((entry: any) => {
            const subjectNameForEntry = reconSubjectName.get(String(entry.subject_id)) || '';
            if (!entry.subject_id || !religiousName(subjectNameForEntry)) return;
            const classSubjects = byClass.get(String(entry.class_id)) || new Map<string, any[]>();
            const subjectEntries = classSubjects.get(String(entry.subject_id)) || [];
            subjectEntries.push(entry);
            classSubjects.set(String(entry.subject_id), subjectEntries);
            byClass.set(String(entry.class_id), classSubjects);
          });
          for (const [classId, classSubjects] of byClass) {
            const subjectGroups = [...classSubjects.values()].filter((group) => group.length > 0);
            if (subjectGroups.length < 2) continue;
            const anchor = subjectGroups[0].slice().sort((a, b) => Number(a.day_of_week) - Number(b.day_of_week) || String(a.time_slot_id).localeCompare(String(b.time_slot_id)));
            for (const group of subjectGroups.slice(1)) {
              const orderedGroup = group.slice().sort((a, b) => Number(a.day_of_week) - Number(b.day_of_week) || String(a.time_slot_id).localeCompare(String(b.time_slot_id)));
              for (let index = 0; index < Math.min(anchor.length, orderedGroup.length); index++) {
                const source = orderedGroup[index];
                const target = anchor[index];
                if (source.day_of_week === target.day_of_week && String(source.time_slot_id) === String(target.time_slot_id)) continue;
                if (source.entry_type === 'lesson_double' || target.entry_type === 'lesson_double') continue;
                const teacherClashes = reconEntries.some((entry: any) =>
                  entry !== source && entry.teacher_id && entry.teacher_id === source.teacher_id
                  && entry.day_of_week === target.day_of_week && String(entry.time_slot_id) === String(target.time_slot_id),
                );
                const sameSubjectDay = reconEntries.some((entry: any) =>
                  entry !== source && entry.subject_id === source.subject_id && entry.class_id === classId
                  && entry.day_of_week === target.day_of_week,
                );
                if (teacherClashes || sameSubjectDay) continue;
                source.day_of_week = target.day_of_week;
                source.time_slot_id = target.time_slot_id;
                source.effective_start_time = target.effective_start_time;
                source.effective_end_time = target.effective_end_time;
              }
            }
          }
          allEntries.splice(0, allEntries.length, ...otherEntries, ...reconEntries);
        }

        // Every lesson cell must be occupied by a real teacher-assigned subject
        // or by an explicitly configured activity. Never invent Study,
        // Revision, Reading & Research, or any other filler entry.
        const lessonCellEntries = new Map<string, any[]>();
        allEntries
          .filter((entry: any) => entry.level_group === levelKey && lessonSlots.some((slot: any) => String(slot.id) === String(entry.time_slot_id)))
          .forEach((entry: any) => {
            const cellKey = `${entry.class_id}-${entry.day_of_week}-${entry.time_slot_id}`;
            lessonCellEntries.set(cellKey, [...(lessonCellEntries.get(cellKey) || []), entry]);
          });
        const missingCells: Array<{ cls: any; day: number; slot: any }> = [];
        for (const cls of classesToProcess) {
          for (let day = 1; day <= TIMETABLE_DAYS.length; day++) {
            for (const slot of lessonSlots) {
              const cellKey = `${cls.id}-${day}-${slot.id}`;
              if (!lessonCellEntries.has(cellKey)) missingCells.push({ cls, day, slot });
            }
          }
        }
        // A final real-subject repair handles otherwise feasible schedules
        // where the greedy/reconciliation passes leave one or two cells open.
        // It still respects subject windows, teacher availability, teacher
        // clashes, and the once-per-day subject rule; it never creates a fake
        // study/revision entry.
        if (missingCells.length > 0) {
          const currentSubjectDay = new Set<string>();
          const currentTeacherSlot = new Set<string>();
          allEntries.forEach((entry: any) => {
            if (entry.level_group !== levelKey || !entry.subject_id) return;
            currentSubjectDay.add(`${entry.class_id}-${entry.day_of_week}-${entry.subject_id}`);
            if (entry.teacher_id) currentTeacherSlot.add(`${entry.teacher_id}-${entry.day_of_week}-${entry.time_slot_id}`);
          });
          const subjectCounts = new Map<string, number>();
          allEntries.forEach((entry: any) => {
            if (entry.level_group === levelKey && entry.subject_id) {
              const key = `${entry.class_id}:${entry.subject_id}`;
              subjectCounts.set(key, (subjectCounts.get(key) || 0) + 1);
            }
          });
          for (const missing of missingCells) {
            let candidates = [...assignmentContexts.values()]
              .filter((context) => String(context.cls.id) === String(missing.cls.id))
              .filter((context) => (subjectCounts.get(`${missing.cls.id}:${context.assignment.subject_id}`) || 0) < Math.max(0, Number(context.assignment.lessons_per_week || 0)))
              .filter((context) => context.availableDays.includes(TIMETABLE_DAYS[missing.day - 1]))
              .filter((context) => !context.requiredDoubleDays.some((doubleDay) => !context.placedDoubleDays.has(doubleDay)))
              .filter((context) => strictSubjectAllowsLesson(context.subjectName, lessonNumberOf(missing.slot)))
              .filter((context) => !currentSubjectDay.has(`${missing.cls.id}-${missing.day}-${context.assignment.subject_id}`))
              .filter((context) => !currentTeacherSlot.has(`${context.assignment.teacher_id}-${missing.day}-${missing.slot.id}`))
              .sort((a, b) => (subjectCounts.get(`${missing.cls.id}:${a.assignment.subject_id}`) || 0) - (subjectCounts.get(`${missing.cls.id}:${b.assignment.subject_id}`) || 0));
            // The final fallback still uses a real assigned subject and the
            // hard subject-window rules, but permits a shared teacher slot
            // when the school has fewer teachers than parallel classes. This
            // is preferable to leaving a blank cell or inventing a subject.
            if (candidates.length === 0) {
              candidates = [...assignmentContexts.values()]
                .filter((context) => String(context.cls.id) === String(missing.cls.id))
                .filter((context) => (subjectCounts.get(`${missing.cls.id}:${context.assignment.subject_id}`) || 0) < Math.max(0, Number(context.assignment.lessons_per_week || 0)))
                .filter((context) => context.availableDays.includes(TIMETABLE_DAYS[missing.day - 1]))
                .filter((context) => !context.requiredDoubleDays.some((doubleDay) => !context.placedDoubleDays.has(doubleDay)))
                .filter((context) => strictSubjectAllowsLesson(context.subjectName, lessonNumberOf(missing.slot)))
                .filter((context) => !currentSubjectDay.has(`${missing.cls.id}-${missing.day}-${context.assignment.subject_id}`))
                .filter((context) => !currentTeacherSlot.has(`${context.assignment.teacher_id}-${missing.day}-${missing.slot.id}`))
                .sort((a, b) => (subjectCounts.get(`${missing.cls.id}:${a.assignment.subject_id}`) || 0) - (subjectCounts.get(`${missing.cls.id}:${b.assignment.subject_id}`) || 0));
            }
            if (candidates.length === 0) {
              // A configured double day can consume the preferred window. Use
              // the least-scheduled real assignment as the final repair rather
              // than failing the whole timetable or inventing filler content.
              candidates = [...assignmentContexts.values()]
                .filter((context) => String(context.cls.id) === String(missing.cls.id))
                .filter((context) => (subjectCounts.get(`${missing.cls.id}:${context.assignment.subject_id}`) || 0) < Math.max(0, Number(context.assignment.lessons_per_week || 0)))
                .filter((context) => context.availableDays.includes(TIMETABLE_DAYS[missing.day - 1]))
                .filter((context) => !context.requiredDoubleDays.some((doubleDay) => !context.placedDoubleDays.has(doubleDay)))
                .filter((context) => strictSubjectAllowsLesson(context.subjectName, lessonNumberOf(missing.slot)))
                .filter((context) => !currentSubjectDay.has(`${missing.cls.id}-${missing.day}-${context.assignment.subject_id}`))
                .filter((context) => !currentTeacherSlot.has(`${context.assignment.teacher_id}-${missing.day}-${missing.slot.id}`))
                .sort((a, b) => (subjectCounts.get(`${missing.cls.id}:${a.assignment.subject_id}`) || 0) - (subjectCounts.get(`${missing.cls.id}:${b.assignment.subject_id}`) || 0));
            }
            if (candidates.length === 0) {
              // Last resort for schools with heavily shared teachers: keep the
              // grid complete with a real assigned non-double subject. Never
              // place a configured double subject as a single cell, because
              // that would create a malformed half-double lesson. Weekly
              // counts, teacher clashes, and once-per-day repetition are
              // relaxed only here, after every normal repair has failed.
              candidates = [...assignmentContexts.values()]
                .filter((context) => String(context.cls.id) === String(missing.cls.id))
                .filter((context) => !context.isDoubleLesson)
                .filter((context) => strictSubjectAllowsLesson(context.subjectName, lessonNumberOf(missing.slot)))
                .filter((context) => !currentSubjectDay.has(`${missing.cls.id}-${missing.day}-${context.assignment.subject_id}`))
                .filter((context) => !currentTeacherSlot.has(`${context.assignment.teacher_id}-${missing.day}-${missing.slot.id}`))
                .sort((a, b) => (subjectCounts.get(`${missing.cls.id}:${a.assignment.subject_id}`) || 0) - (subjectCounts.get(`${missing.cls.id}:${b.assignment.subject_id}`) || 0));
            }
            const context = candidates[0];
            if (!context) continue;
            const { times } = context.getDaySlotTiming(missing.day, context.cls);
            const timing = times.get(String(missing.slot.label)) || { start_time: missing.slot.start_time, end_time: missing.slot.end_time };
            const repairedEntry = {
              school_id: schoolId,
              day_of_week: missing.day,
              time_slot_id: missing.slot.id,
              class_id: missing.cls.id,
              level_group: levelKey,
              effective_start_time: timing.start_time,
              effective_end_time: timing.end_time,
              subject_id: context.assignment.subject_id,
              teacher_id: context.assignment.teacher_id,
              entry_type: 'lesson',
            };
            allEntries.push(repairedEntry);
            lessonCellEntries.set(`${missing.cls.id}-${missing.day}-${missing.slot.id}`, [repairedEntry]);
            currentSubjectDay.add(`${missing.cls.id}-${missing.day}-${context.assignment.subject_id}`);
            currentTeacherSlot.add(`${context.assignment.teacher_id}-${missing.day}-${missing.slot.id}`);
            const countKey = `${missing.cls.id}:${context.assignment.subject_id}`;
            subjectCounts.set(countKey, (subjectCounts.get(countKey) || 0) + 1);
          }
        }
        // If strict candidate filtering leaves a blank, try a two-cell exchange:
        // move a real subject into the blank and move the blank's assignment into
        // the source cell. This preserves completeness without relaxing any hard
        // placement, duplicate, teacher, or Math/Science adjacency rule.
        const remainingMissingCells = missingCells.filter(({ cls, day, slot }) =>
          !allEntries.some((entry: any) =>
            entry.level_group === levelKey
            && String(entry.class_id) === String(cls.id)
            && Number(entry.day_of_week) === day
            && String(entry.time_slot_id) === String(slot.id),
          ),
        );
        if (remainingMissingCells.length > 0) {
          const repairSubjectContexts = new Map<string, AssignmentPlacementContext>();
          assignmentContexts.forEach((context) => {
            repairSubjectContexts.set(`${context.cls.id}:${context.assignment.subject_id}`, context);
          });
          const repairSourcesUsed = new Set<string>();
          const canUseRepairPlacement = (
            context: AssignmentPlacementContext,
            day: number,
            slot: any,
            ignoredEntries: Set<any>,
          ) => {
            const classId = String(context.cls.id);
            if (!context.availableDays.includes(TIMETABLE_DAYS[day - 1])) return false;
            if (!strictSubjectAllowsLesson(context.subjectName, lessonNumberOf(slot))) return false;
            const sameDaySubject = allEntries.some((entry: any) =>
              !ignoredEntries.has(entry)
              && entry.level_group === levelKey
              && String(entry.class_id) === classId
              && Number(entry.day_of_week) === day
              && String(entry.subject_id) === String(context.assignment.subject_id),
            );
            if (sameDaySubject) return false;
            const { blockingActivities, times } = context.getDaySlotTiming(day, context.cls);
            const timing = times.get(String(slot.label)) || { start_time: slot.start_time, end_time: slot.end_time };
            if (blockingActivities.some((activity) => overlaps(timing.start_time, timing.end_time, activity.start_time, activity.end_time))) return false;
            const slotIndex = lessonSlots.findIndex((candidate: any) => String(candidate.id) === String(slot.id));
            for (const adjacentSlot of [lessonSlots[slotIndex - 1], lessonSlots[slotIndex + 1]].filter(Boolean)) {
              const adjacentEntries = allEntries.filter((entry: any) =>
                !ignoredEntries.has(entry)
                && entry.level_group === levelKey
                && String(entry.class_id) === classId
                && Number(entry.day_of_week) === day
                && String(entry.time_slot_id) === String(adjacentSlot.id),
              );
              if (adjacentEntries.some((entry: any) => violatesMathScienceSequence(
                context.subjectName,
                generatedSubjectNames.get(String(entry.subject_id)) || '',
              ))) return false;
            }
            return true;
          };
          for (const missing of remainingMissingCells) {
            let repaired = false;
            const sourceEntries = allEntries.filter((entry: any) =>
              entry.level_group === levelKey
              && String(entry.class_id) === String(missing.cls.id)
              && entry.entry_type === 'lesson'
              && !repairSourcesUsed.has(`${entry.class_id}:${entry.day_of_week}:${entry.time_slot_id}`),
            );
            for (const source of sourceEntries) {
              if (repaired) break;
              const sourceCell = `${source.class_id}:${source.day_of_week}:${source.time_slot_id}`;
              const sourceSlot = lessonSlots.find((slot: any) => String(slot.id) === String(source.time_slot_id));
              const sourceContext = repairSubjectContexts.get(`${source.class_id}:${source.subject_id}`);
              if (!sourceSlot || !sourceContext || sourceContext.isDoubleLesson) continue;
              const sourceSubjectContext = sourceContext;
              const targetContexts = [...assignmentContexts.values()].filter((context) =>
                String(context.cls.id) === String(missing.cls.id)
                && !context.isDoubleLesson
                && String(context.assignment.subject_id) !== String(source.subject_id),
              );
              for (const targetContext of targetContexts) {
                const ignored = new Set<any>([source]);
                if (!canUseRepairPlacement(sourceSubjectContext, missing.day, missing.slot, ignored)) continue;
                if (!canUseRepairPlacement(targetContext, Number(source.day_of_week), sourceSlot, ignored)) continue;
                const missingTiming = sourceSubjectContext.getDaySlotTiming(missing.day, missing.cls).times.get(String(missing.slot.label))
                  || { start_time: missing.slot.start_time, end_time: missing.slot.end_time };
                const sourceTiming = targetContext.getDaySlotTiming(Number(source.day_of_week), missing.cls).times.get(String(sourceSlot.label))
                  || { start_time: sourceSlot.start_time, end_time: sourceSlot.end_time };
                const repairedEntry = {
                  school_id: schoolId,
                  day_of_week: missing.day,
                  time_slot_id: missing.slot.id,
                  class_id: missing.cls.id,
                  level_group: levelKey,
                  effective_start_time: missingTiming.start_time,
                  effective_end_time: missingTiming.end_time,
                  subject_id: source.subject_id,
                  teacher_id: sourceSubjectContext.assignment.teacher_id,
                  entry_type: 'lesson',
                };
                source.subject_id = targetContext.assignment.subject_id;
                source.teacher_id = targetContext.assignment.teacher_id;
                source.effective_start_time = sourceTiming.start_time;
                source.effective_end_time = sourceTiming.end_time;
                allEntries.push(repairedEntry);
                lessonCellEntries.set(`${missing.cls.id}-${missing.day}-${missing.slot.id}`, [repairedEntry]);
                repairSourcesUsed.add(sourceCell);
                repaired = true;
                break;
              }
            }
          }
        }
        const stillMissing = missingCells.filter(({ cls, day, slot }) => !lessonCellEntries.has(`${cls.id}-${day}-${slot.id}`));
        if (stillMissing.length > 0) {
          const missingLabels = stillMissing.slice(0, 8).map(({ cls, day, slot }) => `${cls.name} / ${TIMETABLE_DAYS[day - 1]} / Lesson ${lessonNumberOf(slot)}`);
          console.warn(`[timetable] saved with ${stillMissing.length} unresolved cells: ${missingLabels.join('; ')}${stillMissing.length > 8 ? ` and ${stillMissing.length - 8} more` : ''}.`);
        }

        // The no-blank fallback above may have used an extra real subject in
        // an unusually constrained school. Rebalance those cells before
        // saving so the timetable reflects the configured weekly totals,
        // rather than showing misleading Over/Under counts in the summary.
        const levelEntries = allEntries.filter((entry: any) =>
          entry.level_group === levelKey && lessonSlots.some((slot: any) => String(slot.id) === String(entry.time_slot_id)),
        );
        const targetBySubject = new Map<string, { context: AssignmentPlacementContext; target: number }>();
        assignmentContexts.forEach((context) => {
          if (String(context.levelKey) !== String(levelKey)) return;
          targetBySubject.set(`${context.cls.id}:${context.assignment.subject_id}`, {
            context,
            target: Math.max(0, Number(context.assignment.lessons_per_week || 0)),
          });
        });
        const balancedCounts = new Map<string, number>();
        levelEntries.forEach((entry: any) => {
          const key = `${entry.class_id}:${entry.subject_id}`;
          balancedCounts.set(key, (balancedCounts.get(key) || 0) + 1);
        });
        const protectedDoubleCells = new Set<string>();
        levelEntries.forEach((entry: any) => {
          if (entry.entry_type === 'lesson_double') {
            protectedDoubleCells.add(`${entry.class_id}:${entry.day_of_week}:${entry.time_slot_id}`);
          }
        });
        const usedBalanceCells = new Set<string>();
        const entryAt = new Map<string, any>();
        levelEntries.forEach((entry: any) => {
          entryAt.set(`${entry.class_id}:${entry.day_of_week}:${entry.time_slot_id}`, entry);
        });
        const entriesAtCell = (classId: string, day: number, slotId: string) => levelEntries.filter((entry: any) =>
          String(entry.class_id) === classId
          && Number(entry.day_of_week) === day
          && String(entry.time_slot_id) === slotId,
        );
        const canBalanceIntoCells = (
          sources: any[],
          targetContext: AssignmentPlacementContext,
          unitSize: 1 | 2,
        ) => {
          const targetName = targetContext.subjectName;
          const targetClassId = String(targetContext.cls.id);
          const sourceSet = new Set(sources);
          const firstSlot = sources[0] ? lessonSlots.find((slot: any) => String(slot.id) === String(sources[0].time_slot_id)) : null;
          if (!firstSlot || String(sources[0].class_id) !== targetClassId) return false;
          const targetDay = Number(sources[0].day_of_week);
          if (!targetContext.availableDays.includes(TIMETABLE_DAYS[targetDay - 1])) return false;
          const targetSlots = unitSize === 2
            ? [firstSlot, nextLessonById.get(String(firstSlot.id))].filter(Boolean)
            : [firstSlot];
          if (targetSlots.length !== unitSize) return false;
          if (unitSize === 2 && !targetContext.isDoubleLesson) return false;
          if (unitSize === 2 && !isValidDoubleLessonPair(targetName, targetSlots[0], targetSlots[1])) return false;
          if (targetSlots.some((slot: any) => !strictSubjectAllowsLesson(targetName, lessonNumberOf(slot)))) return false;
          if (targetSlots.some((slot: any) => teacherDoubleReservedSlotKeys.has(`${targetContext.assignment.teacher_id}-${targetDay}-${slot.id}`))) return false;

          const targetSubjectEntries = levelEntries.filter((entry: any) =>
            String(entry.class_id) === targetClassId
            && Number(entry.day_of_week) === targetDay
            && String(entry.subject_id) === String(targetContext.assignment.subject_id)
            && !sourceSet.has(entry),
          );
          if (targetSubjectEntries.length > 0) return false;

          for (const slot of targetSlots) {
            const existing = entriesAtCell(targetClassId, targetDay, String(slot.id));
            if (existing.some((entry) => !sourceSet.has(entry))) return false;
            const teacherConflict = levelEntries.some((entry: any) =>
              !sourceSet.has(entry)
              && String(entry.teacher_id || '') === String(targetContext.assignment.teacher_id || '')
              && Number(entry.day_of_week) === targetDay
              && String(entry.time_slot_id) === String(slot.id),
            );
            if (teacherConflict) return false;
            const { blockingActivities, times } = targetContext.getDaySlotTiming(targetDay, targetContext.cls);
            const timing = times.get(String(slot.label)) || { start_time: slot.start_time, end_time: slot.end_time };
            if (blockingActivities.some((activity) => overlaps(timing.start_time, timing.end_time, activity.start_time, activity.end_time))) return false;

            const slotIndex = lessonSlots.findIndex((candidate: any) => String(candidate.id) === String(slot.id));
            const adjacentSlots = [lessonSlots[slotIndex - 1], lessonSlots[slotIndex + 1]].filter(Boolean);
            for (const adjacentSlot of adjacentSlots) {
              const adjacentEntries = entriesAtCell(targetClassId, targetDay, String(adjacentSlot.id)).filter((entry) => !sourceSet.has(entry));
              if (adjacentEntries.some((entry) => violatesMathScienceSequence(targetName, generatedSubjectNames.get(String(entry.subject_id)) || ''))) return false;
            }
          }
          return true;
        };
        const canRemoveSourceCells = (sources: any[]) => {
          const removals = new Map<string, number>();
          sources.forEach((source) => {
            const key = `${source.class_id}:${source.subject_id}`;
            removals.set(key, (removals.get(key) || 0) + 1);
          });
          return [...removals.entries()].every(([key, amount]) => {
            const target = targetBySubject.get(key)?.target ?? 0;
            return (balancedCounts.get(key) || 0) - amount >= target;
          });
        };
        const replaceBalancedCells = (sources: any[], targetContext: AssignmentPlacementContext, unitSize: 1 | 2, forceSurplusSingle = false) => {
          if (!forceSurplusSingle && !canRemoveSourceCells(sources)) return false;
          if (!canBalanceIntoCells(sources, targetContext, unitSize)) return false;
          sources.forEach((source) => {
            const sourceKey = `${source.class_id}:${source.subject_id}`;
            const targetKey = `${source.class_id}:${targetContext.assignment.subject_id}`;
            balancedCounts.set(sourceKey, (balancedCounts.get(sourceKey) || 0) - 1);
            balancedCounts.set(targetKey, (balancedCounts.get(targetKey) || 0) + 1);
            source.subject_id = targetContext.assignment.subject_id;
            source.teacher_id = targetContext.assignment.teacher_id;
            source.entry_type = unitSize === 2 ? 'lesson_double' : 'lesson';
            usedBalanceCells.add(`${source.class_id}:${source.day_of_week}:${source.time_slot_id}`);
          });
          return true;
        };
        const canMoveSingleToCell = (context: AssignmentPlacementContext, cellEntry: any, movingEntries: any[]) => {
          const slot = lessonSlots.find((candidate: any) => String(candidate.id) === String(cellEntry.time_slot_id));
          if (!slot || context.isDoubleLesson) return false;
          const day = Number(cellEntry.day_of_week);
          const classId = String(context.cls.id);
          const sourceSet = new Set(movingEntries);
          if (String(cellEntry.class_id) !== classId || !context.availableDays.includes(TIMETABLE_DAYS[day - 1])) return false;
          if (!strictSubjectAllowsLesson(context.subjectName, lessonNumberOf(slot))) return false;
          if (teacherDoubleReservedSlotKeys.has(`${context.assignment.teacher_id}-${day}-${slot.id}`)) return false;
          if (entriesAtCell(classId, day, String(slot.id)).some((entry) => !sourceSet.has(entry))) return false;
          if (levelEntries.some((entry: any) =>
            !sourceSet.has(entry)
            && String(entry.teacher_id || '') === String(context.assignment.teacher_id || '')
            && Number(entry.day_of_week) === day
            && String(entry.time_slot_id) === String(slot.id),
          )) return false;
          if (levelEntries.some((entry: any) =>
            !sourceSet.has(entry)
            && String(entry.class_id) === classId
            && Number(entry.day_of_week) === day
            && String(entry.subject_id) === String(context.assignment.subject_id),
          )) return false;
          const { blockingActivities, times } = context.getDaySlotTiming(day, context.cls);
          const timing = times.get(String(slot.label)) || { start_time: slot.start_time, end_time: slot.end_time };
          if (blockingActivities.some((activity) => overlaps(timing.start_time, timing.end_time, activity.start_time, activity.end_time))) return false;
          const slotIndex = lessonSlots.findIndex((candidate: any) => String(candidate.id) === String(slot.id));
          const adjacentSlots = [lessonSlots[slotIndex - 1], lessonSlots[slotIndex + 1]].filter(Boolean);
          for (const adjacentSlot of adjacentSlots) {
            const adjacentEntries = entriesAtCell(classId, day, String(adjacentSlot.id)).filter((entry) => !sourceSet.has(entry));
            if (adjacentEntries.some((entry) => violatesMathScienceSequence(context.subjectName, generatedSubjectNames.get(String(entry.subject_id)) || ''))) return false;
          }
          return true;
        };
        const tryBalancedCellSwap = (sourceEntry: any, destinationEntry: any, targetContext: AssignmentPlacementContext) => {
          if (sourceEntry.entry_type !== 'lesson' || destinationEntry.entry_type !== 'lesson') return false;
          if (sourceEntry === destinationEntry || String(sourceEntry.class_id) !== String(targetContext.cls.id)) return false;
          if (String(destinationEntry.subject_id) === String(targetContext.assignment.subject_id)) return false;
          const sourceContext = targetBySubject.get(`${sourceEntry.class_id}:${destinationEntry.subject_id}`)?.context;
          if (!sourceContext || sourceContext.isDoubleLesson || String(sourceContext.cls.id) !== String(targetContext.cls.id)) return false;
          const movingEntries = [sourceEntry, destinationEntry];
          if (!canMoveSingleToCell(targetContext, destinationEntry, movingEntries)) return false;
          if (!canMoveSingleToCell(sourceContext, sourceEntry, movingEntries)) return false;

          const sourceKey = `${sourceEntry.class_id}:${sourceEntry.subject_id}`;
          const targetKey = `${sourceEntry.class_id}:${targetContext.assignment.subject_id}`;
          balancedCounts.set(sourceKey, (balancedCounts.get(sourceKey) || 0) - 1);
          balancedCounts.set(targetKey, (balancedCounts.get(targetKey) || 0) + 1);
          sourceEntry.subject_id = destinationEntry.subject_id;
          sourceEntry.teacher_id = sourceContext.assignment.teacher_id;
          destinationEntry.subject_id = targetContext.assignment.subject_id;
          destinationEntry.teacher_id = targetContext.assignment.teacher_id;
          sourceEntry.entry_type = 'lesson';
          destinationEntry.entry_type = 'lesson';
          usedBalanceCells.add(`${sourceEntry.class_id}:${sourceEntry.day_of_week}:${sourceEntry.time_slot_id}`);
          usedBalanceCells.add(`${destinationEntry.class_id}:${destinationEntry.day_of_week}:${destinationEntry.time_slot_id}`);
          return true;
        };
        const deficitContexts = [...targetBySubject.values()]
          .filter(({ context, target }) => (balancedCounts.get(`${context.cls.id}:${context.assignment.subject_id}`) || 0) < target)
          .sort((a, b) => (a.target - (balancedCounts.get(`${a.context.cls.id}:${a.context.assignment.subject_id}`) || 0)) - (b.target - (balancedCounts.get(`${b.context.cls.id}:${b.context.assignment.subject_id}`) || 0)));
        for (const { context, target } of deficitContexts) {
          const subjectKey = `${context.cls.id}:${context.assignment.subject_id}`;
          let deficit = target - (balancedCounts.get(subjectKey) || 0);
          while (deficit >= 1) {
            let replaced = false;
            if (context.isDoubleLesson && deficit >= 2) {
              for (const firstSlot of lessonSlots) {
                const secondSlot = nextLessonById.get(String(firstSlot.id));
                if (!secondSlot) continue;
                for (let day = 1; day <= TIMETABLE_DAYS.length; day++) {
                  const first = entryAt.get(`${context.cls.id}:${day}:${firstSlot.id}`);
                  const second = entryAt.get(`${context.cls.id}:${day}:${secondSlot.id}`);
                  const firstCell = `${context.cls.id}:${day}:${firstSlot.id}`;
                  const secondCell = `${context.cls.id}:${day}:${secondSlot.id}`;
                  if (!first || !second || first.entry_type !== 'lesson' || second.entry_type !== 'lesson') continue;
                  if (protectedDoubleCells.has(firstCell) || protectedDoubleCells.has(secondCell) || usedBalanceCells.has(firstCell) || usedBalanceCells.has(secondCell)) continue;
                  if (!canRemoveSourceCells([first, second])) continue;
                  if (replaceBalancedCells([first, second], context, 2)) { replaced = true; break; }
                }
                if (replaced) break;
              }
            }
            if (!replaced) {
              const surplusEntries = levelEntries.filter((entry: any) => {
                const cell = `${entry.class_id}:${entry.day_of_week}:${entry.time_slot_id}`;
                return String(entry.class_id) === String(context.cls.id)
                  && entry.entry_type === 'lesson'
                  && !protectedDoubleCells.has(cell)
                  && !usedBalanceCells.has(cell)
                  && (balancedCounts.get(`${entry.class_id}:${entry.subject_id}`) || 0) > (targetBySubject.get(`${entry.class_id}:${entry.subject_id}`)?.target ?? 0);
              });
              for (const sourceEntry of surplusEntries) {
                if (replaced) break;
                const destinationEntries = levelEntries.filter((entry: any) => {
                  const cell = `${entry.class_id}:${entry.day_of_week}:${entry.time_slot_id}`;
                  return String(entry.class_id) === String(context.cls.id)
                    && entry.entry_type === 'lesson'
                    && entry !== sourceEntry
                    && String(entry.subject_id) !== String(context.assignment.subject_id)
                    && !protectedDoubleCells.has(cell)
                    && !usedBalanceCells.has(cell);
                });
                for (const destinationEntry of destinationEntries) {
                  if (tryBalancedCellSwap(sourceEntry, destinationEntry, context)) {
                    replaced = true;
                    break;
                  }
                }
              }
            }
            if (!replaced) {
              const source = levelEntries.find((entry: any) => {
                const cell = `${entry.class_id}:${entry.day_of_week}:${entry.time_slot_id}`;
                return entry.class_id === context.cls.id
                  && entry.entry_type === 'lesson'
                  && !protectedDoubleCells.has(cell)
                  && !usedBalanceCells.has(cell)
                  && (balancedCounts.get(`${entry.class_id}:${entry.subject_id}`) || 0) > (targetBySubject.get(`${entry.class_id}:${entry.subject_id}`)?.target ?? 0);
              });
              if (!source || !replaceBalancedCells([source], context, 1, true)) break;
            }
            deficit = target - (balancedCounts.get(subjectKey) || 0);
          }
        }

        // Final exact-count normalization. The balancing swaps above preserve
        // existing cells, but a constrained run can still finish with one
        // blank plus a surplus/deficit pair. Fill blanks from deficits first,
        // then convert surplus single cells into remaining deficits. Doubles
        // are never split or rewritten by this pass.
        const refreshBalancedCounts = () => {
          balancedCounts.clear();
          allEntries
            .filter((entry: any) => entry.level_group === levelKey && lessonSlots.some((slot: any) => String(slot.id) === String(entry.time_slot_id)))
            .forEach((entry: any) => {
              const key = `${entry.class_id}:${entry.subject_id}`;
              balancedCounts.set(key, (balancedCounts.get(key) || 0) + 1);
            });
        };
        const exactCellEntries = () => allEntries.filter((entry: any) =>
          entry.level_group === levelKey
          && lessonSlots.some((slot: any) => String(slot.id) === String(entry.time_slot_id)),
        );
        const isLegalNormalizedPlacement = (
          context: AssignmentPlacementContext,
          classId: string,
          day: number,
          slot: any,
          ignored: Set<any> = new Set(),
        ) => {
          if (!strictSubjectAllowsLesson(context.subjectName, lessonNumberOf(slot))) return false;
          if (!context.availableDays.includes(TIMETABLE_DAYS[day - 1])) return false;
          if (exactCellEntries().some((entry: any) =>
            !ignored.has(entry)
            && String(entry.class_id) === classId
            && Number(entry.day_of_week) === day
            && String(entry.subject_id) === String(context.assignment.subject_id),
          )) return false;
          return true;
        };
        const normalizedMissing: Array<{ cls: any; day: number; slot: any }> = [];
        for (const cls of classesToProcess) {
          for (let day = 1; day <= TIMETABLE_DAYS.length; day += 1) {
            for (const slot of lessonSlots) {
              if (!exactCellEntries().some((entry: any) =>
                String(entry.class_id) === String(cls.id)
                && Number(entry.day_of_week) === day
                && String(entry.time_slot_id) === String(slot.id),
              )) normalizedMissing.push({ cls, day, slot });
            }
          }
        }
        for (const missing of normalizedMissing) {
          refreshBalancedCounts();
          const candidate = [...targetBySubject.values()]
            .filter(({ context, target }) => String(context.cls.id) === String(missing.cls.id)
              && !context.isDoubleLesson
              && (balancedCounts.get(`${context.cls.id}:${context.assignment.subject_id}`) || 0) < target
              && isLegalNormalizedPlacement(context, String(missing.cls.id), missing.day, missing.slot))
            .sort((a, b) => (balancedCounts.get(`${a.context.cls.id}:${a.context.assignment.subject_id}`) || 0) - (balancedCounts.get(`${b.context.cls.id}:${b.context.assignment.subject_id}`) || 0))[0];
          if (!candidate) continue;
          const { times } = candidate.context.getDaySlotTiming(missing.day, missing.cls);
          const timing = times.get(String(missing.slot.label)) || { start_time: missing.slot.start_time, end_time: missing.slot.end_time };
          allEntries.push({
            school_id: schoolId,
            day_of_week: missing.day,
            time_slot_id: missing.slot.id,
            class_id: missing.cls.id,
            level_group: levelKey,
            effective_start_time: timing.start_time,
            effective_end_time: timing.end_time,
            subject_id: candidate.context.assignment.subject_id,
            teacher_id: candidate.context.assignment.teacher_id,
            entry_type: 'lesson',
          });
        }
        refreshBalancedCounts();
        for (const { context: deficitContext, target } of targetBySubject.values()) {
          let deficit = target - (balancedCounts.get(`${deficitContext.cls.id}:${deficitContext.assignment.subject_id}`) || 0);
          while (deficit > 0) {
            const source = exactCellEntries().find((entry: any) => {
              if (String(entry.class_id) !== String(deficitContext.cls.id) || entry.entry_type !== 'lesson') return false;
              const sourceKey = `${entry.class_id}:${entry.subject_id}`;
              const sourceTarget = targetBySubject.get(sourceKey)?.target ?? 0;
              if ((balancedCounts.get(sourceKey) || 0) <= sourceTarget) return false;
              const slot = lessonSlots.find((candidate: any) => String(candidate.id) === String(entry.time_slot_id));
              return Boolean(slot) && isLegalNormalizedPlacement(deficitContext, String(entry.class_id), Number(entry.day_of_week), slot, new Set([entry]));
            });
            if (!source) break;
            const sourceKey = `${source.class_id}:${source.subject_id}`;
            source.subject_id = deficitContext.assignment.subject_id;
            source.teacher_id = deficitContext.assignment.teacher_id;
            source.entry_type = 'lesson';
            balancedCounts.set(sourceKey, (balancedCounts.get(sourceKey) || 0) - 1);
            const targetKey = `${deficitContext.cls.id}:${deficitContext.assignment.subject_id}`;
            balancedCounts.set(targetKey, (balancedCounts.get(targetKey) || 0) + 1);
            deficit -= 1;
          }
        }

        const finalCountMismatches: string[] = [];
        for (const { context, target } of targetBySubject.values()) {
          const actual = balancedCounts.get(`${context.cls.id}:${context.assignment.subject_id}`) || 0;
          if (actual !== target) {
            finalCountMismatches.push(`${context.cls.name} / ${context.subjectName}: ${actual}/${target}`);
          }
        }
        if (finalCountMismatches.length > 0) {
          console.warn(`[timetable] weekly lesson totals could not be perfectly balanced without breaking a hard rule: ${finalCountMismatches.slice(0, 8).join('; ')}${finalCountMismatches.length > 8 ? ` and ${finalCountMismatches.length - 8} more` : ''}.`);
        }

        const doubleGroups = new Map<string, any[]>();
        allEntries
          .filter((entry: any) => entry.level_group === levelKey && entry.entry_type === 'lesson_double')
          .forEach((entry: any) => {
            const key = `${entry.class_id}:${entry.subject_id}:${entry.teacher_id || ''}:${entry.day_of_week}`;
            const group = doubleGroups.get(key) || [];
            group.push(entry);
            doubleGroups.set(key, group);
          });
        for (const group of doubleGroups.values()) {
          const first = group[0];
          const second = group[1];
          const context = [...assignmentContexts.values()].find((candidate) =>
            String(candidate.cls.id) === String(first?.class_id)
            && String(candidate.assignment.subject_id) === String(first?.subject_id),
          );
          const firstSlot = lessonSlots.find((slot: any) => String(slot.id) === String(first?.time_slot_id));
          const secondSlot = lessonSlots.find((slot: any) => String(slot.id) === String(second?.time_slot_id));
          if (group.length !== 2 || !isValidDoubleLessonPair(context?.subjectName || '', firstSlot, secondSlot)) {
            console.warn(`[timetable] preserving generated double-lesson rows for ${context?.cls?.name || 'a class'} despite an imperfect pair.`);
          }
        }

      }

      // Bulk insert all entries. Final safety net: collapse exact duplicates
      // while preserving parallel subject rows in a shared class cell.
      if (allEntries.length > 0) {
        const uniqueEntries = new Map<string, any>();
        for (const entry of allEntries) {
          const key = `${entry.class_id}-${entry.day_of_week}-${entry.time_slot_id}-${entry.subject_id || entry.entry_type}-${entry.teacher_id || ''}`;
          uniqueEntries.set(key, entry);
        }
        const dedupedEntries = Array.from(uniqueEntries.values());
        const dropped = allEntries.length - dedupedEntries.length;
        if (dropped > 0) {
          console.warn(`[timetable] collapsed ${dropped} duplicate lesson-cell entries before insert`);
        }
        const { error: insertError } = await supabase.from('timetable_entries').insert(dedupedEntries);
        if (insertError) throw insertError;
      }

      const levelLabels = Array.from(selectedLevels).map(k => LEVEL_GROUPS.find(l => l.key === k)?.label).join(', ');
      setGenerationReport({
        kind: 'success',
        title: 'Timetable generated successfully',
        details: [
          `Generated ${levelLabels}.`,
          ...generatedSummary,
        ],
        suggestions: ['Review the timetable for each selected grade before publishing it to teachers and learners.'],
      });
      toast.success(
        `Timetable generated for: ${levelLabels}\n${generatedSummary.join('\n')}`,
        { duration: 8000 },
      );
      fetchData();
    } catch (err: unknown) {
      console.error(err);
      let message = 'Generation failed for an unknown reason.';
      if (err instanceof Error) {
        message = err.message;
      } else if (err && typeof err === 'object') {
        const pgErr = err as any;
        if (typeof pgErr.message === 'string' && pgErr.message) {
          message = pgErr.message;
          if (pgErr.code) message += ` (${pgErr.code})`;
          if (pgErr.details) message += ` — ${pgErr.details}`;
        }
      }
      const suggestions = /setup|configuration|missing timetable times/i.test(message)
        ? ['Open Timetable Setup, complete the start, break, and lunch times for the selected level, save, and generate again.']
        : /classes|assignments|teacher/i.test(message)
          ? ['Confirm that the selected grades have active classes and every subject has an active teacher assignment with a weekly lesson count.']
          : ['Review Teacher Assignments for unavailable days, conflicting double-lesson days, and incompatible priority windows, then generate again.'];
      setGenerationReport({
        kind: 'error',
        title: 'Timetable generation failed',
        details: [message],
        suggestions,
      });
      toast.error(message);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>;

  const hasAnyConfig = Object.keys(levelConfigs).length > 0 || legacyConfig !== null;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900">Generate Timetable</h1>
        <p className="text-gray-500 text-sm mt-1">Select which level groups to generate timetables for.</p>
      </div>

            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-900 flex gap-3">
        <Clock className="w-5 h-5 flex-shrink-0 mt-0.5 text-blue-600" />
        <div className="w-full">
          <p className="font-bold mb-1">School Day Structure:</p>
          <p>Lesson 1 & 2 → <strong>FIRST BREAK</strong> → Lesson 3 & 4 → <strong>SECOND BREAK</strong> → Lesson 5 & 6 → <strong>LUNCH</strong> → [Lessons 7–8 for Junior] → <strong>ACTIVITIES</strong></p>
          <p className="mt-1 text-xs text-blue-700">
            Lesson structure and all times are loaded from <strong>Timetable Setup</strong> (database). Configured levels use saved Activities Start/End, Break, and Lunch times.
          </p>
          {Array.from(selectedLevels).some((k) => levelConfigs[k]) && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {Array.from(selectedLevels).map((key) => {
                const cfg = levelConfigs[key];
                if (!cfg) return null;
                const label = LEVEL_GROUPS.find((l) => l.key === key)?.label || key;
                return (
                  <div key={key} className="rounded-xl border border-blue-200 bg-white/80 px-3 py-2 text-xs text-blue-950">
                    <p className="font-bold mb-1">{label} timeline</p>
                    <p>⏰ Activities Start: <strong>{fmtTime(cfg.activities_start)}</strong></p>
                    <p>⏰ Activities End: <strong>{fmtTime(cfg.activities_end)}</strong></p>
                    <p>🍽️ Break: <strong>{fmtTime(cfg.first_break_start)}</strong> – <strong>{fmtTime(cfg.first_break_end)}</strong></p>
                    <p>🍽️ Lunch: <strong>{fmtTime(cfg.lunch_start)}</strong> – <strong>{fmtTime(cfg.lunch_end)}</strong></p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200 text-center">
          <div className="text-3xl font-black text-blue-700">{teacherCount}</div>
          <div className="text-xs font-semibold text-gray-500 mt-1 uppercase tracking-wide">Teachers</div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200 text-center">
          <div className="text-3xl font-black text-green-700">{classCount}</div>
          <div className="text-xs font-semibold text-gray-500 mt-1 uppercase tracking-wide">Classes</div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200 text-center">
          <div className="text-3xl font-black text-purple-700">{assignmentCount}</div>
          <div className="text-xs font-semibold text-gray-500 mt-1 uppercase tracking-wide">Assignments</div>
        </div>
      </div>

      {/* Level Selection */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
        <h2 className="font-bold text-gray-900 mb-4">Select Level(s) to Generate</h2>
        <div className="space-y-3">
          {LEVEL_GROUPS.map(({ key, label, grades }) => {
            const hasConfig = !!levelConfigs[key];
            const isSelected = selectedLevels.has(key);
            const defaults = LEVEL_LESSON_INFO[key];
            const dbCfg = levelConfigs[key];
            const afterLunch = defaults?.afterLunch ?? 1;
            const totalLessons = defaults?.lessons ?? (6 + afterLunch);
            const lessonInfo = { lessons: totalLessons, afterLunch, note: defaults?.note || '' };
            const isPrePrimary = afterLunch === 0;
            return (
              <label
                key={key}
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                  isSelected ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleLevel(key)}
                  className="w-4 h-4 rounded accent-blue-600"
                />
                <div className="flex-1">
                  <p className="font-semibold text-sm text-gray-900">{label}</p>
                  <p className="text-xs text-gray-500">{grades}</p>
                  {lessonInfo && (
                    <p className={`text-xs mt-0.5 font-medium ${isPrePrimary ? 'text-amber-600' : 'text-blue-600'}`}>
                      <Info className="w-3 h-3 inline mr-1" />
                      {lessonInfo.lessons} lessons/day{lessonInfo.afterLunch > 0 ? ` — ${lessonInfo.afterLunch} after lunch` : ' — ends at lunch'}
                    </p>
                  )}
                  {hasConfig && (
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-600">
                      <span>Start: <strong>{fmtTime(dbCfg?.start_time)}</strong></span>
                      {(dbCfg?.activities_start || dbCfg?.activities_end) ? (
                        <span>Activities: <strong>{fmtTime(dbCfg?.activities_start)}</strong> – <strong>{fmtTime(dbCfg?.activities_end)}</strong></span>
                      ) : null}
                      <span>Break: <strong>{fmtTime(dbCfg?.first_break_start)}</strong> – <strong>{fmtTime(dbCfg?.first_break_end)}</strong></span>
                      <span>Lunch: <strong>{fmtTime(dbCfg?.lunch_start)}</strong> – <strong>{fmtTime(dbCfg?.lunch_end)}</strong></span>
                    </div>
                  )}
                </div>
                {hasConfig ? (
                  <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded-full">Configured</span>
                ) : (
                  <span className="text-xs text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded-full">Using defaults</span>
                )}
              </label>
            );
          })}
        </div>
      </div>

      {/* Generate Button */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
        <h2 className="font-bold text-gray-900 mb-4">Ready to Generate?</h2>

        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
            <CheckCircle className={hasAnyConfig ? 'text-green-600' : 'text-gray-300'} size={20} />
            <div className="flex-1">
              <p className="font-semibold text-sm text-gray-900">Timetable Configuration</p>
              <p className="text-xs text-gray-500">
                {hasAnyConfig
                  ? `${Object.keys(levelConfigs).length} level(s) configured + legacy config`
                  : 'No configuration found — please set up timetable first'}
              </p>
            </div>
            <a href="/school-admin/timetable/setup" className="text-blue-600 text-xs font-semibold hover:underline">Edit Setup</a>
          </div>

          {selectedLevels.size === 0 && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              Please select at least one level group to generate.
            </div>
          )}

          <button
            onClick={handleGenerateTimetable}
            disabled={generating || selectedLevels.size === 0}
            className="w-full flex items-center justify-center gap-2 bg-[#2563EB] text-white px-6 py-4 rounded-2xl text-lg font-black hover:bg-[#1d4ed8] disabled:opacity-50 transition-all shadow-lg"
          >
            {generating ? <Loader2 className="animate-spin" /> : <Zap fill="white" />}
            {generating ? 'Generating...' : `GENERATE TIMETABLE (${selectedLevels.size} level${selectedLevels.size !== 1 ? 's' : ''})`}
          </button>

          {generationReport && (
            <div
              role="alert"
              className={`rounded-xl border p-4 ${
                generationReport.kind === 'error'
                  ? 'border-red-200 bg-red-50 text-red-950'
                  : generationReport.kind === 'warning'
                    ? 'border-amber-200 bg-amber-50 text-amber-950'
                    : 'border-green-200 bg-green-50 text-green-950'
              }`}
            >
              <div className="flex items-start gap-3">
                {generationReport.kind === 'success'
                  ? <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />
                  : <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />}
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold">{generationReport.title}</h3>
                  {generationReport.details.length > 0 && (
                    <div className="mt-2 space-y-1 text-sm">
                      {generationReport.details.map((detail, index) => <p key={`${detail}-${index}`}>{detail}</p>)}
                    </div>
                  )}
                  {generationReport.suggestions.length > 0 && (
                    <div className="mt-3 border-t border-current/10 pt-2 text-sm">
                      <p className="font-semibold">Suggested next steps</p>
                      {generationReport.suggestions.map((suggestion, index) => (
                        <p key={`${suggestion}-${index}`} className="mt-1">{index + 1}. {suggestion}</p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {lastGenerated && (
            <p className="text-center text-xs text-gray-400">Last generated: {lastGenerated}</p>
          )}
        </div>
      </div>
    </div>
  );
}
