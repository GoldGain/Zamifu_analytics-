import assert from 'node:assert/strict';
import { allowedGradeExamFormats, assessmentLevelForGrade, defaultGradeExamFormat, gradeFormatError, getKpseaPaperSpec, makeKpseaBlueprint } from '../src/lib/exam-grade-policy';
import { makeBalancedBlueprint, makeFormatBlueprint, validateExamRequest, type ExamGenerationRequest } from '../src/lib/exam-schema';
import { getKjseaPaperSpec, makeKjseaBlueprint } from '../src/lib/kjsea-paper-formats';
import { buildCoveragePlanFromRequest, paperVariantLaw, supportsTwoPapers } from '../src/lib/exam-construction';

const base = (grade: number): ExamGenerationRequest => ({ gradeLevel: `Grade ${grade}`, subject: 'Mathematics', strands: ['Numbers'], subStrands: ['Whole numbers'], topics: [], questionTypes: ['multiple_choice','short_answer'], totalMarks: 30, durationMinutes: 45, difficulty:'mixed', includeImages:false, includeMarkingScheme:true, format:'standard30' });
let cases = 0;
for (const subject of ['English Activities','Kiswahili Activities','Mathematics','Integrated Science','Creative Arts & Social Studies']) {
  const spec=getKpseaPaperSpec(subject)!;
  const blueprint=makeKpseaBlueprint(subject)!;
  assert.ok(spec && blueprint);
  assert.equal(blueprint.sections.reduce((n,s)=>n+s.count,0),spec.item_count);
  assert.equal(blueprint.total_marks,spec.marks);
  assert.match(spec.score_basis,/Derived school-practice/);
}
assert.deepEqual(makeKpseaBlueprint('Integrated Science')?.sections.map(s=>s.count),[25,25]);
assert.deepEqual(makeKpseaBlueprint('Creative Arts & Social Studies')?.sections.map(s=>s.count),[30,10,10]);
assert.equal(getKpseaPaperSpec('Social Studies'),null);
const pinned=makeKpseaBlueprint('Creative Arts & Social Studies')!;
pinned.sections=pinned.sections.map((s,i)=>({...s,strand:['Creative','Social','Religion'][i]}));
assert.deepEqual(buildCoveragePlanFromRequest({strands:['Creative','Social','Religion'],blueprint:pinned}).map(row=>row.questions),[30,10,10]);
for (const grade of [6,7,8,9,10]) {
  assert.equal(assessmentLevelForGrade(`Grade ${grade}`), grade === 6 ? 'upper_primary' : grade === 10 ? 'senior_secondary' : 'junior_secondary');
  assert.equal(defaultGradeExamFormat(`Grade ${grade}`), grade === 6 ? 'kpsea' : grade === 9 ? 'kjsea' : 'cbe');
  assert.equal(allowedGradeExamFormats(`Grade ${grade}`).includes('kjsea'), grade===9);
  assert.equal(allowedGradeExamFormats(`Grade ${grade}`).includes('kpsea'), grade===6);
  assert.equal(gradeFormatError(`Grade ${grade}`, 'kjsea') === null, grade===9);
  const standard = {...base(grade), blueprint: makeFormatBlueprint('standard30',30)};
  assert.deepEqual(validateExamRequest(standard), []);
  assert.equal(standard.blueprint?.sections.reduce((n,s)=>n+s.count*s.marks_per_question,0),30);
  for (const marks of [10,20,30,50,60,70,80,100,120,150,200]) {
    const blueprint = makeBalancedBlueprint(['multiple_choice','case_study'],marks);
    assert.equal(blueprint.total_marks, marks);
    assert.equal(blueprint.sections.reduce((n,s)=>n+s.count*s.marks_per_question,0), marks);
    assert.ok(blueprint.sections.every(s=>s.question_type !== 'multiple_choice' || s.marks_per_question===1));
    cases++;
  }
}
const subjects=['English','Kiswahili','Integrated Science','Agriculture and Nutrition','Pre-Technical Studies','Creative Arts and Sports','Mathematics','Social Studies','Christian Religious Education','Islamic Religious Education','Hindu Religious Education'];
for (const subject of subjects) {
  for (const variant of supportsTwoPapers(subject) ? ['paper1','paper2'] as const : ['single'] as const) {
    const spec=getKjseaPaperSpec(subject,variant)!;
    const blueprint=makeKjseaBlueprint(subject,variant)!;
    assert.ok(spec && blueprint);
    assert.equal(spec.marks,blueprint.total_marks);
    assert.equal(spec.components.reduce((n,c)=>n+c.marks,0),spec.marks);
    const request={...base(9),subject,format:'kjsea' as const,paperVariant:variant,totalMarks:spec.marks,durationMinutes:spec.duration_minutes,blueprint};
    assert.deepEqual(validateExamRequest(request),[]);
    cases++;
  }
}
assert.ok(validateExamRequest({...base(8),format:'kjsea'}).length);
assert.ok(validateExamRequest({...base(10),format:'kpsea'}).length);
assert.match(paperVariantLaw({...base(10),subject:'English',format:'custom',paperVariant:'paper2'}),/School-configured/);
assert.ok(!paperVariantLaw({...base(10),subject:'English',format:'custom',paperVariant:'paper2'}).includes('50-mark'));
assert.deepEqual(validateExamRequest({...base(10),subject:'Physics',format:'custom',totalMarks:1,blueprint:{total_marks:1,sections:[{id:'replacement',question_type:'multiple_choice',count:1,marks_per_question:1,difficulty:'mixed'}]}}),[]);
console.log(`Grade-format and exact-mark regressions passed: ${cases} matrix cases plus grade guards and replacement checks.`);
