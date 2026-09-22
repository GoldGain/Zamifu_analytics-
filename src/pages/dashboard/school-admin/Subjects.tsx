import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabaseUntyped } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  BookOpen,
  Check,
  CheckCircle2,
  Loader2,
  MinusCircle,
  Plus,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

type LearningAreaLevel = 'pre_school' | 'lower_primary' | 'upper_primary' | 'junior' | 'senior';
const CATEGORIES = ['Languages', 'Mathematics', 'Sciences', 'Humanities', 'Technical', 'Creative', 'Life Skills'] as const;
type CategoryType = typeof CATEGORIES[number];

type CatalogArea = {
  id: number;
  level: LearningAreaLevel;
  name: string;
  display_order: number;
};

type SchoolArea = {
  id: number;
  school_id: string;
  learning_area_id: number;
  is_active: boolean;
};

type LevelConfig = {
  key: LearningAreaLevel;
  label: string;
  shortLabel: string;
  description: string;
};

const LEVELS: LevelConfig[] = [
  {
    key: 'pre_school',
    label: 'Pre-School',
    shortLabel: 'Pre-School',
    description: 'Early years learning areas',
  },
  {
    key: 'lower_primary',
    label: 'Lower Primary',
    shortLabel: 'Lower Primary',
    description: 'Grades 1–3 learning areas',
  },
  {
    key: 'upper_primary',
    label: 'Upper Primary',
    shortLabel: 'Upper Primary',
    description: 'Grades 4–6 learning areas',
  },
  {
    key: 'junior',
    label: 'Junior School',
    shortLabel: 'Junior School',
    description: 'Grades 7–9 learning areas',
  },
  {
    key: 'senior',
    label: 'Senior School',
    shortLabel: 'Senior School',
    description: 'Core, elective, and additional KICD learning areas',
  },
];

const LEVEL_LABELS = Object.fromEntries(LEVELS.map((level) => [level.key, level.label])) as Record<LearningAreaLevel, string>;

function isLearningAreaLevel(value: unknown): value is LearningAreaLevel {
  return LEVELS.some((level) => level.key === value);
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : null;
}

function toCatalogAreas(rows: unknown[]): CatalogArea[] {
  return (rows || [])
    .map(toRecord)
    .filter((row): row is Record<string, unknown> => (
      row !== null
      && isLearningAreaLevel(row.level)
      && typeof row.name === 'string'
      && row.name.trim().length > 0
    ))
    .map((row) => ({
      id: Number(row.id),
      level: row.level as LearningAreaLevel,
      name: String(row.name),
      display_order: Number(row.display_order || 0),
    }))
    .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name));
}

function toSchoolAreas(rows: unknown[]): SchoolArea[] {
  return (rows || [])
    .map(toRecord)
    .filter((row): row is Record<string, unknown> => row !== null)
    .map((row) => ({
      id: Number(row.id),
      school_id: String(row.school_id),
      learning_area_id: Number(row.learning_area_id),
      is_active: row.is_active !== false,
    }));
}

