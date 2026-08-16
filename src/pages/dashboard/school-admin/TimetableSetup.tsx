import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabaseUntyped } from '@/lib/supabase/client';
import { Clock, Save, AlertCircle, Copy, ChevronDown, Info, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { getLevelConfig } from '@/lib/timetable-generator';

// ─── Level Groups ────────────────────────────────────────────────────────────


/** Normalize HTML time / free text to HH:MM:SS for Postgres time columns */
function normalizeTime(value: string | null | undefined): string | null {
  if (value == null) return null;
  const v = String(value).trim();
  if (!v) return null;
  const m = v.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  const hh = m[1].padStart(2, '0');
  const mm = m[2];
  const ss = (m[3] || '00').padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}


export const LEVEL_GROUPS = [
  { key: 'pre-primary', label: 'Pre-Primary (PP1, PP2)', grades: 'PP1, PP2' },
  { key: 'lower-primary', label: 'Lower Primary (Grade 1-3)', grades: 'Grade 1, 2, 3' },
  { key: 'upper-primary', label: 'Upper Primary (Grade 4-6)', grades: 'Grade 4, 5, 6' },
  { key: 'combined-primary', label: 'Combined Primary (Grade 1-6)', grades: 'Grade 1-6' },
  { key: 'junior', label: 'Junior School (Grade 7-9)', grades: 'Grade 7, 8, 9' },
  { key: 'senior', label: 'Senior School (Grade 10-12)', grades: 'Grade 10, 11, 12' },
  { key: 'form-3-4', label: 'Form 3 & 4 (8-4-4)', grades: 'Form 3, Form 4' },
];

// Default timings per level group
const DEFAULT_CONFIGS: Record<string, LevelConfig> = {
  'pre-primary': {
    start_time: '08:30', end_time: '12:30', period_duration: 35,
    lessons_per_day: 6, after_lunch_lessons: 0,
    first_break_start: '09:45', first_break_end: '10:15',
    second_break_start: '11:15', second_break_end: '11:35',
    lunch_start: '12:00', lunch_end: '12:30',
    activities_start: '', activities_end: '',
  },
  'lower-primary': {
    start_time: '08:20', end_time: '12:50', period_duration: 40,
    lessons_per_day: 6, after_lunch_lessons: 0,
    first_break_start: '09:40', first_break_end: '10:20',
    second_break_start: '11:40', second_break_end: '12:00',
    lunch_start: '12:50', lunch_end: '13:30',
    activities_start: '', activities_end: '',
  },
  'upper-primary': {
    start_time: '08:00', end_time: '15:30', period_duration: 40,
    lessons_per_day: 7, after_lunch_lessons: 1,
    first_break_start: '09:40', first_break_end: '10:20',
    second_break_start: '11:40', second_break_end: '12:00',
    lunch_start: '12:50', lunch_end: '13:30',
    activities_start: '15:30', activities_end: '16:10',
  },
  'combined-primary': {
    start_time: '08:20', end_time: '15:00', period_duration: 40,
    lessons_per_day: 7, after_lunch_lessons: 1,
    first_break_start: '09:40', first_break_end: '10:20',
    second_break_start: '11:40', second_break_end: '12:00',
    lunch_start: '12:50', lunch_end: '13:30',
    activities_start: '15:00', activities_end: '15:40',
  },
  'junior': {
    start_time: '08:00', end_time: '16:00', period_duration: 40,
    lessons_per_day: 8, after_lunch_lessons: 2,
    first_break_start: '09:40', first_break_end: '10:20',
    second_break_start: '11:40', second_break_end: '12:00',
    lunch_start: '12:50', lunch_end: '13:30',
    activities_start: '16:00', activities_end: '16:40',
  },
  'senior': {
    start_time: '08:00', end_time: '16:00', period_duration: 40,
    lessons_per_day: 9, after_lunch_lessons: 2,
    first_break_start: '09:40', first_break_end: '10:20',
    second_break_start: '11:40', second_break_end: '12:00',
    lunch_start: '12:50', lunch_end: '13:30',
    activities_start: '16:00', activities_end: '16:40',
  },
  'form-3-4': {
    start_time: '08:00', end_time: '17:00', period_duration: 40,
    lessons_per_day: 8, after_lunch_lessons: 3,
    first_break_start: '09:40', first_break_end: '10:20',
    second_break_start: '11:40', second_break_end: '12:00',
    lunch_start: '12:50', lunch_end: '13:30',
    activities_start: '17:00', activities_end: '17:40',
  },
};

// Lesson info per level for display
const LEVEL_LESSON_INFO: Record<string, { total: number; afterLunch: number; note: string }> = {
  'pre-primary': { total: 6, afterLunch: 0, note: 'School ends at lunch' },
  'lower-primary': { total: 6, afterLunch: 0, note: '6 lessons ending before lunch' },
  'upper-primary': { total: 7, afterLunch: 1, note: '1 lesson after lunch' },
  'combined-primary': { total: 7, afterLunch: 1, note: '1 lesson after lunch' },
  'junior': { total: 8, afterLunch: 2, note: '2 lessons after lunch' },
  'senior': { total: 9, afterLunch: 2, note: '2 lessons after lunch' },
  'form-3-4': { total: 8, afterLunch: 3, note: '3 lessons after lunch' },
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScheduledActivity {
  id: string;
  day_of_week: number;
  activity_name: string;
  start_time: string;
  end_time: string;
  target_classes: string;
}

interface LevelConfig {
  start_time: string;
  end_time: string;
  period_duration: number;
  first_break_start: string;
  first_break_end: string;
  second_break_start: string;
  second_break_end: string;
  lunch_start: string;
  lunch_end: string;
  activities_start: string;
  activities_end: string;
  lessons_per_day: number;
  after_lunch_lessons: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TimetableSetup() {
  const { user } = useAuth();
  const [schoolId, setSchoolId] = useState<string>('');
  const [selectedLevel, setSelectedLevel] = useState<string>('lower-primary');
  const [configs, setConfigs] = useState<Record<string, LevelConfig>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copyFrom, setCopyFrom] = useState('');
  const [copyTo, setCopyTo] = useState('');
  const [activities, setActivities] = useState<ScheduledActivity[]>([]);
  const [activityDraft, setActivityDraft] = useState({ day_of_week: 5, activity_name: 'PPI', start_time: '08:00', end_time: '08:20', target_classes: 'Primary and Junior School' });
  const [savingActivity, setSavingActivity] = useState(false);

  useEffect(() => {
    fetchData();
  }, [user?.id]);

  const resolveSchoolId = async () => {
    if (user?.schoolId) return user.schoolId;
    const { data: profile } = await supabaseUntyped.from('profiles').select('school_id').eq('id', user?.id).single();
    return profile?.school_id || '';
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const resolvedSchoolId = await resolveSchoolId();
      if (!resolvedSchoolId) {
        toast.error('No school assigned to your account');
        return;
      }
      setSchoolId(resolvedSchoolId);

      // Fetch all level configs for this school
      const { data: levelConfigs, error } = await supabaseUntyped
        .from('timetable_level_configs')
        .select('*')
        .eq('school_id', resolvedSchoolId);

      if (error) {
        console.error('Level configs fetch error:', error);
      }

      // Build configs map from DB data, falling back to defaults
      const configMap: Record<string, LevelConfig> = {};
      LEVEL_GROUPS.forEach(({ key }) => {
        const dbConfig = (levelConfigs || []).find((c: any) => c.level_group === key);
        if (dbConfig) {
          configMap[key] = {
            start_time: dbConfig.start_time?.slice(0, 5) || DEFAULT_CONFIGS[key].start_time,
            end_time: dbConfig.end_time?.slice(0, 5) || DEFAULT_CONFIGS[key].end_time,
            period_duration: dbConfig.period_duration || DEFAULT_CONFIGS[key].period_duration,
            lessons_per_day: dbConfig.lessons_per_day ?? DEFAULT_CONFIGS[key].lessons_per_day ?? LEVEL_LESSON_INFO[key]?.total ?? 7,
            after_lunch_lessons: dbConfig.after_lunch_lessons ?? DEFAULT_CONFIGS[key].after_lunch_lessons ?? LEVEL_LESSON_INFO[key]?.afterLunch ?? 1,
            first_break_start: dbConfig.first_break_start?.slice(0, 5) || DEFAULT_CONFIGS[key].first_break_start,
            first_break_end: dbConfig.first_break_end?.slice(0, 5) || DEFAULT_CONFIGS[key].first_break_end,
            second_break_start: dbConfig.second_break_start?.slice(0, 5) || DEFAULT_CONFIGS[key].second_break_start,
            second_break_end: dbConfig.second_break_end?.slice(0, 5) || DEFAULT_CONFIGS[key].second_break_end,
            lunch_start: dbConfig.lunch_start?.slice(0, 5) || DEFAULT_CONFIGS[key].lunch_start,
            lunch_end: dbConfig.lunch_end?.slice(0, 5) || DEFAULT_CONFIGS[key].lunch_end,
            activities_start: dbConfig.activities_start?.slice(0, 5) || DEFAULT_CONFIGS[key].activities_start,
            activities_end: dbConfig.activities_end?.slice(0, 5) || DEFAULT_CONFIGS[key].activities_end,
          };
        } else {
          configMap[key] = { ...DEFAULT_CONFIGS[key] };
        }
      });

      setConfigs(configMap);

      const { data: activityRows, error: activityError } = await supabaseUntyped
        .from('after_school_activities')
        .select('id, day_of_week, activity_name, start_time, end_time, target_classes')
        .eq('school_id', resolvedSchoolId)
        .order('day_of_week')
        .order('start_time');
      if (activityError) console.warn('Activity schedule fetch warning:', activityError.message);
      setActivities((activityRows || []).map((a: any) => ({
        id: a.id,
        day_of_week: Number(a.day_of_week),
        activity_name: a.activity_name || '',
        start_time: String(a.start_time || '').slice(0, 5),
        end_time: String(a.end_time || '').slice(0, 5),
        target_classes: a.target_classes || 'All',
      })));
    } catch (err: any) {
      console.error('fetchData error:', err);
      toast.error('Failed to load timetable setup: ' + (err?.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const currentConfig = configs[selectedLevel] || DEFAULT_CONFIGS[selectedLevel] || DEFAULT_CONFIGS['lower-primary'];
  const lessonInfo = LEVEL_LESSON_INFO[selectedLevel];
  const isPrePrimary = selectedLevel === 'pre-primary';

  const handleConfigChange = (field: keyof LevelConfig, value: any) => {
    let v = value;
    const timeFields = [
      'start_time','end_time','first_break_start','first_break_end',
      'second_break_start','second_break_end','lunch_start','lunch_end',
      'activities_start','activities_end',
    ];
    if (timeFields.includes(field) && typeof v === 'string' && v.includes(':')) {
      v = v.slice(0, 5);
    }
    setConfigs(prev => ({
      ...prev,
      [selectedLevel]: {
        ...prev[selectedLevel],
        [field]: v,
      },
    }));
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      if (!schoolId) throw new Error('No school ID found. Please log in again.');

      const cfg = configs[selectedLevel];
      const requiredTimes: (keyof LevelConfig)[] = [
        'start_time', 'first_break_start', 'first_break_end',
        'second_break_start', 'second_break_end', 'lunch_start', 'lunch_end',
      ];
      for (const key of requiredTimes) {
        if (!normalizeTime(String(cfg[key] ?? ''))) {
          throw new Error(`Invalid time for ${String(key).replace(/_/g, ' ')}. Use HH:MM format.`);
        }
      }
      const afterLunch = Math.max(0, Math.min(3, Number(cfg.after_lunch_lessons ?? 0)));
      const lessonsPerDay = Math.max(6, Math.min(9, Number(cfg.lessons_per_day ?? (6 + afterLunch))));
      // Keep invariant: total = 6 before lunch + after lunch
      const normalizedLessons = 6 + afterLunch;
      // end_time is no longer edited in UI — use Activities End (or Lunch End for pre-primary)
      const derivedEnd =
        normalizeTime(cfg.activities_end) ||
        normalizeTime(cfg.lunch_end) ||
        normalizeTime(cfg.end_time);
      const payload = {
          school_id: schoolId,
          level_group: selectedLevel,
          start_time: normalizeTime(cfg.start_time),
          end_time: derivedEnd,
          period_duration: Number(cfg.period_duration) || 40,
          first_break_start: normalizeTime(cfg.first_break_start),
          first_break_end: normalizeTime(cfg.first_break_end),
          second_break_start: normalizeTime(cfg.second_break_start),
          second_break_end: normalizeTime(cfg.second_break_end),
          lunch_start: normalizeTime(cfg.lunch_start),
          lunch_end: normalizeTime(cfg.lunch_end),
          activities_start: normalizeTime(cfg.activities_start),
          activities_end: normalizeTime(cfg.activities_end),
          lessons_per_day: normalizedLessons,
          after_lunch_lessons: afterLunch,
          updated_at: new Date().toISOString(),
        };
      console.info('[TimetableSetup] saving', payload);

      const { data: savedRows, error } = await supabaseUntyped
        .from('timetable_level_configs')
        .upsert(payload, { onConflict: 'school_id,level_group' })
        .select('*');

      if (error) throw new Error('Failed to save: ' + error.message);
      if (!savedRows || savedRows.length === 0) {
        throw new Error('Save returned no rows — check database permissions (RLS).');
      }

      const saved = savedRows[0];
      // Reflect exact DB values in local state so UI matches what Generate will use
      setConfigs(prev => ({
        ...prev,
        [selectedLevel]: {
          start_time: (saved.start_time || payload.start_time || '').toString().slice(0, 5),
          end_time: (saved.end_time || payload.end_time || '').toString().slice(0, 5),
          period_duration: saved.period_duration || payload.period_duration,
          first_break_start: (saved.first_break_start || payload.first_break_start || '').toString().slice(0, 5),
          first_break_end: (saved.first_break_end || payload.first_break_end || '').toString().slice(0, 5),
          second_break_start: (saved.second_break_start || payload.second_break_start || '').toString().slice(0, 5),
          second_break_end: (saved.second_break_end || payload.second_break_end || '').toString().slice(0, 5),
          lunch_start: (saved.lunch_start || payload.lunch_start || '').toString().slice(0, 5),
          lunch_end: (saved.lunch_end || payload.lunch_end || '').toString().slice(0, 5),
          activities_start: (saved.activities_start || payload.activities_start || '').toString().slice(0, 5),
          activities_end: (saved.activities_end || payload.activities_end || '').toString().slice(0, 5),
          lessons_per_day: saved.lessons_per_day ?? normalizedLessons,
          after_lunch_lessons: saved.after_lunch_lessons ?? afterLunch,
        },
      }));

      toast.success(
        `Saved ${LEVEL_GROUPS.find(l => l.key === selectedLevel)?.label}: start ${(saved.start_time || '').toString().slice(0,5)}, lunch ${(saved.lunch_start || '').toString().slice(0,5)}–${(saved.lunch_end || '').toString().slice(0,5)}, ${saved.lessons_per_day ?? normalizedLessons} lessons (${saved.after_lunch_lessons ?? afterLunch} after lunch). Now open Generate Timetable.`
      );
    } catch (err: any) {
      toast.error(err.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleAddActivity = async () => {
    if (!schoolId) return;
    const name = activityDraft.activity_name.trim();
    if (!name) { toast.error('Enter an activity name'); return; }
    if (!normalizeTime(activityDraft.start_time) || !normalizeTime(activityDraft.end_time)) { toast.error('Enter valid activity times'); return; }
    if (activityDraft.end_time <= activityDraft.start_time) { toast.error('Activity end time must be after its start time'); return; }
    setSavingActivity(true);
    try {
      const { data, error } = await supabaseUntyped.from('after_school_activities').insert({
        school_id: schoolId,
        day_of_week: activityDraft.day_of_week,
        activity_name: name,
        start_time: normalizeTime(activityDraft.start_time),
        end_time: normalizeTime(activityDraft.end_time),
        target_classes: activityDraft.target_classes.trim() || 'All',
      }).select('id, day_of_week, activity_name, start_time, end_time, target_classes').single();
      if (error) throw error;
      if (data) setActivities(prev => [...prev, { ...data, start_time: String(data.start_time).slice(0, 5), end_time: String(data.end_time).slice(0, 5), target_classes: data.target_classes || 'All' }].sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time)));
      toast.success(`${name} activity schedule saved.`);
    } catch (err: any) {
      toast.error('Failed to save activity: ' + (err.message || 'Unknown error'));
    } finally {
      setSavingActivity(false);
    }
  };

  const handleDeleteActivity = async (activity: ScheduledActivity) => {
    const { error } = await supabaseUntyped.from('after_school_activities').delete().eq('id', activity.id).eq('school_id', schoolId);
    if (error) { toast.error('Failed to remove activity: ' + error.message); return; }
    setActivities(prev => prev.filter(a => a.id !== activity.id));
    toast.success('Activity schedule removed.');
  };

  const handleCopyConfig = () => {
    if (!copyFrom || !copyTo) {
      toast.error('Please select both source and destination levels');
      return;
    }
    if (copyFrom === copyTo) {
      toast.error('Source and destination must be different');
      return;
    }
    const sourceConfig = configs[copyFrom];
    if (!sourceConfig) {
      toast.error('Source configuration not found');
      return;
    }
    setConfigs(prev => ({
      ...prev,
      [copyTo]: { ...sourceConfig },
    }));
    const fromLabel = LEVEL_GROUPS.find(l => l.key === copyFrom)?.label;
    const toLabel = LEVEL_GROUPS.find(l => l.key === copyTo)?.label;
    toast.success(`Configuration copied from ${fromLabel} to ${toLabel}. Remember to save!`);
    setSelectedLevel(copyTo);
  };

  if (loading) return <div className="text-center py-8 text-sm text-gray-500">Loading timetable configuration...</div>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-black text-[#111111]">Timetable Setup</h1>
        <p className="text-sm text-[#666666]">Configure lesson durations and break times for each school level group.</p>
      </div>

      {/* School Day Structure Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex gap-3 text-sm text-blue-900">
        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-blue-600" />
        <div>
          <p className="font-bold mb-1">School Day Structure:</p>
          <p>
            Lesson 1 &amp; 2 → <strong>FIRST BREAK</strong> → Lesson 3 &amp; 4 → <strong>SECOND BREAK</strong> → Lesson 5 &amp; 6 → <strong>LUNCH</strong> → [Lesson 7+] → <strong>ACTIVITIES</strong>
          </p>
          <p className="mt-1 text-xs text-blue-700">
            Pre-Primary: <strong>6 lessons (ends at lunch)</strong> | Lower Primary: <strong>6 lessons (ends at lunch)</strong> | Upper Primary: <strong>7 lessons</strong> | Junior/8-4-4: <strong>8 lessons</strong> | Senior: <strong>9 lessons</strong>
          </p>
        </div>
      </div>

      {/* Level Selector */}
      <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
        <h2 className="text-lg font-bold text-[#111111] mb-4">Select Level to Configure</h2>
        <div className="relative">
          <select
            value={selectedLevel}
            onChange={e => setSelectedLevel(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] bg-white appearance-none pr-10"
          >
            {LEVEL_GROUPS.map(({ key, label }) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
        <div className="mt-3 p-3 bg-gray-50 rounded-xl">
          <p className="text-xs text-gray-500">
            Grades: <strong>{LEVEL_GROUPS.find(l => l.key === selectedLevel)?.grades}</strong>
          </p>
          {lessonInfo && (
            <p className={`text-xs mt-1 font-semibold ${isPrePrimary ? 'text-amber-600' : 'text-blue-600'}`}>
              <Info className="w-3 h-3 inline mr-1" />
              {lessonInfo.total} lessons per day — {lessonInfo.note}
              {((isPrePrimary || selectedLevel === 'lower-primary') && (
                <span className="block mt-0.5 text-amber-500 font-normal">
                  This level ends at lunch. Leave the generic Activities window empty; individually scheduled activities can still be added at an explicit time.
                </span>
              ))}
            </p>
          )}
        </div>
      </div>

      {/* Level Configuration Form */}
      <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
        <h2 className="text-lg font-bold text-[#111111] mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-[#2563EB]" />
          Configure: {LEVEL_GROUPS.find(l => l.key === selectedLevel)?.label}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Lesson Duration */}
          <div>
            <label className="block text-sm font-medium text-[#111111] mb-2">Lesson duration (min)</label>
            <input
              type="number"
              value={currentConfig.period_duration}
              onChange={e => handleConfigChange('period_duration', parseInt(e.target.value) || 40)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              min={20} max={90}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#111111] mb-2">Lessons after lunch</label>
            <select
              value={currentConfig.after_lunch_lessons ?? 1}
              onChange={e => {
                const after = parseInt(e.target.value) || 0;
                handleConfigChange('after_lunch_lessons', after);
                handleConfigChange('lessons_per_day', 6 + after);
              }}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            >
              <option value={0}>0 — ends at lunch (Pre-Primary / Lower Primary)</option>
              <option value={1}>1 — Lower / Upper Primary</option>
              <option value={2}>2 — Junior / 8-4-4</option>
              <option value={3}>3 — Senior School</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Total lessons/day = 6 before lunch + {currentConfig.after_lunch_lessons ?? 0} after = <strong>{6 + (currentConfig.after_lunch_lessons ?? 0)}</strong>
            </p>
          </div>
          <TimeInput label="School starts" value={currentConfig.start_time} onChange={v => handleConfigChange('start_time', v)} />
          <div className="hidden md:block" />

          <TimeInput label="FIRST BREAK starts" value={currentConfig.first_break_start} onChange={v => handleConfigChange('first_break_start', v)} />
          <TimeInput label="FIRST BREAK ends" value={currentConfig.first_break_end} onChange={v => handleConfigChange('first_break_end', v)} />
          <div className="hidden md:block" />

          <TimeInput label="SECOND BREAK starts" value={currentConfig.second_break_start} onChange={v => handleConfigChange('second_break_start', v)} />
          <TimeInput label="SECOND BREAK ends" value={currentConfig.second_break_end} onChange={v => handleConfigChange('second_break_end', v)} />
          <div className="hidden md:block" />

          <TimeInput label="LUNCH starts" value={currentConfig.lunch_start} onChange={v => handleConfigChange('lunch_start', v)} />
          <TimeInput label="LUNCH ends" value={currentConfig.lunch_end} onChange={v => handleConfigChange('lunch_end', v)} />
          <div className="hidden md:block" />

          {!(isPrePrimary || selectedLevel === 'lower-primary') && (
            <>
              <TimeInput label="ACTIVITIES starts" value={currentConfig.activities_start} onChange={v => handleConfigChange('activities_start', v)} />
              <TimeInput label="ACTIVITIES ends" value={currentConfig.activities_end} onChange={v => handleConfigChange('activities_end', v)} />
            </>
          )}
          {isPrePrimary && (
            <div className="md:col-span-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
              <Info className="w-4 h-4 inline mr-1" />
              This level ends at lunch time — no generic post-lunch activities window is needed.
            </div>
          )}
        </div>

        <button
          onClick={handleSaveConfig}
          disabled={saving}
          className="flex items-center gap-2 bg-[#2563EB] text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-[#1d4ed8] disabled:opacity-50 transition-colors"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>

      {/* Scheduled activities */}
      <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
        <h2 className="text-lg font-bold text-[#111111] mb-2 flex items-center gap-2">
          <Plus className="w-5 h-5 text-emerald-600" />
          Scheduled Activities
        </h2>
        <p className="text-sm text-gray-600 mb-4">Add PPI, games, guidance and counselling, debate club, or any other activity at a specific day and time. Use a target such as <strong>All</strong>, <strong>Grade 1</strong>, or <strong>Primary and Junior School</strong>.</p>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Day</label>
            <select value={activityDraft.day_of_week} onChange={e => setActivityDraft(prev => ({ ...prev, day_of_week: Number(e.target.value) }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white">
              <option value={1}>Monday</option><option value={2}>Tuesday</option><option value={3}>Wednesday</option><option value={4}>Thursday</option><option value={5}>Friday</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Activity type / name</label>
            <input value={activityDraft.activity_name} onChange={e => setActivityDraft(prev => ({ ...prev, activity_name: e.target.value }))} placeholder="e.g. PPI, Games, Debate Club" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm" />
          </div>
          <TimeInput label="Starts" value={activityDraft.start_time} onChange={v => setActivityDraft(prev => ({ ...prev, start_time: v }))} />
          <TimeInput label="Ends" value={activityDraft.end_time} onChange={v => setActivityDraft(prev => ({ ...prev, end_time: v }))} />
          <button onClick={handleAddActivity} disabled={savingActivity} className="flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"><Plus className="w-4 h-4" /> Add</button>
          <div className="md:col-span-3">
            <label className="block text-xs font-medium text-gray-700 mb-1">Target classes</label>
            <input value={activityDraft.target_classes} onChange={e => setActivityDraft(prev => ({ ...prev, target_classes: e.target.value }))} placeholder="All or Grade 1, Grade 2" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm" />
          </div>
        </div>
        <div className="mt-5 space-y-2">
          {activities.length === 0 ? <p className="text-sm text-gray-500 bg-gray-50 rounded-xl p-3">No scheduled activities yet.</p> : activities.map(activity => (
            <div key={activity.id} className="flex flex-wrap items-center justify-between gap-3 border border-gray-100 rounded-xl px-3 py-2.5 bg-gray-50">
              <div className="text-sm"><strong>{['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'][activity.day_of_week]}</strong> · {activity.activity_name} · {activity.start_time}–{activity.end_time} · {activity.target_classes}</div>
              <button onClick={() => handleDeleteActivity(activity)} className="text-red-600 hover:text-red-700 text-sm flex items-center gap-1"><Trash2 className="w-4 h-4" /> Remove</button>
            </div>
          ))}
        </div>
      </div>

      {/* Copy Configuration */}
      <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
        <h2 className="text-lg font-bold text-[#111111] mb-4 flex items-center gap-2">
          <Copy className="w-5 h-5 text-[#2563EB]" />
          Copy Configuration Between Levels
        </h2>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex-1 w-full">
            <label className="block text-xs text-gray-500 mb-1">Copy from</label>
            <select
              value={copyFrom}
              onChange={e => setCopyFrom(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] bg-white"
            >
              <option value="">Select source level</option>
              {LEVEL_GROUPS.map(({ key, label }) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div className="text-gray-400 font-bold mt-4 sm:mt-0">→</div>
          <div className="flex-1 w-full">
            <label className="block text-xs text-gray-500 mb-1">Apply to</label>
            <select
              value={copyTo}
              onChange={e => setCopyTo(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] bg-white"
            >
              <option value="">Select destination level</option>
              {LEVEL_GROUPS.map(({ key, label }) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleCopyConfig}
            className="mt-4 sm:mt-0 flex items-center gap-2 bg-amber-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-amber-600 transition-colors whitespace-nowrap"
          >
            <Copy className="w-4 h-4" /> Copy
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">After copying, remember to click &quot;Save Configuration&quot; to persist the changes.</p>
      </div>

      {/* Overview of all levels */}
      <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
        <h2 className="text-lg font-bold text-[#111111] mb-4">All Level Configurations Overview</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Level</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Lessons/Day</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">After Lunch</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Start</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Activities</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Duration</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Lunch</th>
              </tr>
            </thead>
            <tbody>
              {LEVEL_GROUPS.map(({ key, label }) => {
                const cfg = configs[key] || DEFAULT_CONFIGS[key];
                const info = LEVEL_LESSON_INFO[key];
                return (
                  <tr
                    key={key}
                    className={`border-b hover:bg-gray-50 cursor-pointer transition-colors ${selectedLevel === key ? 'bg-blue-50' : ''}`}
                    onClick={() => setSelectedLevel(key)}
                  >
                    <td className="px-4 py-3 font-medium text-[#111111]">{label}</td>
                    <td className="px-4 py-3">
                      <span className={`font-semibold ${(cfg?.after_lunch_lessons ?? info?.afterLunch) === 0 ? 'text-amber-600' : 'text-blue-600'}`}>
                        {info?.total || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${(cfg?.after_lunch_lessons ?? info?.afterLunch) === 0 ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                        {(cfg?.after_lunch_lessons ?? info?.afterLunch) === 0 ? 'Ends at lunch' : `${cfg?.after_lunch_lessons ?? info?.afterLunch} lesson${(cfg?.after_lunch_lessons ?? info?.afterLunch) !== 1 ? 's' : ''}`}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{cfg?.start_time || '-'}</td>
                    <td className="px-4 py-3 text-gray-600">{cfg?.activities_start && cfg?.activities_end ? `${cfg.activities_start} – ${cfg.activities_end}` : (cfg?.activities_end || cfg?.end_time || '-')}</td>
                    <td className="px-4 py-3 text-gray-600">{cfg?.period_duration || 40} min</td>
                    <td className="px-4 py-3 text-gray-600">{cfg?.lunch_start || '-'} – {cfg?.lunch_end || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500 mt-2">Click a row to edit that level&apos;s configuration.</p>
      </div>
    </div>
  );
}

function TimeInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#111111] mb-2">{label}</label>
      <input
        type="time"
        value={value?.slice(0, 5) || ''}
        onChange={e => onChange(e.target.value)}
        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
      />
    </div>
  );
}
