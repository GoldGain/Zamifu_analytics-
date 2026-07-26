export type Curriculum = 'CBE';
export type SchoolLevelBand = 'primary' | 'junior' | 'senior';

export interface NumericGrade844 {
  grade: string;
  points: number;
  descriptor: string;
  band: '844';
}

export interface CompetencyGrade {
  subLevel: string;
  grade: 'EE' | 'ME' | 'AE' | 'BE';
  points: number;
  descriptor: string;
  band: SchoolLevelBand;
}

function normalizePercentage(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function getSchoolLevelBand(classData?: { curriculum?: Curriculum | string | null; grade_level?: number | string | null; level?: number | string | null; name?: string | null }): SchoolLevelBand {
  // Use grade_level first (new column), fall back to level (legacy)
  const rawLevel = classData?.grade_level ?? classData?.level;
  const parsedLevel = typeof rawLevel === 'number' ? rawLevel : parseInt(String(rawLevel || '').replace(/[^0-9]/g, ''), 10);

  // PP1 and PP2 are also primary
  const name = String(classData?.name || '').toLowerCase();
  if (/pp1|pp2|pre.?primary/i.test(name)) return 'primary';

  // Primary School: PP1, PP2, Grades 1-6 — marks only, no points
  if (Number.isFinite(parsedLevel) && parsedLevel >= 0 && parsedLevel <= 6) return 'primary';

  // Junior School: Grades 7-9 — 8-level scale with points
  if (Number.isFinite(parsedLevel) && parsedLevel >= 7 && parsedLevel <= 9) return 'junior';

  // Senior School: Grades 10-12 — same 8-level scale as Junior
  if (Number.isFinite(parsedLevel) && parsedLevel >= 10 && parsedLevel <= 12) return 'senior';

  // Fallback: parse from class name
  if (/senior|grade\s*1[012]|\b1[012]\b/.test(name)) return 'senior';
  if (/junior|jss|grade\s*[789]|\b[789]\b/.test(name)) return 'junior';
  if (/pp1|pp2|pre.?primary|grade\s*[1-6]/i.test(name)) return 'primary';
  return 'primary';
}

/**
 * PRIMARY SCHOOL (PP1, PP2, Grades 1-6): MARKS ONLY — NO points shown to users.
 * EE: 75-100%, ME: 41-74%, AE: 21-40%, BE: 1-20%
 *
 * JUNIOR SCHOOL (Grades 7-9): 8-level scale WITH points.
 * EE1=8, EE2=7, ME1=6, ME2=5, AE1=4, AE2=3, BE1=2, BE2=1
 *
 * SENIOR SCHOOL (Grades 10-12): Same 8-level scale as Junior WITH points.
 * EE1=8, EE2=7, ME1=6, ME2=5, AE1=4, AE2=3, BE1=2, BE2=1
 */
export function calculateCompetencyGrade(score: number, band: SchoolLevelBand = 'primary'): CompetencyGrade {
  const percentage = normalizePercentage(score);

  if (band === 'junior' || band === 'senior') {
    // Junior/Senior (Grades 7-12): 8-level scale with points
    if (percentage >= 90) return { subLevel: 'EE1', grade: 'EE', points: 8, descriptor: 'Exceeding Expectation', band };
    if (percentage >= 75) return { subLevel: 'EE2', grade: 'EE', points: 7, descriptor: 'Exceeding Expectation', band };
    if (percentage >= 58) return { subLevel: 'ME1', grade: 'ME', points: 6, descriptor: 'Meeting Expectation', band };
    if (percentage >= 41) return { subLevel: 'ME2', grade: 'ME', points: 5, descriptor: 'Meeting Expectation', band };
    if (percentage >= 31) return { subLevel: 'AE1', grade: 'AE', points: 4, descriptor: 'Approaching Expectation', band };
    if (percentage >= 21) return { subLevel: 'AE2', grade: 'AE', points: 3, descriptor: 'Approaching Expectation', band };
    if (percentage >= 11) return { subLevel: 'BE1', grade: 'BE', points: 2, descriptor: 'Below Expectation', band };
    return { subLevel: 'BE2', grade: 'BE', points: 1, descriptor: 'Below Expectation', band };
  }

  // Primary (PP1, PP2, Grades 1-6): MARKS ONLY — 4 competency descriptors, NO points shown.
  // EE: 75-100%, ME: 41-74%, AE: 21-40%, BE: 1-20%
  if (percentage >= 75) return { subLevel: 'EE', grade: 'EE', points: 0, descriptor: 'Exceeding Expectation', band };
  if (percentage >= 41) return { subLevel: 'ME', grade: 'ME', points: 0, descriptor: 'Meeting Expectation', band };
  if (percentage >= 21) return { subLevel: 'AE', grade: 'AE', points: 0, descriptor: 'Approaching Expectation', band };
  return { subLevel: 'BE', grade: 'BE', points: 0, descriptor: 'Below Expectation', band };
}

export function calculateResultGrades(percentage: number, classData?: { curriculum?: Curriculum | string | null; level?: number | string | null; name?: string | null }) {
  const band = getSchoolLevelBand(classData);
  const cbeGrade = calculateCompetencyGrade(percentage, band);
  return { band, cbeGrade };
}

export function calculate844Grade(score: number): NumericGrade844 {
  const percentage = normalizePercentage(score);
  if (percentage >= 80) return { grade: 'A', points: 12, descriptor: 'Excellent', band: '844' };
  if (percentage >= 75) return { grade: 'A-', points: 11, descriptor: 'Very Good', band: '844' };
  if (percentage >= 70) return { grade: 'B+', points: 10, descriptor: 'Good', band: '844' };
  if (percentage >= 65) return { grade: 'B', points: 9, descriptor: 'Good', band: '844' };
  if (percentage >= 60) return { grade: 'B-', points: 8, descriptor: 'Good', band: '844' };
  if (percentage >= 55) return { grade: 'C+', points: 7, descriptor: 'Average', band: '844' };
  if (percentage >= 50) return { grade: 'C', points: 6, descriptor: 'Average', band: '844' };
  if (percentage >= 45) return { grade: 'C-', points: 5, descriptor: 'Average', band: '844' };
  if (percentage >= 40) return { grade: 'D+', points: 4, descriptor: 'Below Average', band: '844' };
  if (percentage >= 35) return { grade: 'D', points: 3, descriptor: 'Below Average', band: '844' };
  if (percentage >= 30) return { grade: 'D-', points: 2, descriptor: 'Below Average', band: '844' };
  return { grade: 'E', points: 1, descriptor: 'Poor', band: '844' };
}

export function gradeDisplayLabel(band: SchoolLevelBand): string {
  if (band === 'senior') return 'Senior CBE Grade';
  if (band === 'junior') return 'Junior CBE Grade';
  return 'Primary CBE Grade';
}

// ── Subject-Specific AI Comment Generator ────────────────────────────────────

export interface SubjectResult {
  name: string;
  percentage: number;
  grade?: string;
  previousPercentage?: number | null;
}

function getSubjectAdvice(subjectName: string, band: SchoolLevelBand): string {
  const name = subjectName.toLowerCase();
  if (name.includes('math')) return 'practice daily arithmetic and work through past assessment papers';
  if (name.includes('english') || name.includes('composition') || name.includes('grammar')) return 'read more books, practice writing compositions, and review grammar rules';
  if (name.includes('kiswahili') || name.includes('insha') || name.includes('sarufi')) return 'practice speaking Kiswahili daily and review vocabulary';
  if (name.includes('science') || name.includes('biology') || name.includes('chemistry') || name.includes('physics')) return 'review key concepts, conduct practical exercises, and ask your teacher for extra help';
  if (name.includes('history') || name.includes('social')) return 'create summary notes and practice answering past questions';
  if (name.includes('geography')) return 'study maps and practice describing geographical features';
  if (name.includes('agriculture')) return 'review farming concepts and practical applications';
  if (name.includes('art') || name.includes('creative')) return 'practice regularly and explore different techniques';
  if (name.includes('computer') || name.includes('ict')) return 'practice hands-on exercises and review theoretical concepts';
  if (name.includes('religious') || name.includes('cre') || name.includes('ire')) return 'review key teachings and practice essay writing';
  if (name.includes('business')) return 'review business concepts and practice calculations';
  return 'review class notes, complete all assignments, and seek extra help from your teacher';
}

function getGradeLabel(pct: number, band: SchoolLevelBand): string {
  const g = calculateCompetencyGrade(pct, band);
  return g.subLevel;
}

/**
 * ENHANCED AI Comment Generator that:
 * - Congratulates on BEST learning area
 * - Identifies and addresses ALL weak learning areas (not just top 2)
 * - Gives SPECIFIC advice for each weak learning area
 * - Identifies failing learning areas and recommends parent-teacher meeting
 * - Compares with previous term performance
 * - Adapts language to curriculum level
 * - Includes class position and encouragement
 * - Uses ACTUAL subject grade for the specific subject mentioned (not average)
 * - Includes pathway performance sentence
 */
export function generateSubjectSpecificComment(
  studentName: string,
  subjects: SubjectResult[],
  avgPct: number,
  position: number | null,
  totalStudents: number,
  classData?: any
): string {
  const band = getSchoolLevelBand(classData);
  const isPrimary = band === 'primary';

  if (!subjects || subjects.length === 0) {
    return `${studentName}, keep working hard and striving for excellence in all your learning areas!`;
  }

  // Sort subjects by percentage
  const sorted = [...subjects].sort((a, b) => b.percentage - a.percentage);
  const best = sorted[0];

  // Identify weak subjects (below ME threshold)
  const weakThreshold = isPrimary ? 41 : 41;
  const failThreshold = isPrimary ? 21 : 21;
  const weakSubjects = sorted.filter(s => s.percentage < weakThreshold);
  const failingSubjects = sorted.filter(s => s.percentage < failThreshold);

  // Identify dropping subjects (worse than previous term)
  const droppingSubjects = subjects.filter(s =>
    s.previousPercentage !== null && s.previousPercentage !== undefined &&
    s.percentage < s.previousPercentage - 5
  );

  // FIX Issue 1: Use ACTUAL grade for the specific subject mentioned (not the average grade)
  // When a subject is referenced in the comment, fetch its actual grade, not the overall average.
  const getActualSubjectGrade = (subjectName: string): string => {
    const subjectResult = subjects.find(s =>
      s.name.toLowerCase().includes(subjectName.toLowerCase()) ||
      subjectName.toLowerCase().includes(s.name.toLowerCase())
    );
    if (subjectResult) {
      return getGradeLabel(subjectResult.percentage, band);
    }
    return getGradeLabel(avgPct, band);
  };

  const bestGrade = getGradeLabel(best.percentage, band);
  let comment = '';
  const firstName = studentName.split(' ')[0] || studentName;

  // Opening: congratulate on best subject — use ACTUAL grade for that subject
  if (isPrimary) {
    comment += `${firstName}, you did very well in ${best.name} (${best.percentage.toFixed(0)}% — ${bestGrade}). `;
  } else {
    comment += `${firstName}, you excelled in ${best.name} (${best.percentage.toFixed(0)}% — ${bestGrade}). `;
  }

  // Address failing subjects first (most urgent) — MENTION ALL
  if (failingSubjects.length > 0) {
    const failNames = failingSubjects.map(s => {
      return `${s.name} (${s.percentage.toFixed(0)}%)`;
    }).join(', ');

    if (isPrimary) {
      comment += `However, your scores in ${failNames} need immediate attention. `;
      failingSubjects.forEach(s => {
        comment += `In ${s.name}, ${getSubjectAdvice(s.name, band)}. `;
      });
      comment += `Let's work together to bring these up to ME level. `;
    } else {
      comment += `However, your performance in ${failNames} needs immediate attention. `;
      failingSubjects.forEach(s => {
        comment += `In ${s.name}, ${getSubjectAdvice(s.name, band)}. `;
      });
      comment += `Please seek extra help from your teacher and dedicate more study time. `;
    }
  } else if (weakSubjects.length > 0) {
    // Address weak (but not failing) subjects — MENTION ALL WITH SPECIFIC ADVICE
    const weakNames = weakSubjects.map(s => {
      return `${s.name} (${s.percentage.toFixed(0)}%)`;
    }).join(', ');

    if (isPrimary) {
      comment += `Let's work harder on ${weakNames} to bring ${weakSubjects.length === 1 ? 'it' : 'them'} up to ME level. `;
      weakSubjects.forEach(s => {
        comment += `In ${s.name}, ${getSubjectAdvice(s.name, band)}. `;
      });
    } else {
      comment += `Focus more on ${weakNames}. `;
      weakSubjects.forEach(s => {
        comment += `In ${s.name}, ${getSubjectAdvice(s.name, band)}. `;
      });
    }
  } else {
    // All subjects above threshold
    comment += `Keep maintaining this excellent standard across all your learning areas. `;
  }

  // Address dropping subjects (if not already mentioned)
  const droppingNotMentioned = droppingSubjects.filter(s =>
    !weakSubjects.find(w => w.name === s.name) && !failingSubjects.find(f => f.name === s.name)
  );
  if (droppingNotMentioned.length > 0) {
    droppingNotMentioned.forEach(drop => {
      const prevPct = drop.previousPercentage!;
      comment += `Note that your ${drop.name} grade dropped from ${prevPct.toFixed(0)}% to ${drop.percentage.toFixed(0)}% — let's review the topics you struggled with this term. `;
    });
  }

  // FIX Issue 2: Add pathway performance sentence
  // Group subjects by pathway and find the strongest pathway
  const SUBJECT_PATHWAY_MAP: Record<string, string> = {
    'Mathematics': 'STEM',
    'Integrated Science': 'STEM',
    'Pre-Technical Studies': 'STEM',
    'Agriculture and Nutrition': 'STEM',
    'Agriculture': 'STEM',
    'Science and Technology': 'STEM',
    'English': 'Social Sciences',
    'Kiswahili': 'Social Sciences',
    'Social Studies': 'Social Sciences',
    'Religious Education': 'Social Sciences',
    'CRE': 'Social Sciences',
    'IRE': 'Social Sciences',
    'HRE': 'Social Sciences',
    'Creative Arts and Sports': 'Creative Arts and Sports',
    'Creative Arts': 'Creative Arts and Sports',
    'Physical and Health Education': 'Creative Arts and Sports',
    'Music': 'Creative Arts and Sports',
    'Art and Craft': 'Creative Arts and Sports',
  };

  const pathwayScores: Record<string, { total: number; count: number }> = {};
  subjects.forEach(s => {
    // Find matching pathway
    const pathwayKey = Object.keys(SUBJECT_PATHWAY_MAP).find(k =>
      s.name.toLowerCase().includes(k.toLowerCase()) ||
      k.toLowerCase().includes(s.name.toLowerCase())
    );
    const pathway = pathwayKey ? SUBJECT_PATHWAY_MAP[pathwayKey] : null;
    if (pathway) {
      if (!pathwayScores[pathway]) pathwayScores[pathway] = { total: 0, count: 0 };
      pathwayScores[pathway].total += s.percentage;
      pathwayScores[pathway].count += 1;
    }
  });

  const pathwayAverages = Object.entries(pathwayScores)
    .filter(([, v]) => v.count > 0)
    .map(([name, v]) => ({ name, avg: v.total / v.count }))
    .sort((a, b) => b.avg - a.avg);

  if (pathwayAverages.length > 0) {
    const strongestPathway = pathwayAverages[0];
    comment += `Your performance in the ${strongestPathway.name} pathway (${strongestPathway.avg.toFixed(1)}%) shows strong potential. `;
  }

  // Closing encouragement with position
  if (position && totalStudents > 0) {
    if (position === 1) {
      comment += `Congratulations on ranking 1st out of ${totalStudents} students — keep up the outstanding work!`;
    } else if (position <= 3) {
      const suffix = position === 2 ? 'nd' : 'rd';
      comment += `Well done for ranking ${position}${suffix} out of ${totalStudents} students. Aim for the top!`;
    } else if (position <= Math.ceil(totalStudents * 0.3)) {
      comment += `You are in the top 30% of the class. With more focus on your weak areas, you can climb even higher!`;
    } else {
      comment += `With consistent effort and focus on your weak subjects, you will achieve much better results next term!`;
    }
  } else {
    comment += `Keep working hard and never give up — your best is yet to come!`;
  }

  return comment;
}