export default function SchoolAdminSubjects() {
  const { user } = useAuth();
  const schoolId = user?.schoolId;
  const [catalog, setCatalog] = useState<CatalogArea[]>([]);
  const [schoolAreas, setSchoolAreas] = useState<SchoolArea[]>([]);
  const [activeLevel, setActiveLevel] = useState<LearningAreaLevel>('pre_school');
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualAdding, setManualAdding] = useState(false);
  const [manualForm, setManualForm] = useState({ name: '', code: '', category: '' as CategoryType | '' });

  const fetchLearningAreas = useCallback(async () => {
    if (!schoolId) return;

    setLoading(true);
    const [catalogResult, schoolAreasResult] = await Promise.all([
      supabaseUntyped
        .from('learning_area_catalog')
        .select('id, level, name, display_order')
        .order('level')
        .order('display_order'),
      supabaseUntyped
        .from('school_learning_areas')
        .select('id, school_id, learning_area_id, is_active')
        .eq('school_id', schoolId),
    ]);

    if (catalogResult.error) {
      toast.error(`Failed to load the learning-area catalogue: ${catalogResult.error.message}`);
      setCatalog([]);
    } else {
      setCatalog(toCatalogAreas(catalogResult.data || []));
    }

    if (schoolAreasResult.error) {
      toast.error(`Failed to load this school's learning areas: ${schoolAreasResult.error.message}`);
      setSchoolAreas([]);
    } else {
      setSchoolAreas(toSchoolAreas(schoolAreasResult.data || []));
    }

    setLoading(false);
  }, [schoolId]);

  useEffect(() => {
    // This effect synchronizes the page with the authenticated tenant's remote data.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchLearningAreas();
  }, [fetchLearningAreas]);

  const areasByLevel = useMemo(() => {
    const grouped = new Map<LearningAreaLevel, CatalogArea[]>();
    LEVELS.forEach((level) => grouped.set(level.key, []));
    catalog.forEach((area) => grouped.get(area.level)?.push(area));
    return grouped;
  }, [catalog]);

  const activeAreaIds = useMemo(
    () => new Set(schoolAreas.filter((area) => area.is_active).map((area) => area.learning_area_id)),
    [schoolAreas],
  );

  const updateAreaState = async (area: CatalogArea, shouldBeActive: boolean) => {
    if (!schoolId) return;

    setBusyKey(`area:${area.id}`);
    const result = shouldBeActive
      ? await supabaseUntyped
          .from('school_learning_areas')
          .upsert(
            {
              school_id: schoolId,
              learning_area_id: area.id,
              is_active: true,
            },
            { onConflict: 'school_id,learning_area_id' },
          )
      : await supabaseUntyped
          .from('school_learning_areas')
          .update({ is_active: false })
          .eq('school_id', schoolId)
          .eq('learning_area_id', area.id);

    if (result.error) {
      toast.error(`Could not ${shouldBeActive ? 'add' : 'remove'} ${area.name}: ${result.error.message}`);
    } else {
      toast.success(`${area.name} ${shouldBeActive ? 'added to' : 'removed from'} this school.`);
      await fetchLearningAreas();
    }
    setBusyKey(null);
  };

  const addAllForLevel = async (level: LevelConfig) => {
    if (!schoolId) return;
    const areas = areasByLevel.get(level.key) || [];
    if (areas.length === 0) {
      toast.error(`No ${level.label} learning areas are available.`);
      return;
    }

    setBusyKey(`add:${level.key}`);
    const { error } = await supabaseUntyped
      .from('school_learning_areas')
      .upsert(
        areas.map((area) => ({
          school_id: schoolId,
          learning_area_id: area.id,
          is_active: true,
        })),
        { onConflict: 'school_id,learning_area_id' },
      );

    if (error) {
      toast.error(`Could not add all ${level.label} learning areas: ${error.message}`);
    } else {
      toast.success(`All ${areas.length} ${level.label} learning areas are now active for this school.`);
      await fetchLearningAreas();
    }
    setBusyKey(null);
  };

  const removeAllForLevel = async (level: LevelConfig) => {
    if (!schoolId) return;
    const areas = areasByLevel.get(level.key) || [];
    if (areas.length === 0) return;

    setBusyKey(`remove:${level.key}`);
    const { error } = await supabaseUntyped
      .from('school_learning_areas')
      .update({ is_active: false })
      .eq('school_id', schoolId)
      .in('learning_area_id', areas.map((area) => area.id));

    if (error) {
      toast.error(`Could not remove all ${level.label} learning areas: ${error.message}`);
    } else {
      toast.success(`All ${level.label} learning areas were removed from this school.`);
      await fetchLearningAreas();
    }
    setBusyKey(null);
  };

  const addManualLearningArea = async () => {
    if (!schoolId) return;
    const name = manualForm.name.trim();
    if (!name) {
      toast.error('Learning area name is required.');
      return;
    }

    setManualAdding(true);
    const { error } = await supabaseUntyped.from('subjects').insert([{
      school_id: schoolId,
      name,
      code: manualForm.code.trim() || null,
      curriculum: 'CBE',
      category: manualForm.category || null,
      class_levels: [],
    }]);

    if (error) {
      toast.error(`Could not add ${name}: ${error.message}`);
    } else {
      toast.success(`Learning area "${name}" added successfully.`);
      setManualForm({ name: '', code: '', category: '' });
      setShowManualAdd(false);
    }
    setManualAdding(false);
  };

  const activeLevelConfig = LEVELS.find((level) => level.key === activeLevel) || LEVELS[0];
  const activeLevelAreas = areasByLevel.get(activeLevel) || [];
  const activeCount = activeLevelAreas.filter((area) => activeAreaIds.has(area.id)).length;
  const isSenior = activeLevel === 'senior';
  const seniorSections = isSenior
    ? [
        { title: 'Core subjects', areas: activeLevelAreas.slice(0, 4) },
        { title: 'Elective subjects', areas: activeLevelAreas.slice(4, 38) },
        { title: 'Additional learning areas', areas: activeLevelAreas.slice(38) },
      ]
    : [{ title: `${activeLevelConfig.label} learning areas`, areas: activeLevelAreas }];

  const renderArea = (area: CatalogArea) => {
    const active = activeAreaIds.has(area.id);
    const isBusy = busyKey === `area:${area.id}`;
    return (
      <label
        key={area.id}
        className={`flex min-h-[76px] cursor-pointer items-center gap-4 rounded-2xl border p-4 transition-colors ${
          active
            ? 'border-blue-200 bg-blue-50/70 hover:border-blue-300'
            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
        }`}
      >
        <input
          type="checkbox"
          checked={active}
          disabled={busyKey !== null}
          onChange={(event) => void updateAreaState(area, event.target.checked)}
          className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed"
          aria-label={`${active ? 'Remove' : 'Add'} ${area.name}`}
        />
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-slate-900">{area.name}</span>
          <span className="mt-1 block text-xs text-slate-500">
            {active ? 'Active for this school' : 'Not active for this school'}
          </span>
        </span>
        {isBusy ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-600" aria-label="Updating" />
        ) : active ? (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-blue-600" aria-hidden="true" />
        ) : (
          <span className="h-5 w-5 shrink-0 rounded-full border-2 border-slate-300" aria-hidden="true" />
        )}
      </label>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
              <BookOpen className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-950">Learning Areas</h1>
              <p className="text-sm text-slate-500">Manage the canonical learning areas enabled for this school.</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowManualAdd(true)}
            disabled={loading || busyKey !== null || manualAdding}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add Manually
          </button>
          <button
            type="button"
            onClick={() => void fetchLearningAreas()}
            disabled={loading || busyKey !== null || manualAdding}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            Refresh
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
          <p>
            These are the official canonical learning areas for each level. Existing legacy subject rows are preserved for historical results and teacher assignments; this page does not delete or rename them.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex min-w-max gap-2" role="tablist" aria-label="School levels">
          {LEVELS.map((level) => {
            const areas = areasByLevel.get(level.key) || [];
            const selected = activeLevel === level.key;
            const count = areas.filter((area) => activeAreaIds.has(area.id)).length;
            return (
              <button
                key={level.key}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`learning-areas-panel-${level.key}`}
                onClick={() => setActiveLevel(level.key)}
                className={`rounded-xl px-4 py-3 text-left transition-colors ${
                  selected ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span className="block text-sm font-semibold">{level.shortLabel}</span>
                <span className={`mt-1 block text-xs ${selected ? 'text-blue-100' : 'text-slate-400'}`}>
                  {count}/{areas.length || '—'} active
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <section
        id={`learning-areas-panel-${activeLevel}`}
        role="tabpanel"
        aria-labelledby={activeLevel}
        className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6"
      >
        <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-5 lg:flex-row lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-semibold text-slate-950">{activeLevelConfig.label}</h2>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                {activeCount} of {activeLevelAreas.length} active
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">{activeLevelConfig.description}. The catalogue contains no extras for this level.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => void addAllForLevel(activeLevelConfig)}
              disabled={loading || busyKey !== null || activeLevelAreas.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busyKey === `add:${activeLevel}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add All {LEVEL_LABELS[activeLevel]} Learning Areas
            </button>
            <button
              type="button"
              onClick={() => void removeAllForLevel(activeLevelConfig)}
              disabled={loading || busyKey !== null || activeLevelAreas.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busyKey === `remove:${activeLevel}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <MinusCircle className="h-4 w-4" />}
              Remove All {LEVEL_LABELS[activeLevel]} Learning Areas
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-slate-500">
            <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-blue-600" />
            Loading canonical learning areas…
          </div>
        ) : activeLevelAreas.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500">
            No catalogue entries are available for this level.
          </div>
        ) : (
          <div className="space-y-6">
            {seniorSections.map((section) => (
              <div key={section.title}>
                {isSenior && (
                  <div className="mb-3 flex items-center gap-2">
                    <Check className="h-4 w-4 text-blue-600" aria-hidden="true" />
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">{section.title}</h3>
                  </div>
                )}
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {section.areas.map(renderArea)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {showManualAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="manual-add-title">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void addManualLearningArea();
            }}
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id="manual-add-title" className="text-lg font-semibold text-slate-950">Add Learning Area Manually</h2>
                <p className="mt-1 text-sm text-slate-500">Add a custom learning area for this school without changing the official catalogue.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowManualAdd(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close manual add form"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="space-y-4">
              <label className="block text-sm font-medium text-slate-700">
                Learning area name
                <input
                  autoFocus
                  value={manualForm.name}
                  onChange={(event) => setManualForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="e.g. Debate and Public Speaking"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">
                  Code <span className="font-normal text-slate-400">(optional)</span>
                  <input
                    value={manualForm.code}
                    onChange={(event) => setManualForm((current) => ({ ...current, code: event.target.value }))}
                    placeholder="e.g. DPS"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Category <span className="font-normal text-slate-400">(optional)</span>
                  <select
                    value={manualForm.category}
                    onChange={(event) => setManualForm((current) => ({ ...current, category: event.target.value as CategoryType | '' }))}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">Select category</option>
                    {CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                  </select>
                </label>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowManualAdd(false)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={manualAdding}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {manualAdding && <Loader2 className="h-4 w-4 animate-spin" />}
                Add Learning Area
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
