import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { supabaseUntyped } from '@/lib/supabase/client';
import { Zap, CheckCircle, Loader2, Clock, AlertCircle, Info } from 'lucide-react';
import { toast } from 'sonner';
import { canUseAssignmentDay, classifySubject, generateSlots, getDefaultPriorityBand, getDefaultPriorityLesson, getExactGridAssignmentIssues, getLessonCountForLevel, getLevelConfig, isFillerSubject, isValidDoubleLessonPair, orderAssignmentDays, resolveLessonTargets, shouldSkipPreferredSlot, strictSubjectAllowsLesson, violatesMathScienceSequence } from '@/lib/timetable-generator';
import { LEVEL_GROUPS } from './TimetableSetup';
import {
  activityBlocksLessons,
  activityMatchesLevel,
  isPostLessonActivity,
  resolveActivityLessonSlot,
} from '@/lib/timetable-activity';
import { assertTimetableRules, validateTimetableRules } from '@/lib/timetable-validator';
import { formatClassStream } from '@/lib/class-label';
import { formatCspSolverIssues, formatCspSolverWarnings, solveTimetableCsp } from '@/lib/timetable-csp-solver';

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
// Senior (Grade 10-12): 8 lessons/day, 2 after lunch
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
  'senior': { lessons: 8, afterLunch: 2, note: '2 lessons after lunch' },
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
  /**
   * Set when the solver found classes whose weekly lessons do not fill the level's
   * week (Rule 14). The admin decides whether to continue; nothing is saved until
   * they do, so a week with holes in it is never written by surprise.
   */
  const [pendingShortfall, setPendingShortfall] = useState<{
    levelKey: string;
    levelLabel: string;
    message: string;
    details: string[];
    canContinue: boolean;
    reason: string;
  } | null>(null);

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
        .from('classes').select('id, name, level, grade_level, stream, stream_name').eq('school_id', schoolId).eq('is_active', true);
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

  const handleGenerateTimetable = async (runOptions: { continuePastWarning?: boolean } = {}) => {
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
    setPendingShortfall(null);
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
      const { data: allClasses } = await supabase.from('classes').select('id, name, level, grade_level, stream, stream_name, school_id, is_active').eq('school_id', schoolId).eq('is_active', true);
      const { data: rawAssignments } = await supabase
        .from('teacher_subject_assignments')
        .select('*, subjects(name, code), teachers(first_name, last_name, teacher_number)')
        .eq('school_id', schoolId)
        .eq('is_active', true);
      const { data: existingTimetableEntries } = await supabaseUntyped
        .from('timetable_entries')
        .select('*')
        .eq('school_id', schoolId);

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

      const teacherBusy = new Set<string>();
      const cspReservedTeacherCells = new Set<string>();
      const classBusy = new Set<string>();
      const allEntries: any[] = [];
      type AssignmentPlacementContext = {
        assignmentKey: string;
        assignment: any;
        cls: any;
        levelKey: string;
        subjectName: string;
        priorityBand: string;
        preferredLessonSlots: any[];
        availableDays: string[];
        lessonsPerWeek: number;
        isDoubleLesson: boolean;
        configuredDoubleDays: string[];
        requiredDoubleDays: string[];
        placedDoubleDays: Set<string>;
        doublePlaced: boolean;
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
      const pendingSlots: any[] = [];
      const pendingClassIds = new Set<string>();
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
        classesToProcess.forEach((cls: any) => pendingClassIds.add(String(cls.id)));

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

        // Keep generated slots in memory until every selected level passes all
        // validation. This prevents failed generation from deleting the
        // client’s existing timetable or leaving orphaned time slots.
        const createdSlots = slots.map((slot) => ({
          ...slot,
          id: crypto.randomUUID(),
          school_id: schoolId,
          level_group: levelKey,
          slot_type: slot.slot_type === 'activities' ? 'activity' : slot.slot_type,
        }));
        pendingSlots.push(...createdSlots);

        const lessonN = (createdSlots || []).filter((s: any) => s.slot_type === 'lesson').length;
        const afterN = targets.afterLunch;
        generatedSummary.push(
          `${LEVEL_GROUPS.find((l) => l.key === levelKey)?.label || levelKey}: ${lessonN} lessons (${afterN} after lunch), start ${config.school_start}`
        );

        const orderedSlots = (createdSlots || []).slice().sort((a: any, b: any) => a.slot_order - b.slot_order);
        const fixedSlots = orderedSlots.filter((s: any) => ['break', 'lunch', 'activity', 'activities'].includes(s.slot_type));
        const lessonSlots = orderedSlots.filter((s: any) => s.slot_type === 'lesson');
        const exactGridIssues = getExactGridAssignmentIssues({
          classes: classesToProcess,
          assignments,
          totalLessons: lessonSlots.length,
        });
        if (exactGridIssues.length > 0) {
          const levelLabel = LEVEL_GROUPS.find((level) => level.key === levelKey)?.label || levelKey;
          const details = exactGridIssues
            .slice(0, 8)
            .map((issue) => `• ${issue.message}`)
            .join('\n');
          const more = exactGridIssues.length > 8 ? `\n• And ${exactGridIssues.length - 8} more assignment constraint issue(s).` : '';
          throw new Error(`${levelLabel} cannot generate an exact timetable with the current Teacher Assignments:\n${details}${more}\nUpdate the listed available weekdays or weekly lesson counts, then generate again.`);
        }
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

        // Track each teacher’s configured double-day window as a soft preference.
        // It must not become a hard block: when two double assignments share a
        // teacher/day, one pair may move to another valid day and the released
        // cells must remain available to ordinary lessons.
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

        // === Exact CSP solver. Every class in this level is solved as one
        // constraint system. Doubles and IRE/CRE sharing are atomic units, so
        // no repair pass can split them or silently change weekly counts.
        {
          const levelLabel = LEVEL_GROUPS.find((l) => l.key === levelKey)?.label || levelKey;
          const subjectNames = new Map<string, string>();
          assignments
            .filter((assignment: any) => classesInLevel.has(String(assignment.class_id)))
            .forEach((assignment: any) => subjectNames.set(String(assignment.subject_id), String(assignment.subjects?.name || assignment.subject_name || '')));
          const requiredLessonCounts = new Map<string, number>();
          assignments
            .filter((assignment: any) => classesInLevel.has(String(assignment.class_id)))
            .forEach((assignment: any) => requiredLessonCounts.set(
              `${String(assignment.class_id)}-${String(assignment.subject_id)}`,
              Number(assignment.lessons_per_week || 0),
            ));

          const solverResult = solveTimetableCsp({
            schoolId,
            levelKey,
            classes: classesToProcess,
            assignments,
            lessonSlots,
            reservedTeacherCells: cspReservedTeacherCells,
            // Rule 14 warns rather than blocks. When the admin has seen the
            // lesson-count warning and chosen to continue, the classes that can be
            // complete still are; only the shortfall cells are left empty.
            allowIncompleteClasses: Boolean(runOptions.continuePastWarning),
            onProgress: (message) => console.info(`[timetable] ${message}`),
          });
          const dataWarnings = solverResult.warnings.filter((warning) => warning.code.startsWith('weekly-total-'));
          const solverWarnings = solverResult.warnings.filter((warning) => !warning.code.startsWith('weekly-total-'));
          // A data warning is actionable and may be accepted by the admin. Any
          // other warning indicates a solver/capacity problem and must block the
          // write just like an issue; never persist a partially diagnosed grid.
          if (solverWarnings.length > 0) {
            throw new Error(`${levelLabel} solver error — generation stopped safely before saving:\n${formatCspSolverWarnings(solverWarnings)}`);
          }
          // Rule 14 - a class whose weekly lessons do not fill this level's week is
          // a WARNING, never a block. The admin is shown exactly which classes are
          // short and decides whether to continue; nothing is saved before that.
          if (solverResult.needsConfirmation && !runOptions.continuePastWarning) {
            const short = solverResult.shortClasses;
            const details = short.map((entry) => (entry.configuredTotal < entry.expectedTotal
              ? `${entry.className}: ${entry.configuredTotal} lessons, but this level's week holds ${entry.expectedTotal} (${entry.expectedTotal - entry.configuredTotal} fewer)`
              : `${entry.className}: ${entry.configuredTotal} lessons, but this level's week holds ${entry.expectedTotal} (${entry.configuredTotal - entry.expectedTotal} more)`));
            const over = short.some((entry) => entry.configuredTotal > entry.expectedTotal);
            setPendingShortfall({
              levelKey,
              levelLabel,
              message: `${levelLabel}: these classes do not match the level's weekly lesson count.`,
              details,
              canContinue: !over,
              reason: over
                ? 'A class with MORE lessons than the week holds cannot be fitted. Add lessons to the level, or remove assignments from those classes, then generate again.'
                : 'You can continue anyway: every lesson you configured is still placed, and only the cells those classes have no lessons for are left empty. Correcting the counts in Teacher Assignments gives a fully filled week.',
            });
            setGenerating(false);
            return;
          }
          if (solverResult.issues.length > 0 || solverResult.entries.length === 0) {
            const detail = formatCspSolverIssues(solverResult.issues) || 'The CSP solver returned no complete grid.';
            throw new Error(`${levelLabel} generation stopped safely before saving:\n${detail}`);
          }

          assertTimetableRules({
            entries: [...allEntries, ...solverResult.entries],
            slots: createdSlots,
            subjectNames,
            classes: classesToProcess,
            levelGroup: levelKey,
            // Continuing past a Rule 14 warning means only the classes the admin
            // saw in the warning may keep empty cells; every other class must
            // still be completely filled.
            requireComplete: true,
            allowBlankSlotsForClassIds: runOptions.continuePastWarning
              ? solverResult.shortClasses.map((entry) => entry.classId)
              : undefined,
            requiredLessonCounts,
            requireReligiousPairing: true,
          });

          allEntries.push(...solverResult.entries);
          solverResult.entries.forEach((entry: any) => {
            if (entry.teacher_id) teacherBusy.add(`${entry.teacher_id}-${entry.day_of_week}-${entry.time_slot_id}`);
            if (entry.teacher_id) {
              const lessonIndex = lessonSlots.findIndex((slot: any) => String(slot.id) === String(entry.time_slot_id));
              if (lessonIndex >= 0) cspReservedTeacherCells.add(`${entry.teacher_id}|${Number(entry.day_of_week) - 1}|${lessonIndex}`);
            }
            classBusy.add(`${entry.class_id}-${entry.day_of_week}-${entry.time_slot_id}`);
          });
          generatedSummary.push(
            `${levelLabel}: ${solverResult.entries.length} entries across 5 days - complete CSP grid (exact weekly totals, ${solverResult.searchNodes.toLocaleString()} search nodes)`,
          );
          if (dataWarnings.length > 0 && runOptions.continuePastWarning) {
            generatedSummary.push(`Data warning accepted: ${formatCspSolverWarnings(dataWarnings)}`);
          }
          console.info(`[timetable] ${levelKey}: CSP solver placed ${solverResult.entries.length} entries in ${solverResult.durationMs}ms`);
          continue;
        }

        // The CSP solver above is the sole lesson-generation path.
        // Any solver error has already aborted before this point; data warnings
        // are handled through the explicit confirmation flow.
      }
      const teacherTimeSlots = new Map<string, any>();
      for (const entry of allEntries.filter((candidate: any) =>
        (candidate.entry_type === 'lesson' || candidate.entry_type === 'lesson_double') && candidate.teacher_id,
      )) {
        const key = `${entry.teacher_id}-${entry.day_of_week}-${entry.effective_start_time || ''}-${entry.effective_end_time || ''}`;
        const previous = teacherTimeSlots.get(key);
        if (previous && String(previous.class_id) !== String(entry.class_id)) {
          throw new Error(`Timetable generation stopped safely: teacher ${entry.teacher_id} is double-booked between classes ${previous.class_id} and ${entry.class_id} on day ${entry.day_of_week} at ${entry.effective_start_time || 'the same time'}. Adjust assignments or timetable setup and try again.`);
        }
        teacherTimeSlots.set(key, entry);
      }

      // Commit only after every selected level has passed generation and the
      // no-blank validation above. A failed generation therefore leaves the
      // client’s existing timetable untouched.
      const levelsToClear = new Set<string>([...Array.from(selectedLevels), 'default']);
      for (const levelKey of Array.from(levelsToClear)) {
        const { error: slotDeleteError } = await (supabase as any)
          .from('timetable_time_slots')
          .delete()
          .eq('school_id', schoolId)
          .eq('level_group', levelKey);
        if (slotDeleteError) throw slotDeleteError;
        const { error: entryDeleteError } = await (supabase as any)
          .from('timetable_entries')
          .delete()
          .eq('school_id', schoolId)
          .eq('level_group', levelKey);
        if (entryDeleteError) throw entryDeleteError;
      }
      if (pendingClassIds.size > 0) {
        const { error: classEntryDeleteError } = await (supabase as any)
          .from('timetable_entries')
          .delete()
          .eq('school_id', schoolId)
          .in('class_id', Array.from(pendingClassIds));
        if (classEntryDeleteError) throw classEntryDeleteError;
      }
      if (pendingSlots.length > 0) {
        const { error: slotInsertError } = await (supabase as any)
          .from('timetable_time_slots')
          .insert(pendingSlots);
        if (slotInsertError) throw slotInsertError;
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
            onClick={() => handleGenerateTimetable()}
            disabled={generating || selectedLevels.size === 0}
            className="w-full flex items-center justify-center gap-2 bg-[#2563EB] text-white px-6 py-4 rounded-2xl text-lg font-black hover:bg-[#1d4ed8] disabled:opacity-50 transition-all shadow-lg"
          >
            {generating ? <Loader2 className="animate-spin" /> : <Zap fill="white" />}
            {generating ? 'Generating...' : `GENERATE TIMETABLE (${selectedLevels.size} level${selectedLevels.size !== 1 ? 's' : ''})`}
          </button>
          {pendingShortfall && (
            <div
              role="alertdialog"
              aria-labelledby="shortfall-title"
              className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950"
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 id="shortfall-title" className="font-bold">
                    Data warning: {' '}
                    {pendingShortfall.canContinue
                      ? 'Lesson counts do not fill the week'
                      : 'Lesson counts exceed the week'}
                  </h3>
                  <p className="mt-1 text-sm">{pendingShortfall.message}</p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {pendingShortfall.details.map((detail, index) => (
                      <li key={`${detail}-${index}`} className="flex gap-2">
                        <span aria-hidden="true">&#8226;</span>
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-sm">{pendingShortfall.reason}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {pendingShortfall.canContinue && (
                      <button
                        type="button"
                        onClick={() => handleGenerateTimetable({ continuePastWarning: true })}
                        disabled={generating}
                        className="px-4 py-2 rounded-xl bg-[#2563EB] text-white text-sm font-bold hover:bg-[#1d4ed8] disabled:opacity-50"
                      >
                        Continue and generate
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setPendingShortfall(null)}
                      className="px-4 py-2 rounded-xl bg-white border border-amber-300 text-sm font-semibold text-amber-900 hover:bg-amber-100"
                    >
                      {pendingShortfall.canContinue ? 'Cancel - fix the counts first' : 'Close'}
                    </button>
                    <a
                      href="/school-admin/teacher-assignments"
                      className="px-4 py-2 rounded-xl bg-white border border-amber-300 text-sm font-semibold text-amber-900 hover:bg-amber-100"
                    >
                      Open Teacher Assignments
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

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
