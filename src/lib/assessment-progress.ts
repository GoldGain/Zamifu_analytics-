export interface AssessmentClassRecord {
  id?: string | null;
  name?: string | null;
  stream?: string | null;
  grade_level?: number | string | null;
  level?: number | string | null;
  curriculum?: string | null;
}

export interface AssessmentExamScope {
  target_type?: string | null;
  target_class_id?: string | null;
  target_grade_level?: number | string | null;
}

export function getEffectiveGradeLevel(classRecord: AssessmentClassRecord | null | undefined): number | null {
  const rawLevel = classRecord?.grade_level ?? classRecord?.level;
  if (rawLevel !== null && rawLevel !== undefined && String(rawLevel).trim() !== '') {
    const parsed = Number(rawLevel);
    if (Number.isFinite(parsed)) return parsed;
  }

  const name = String(classRecord?.name || '').trim().toLowerCase();
  if (/playgroup|baby\s*class/.test(name)) return -3;
  if (/\bpp\s*1\b|pre[-\s]?primary\s*1/.test(name)) return -2;
  if (/\bpp\s*2\b|pre[-\s]?primary\s*2/.test(name)) return -1;
  const grade = name.match(/\bgrade\s*(\d{1,2})\b/);
  if (grade) return Number(grade[1]);
  const form = name.match(/\bform\s*(\d)\b/);
  if (form) return Number(form[1]) + 9;
  return null;
}

export function getAssessmentLevelLabel(classRecord: AssessmentClassRecord | null | undefined): string {
  const level = getEffectiveGradeLevel(classRecord);
  const className = String(classRecord?.name || '').trim();
  const explicitForm = className.match(/\bform\s*(\d)\b/i);
  if (explicitForm) return `Form ${explicitForm[1]}`;
  if (level === -3) return 'Playgroup';
  if (level === -2) return 'PP1';
  if (level === -1) return 'PP2';
  if (level === 0) return 'Pre-Primary';
  if (level !== null && level >= 1 && level <= 9) return `Grade ${level}`;
  if (level !== null && level >= 10 && level <= 12) {
    return /8[-\s]?4[-\s]?4/.test(String(classRecord?.curriculum || '').toLowerCase())
      ? `Form ${level - 8}`
      : `Grade ${level}`;
  }
  return className || 'Class';
}

export function matchesAssessmentScope(
  exam: AssessmentExamScope,
  classRecord: AssessmentClassRecord,
): boolean {
  const targetType = String(exam.target_type || 'school').toLowerCase();
  if (targetType === 'class') return String(exam.target_class_id || '') === String(classRecord.id || '');
  if (targetType === 'grade') {
    const targetGrade = Number(exam.target_grade_level);
    const classGrade = getEffectiveGradeLevel(classRecord);
    return Number.isFinite(targetGrade) && classGrade !== null && classGrade === targetGrade;
  }
  return true;
}

export const ASSESSMENT_LEVEL_OPTIONS = [
  { value: 'all', label: 'All levels' },
  { value: '-3', label: 'Playgroup' },
  { value: '-2', label: 'PP1' },
  { value: '-1', label: 'PP2' },
  { value: '1', label: 'Grade 1' },
  { value: '2', label: 'Grade 2' },
  { value: '3', label: 'Grade 3' },
  { value: '4', label: 'Grade 4' },
  { value: '5', label: 'Grade 5' },
  { value: '6', label: 'Grade 6' },
  { value: '7', label: 'Grade 7' },
  { value: '8', label: 'Grade 8' },
  { value: '9', label: 'Grade 9 / Form 1' },
  { value: '10', label: 'Grade 10 / Form 2' },
  { value: '11', label: 'Grade 11 / Form 3' },
  { value: '12', label: 'Grade 12 / Form 4' },
] as const;
