import type { CurriculumScopeNode, ExamGenerationRequest } from './exam-schema.js';

/** Select a supported curriculum child for each compulsory language Paper 2 component. */
export function bindLanguagePaperComponents(request: ExamGenerationRequest): ExamGenerationRequest {
  if (request.format !== 'kjsea' || request.paperVariant !== 'paper2' || !request.curriculumScope?.length) return request;
  const kiswahili = /^kiswahili$/i.test(request.subject.trim());
  const english = /^english$/i.test(request.subject.trim());
  if (!kiswahili && !english) return request;
  const patterns = kiswahili
    ? [/insha/i, /tanzu.*fasihi|fasihi.*simulizi|semi:|vitendawili|nahau/i, /novela/i, /tamthilia/i, /ushairi/i]
    : [/composition|descriptive paragraph|narrative/i, /oral literature|oral poetry/i, /class reader|fiction/i, /play/i, /poem|poetry/i];
  const candidates = request.curriculumScope.flatMap(node => node.subStrands.map(sub => ({strand: node.strand, sub})));
  const matches = patterns.map(pattern => candidates.find(child => pattern.test(child.sub)));
  // Fail explicitly rather than pretending an unrelated skill is a literature component.
  if (matches.some(match => !match)) return request;
  const scope: CurriculumScopeNode[] = [];
  for (const match of matches) {
    if (!match) continue;
    let node = scope.find(item => item.strand === match.strand);
    if (!node) { node = {strand: match.strand, subStrands: [], topics: []}; scope.push(node); }
    if (!node.subStrands.includes(match.sub)) node.subStrands.push(match.sub);
  }
  return {
    ...request,
    strands: scope.map(node => node.strand), subStrands: scope.flatMap(node => node.subStrands), topics: [], curriculumScope: scope,
    blueprint: request.blueprint ? {...request.blueprint, sections: request.blueprint.sections.map((section,index) => ({...section, strand: matches[index]?.strand, sub_strand: matches[index]?.sub}))} : undefined,
  };
}
