const { createHash } = require('node:crypto');
const { writeFileSync } = require('node:fs');
const { spawnSync } = require('node:child_process');

const url = 'https://naihzzlszvrkxrxogsuz.supabase.co/storage/v1/object/public/zamifu-source-transfer-c039e17/analytics-c039e17-source.tar.gz';
const expectedSha256 = '4db32fe9cace2311649824fbf995af65df8b914d1cf99e0d0ba01324fef2ff77';
const archive = '/tmp/analytics-source.tar.gz';

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
  console.log(`Verified and extracted ${bytes.length} source bytes.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
