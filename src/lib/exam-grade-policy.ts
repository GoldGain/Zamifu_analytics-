/** Grade-scoped assessment policy. KICD defines curriculum; KNEC defines national formats. */
import type { AssessmentLevel, ExamFormat, Difficulty, ExamBlueprint } from './exam-schema.js';

export function examGradeNumber(grade: unknown): number | null {
  const match = String(grade ?? '').match(/\d+/);
  return match ? Number(match[0]) : null;
}
export function isGradeNine(grade: unknown): boolean { return examGradeNumber(grade) === 9; }
export function assessmentLevelForGrade(grade: unknown): AssessmentLevel | undefined {
  const number = examGradeNumber(grade);
  if (number === null) return undefined;
  if (number >= 10) return 'senior_secondary';
  if (number >= 7) return 'junior_secondary';
  if (number >= 4) return 'upper_primary';
  if (number >= 1) return 'lower_primary';
  return 'pre_primary';
}
export function allowedGradeExamFormats(grade: unknown): ExamFormat[] {
  const number = examGradeNumber(grade);
  return number === 6 ? ['kpsea', 'standard30', 'cbe', 'custom']
    : number === 9 ? ['kjsea', 'standard30', 'cbe', 'custom']
    : ['cbe', 'standard30', 'custom'];
}
export function defaultGradeExamFormat(grade: unknown): ExamFormat {
  return examGradeNumber(grade) === 6 ? 'kpsea' : isGradeNine(grade) ? 'kjsea' : 'cbe';
}
export function gradeFormatError(grade: unknown, format: ExamFormat): string | null {
  if (allowedGradeExamFormats(grade).includes(format)) return null;
  return format === 'kjsea'
    ? 'KJSEA national-format practice is available for Grade 9 only. Choose a school-based CBE assessment for this grade.'
    : 'KPSEA national-format practice is available for Grade 6 only. Choose a school-based CBE assessment for this grade.';
}
export interface KpseaPaperSpec {
  title: string;
  code: string;
  marks: number;
  duration_minutes: number;
  source: string;
  item_count: number;
  score_basis: string;
  components: Array<{ label: string; count: number; subjects: string[] }>;
}
const KPSEA_SOURCE = 'https://www.knec.ac.ke/wp-content/uploads/2026/08/kpsea_regulations_2024.pdf';
const SCORE_BASIS = 'Derived school-practice score: one point per MCQ. KNEC regulations specify item counts, not an explicit marks-per-item rule.';
/** Unsupported individual learning areas are school CBE papers, not national paper groups. */
export function getKpseaPaperSpec(subject: unknown): KpseaPaperSpec | null {
  const key = String(subject ?? '').toLowerCase().replace(/[^a-z]+/g, '');
  const single = (title: string, duration: number, subjectNames: string[]): KpseaPaperSpec => ({title, code: '', marks:30, item_count:30, duration_minutes:duration, source:KPSEA_SOURCE, score_basis:SCORE_BASIS, components:[{label:title,count:30,subjects:subjectNames}]});
  if (key === 'mathematics' || key === 'maths') return single('Mathematics',80,['Mathematics']);
  if (key === 'english' || key === 'englishactivities' || key === 'englishlanguage') return single('English Language',60,['English Activities','English']);
  if (key === 'kiswahili' || key === 'kiswahiliactivities' || key === 'kiswahililugha') return single('Kiswahili Lugha',60,['Kiswahili Activities','Kiswahili']);
  if (key === 'integratedscience') return {title:'Integrated Science',code:'',marks:50,item_count:50,duration_minutes:100,source:KPSEA_SOURCE,score_basis:SCORE_BASIS,components:[{label:'Science & Technology',count:25,subjects:['Science & Technology','Science and Technology']},{label:'Agriculture & Nutrition',count:25,subjects:['Agriculture & Nutrition','Agriculture and Nutrition']}]};
  if (key === 'creativeartssocialstudies' || key === 'creativeartsandsocialstudies') return {title:'Creative Arts & Social Studies',code:'',marks:50,item_count:50,duration_minutes:100,source:KPSEA_SOURCE,score_basis:SCORE_BASIS,components:[{label:'Creative Arts',count:30,subjects:['Creative Arts']},{label:'Social Studies',count:10,subjects:['Social Studies']},{label:'Registered Religious Education',count:10,subjects:['Religious Education','Christian Religious Education','Islamic Religious Education','Hindu Religious Education']}]};
  return null;
}
export function makeKpseaBlueprint(subject: unknown, difficulty: Difficulty = 'mixed'): ExamBlueprint | undefined {
  const spec = getKpseaPaperSpec(subject);
  if (!spec) return undefined;
  return {total_marks:spec.marks,estimated_minutes:spec.duration_minutes,paper_variant:'single',sections:spec.components.map((component,index)=>({id:`kpsea-component-${index+1}`,title:component.label,question_type:'multiple_choice',count:component.count,marks_per_question:1,difficulty}))};
}
