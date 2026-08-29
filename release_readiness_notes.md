# Zamifu Analytics release-readiness notes

Date: 2026-08-29

## Repository

- GitHub repository: GoldGain/Zamifu_analytics-
- Branch inspected: main
- Repository cloned to `/home/ubuntu/Zamifu_analytics-` with clean status.
- Project is a Vite + React + TypeScript static web application.
- `package.json` contains only web scripts: `dev`, `build`, `lint`, and `preview`.
- No `android/` directory, Gradle wrapper, Capacitor config, React Native config, Expo config, or existing Android manifest was found in the initial project inspection.
- Existing PWA metadata is present in `public/manifest.json` and a service-worker-based install flow exists in `src/hooks/usePWA.ts`.
- Existing deployment configuration is Vercel-oriented (`vercel.json`) and SPA routing rewrites all paths to `index.html`.

## Live deployment

- `https://zamifu.company` loads successfully after initial render.
- Visible branding: Zamifu Analytics - Intelligent School Management System.
- Landing page exposes login, school registration, Pathway Finder, features, FAQ, privacy policy, terms, cookie policy, data processing agreement, and confidentiality pages.
- The live page presents Zamifu Analytics as a school-management web platform with learner/result/fee/report-card tools and a Pathway Finder.
- The live page has an explicit "Get the App" area, but the current repository inspection shows no native Android project.
- Contact details visible on the public page: tutorsultimate@gmail.com and 0712644205; do not treat these as verified account credentials.

## Initial implication

The codebase is currently a browser/PWA application rather than a ready-to-upload Android App Bundle. A Play Store release will require a native wrapper strategy (likely Capacitor or Trusted Web Activity) plus Android application identity, signing, versioning, policy declarations, screenshots, privacy details, and Play Console access. The user supplied no Android keystore, package ID, privacy policy URL confirmation, Play Console invitation/owner access, or verified pricing/IAP configuration yet.

## Security note

The user message included long-lived credentials. Do not write those secrets to repository files, commit them, or echo them in logs. Prefer the already-authenticated GitHub CLI and connector session where available. Recommend rotating any credentials that may have been exposed in chat before production release.

## External links visited

- https://zamifu.company
- https://github.com/GoldGain/Zamifu_analytics-.git (repository URL supplied by user; repository resolved as GoldGain/Zamifu_analytics-)
- https://naihzzlszvrkxrxogsuz.supabase.co (Supabase URL supplied by user; API access not yet performed)
- Vercel team/live information was supplied by user; live deployment URL was verified above.

## Play Console access

- Opening `https://play.google.com/console` redirected to the Google sign-in page.
- The browser session is not authenticated for Google Play Console.
- The next step requiring account access will need the user to complete Google login and any 2-step verification in the already-open browser, or provide an alternative Play Console release path.
- No Play Console app, package name, developer account status, or existing release could be inspected without authentication.

## Current Play requirements verified from official sources

- The official Android Developers guidance states that starting August 31, 2026, new apps and app updates must target Android 16 (API level 36) or higher for submission to Google Play. The current date is August 29, 2026, so this release should target API 36 rather than relying on an older target.
- The official Play Console Help guidance states that personal developer accounts created after November 13, 2023 must run a closed test with at least 12 testers opted in continuously for at least 14 days before applying for production access. This requirement may prevent immediate production publishing even after an App Bundle is uploaded.
- The Play Console account is not currently authenticated in the browser, so the developer account type and creation date could not be verified.

Sources:
- https://developer.android.com/google/play/requirements/target-sdk
- https://support.google.com/googleplay/android-developer/answer/14151465?hl=en

## Native packaging assessment

- Official Capacitor documentation currently presents v8 and confirms that an existing web app can add Android with `npm install @capacitor/android`, `npx cap add android`, and `npx cap open android`.
- Capacitor documentation describes Play deployment as a normal native Android release and points to Google’s launch checklist and icon/splash guidance.
- The sandbox has Node 22 and Java 21, but no Android SDK environment variables, SDK platforms directory, or system Gradle installation were found. A local release build therefore needs Android command-line tools, platform API 36, build-tools, and Gradle dependencies installed or a remote Android build service used.

## Branding assets

- The repository includes a clear square 512×512 Zamifu icon with a blue and teal “Z” globe mark suitable as the base for the Play Store icon and native launcher resources.
- The repository also includes a 1200×900 wordmark logo and several 1344×768 school photography assets suitable for promotional graphics, but the wordmark is not square and should not be used directly as a launcher icon.
- Native Capacitor resources were generated with default launcher/splash files; these should be replaced or verified against the Zamifu icon before submission.

## Legal and policy pages

- `https://zamifu.company/privacy` is publicly reachable and states that Zamifu Analytics processes school, staff, learner, parent/guardian, financial, and usage data; it explicitly covers minors’ data in an educational context and identifies parental-consent responsibilities for schools.
- The privacy page identifies Data Protection Act 2019 (Kenya) and GDPR where applicable, lists rights and retention language, and provides a contact email and phone number. This is a usable candidate for the Play listing privacy-policy URL, but the developer should confirm the operator’s legal identity and that the policy exactly matches the mobile app’s final data flows.
- `https://zamifu.company/terms` is publicly reachable and covers school accounts, subscriptions, Paystack processing, acceptable use, AI-generated content, and Kenyan governing law.
- Because the app handles learner and potentially minor data, Play Console Data Safety and Families/policy declarations must be completed carefully; the current public policy is evidence for those declarations but not a substitute for account-owner confirmation.

## Store screenshots

- Three Play Store candidate screenshots were captured at 1080×1920 PNG dimensions from the public production app: the landing page, Pathway Finder, and login screen.
- The landing screenshot shows Zamifu Analytics branding, school-management positioning, calls to action, and responsive mobile rendering. The Pathway Finder screenshot shows a distinct functional flow and readable pathway-interest cards. These are suitable candidate assets, subject to the account owner confirming that public landing-page views are representative of the mobile release.
- The Android release bundle was successfully produced at `android/app/build/outputs/bundle/release/app-release.aab`; a debug APK was also produced for testing. The AAB is signed with a newly generated local upload key that is intentionally excluded from Git.
