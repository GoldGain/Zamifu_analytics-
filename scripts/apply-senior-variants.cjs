const fs = require('node:fs');
const path = require('node:path');

const candidates = ['lib/paper-formats.ts', 'src/lib/learn-exam/paper-formats.ts'];
const file = candidates.find((candidate) => fs.existsSync(path.join(process.cwd(), candidate)));
if (!file) throw new Error('Paper format module not found.');
let source = fs.readFileSync(file, 'utf8');
if (source.includes('const resolvedVariant: PaperVariant')) {
  console.log(`Senior paper variants already enabled in ${file}.`);
  applyDeploymentPatches();
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

applyDeploymentPatches();

function applyDeploymentPatches() {
  const tsconfigPath = path.join(process.cwd(), 'tsconfig.json');
  if (fs.existsSync(tsconfigPath)) {
    const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
    const compilerOptions = tsconfig.compilerOptions || {};
    if (compilerOptions.module !== 'ESNext' || compilerOptions.moduleResolution !== 'Bundler'
        || compilerOptions.resolveJsonModule !== true || !Array.isArray(compilerOptions.types)
        || !compilerOptions.types.includes('node')) {
      tsconfig.compilerOptions = {
        ...compilerOptions,
        module: 'ESNext',
        moduleResolution: 'Bundler',
        resolveJsonModule: true,
        types: [...new Set([...(Array.isArray(compilerOptions.types) ? compilerOptions.types : []), 'node'])],
      };
      fs.writeFileSync(tsconfigPath, `${JSON.stringify(tsconfig, null, 2)}\n`);
      console.log('Enabled Node-compatible serverless module resolution.');
    }
  }

  const routeCandidates = ['app/api/papers/generate/route.ts', 'api/generate-learn-exam.ts'];
  const routeFile = routeCandidates.find((candidate) => fs.existsSync(path.join(process.cwd(), candidate)));
  if (routeFile) {
    const routePath = path.join(process.cwd(), routeFile);
    let route = fs.readFileSync(routePath, 'utf8');
  if (routeFile === 'api/generate-learn-exam.ts' && !route.includes('async function loadGenerationEngine()')) {
    const staticImports = "import { createClient } from '@supabase/supabase-js';\nimport { generatePaper, type GeneratedPaper } from '../src/lib/learn-exam/learn-ai.js';\nimport {\n  isLanguageSubject,\n  requiresMapExtract,\n  specFor,\n  type Difficulty,\n  type PaperFormat,\n  type PaperVariant,\n} from '../src/lib/learn-exam/paper-formats.js';\nimport { geographyTopicAllowed } from '../src/lib/learn-exam/geography-paper.js';\nimport { alignGeneratedPaper, validateGeneratedPaper } from '../src/lib/learn-exam/paper-validation.js';\nimport { strandsForSubject } from '../src/lib/learn-exam/subjects.js';\nimport { KITUI_MAP_GROUND_TRUTH } from '../src/lib/learn-exam/kitui-map.js';\nimport { completeGeneratedChartUnits } from '../src/lib/learn-exam/paper-presentation.js';\nimport { validateComputerPracticalConsistency } from '../src/lib/learn-exam/computer-practical-validation.js';\nimport { validateSeniorCurriculumAlignment } from '../src/lib/learn-exam/senior-curriculum-validation.js';\n";
    const lazyImports = "import { createClient } from '@supabase/supabase-js';\nimport type { GeneratedPaper } from '../src/lib/learn-exam/learn-ai.js';\nimport type { Difficulty, PaperFormat, PaperVariant } from '../src/lib/learn-exam/paper-formats.js';\n\nasync function loadGenerationEngine() {\n  const [ai, formats, geography, validation, subjectModule, kitui, presentation, computer, senior] = await Promise.all([\n    import('../src/lib/learn-exam/learn-ai.js'),\n    import('../src/lib/learn-exam/paper-formats.js'),\n    import('../src/lib/learn-exam/geography-paper.js'),\n    import('../src/lib/learn-exam/paper-validation.js'),\n    import('../src/lib/learn-exam/subjects.js'),\n    import('../src/lib/learn-exam/kitui-map.js'),\n    import('../src/lib/learn-exam/paper-presentation.js'),\n    import('../src/lib/learn-exam/computer-practical-validation.js'),\n    import('../src/lib/learn-exam/senior-curriculum-validation.js'),\n  ]);\n  return {\n    generatePaper: ai.generatePaper,\n    isLanguageSubject: formats.isLanguageSubject,\n    requiresMapExtract: formats.requiresMapExtract,\n    specFor: formats.specFor,\n    geographyTopicAllowed: geography.geographyTopicAllowed,\n    alignGeneratedPaper: validation.alignGeneratedPaper,\n    validateGeneratedPaper: validation.validateGeneratedPaper,\n    strandsForSubject: subjectModule.strandsForSubject,\n    KITUI_MAP_GROUND_TRUTH: kitui.KITUI_MAP_GROUND_TRUTH,\n    completeGeneratedChartUnits: presentation.completeGeneratedChartUnits,\n    validateComputerPracticalConsistency: computer.validateComputerPracticalConsistency,\n    validateSeniorCurriculumAlignment: senior.validateSeniorCurriculumAlignment,\n  };\n}\n\n";
    if (!route.includes(staticImports)) throw new Error('Generation runtime import anchor not found.');
    route = route.replace(staticImports, lazyImports);
    const methodAnchor = "  if (request.method !== 'POST') {\n    response.setHeader('Allow', 'POST, OPTIONS');\n    response.status(405).json({ error: 'Method not allowed.' });\n    return;\n  }\n\n  const url = process.env.SUPABASE_URL;\n";
    const lazyLoad = "  let engine: Awaited<ReturnType<typeof loadGenerationEngine>>;\n  try {\n    engine = await loadGenerationEngine();\n  } catch (caught) {\n    const detail = caught instanceof Error ? caught.message : 'Unknown module error';\n    response.status(500).json({ error: `The examination engine could not be loaded: ${detail}` });\n    return;\n  }\n  const {\n    generatePaper,\n    isLanguageSubject,\n    requiresMapExtract,\n    specFor,\n    geographyTopicAllowed,\n    alignGeneratedPaper,\n    validateGeneratedPaper,\n    strandsForSubject,\n    KITUI_MAP_GROUND_TRUTH,\n    completeGeneratedChartUnits,\n    validateComputerPracticalConsistency,\n    validateSeniorCurriculumAlignment,\n  } = engine;\n\n";
    if (!route.includes(methodAnchor)) throw new Error('Generation runtime method anchor not found.');
    route = route.replace(methodAnchor, methodAnchor.replace('  const url = process.env.SUPABASE_URL;', lazyLoad + '  const url = process.env.SUPABASE_URL;'));
    fs.writeFileSync(routePath, route);
    console.log('Enabled guarded serverless engine loading.');
  }
    if (!route.includes('SENIOR INDEPENDENT PAPER RULE')) {
      const anchor = '    let paper: GeneratedPaper | null = null;';
      if (!route.includes(anchor)) throw new Error(`Generation anchor not found in ${routeFile}.`);
      const rule = `    const seniorVariantRule = /^Grade\\s+(?:10|11|12)$/i.test(gradeLevel) && (spec.format === "cbe" || spec.format === "end_term")
      ? \`SENIOR INDEPENDENT PAPER RULE: This is school-based Paper \${spec.variant === "paper2" ? "2" : "1"}. Generate an independent paper, not a relabelled copy. Every top-level question must assess different work. Never repeat or lightly reword a passage, scenario, data set, instruction, question stem or sub-question under another number. Each reading or comprehension question needs its own different stimulus; use no more than one passage-based question in the entire paper. Do not start multiple questions with “Read the following passage” or an equivalent. For a language Paper 2, use varied grammar, writing, listening/speaking and reading tasks within the verified class curriculum, and make every structured task different. Before returning, compare every question with all earlier questions and rewrite any repeated work.\`
      : "";
`;
      route = route.replace(anchor, rule + anchor);
      const instructionAnchor = '${difficultyRule}${correction}';
      if (!route.includes(instructionAnchor)) throw new Error(`Instruction anchor not found in ${routeFile}.`);
      route = route.replace(instructionAnchor, '${difficultyRule}\\n${seniorVariantRule}${correction}');
      fs.writeFileSync(routePath, route);
      console.log(`Enabled independent senior paper generation in ${routeFile}.`);
    }
  }

  const walletPath = path.join(process.cwd(), 'api/verify-exam-wallet-topup.ts');
  if (fs.existsSync(walletPath)) {
    let wallet = fs.readFileSync(walletPath, 'utf8');
    if (!wallet.includes('zamifulearn.company/api/analytics/exam-wallet-topup')) {
      const configBefore = "if (!url || !serviceKey || !paystackKey) { error(response, 503, 'Secure wallet top-up verification is not configured.'); return; }";
      const configAfter = "if (!url || !serviceKey) { error(response, 503, 'Secure wallet top-up verification is not configured.'); return; }";
      if (!wallet.includes(configBefore)) throw new Error('Wallet configuration anchor not found.');
      wallet = wallet.replace(configBefore, configAfter);
      const bodyAnchor = `  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });`;
      const relay = `  if (!paystackKey) {
    const rawRelayAuthorization = request.headers.authorization;
    const relayAuthorization = Array.isArray(rawRelayAuthorization) ? rawRelayAuthorization[0] : rawRelayAuthorization;
    try {
      const relay = await fetch('https://zamifulearn.company/api/analytics/exam-wallet-topup', {
        method: 'POST',
        headers: { Authorization: relayAuthorization || '', 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference, amountKes: requestedAmount }),
        signal: AbortSignal.timeout(30000),
      });
      const payload = await relay.json() as unknown;
      response.status(relay.status).json(payload);
    } catch {
      error(response, 503, 'Secure wallet verification is temporarily unavailable. Please retry.');
    }
    return;
  }

`;
      if (!wallet.includes(bodyAnchor)) throw new Error('Wallet relay anchor not found.');
      wallet = wallet.replace(bodyAnchor, relay + bodyAnchor);
      fs.writeFileSync(walletPath, wallet);
      console.log('Enabled the secure wallet verification relay.');
    }
  }
}
