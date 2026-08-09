# Zamifu Analytics Fix Task — Working Notes

Repo: /home/ubuntu/zamifu (origin = GoldGain/Zamifu_analytics-, backup remote added: https://GoldGain:ghp_Token@github.com/GoldGain/zamifu-backup.git)
Backup DONE: `git push backup main --force` (backup main now = 89a3447 local main).
Live: https://zamifu.company, deploy via Vercel MCP (server name: vercel) or vercel CLI — Vercel token/team goldgain-3350s-projects in prompt.
Project: Vite + React + TS (src/), Supabase client via src/lib/supabase/client.ts. No api/ routes server-side; SMS sent client-side from school-admin/Results.tsx via src/lib/sms.ts (Olympus API).

## Issue 1 SMS Total Points (DONE)
- src/lib/sms.ts: resultsToParent template now adds `Total Points: X/Y` line only when band !== 'primary' and totalPossible > 0.
- src/pages/dashboard/school-admin/Results.tsx (~line 230): now computes gradePoints sum (8-level: EE1=8..BE2=1) for Junior/Senior (subjects × 8), passes smsTotalPoints/smsTotalPossible; Primary keeps percentage-sum semantics (subjects × 100) — template skips primary.

## Issue 2 Assessment label (DONE)
- src/lib/reportCardPdf.ts drawStudentInfo already accepts assessmentName param (shows "Assessment: ..." at y+6, shifts Position).
- src/pages/dashboard/student/ReportCard.tsx: drawStudentInfo now passes assessment name; added on-screen "Assessment:" line in student info card; removed redundant inline PDF text at y=70.
- src/pages/dashboard/parent/ChildReportCard.tsx: drawStudentInfo now passes assessment name.

## Issue 3 Remove Mark List (DONE)
- src/components/layout/DashboardLayout.tsx: removed Marklist nav item (kept Class List).
- src/pages/dashboard/dean-of-studies/Dashboard.tsx: removed mark_lists tab, typed state, and MarkListTable component.
- NOTE: /teacher/marklist route still exists in App.tsx (line ~240) but no nav link — acceptable (hidden). Optionally keep.

## Issue 4 Copilot responsive — src/components/AIAssistant.tsx (DONE)
- Bottom sheet on mobile (max-md: fixed bottom, full width, rounded-t-2xl, 88vh), floating panel on desktop (md).
- Drag disabled on mobile (onMouseDown undefined when isMobileView); isMobileView via resize listener.
- Copilot label truncated w/ max-w-[70%] pill; title whitespace-nowrap; position clamped on load.
## Issue 5 Payment callback — src/components/Payment/PaystackButton.tsx (TODO)
## Issue 6 Policy pages — Home.tsx footer, create 5 legal pages (Privacy, Terms, Cookie, DPA, Confidentiality) (TODO)
## Issue 7 One-page report cards — src/lib/reportCardPdf.ts + reportCard sections (TODO): reduce fonts/margins/spacing, ensure single page

## Test creds
School Admin: muemutuku@gmail.com / SchoolAdmin@2025; Teacher: makau@gmail.com / Teacher@2025; DOS: dos@zamifu.com / Dos@2025; Reseller: martinmakau123@gmail.com / 123456789
Supabase URL https://naihzzlszvrkxrxogsuz.supabase.co ; also MCP supabase available.

## Remaining steps
- Install deps + local test (pnpm or npm run dev)
- Push + deploy to Vercel (vercel MCP tool or CLI)
## Issue 4 Copilot responsive (TODO next)
- File: src/components/AIAssistant.tsx (imported in DashboardLayout line 11 as AIAssistant, rendered line ~291)
- Problem: text cut off on mobile — fix with responsive classes, word break, max-width, z-index.

## Issue 5 Payment callback error (DONE)
Root cause FOUND & FIXED: Paystack V1 inline.js (js.paystack.co/v1/inline.js) validates callbacks with:
`Object.prototype.toString.call(t) === "[object Function]"` — async arrow functions are "[object AsyncFunction]" → throws "Attribute callback must be a valid function".
Fix: replaced `callback: async (response) => {...}` with plain sync `callback: (response) => { ... .then(...).catch(...) }` in:
- src/components/Payment/PaystackButton.tsx (subscription payment — the one school admin uses)
- src/pages/dashboard/parent/ChildReportCard.tsx
- src/pages/dashboard/parent/Children.tsx
- src/pages/dashboard/parent/Fees.tsx
- src/hooks/usePaystack.ts (consumer must pass sync onSuccess)

## Issue 6 Policy pages (TODO next)
- Create 5 legal pages in src/pages/: PrivacyPolicy, TermsOfService, CookiePolicy, DataProcessingAgreement, Confidentiality
- Link in landing page footer — find Home.tsx footer (Home/landing page)
- Routes in App.tsx

## Issue 7 One-page report card (MOSTLY DONE — verify)
DONE in src/lib/reportCardPdf.ts: export COMPACT_MODE=true; HDR_H 28mm; ROW 4.5mm; student info y=34 in both callers; table fs 7.5 padding 1; summary box 17mm fs 7.5; deviation 7mm; achievements fs 6.5 row 4.5; AI comment fs 7 lineHeight 0.55; signatures 24mm compact (sig images 40x12 at y+2, labels y+16, date y+21, stamp box 32x14). Trend graph capped 38mm in compact.
DONE in student/ReportCard.tsx: y=34. DONE in parent/ChildReportCard.tsx: photo 26x26 at 168,26; y=34; table startY 62; gaps 6; trend 40h +42.
TODO verify: teacher ResultsUpload.tsx has 2 jsPDF uses (lines 248, 495) — check if they also call drawReportHeader/drawStudentInfo at y=38; update if so.
Also TODO: shorten AI comment templates in grading.ts? Check template length — currently ~3 sentences; compact lineHeight 4.45*lines. If comment ~4 lines (28mm) + box ≈ fits.
Then: test build, check pages, push, deploy via Vercel MCP (vercel server), verify live.
