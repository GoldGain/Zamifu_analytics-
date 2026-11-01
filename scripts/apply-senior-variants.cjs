const fs = require('node:fs');
const path = require('node:path');

const candidates = ['lib/paper-formats.ts', 'src/lib/learn-exam/paper-formats.ts'];
const file = candidates.find((candidate) => fs.existsSync(path.join(process.cwd(), candidate)));
if (!file) throw new Error('Paper format module not found.');
let source = fs.readFileSync(file, 'utf8');
if (source.includes('const resolvedVariant: PaperVariant')) {
  console.log(`Senior paper variants already enabled in ${file}.`);
  process.exit(0);
}
function replaceOnce(before, after) {
  if (!source.includes(before)) throw new Error(`Expected source fragment not found in ${file}: ${before.slice(0, 100)}`);
  source = source.replace(before, after);
}
replaceOnce(
  'function schoolSpec(grade: string, endTerm: boolean): PaperSpec {\n  const n = isForm(grade) ? 12 : gradeNumber(grade);',
  'function schoolSpec(grade: string, endTerm: boolean, variant: PaperVariant = "standard"): PaperSpec {\n  const n = isForm(grade) ? 12 : gradeNumber(grade);\n  const senior = !isForm(grade) && n >= 10;\n  if (senior && variant === "paper3") throw new Error(`Grade ${n} has no school-based Paper 3.`);\n  const resolvedVariant: PaperVariant = senior ? (variant === "paper2" ? "paper2" : "paper1") : "standard";\n  const variantLabel = resolvedVariant === "standard" ? "" : ` Paper ${resolvedVariant.slice(-1)}`;',
);
replaceOnce(
  '    formatName: formatName(endTerm ? "end_term" : "cbe"),\n    variant: "standard",',
  '    formatName: formatName(endTerm ? "end_term" : "cbe"),\n    variant: resolvedVariant,',
);
replaceOnce(
  '"School-based End-Term assessment covering one learning area and the selected term\'s strands."',
  '`School-based End-Term${variantLabel} assessment covering one learning area and the selected term\'s strands.`',
);
if (source.includes('`Grade ${n} CBE school-based assessment; this is not presented as a national examination format.`')) {
  replaceOnce(
    '`Grade ${n} CBE school-based assessment; this is not presented as a national examination format.`',
    '`Grade ${n} CBE school-based${variantLabel} assessment; this is not presented as a national examination format.`',
  );
} else {
  replaceOnce(
    '"Grade 10 CBE school-based assessment; this is not presented as a national examination format."',
    '`Grade 10 CBE school-based${variantLabel} assessment; this is not presented as a national examination format.`',
  );
}
replaceOnce('if (requestedFormat === "end_term") return schoolSpec(grade || "", true);', 'if (requestedFormat === "end_term") return schoolSpec(grade || "", true, variant);');
replaceOnce('if (requestedFormat === "standard" || requestedFormat === "cbe") return schoolSpec(grade || "", false);', 'if (requestedFormat === "standard" || requestedFormat === "cbe") return schoolSpec(grade || "", false, variant);');
if (source.includes('if (n >= 10) return schoolSpec(grade || "", false);')) {
  replaceOnce('if (n >= 10) return schoolSpec(grade || "", false);', 'if (n >= 10) return schoolSpec(grade || "", false, variant);');
} else {
  replaceOnce('if (n === 10) return schoolSpec(grade || "", false);', 'if (n === 10) return schoolSpec(grade || "", false, variant);');
}
replaceOnce(
  'export function availableVariants(grade: string, subject: string, format?: PaperFormat | "standard"): PaperVariant[] {\n  if (format === "end_term" || format === "standard" || format === "cbe") return ["standard"];\n  if (isForm(grade)) return kcseVariants(subject);\n  const n = gradeNumber(grade);',
  'export function availableVariants(grade: string, subject: string, format?: PaperFormat | "standard"): PaperVariant[] {\n  const n = gradeNumber(grade);\n  if (!isForm(grade) && n >= 10 && (!format || format === "end_term" || format === "standard" || format === "cbe")) return ["paper1", "paper2"];\n  if (format === "end_term" || format === "standard" || format === "cbe") return ["standard"];\n  if (isForm(grade)) return kcseVariants(subject);',
);
fs.writeFileSync(file, source);
console.log(`Enabled senior Paper 1 and Paper 2 in ${file}.`);
