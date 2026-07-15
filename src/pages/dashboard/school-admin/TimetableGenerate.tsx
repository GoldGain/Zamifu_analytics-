import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { supabaseUntyped } from '@/lib/supabase/client';
import { Zap, CheckCircle, Loader2, Clock, AlertCircle, Info } from 'lucide-react';
import { toast } from 'sonner';
import { generateSlots, getLessonCountForLevel, getLevelConfig, resolveLessonTargets } from '@/lib/timetable-generator';
import { LEVEL_GROUPS } from './TimetableSetup';

// Frontend config interface (matches what timetable-generator expects)
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
}

// Map level config DB row to frontend config
const mapLevelConfigToFrontend = (dbConfig: any, dbActivities: Record<string, string>): FrontendConfig => ({
  lesson_duration: dbConfig.period_duration || 40,
  school_start: dbConfig.start_time?.slice(0, 5) || '08:20',
  school_end: dbConfig.end_time?.slice(0, 5) || '15:40',
  first_break_start: dbConfig.first_break_start?.slice(0, 5) || '09:40',
  first_break_end: dbConfig.first_break_end?.slice(0, 5) || '10:20',
  second_break_start: dbConfig.second_break_start?.slice(0, 5) || '11:40',
  second_break_end: dbConfig.second_break_end?.slice(0, 5) || '12:20',
  lunch_start: dbConfig.lunch_start?.slice(0, 5) || '12:50',
  lunch_end: dbConfig.lunch_end?.slice(0, 5) || '13:30',
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
    school_start: dbConfig.school_start_time?.slice(0, 5) || '08:20',
    school_end: dbConfig.school_end_time?.slice(0, 5) || '15:40',
    first_break_start: dbConfig.morning_break_start?.slice(0, 5) || '09:40',
    first_break_end: dbConfig.morning_break_end?.slice(0, 5) || '10:20',
    second_break_start: dbConfig.afternoon_break_start?.slice(0, 5) || '11:40',
    second_break_end: dbConfig.afternoon_break_end?.slice(0, 5) || '12:20',
    lunch_start: dbConfig.lunch_start?.slice(0, 5) || '12:50',
    lunch_end: dbConfig.lunch_end?.slice(0, 5) || '13:30',
    activities: dbActivities,
  };
};

// Map level group key to class grade_level ranges
const LEVEL_GROUP_GRADE_RANGES: Record<string, number[]> = {
  'pre-primary': [-2, -1, 0],
  'lower-primary': [1, 2, 3],
  'upper-primary': [4, 5, 6],
  'combined-primary': [1, 2, 3, 4, 5, 6],
  'junior': [7, 8, 9],
  'senior': [10, 11, 12],
  'form-3-4': [11, 12], // Form 3=11, Form 4=12 in 8-4-4
};

