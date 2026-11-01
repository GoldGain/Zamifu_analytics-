const { createHash } = require('node:crypto');
const { readFileSync, readdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const url = 'https://naihzzlszvrkxrxogsuz.supabase.co/storage/v1/object/public/zamifu-source-transfer-c039e17/analytics-c039e17-source.tar.gz';
const expectedSha256 = '4db32fe9cace2311649824fbf995af65df8b914d1cf99e0d0ba01324fef2ff77';
const archive = '/tmp/analytics-source.tar.gz';

function normalizeRelativeServerlessImports() {
  const directory = path.join(process.cwd(), 'src/lib/learn-exam');
  for (const entry of readdirSync(directory)) {
    if (!entry.endsWith('.ts')) continue;
    const modulePath = path.join(directory, entry);
    const original = readFileSync(modulePath, 'utf8');
    const patched = original.replace(
      /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])(\.\.?\/[^'"]+?)\2(?!\s+with\s*\{)/g,
      (match, prefix, quote, specifier) => {
        if (specifier.endsWith('.json')) return `${prefix}${quote}${specifier}${quote} with { type: 'json' }`;
        return path.extname(specifier) ? match : `${prefix}${quote}${specifier}.js${quote}`;
      },
    );
    if (patched !== original) writeFileSync(modulePath, patched);
  }
  console.log('Normalized relative serverless imports.');
}

function canonicalizeVerifiedSeniorTopics() {
  const modulePath = path.join(process.cwd(), 'src/lib/learn-exam/senior-curriculum-validation.ts');
  const original = readFileSync(modulePath, 'utf8');
  const before = '    const topic = String(question.topic || "").trim();\n    if (!allowed.has(topic)) {';
  const after = `    let topic = String(question.topic || "").trim();
    if (!allowed.has(topic) && topic.length >= 12 && /\\s/.test(topic)) {
      const foldedTopic = topic.toLocaleLowerCase();
      const matches = [...allowed].filter((candidate) => candidate.toLocaleLowerCase().includes(foldedTopic));
      if (matches.length === 1) {
        question.topic = matches[0];
        topic = matches[0];
      }
    }
    if (!allowed.has(topic)) {`;
  if (!original.includes(before)) throw new Error('Senior curriculum validation anchor not found.');
  writeFileSync(modulePath, original.replace(before, after));
  console.log('Enabled exact senior sub-strand canonicalization.');
}

async function main() {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Verified source download failed with HTTP ${response.status}.`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const actualSha256 = createHash('sha256').update(bytes).digest('hex');
  if (actualSha256 !== expectedSha256) throw new Error('Verified source archive checksum did not match.');
  writeFileSync(archive, bytes);
  const extracted = spawnSync('tar', ['-xzf', archive], { stdio: 'inherit' });
  if (extracted.error || extracted.status !== 0) {
    throw extracted.error || new Error(`Source extraction exited with status ${extracted.status}.`);
  }
  normalizeRelativeServerlessImports();
  canonicalizeVerifiedSeniorTopics();
  console.log(`Verified and extracted ${bytes.length} source bytes.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
