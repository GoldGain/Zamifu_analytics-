import type {GeneratedExamQuestion} from './exam-schema.js';
/** Source evidence: research/science-hard-water-marking-note.md. This is an exam-content guard, not medical advice. */
export function scientificContentIssues(question:GeneratedExamQuestion):string[] {
 const context=[question.question_text,question.topic,question.sub_strand,question.visual_spec?.title,...(question.sub_parts||[]).map(part=>part.prompt)].join(' ');
 if(!/\bhard\s+water\b|\bwater\s+hardness\b/i.test(context))return [];
 const items=question.sub_parts?.length?question.sub_parts:[{prompt:question.question_text,correct_answer:question.correct_answer,marking_scheme:question.marking_scheme}];
 for(const item of items){
  const answer=[item.correct_answer,item.marking_scheme].join(' ');
  if(!/\bkidney\s+stones?\b|\bscal(?:e|ing)\b[^.;]{0,30}\bkidneys?\b/i.test(answer))continue;
  if(/\b(?:false|not\s+(?:proven|established|known|caused)|no\s+(?:conclusive\s+)?(?:evidence|significant\s+(?:overall\s+)?association))\b/i.test(answer))continue;
  return ['Do not mark hard water generally causing kidney stones or scaling inside kidneys as an established one-mark school-science fact. Evidence is nuanced and does not establish an overall causal association. Rewrite this subpart to an established domestic effect (soap scum or appliance scaling), mineral benefit, or accurately qualified evidence, while preserving its marks and curriculum scope.'];
 }
 return [];
}
