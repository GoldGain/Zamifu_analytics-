import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const expectIncludes = (content: string, needle: string, label: string) => {
  if (!content.includes(needle)) throw new Error(`${label}: missing ${needle}`);
};
const expectNotIncludes = (content: string, needle: string, label: string) => {
  if (content.includes(needle)) throw new Error(`${label}: found forbidden ${needle}`);
};

const reseller = read('src/lib/reseller.ts');
const trial = read('src/lib/trial.ts');
const sms = read('src/lib/sms.ts');
const wallet = read('src/pages/dashboard/school-admin/SMSWallet.tsx');
const app = read('src/App.tsx');
const layout = read('src/components/layout/DashboardLayout.tsx');
const sendSms = read('supabase/functions/send-sms/index.ts');
const verifyTopup = read('supabase/functions/verify-paystack-sms-topup/index.ts');
const migration = read('supabase/migrations/20260823_sms_wallet_and_subscription_pricing.sql');
const smsSettings = read('src/pages/dashboard/school-admin/SMSSettings.tsx');
const bulkSms = read('src/pages/dashboard/school-admin/BulkSms.tsx');
const communicate = read('src/pages/dashboard/school-admin/Communicate.tsx');
const aiGuide = read('src/lib/ai.ts');

expectIncludes(reseller, 'DEFAULT_FEE_PER_LEARNER = 20', 'reseller term default');
expectIncludes(reseller, 'DEFAULT_ANNUAL_FEE_PER_LEARNER = 50', 'reseller annual default');
expectIncludes(trial, 'PRICE_PER_LEARNER = DEFAULT_FEE_PER_LEARNER', 'trial term default');
expectIncludes(wallet, 'variable_name: \'product\', value: \'sms_credits\'', 'Paystack product metadata');
expectIncludes(wallet, 'variable_name: \'sms_credits\'', 'Paystack credit metadata');
expectIncludes(app, '/school-admin/sms-wallet', 'wallet route');
expectIncludes(layout, "path: '/school-admin/sms-wallet'", 'wallet navigation');
expectIncludes(sms, "functions.invoke('send-sms'", 'server SMS invocation');
expectNotIncludes(sms, '3682|', 'browser-bundled Olympus token');
expectIncludes(sms, "const OLYMPUS_SENDER_ID = 'ZAMIFU'", 'client Olympus sender ID');
expectIncludes(sendSms, '|| "ZAMIFU"', 'edge-function Olympus sender fallback');
for (const [label, content] of [
  ['SMS settings', smsSettings],
  ['bulk SMS', bulkSms],
  ['communicate', communicate],
  ['copilot guidance', aiGuide],
] as const) {
  expectNotIncludes(content, ['PRO', 'CALL'].join(''), `${label} stale sender ID`);
  expectIncludes(content, 'ZAMIFU', `${label} sender ID`);
}
expectIncludes(sendSms, 'reserve_school_sms_credits', 'server credit reservation');
expectIncludes(sendSms, 'settle_school_sms_charge', 'server charge settlement');
expectIncludes(sendSms, 'You can only send SMS for your own school.', 'school scope guard');
expectIncludes(sendSms, 'INSUFFICIENT_SMS_CREDITS', 'insufficient-credit guard');
expectIncludes(verifyTopup, 'record_verified_school_sms_topup', 'verified top-up ledger call');
expectIncludes(verifyTopup, 'product !== "sms_credits"', 'top-up product guard');
expectIncludes(verifyTopup, 'amountKsh !== credits', 'KES 1 amount guard');
expectIncludes(migration, 'school_sms_wallets', 'wallet table');
expectIncludes(migration, 'school_sms_transactions', 'ledger table');
expectIncludes(migration, 'record_verified_school_sms_topup', 'top-up function');
expectIncludes(migration, 'reserve_school_sms_credits', 'reservation function');
expectIncludes(migration, 'settle_school_sms_charge', 'settlement function');

for (const [label, content] of [
  ['bulk SMS', read('src/pages/dashboard/school-admin/BulkSms.tsx')],
  ['communicate', read('src/pages/dashboard/school-admin/Communicate.tsx')],
  ['results notifications', read('src/pages/dashboard/school-admin/Results.tsx')],
  ['learner welcome', read('src/pages/dashboard/school-admin/Students.tsx')],
  ['teacher welcome', read('src/pages/dashboard/school-admin/Teachers.tsx')],
] as const) {
  if (!content.includes('user?.schoolId')) throw new Error(`${label}: missing school-scoped SMS call`);
}

console.log('SMS wallet and pricing implementation smoke tests passed.');
