import assert from 'node:assert/strict';
import {scientificContentIssues} from '../src/lib/exam-science-policy.js';
import {validateGeneratedExam} from '../src/lib/exam-validation.js';
import type {GeneratedExamQuestion,ExamGenerationRequest} from '../src/lib/exam-schema.js';
const request:ExamGenerationRequest={gradeLevel:'Grade 9',subject:'Integrated Science',strands:['Water'],subStrands:['Hardness'],topics:['Hard water'],questionTypes:['short_answer'],totalMarks:1,durationMinutes:15,difficulty:'medium',includeImages:false,format:'cbe',blueprint:{sections:[{id:'water',title:'Water',question_type:'short_answer',count:1,marks_per_question:1,difficulty:'medium'}],total_marks:1}};
const question:GeneratedExamQuestion={question_type:'short_answer',question_text:'State a health effect of drinking hard water.',correct_answer:'It may cause kidney stones or scaling in the kidneys.',marking_scheme:'Award one mark for kidney stones.',marks:1,difficulty:'medium',strand:'Water',sub_strand:'Hardness',topic:'Hard water'};
assert.equal(scientificContentIssues(question).length,1);
assert.ok(validateGeneratedExam(request,[question]).issues.some(issue=>issue.code==='SCIENTIFIC_CONTENT_CORRECTION'&&issue.severity==='critical'));
assert.equal(scientificContentIssues({...question,question_text:'State a domestic disadvantage of hard water.',correct_answer:'It forms limescale in kettles.',marking_scheme:'Award for appliance scaling.'}).length,0);
assert.equal(scientificContentIssues({...question,question_text:'Evaluate the statement that hard water generally causes kidney stones.',correct_answer:'False: no significant overall association was established.',marking_scheme:'Award for correctly rejecting the general claim.'}).length,0);
console.log('PASS: unsupported hard-water renal-harm marking is rejected without rejecting domestic effects or qualified evidence.');

const artRequest:ExamGenerationRequest={...request,subject:'Creative Arts',includeImages:true,strands:['Music'],subStrands:['Instruments'],topics:['Traditional instruments']};
const artQuestion={...question,question_text:'Name a traditional musical instrument.',correct_answer:'A drum.',marking_scheme:'Award for a valid instrument.',strand:'Music',sub_strand:'Instruments',topic:'Traditional instruments'};
assert.ok(!validateGeneratedExam(artRequest,[artQuestion]).issues.some(issue=>issue.code==='VISUAL_REQUIRED'),'optional images must not fail a valid Creative Arts theory paper');
assert.ok(validateGeneratedExam(artRequest,[{...artQuestion,question_text:'Study the diagram below and identify the instrument.'}]).issues.some(issue=>issue.code==='VISUAL_REFERENCE_MISSING'),'relaxing optional images must never permit a dangling visual reference');