// Display info for each level's lesson structure
const LEVEL_LESSON_INFO: Record<string, { lessons: number; afterLunch: number; note: string }> = {
  'pre-primary': { lessons: 6, afterLunch: 0, note: 'School ends at lunch time' },
  'lower-primary': { lessons: 7, afterLunch: 1, note: '1 lesson after lunch' },
  'upper-primary': { lessons: 7, afterLunch: 1, note: '1 lesson after lunch' },
  'combined-primary': { lessons: 7, afterLunch: 1, note: '1 lesson after lunch' },
  'junior': { lessons: 8, afterLunch: 2, note: '2 lessons after lunch' },
  'senior': { lessons: 9, afterLunch: 3, note: '3 lessons after lunch' },
  'form-3-4': { lessons: 8, afterLunch: 2, note: '2 lessons after lunch' },
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
  const [selectedLevels, setSelectedLevels] = useState<Set<string>>(new Set(['lower-primary']));

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

      // Fetch activities
      const { data: activitiesData } = await supabase
        .from('school_activities')
        .select('day_of_week, activity_name')
        .eq('school_id', schoolId)
        .order('day_of_week');

      const activities: Record<string, string> = {};
      (activitiesData || []).forEach((a: any) => {
        activities[String(a.day_of_week)] = a.activity_name;
      });

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
      toast.error('Please select at least one level to generate');
      return;
    }

    try {
      setGenerating(true);
      const schoolId = user?.schoolId;

      // Fetch all active classes
      const { data: allClasses } = await supabase.from('classes').select('*').eq('school_id', schoolId).eq('is_active', true);
      const { data: assignments } = await supabase.from('teacher_subject_assignments').select('*, subjects(name, code)').eq('school_id', schoolId).eq('is_active', true);

      if (!allClasses?.length || !assignments?.length) {
        throw new Error('Classes or assignments missing. Please set up classes and teacher assignments first.');
      }

      // Fetch activities
      const { data: activitiesData } = await supabase
        .from('school_activities').select('day_of_week, activity_name').eq('school_id', schoolId).order('day_of_week');
      const activities: Record<string, string> = {};
      (activitiesData || []).forEach((a: any) => { activities[String(a.day_of_week)] = a.activity_name; });

      // Clear existing entries and slots ONLY for selected levels (prevents duplicate key errors)
      for (const levelKey of Array.from(selectedLevels)) {
        await (supabase as any).from('timetable_entries').delete().eq('school_id', schoolId).eq('level_group', levelKey);
        await (supabase as any).from('timetable_time_slots').delete().eq('school_id', schoolId).eq('level_group', levelKey);
      }

      const teacherBusy = new Set<string>();
      const classBusy = new Set<string>();
      const allEntries: any[] = [];

      // Process each selected level group
      for (const levelKey of Array.from(selectedLevels)) {
        // Get config for this level (level-specific or legacy fallback)
        const levelDbConfig = levelConfigs[levelKey];
        const config: FrontendConfig = levelDbConfig
          ? mapLevelConfigToFrontend(levelDbConfig, activities)
          : (legacyConfig || {
              lesson_duration: 40, school_start: '08:20', school_end: '15:40',
              first_break_start: '09:40', first_break_end: '10:20',
              second_break_start: '11:40', second_break_end: '12:20',
              lunch_start: '12:50', lunch_end: '13:30', activities,
            });

        // Validate required fields
        const requiredFields = ['first_break_start', 'first_break_end', 'second_break_start', 'second_break_end', 'lunch_start', 'lunch_end'];
        for (const field of requiredFields) {
          if (!config[field as keyof FrontendConfig]) {
            toast.error(`Missing ${field} in configuration for ${LEVEL_GROUPS.find(l => l.key === levelKey)?.label}. Please configure it first.`);
            setGenerating(false);
            return;
          }
        }

        // Generate time slots using DB lesson counts (fallback to level defaults)
        const targets = resolveLessonTargets(levelKey, config);
        const lessonCount = targets.totalLessons;
        const slots = generateSlots(
          {
            ...config,
            lessons_per_day: targets.totalLessons,
            after_lunch_lessons: targets.afterLunch,
          },
          lessonCount,
          levelKey
        );
        console.info(`[timetable] ${levelKey}: ${targets.totalLessons} lessons (${targets.afterLunch} after lunch), ${slots.filter(s => s.slot_type === 'lesson').length} lesson slots generated`);

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

        // Filter classes for this level group
        const gradeRange = LEVEL_GROUP_GRADE_RANGES[levelKey] || [];
        const levelClasses = allClasses.filter((cls: any) => {
          const gradeLevel = cls.grade_level ?? cls.level;
          return gradeRange.includes(Number(gradeLevel));
        });

        // If no classes match the grade range, use all classes for this level (fallback)
        const classesToProcess = levelClasses.length > 0 ? levelClasses : allClasses;

        const fixedSlots = createdSlots?.filter(s => ['break', 'lunch', 'activity', 'activities'].includes(s.slot_type)) || [];
        const lessonSlots = createdSlots?.filter(s => s.slot_type === 'lesson').sort((a, b) => a.slot_order - b.slot_order) || [];

        // Fill fixed slots for each class
        for (const cls of classesToProcess) {
          for (let day = 1; day <= 5; day++) {
            for (const slot of fixedSlots) {
              const isActivity = slot.slot_type === 'activities' || slot.slot_type === 'activity';
              allEntries.push({
                school_id: schoolId,
                day_of_week: day,
                time_slot_id: slot.id,
                class_id: cls.id,
                level_group: levelKey,
                entry_type: isActivity ? 'activity' : slot.slot_type,
                activity_name: isActivity ? (config.activities?.[String(day)] || 'Activity') : slot.label,
              });
            }
          }
        }

        // Allocate lessons
        for (const cls of classesToProcess) {
          const classAssignments = assignments.filter(a => a.class_id === cls.id);
          for (const assignment of classAssignments) {
            const lessonsToSchedule = assignment.lessons_per_week || 0;
            let scheduled = 0;
            for (let day = 1; day <= 5 && scheduled < lessonsToSchedule; day++) {
              for (const slot of lessonSlots) {
                const teacherKey = `${assignment.teacher_id}-${day}-${slot.id}`;
                const classKey = `${cls.id}-${day}-${slot.id}`;
                if (!teacherBusy.has(teacherKey) && !classBusy.has(classKey)) {
                  allEntries.push({
                    school_id: schoolId,
                    day_of_week: day,
                    time_slot_id: slot.id,
                    class_id: cls.id,
                    level_group: levelKey,
                    subject_id: assignment.subject_id,
                    teacher_id: assignment.teacher_id,
                    entry_type: 'lesson',
                  });
                  teacherBusy.add(teacherKey);
                  classBusy.add(classKey);
                  scheduled++;
                  break;
                }
              }
            }
          }
        }
      }

      // Bulk insert all entries
      if (allEntries.length > 0) {
        const { error: insertError } = await supabase.from('timetable_entries').insert(allEntries);
        if (insertError) throw insertError;
      }

      const levelLabels = Array.from(selectedLevels).map(k => LEVEL_GROUPS.find(l => l.key === k)?.label).join(', ');
      toast.success(`Timetable generated for: ${levelLabels}`);
      fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Generation failed');
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
        <div>
          <p className="font-bold mb-1">School Day Structure:</p>
          <p>Lesson 1 &amp; 2 → <strong>FIRST BREAK</strong> → Lesson 3 &amp; 4 → <strong>SECOND BREAK</strong> → Lesson 5 &amp; 6 → <strong>LUNCH</strong> → [Lesson 7] [+ Lesson 8 for Junior/8-4-4] [+ Lesson 9 for Senior] → <strong>ACTIVITIES</strong></p>
          <p className="mt-1 text-xs text-blue-700">
            Lesson structure is loaded from <strong>Timetable Setup</strong> (DB). Defaults: Pre-Primary 6/0 · Lower/Upper 7/1 · Junior & 8-4-4 8/2 · Senior 9/3 (total / after lunch).
          </p>
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
            const afterLunch = typeof dbCfg?.after_lunch_lessons === 'number'
              ? dbCfg.after_lunch_lessons
              : (defaults?.afterLunch ?? 1);
            const totalLessons = typeof dbCfg?.lessons_per_day === 'number'
              ? dbCfg.lessons_per_day
              : (defaults?.lessons ?? (6 + afterLunch));
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

          {lastGenerated && (
            <p className="text-center text-xs text-gray-400">Last generated: {lastGenerated}</p>
          )}
        </div>
      </div>
    </div>
  );
}
