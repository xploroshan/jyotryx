# Mobile Release Runbook (P7)

How a MyAstro360 Android release goes from branch → Play Store, step by step.

## One-time setup

1. **Expo/EAS project**: `npm i -g eas-cli && eas login` → in `apps/mobile`:
   `eas init` (links the project; note the project ID) → set `EAS_PROJECT_ID`
   wherever you build locally. `eas credentials` → let EAS manage the Android
   keystore (Play App Signing recommended).
2. **GitHub secrets** (repo → Settings → Secrets → Actions):
   - `EXPO_TOKEN` — from https://expo.dev/accounts/[you]/settings/access-tokens
   - `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` — the SAME service account from
     [`docs/PLAY_BILLING_SETUP.md`](../PLAY_BILLING_SETUP.md) §2 (it also needs
     "Releases" permission in Play Console → Users and permissions).
3. **Play Console**: complete the app listing, data-safety form, content
   rating; create the internal-testing track and add testers. First AAB must
   be uploaded manually once (Play requirement) — use
   `eas build -p android --profile production` and upload the artifact.
4. **App assets**: already committed (`apps/mobile/assets/`, generated from the
   brand mark).

## Every release

1. **Pre-flight on the branch** (CI runs these on every mobile PR anyway):
   ```bash
   cd apps/mobile
   npx tsc --noEmit && npm test -- --ci     # types + 70-ish unit tests
   npm run bundle:check                     # JS bundle ≤ 8 MB budget
   ```
2. **Detox on an emulator** — GitHub → Actions → "Mobile CI" → **Run workflow**
   (the emulator job only runs on manual dispatch). Locally:
   ```bash
   npx expo prebuild -p android && npm run e2e:build && npm run e2e:test
   ```
3. **Tag** — the release workflow does the rest (build gate → EAS Build
   production AAB → EAS Submit to the Play **internal** track as a draft):
   ```bash
   git tag mobile-v1.0.0 && git push origin mobile-v1.0.0
   ```
4. **Promote in Play Console**: internal → closed → open → production, watching
   pre-launch reports and Android vitals between promotions.
5. **Verify the payment rail on internal track** per
   [`docs/PLAY_BILLING_SETUP.md`](../PLAY_BILLING_SETUP.md) §5 (license-tester
   purchase → exactly-once grant → RTDN cancel → revoke).

## OTA updates (JS-only fixes)

Build profiles are pinned to channels (`preview`, `production` in `eas.json`).
For a JS-only hotfix (no native/dep changes):
```bash
cd apps/mobile
eas update --channel production --message "fix: …"
```
Native/dependency changes always require a full build + store release.

## Rollback

- OTA: `eas update:republish` the previous update group on the channel.
- Store: halt the rollout in Play Console (Releases → production → pause) and
  promote the previous AAB.
