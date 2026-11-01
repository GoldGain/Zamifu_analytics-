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
  const routeCandidates = ['app/api/papers/generate/route.ts', 'api/generate-learn-exam.ts'];
  const routeFile = routeCandidates.find((candidate) => fs.existsSync(path.join(process.cwd(), candidate)));
  if (routeFile) {
    const routePath = path.join(process.cwd(), routeFile);
    let route = fs.readFileSync(routePath, 'utf8');
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
