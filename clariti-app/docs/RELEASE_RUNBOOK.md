# Clariti release runbook — App Store, Play, RevenueCat, Firebase

Everything in this document is work that happens in someone else's dashboard, so
none of it could be done in code. The code side is finished and waiting on these
values.

Do the steps in order. Later steps depend on identifiers earlier ones produce.

## Fixed identifiers

Everything below is already hardcoded somewhere in the repo. Changing one means
changing the other side too — the "used by" column says where.

| Value | | Used by |
|---|---|---|
| Bundle / application id | `app.useclariti.mobile` | `clariti-mobile/capacitor.config.ts`, both native projects, the AASA file |
| App name | `Clariti` | `Info.plist` `CFBundleDisplayName`, `strings.xml` |
| Apple Team ID | `7DXS32H632` (ZAPX SOLUTIONS LIMITED) | `project.pbxproj`, `public/.well-known/apple-app-site-association` |
| Release provisioning profile | `Clariti App Store` | `project.pbxproj` → `PROVISIONING_PROFILE_SPECIFIER` |
| Custom URL scheme | `app.useclariti.mobile://` | `Info.plist`, `AndroidManifest.xml`, `lib/auth/oauth.ts`, Supabase redirect list |
| Associated domain | `applinks:useclariti.app` | `App.entitlements` |
| Production origin | `https://useclariti.app` | `capacitor.config.ts` `server.url`, `NEXT_PUBLIC_APP_URL` |
| RevenueCat project | `proja88a3e46` | already live for web billing |
| RevenueCat entitlement | `plus` | `lib/billing/subscription.ts`, `lib/billing/native-purchases.ts`, the webhook |
| RevenueCat offering | `default` | packages `$rc_monthly` / `$rc_annual` |
| Store product ids | `clariti_plus_monthly`, `clariti_plus_annual` | `lib/billing/revenuecat.ts` → `CLARITI_STORE_PRODUCT_IDS`, and already on `CLARITI_REVENUECAT_PLUS_PRODUCT_IDS` in Vercel |

## What is already true

Verified against the live services, not assumed:

- The Apple Developer account is active and a distribution certificate for team
  `7DXS32H632` is installed on this machine.
- The App ID `app.useclariti.mobile` is registered, and the App Store
  distribution profile named `Clariti App Store` exists and is installed — the
  Release configuration signs against it on every archive.
- `useclariti.app` resolves and serves the production app.
- The Clariti RevenueCat project exists with the `plus` entitlement, and the
  `default` offering now returns **both** packages — `$rc_monthly` →
  `clariti_plus_monthly` and `$rc_annual` → `clariti_plus_annual` — to the
  production iOS key. The paywall has real prices to render.
- `CLARITI_REVENUECAT_PLUS_PRODUCT_IDS` in Vercel production already allowlists
  `clariti_plus_monthly` and `clariti_plus_annual`, so an entitlement granted for
  either flows through the existing webhook with no code change.
- Migration `0006_private_artifacts_and_limits.sql` is applied. Both storage
  buckets — `clariti-documents` and `clariti-videos` — are private, and the media
  routes hand out signed URLs rather than public ones.
- Build 1 (`CFBundleVersion 1`, `MARKETING_VERSION 1.0`) is uploaded, processed
  and attached to version 1.0. Every subsequent archive needs a higher
  `CURRENT_PROJECT_VERSION`, set in **both** Release and Debug configuration
  blocks of `project.pbxproj`.

---

## 1. Apple Developer portal

<https://developer.apple.com/account/resources>

1. ~~**Identifiers → +** → App IDs → App.~~ **Already done.** The App ID
   `app.useclariti.mobile` is registered with **Push Notifications**,
   **Associated Domains** and **Sign In with Apple** (primary). Those three have
   to stay ticked: `App.entitlements` claims all three, and a mismatch fails the
   signing step rather than warning.

2. **Keys → +** → tick **Apple Push Notifications service (APNs)** → name it
   `Clariti APNs` → Continue → Register → **Download the `.p8`**. Note the **Key
   ID**. Apple lets you download this file exactly once.
   > An APNs key is per-team, not per-app, so if you already made one for Nura you
   > can reuse that key and skip this step.

3. **Keys → +** → tick **Sign in with Apple** → Configure → set the primary App ID
   to `app.useclariti.mobile` → Register → download the `.p8`, note the Key ID.
   This is the key Supabase needs in step 6.

4. ~~**Profiles → +** → **App Store Connect** distribution~~ **Already done.**
   The profile named `Clariti App Store` exists and is installed; the Xcode
   Release configuration looks it up by that exact name via
   `PROVISIONING_PROFILE_SPECIFIER`. Only regenerate it if a capability changes
   or it expires — and keep the name, or the archive stops signing.

## 2. App Store Connect — the app record

<https://appstoreconnect.apple.com>

1. **Apps → +** → New App.
   - Platform: iOS · Name: `Clariti` · Primary language: English (U.S.)
   - Bundle ID: `app.useclariti.mobile` · SKU: `clariti-ios`
   - Full Access.
2. Note the **Apple ID** number App Store Connect assigns (a 10-digit number in
   the App Information page). You need it in step 7.

## 3. App Store Connect — subscriptions

**Monetization → Subscriptions → Create** a subscription group first:

- Reference name: `Clariti Plus`

Then **two** subscriptions inside that group. The product IDs must match exactly —
they are what RevenueCat and the webhook allowlist key on:

| Product ID | Reference name | Duration |
|---|---|---|
| `clariti_plus_monthly` | Clariti Plus Monthly | 1 month |
| `clariti_plus_annual` | Clariti Plus Annual | 1 year |

For each one:
- Set a price for your base territory (Apple generates the rest).
- **Localization** → Display name (`Clariti Plus`) and a description. Required, or
  the product stays in "Missing Metadata" and the offering returns zero packages.
- **Review information** → a screenshot of the paywall and a note.
- Optionally add an **introductory offer** (free trial). The webhook already maps
  `period_type: TRIAL` to `subscription_status: "trialing"`, so a store trial
  works with no code change.

Then **Monetization → In-App Purchase → App-Specific Shared Secret → Generate**.
Copy it; RevenueCat needs it in step 4.

> The products stay in "Ready to Submit" until they are attached to a build and
> reviewed. They still return real prices to a TestFlight build, which is enough
> to test the whole purchase path.

## 4. RevenueCat

<https://app.revenuecat.com> → project `proja88a3e46`

1. **Apps → + New** → **App Store**.
   - App name: `Clariti iOS` · Bundle ID: `app.useclariti.mobile`
   - Paste the **App-Specific Shared Secret** from step 3.
   - Upload the **In-App Purchase Key** (App Store Connect → Users and Access →
     Integrations → In-App Purchase → generate) so RevenueCat can verify receipts
     server-side.
2. ~~**Apps → + New** → **Play Store**~~ **Done 2026-09-09.** `Clariti Android`
   (`appa7ba601e5b`, package `app.useclariti.mobile`) exists with Play products
   `clariti_plus_monthly:monthly` and `clariti_plus_annual:annual`, both attached
   to `plus` and to the `default` packages. It still has **no service account
   credentials**, so Google purchases cannot be validated until step 8.5 is done.
3. **Products → + New**, twice, on the iOS app: `clariti_plus_monthly` and
   `clariti_plus_annual`.
4. ~~**Offerings → `default`** → add two packages~~ **Already done.** `default`
   returns `$rc_monthly` → `clariti_plus_monthly` and `$rc_annual` →
   `clariti_plus_annual` to the production iOS key. If the paywall ever shows no
   buy button again, check this first: the app refuses to render one when the
   offering is empty, because a button that cannot complete a purchase is worse
   than none.
5. **Entitlements → `plus`** → attach both products.
6. **API keys** → copy the **public** app-specific keys:
   - iOS key (`appl_…`) → Vercel `NEXT_PUBLIC_CLARITI_REVENUECAT_IOS_API_KEY`
   - Android key (`goog_…`) → `NEXT_PUBLIC_CLARITI_REVENUECAT_ANDROID_API_KEY`
     (**set 2026-09-09** in production, preview and development).
7. **Integrations → Webhooks** — confirm the existing webhook points at
   `https://useclariti.app/api/revenuecat/webhook` and that its Authorization
   header matches `CLARITI_REVENUECAT_WEBHOOK_AUTH_HEADER` in Vercel. The route
   returns 503 rather than 200 when that variable is unset, so a misconfiguration
   is loud.

## 5. Firebase (push notifications)

Push is wired but inert until this exists — `AppDelegate.swift` skips
`FirebaseApp.configure()` when `GoogleService-Info.plist` is absent, so the app
builds and runs without it.

1. <https://console.firebase.google.com> → create project `Clariti` (or add to the
   existing Nura project — one project can host several apps).
2. **Add app → iOS**, bundle id `app.useclariti.mobile` → download
   **`GoogleService-Info.plist`** → put it at
   `clariti-mobile/ios/App/App/GoogleService-Info.plist`, then drag it into the
   `App` group in Xcode so it is added to the target's Copy Bundle Resources.
3. **Project settings → Cloud Messaging → APNs Authentication Key** → upload the
   `.p8` from step 1.2 with its Key ID and your Team ID `7DXS32H632`.
4. For Android: **Add app → Android**, package `app.useclariti.mobile`, download
   **`google-services.json`** → `clariti-mobile/android/app/google-services.json`.

Both files are gitignored deliberately — they are environment-specific.

## 6. Supabase

Dashboard → Authentication.

1. **URL Configuration → Redirect URLs**, add:
   - `app.useclariti.mobile://auth/callback` — the native OAuth return leg
   - `https://useclariti.app/**`
   `pnpm --filter clariti-app exec node scripts/configure-supabase-auth.mjs` writes
   these for you if you prefer.
2. **Providers → Apple** → enable. Services ID, Team ID `7DXS32H632`, the Key ID
   and `.p8` from step 1.3.
3. **Providers → Google** → enable, with an OAuth client from Google Cloud Console.
   > Apple's Guideline 4.8 makes Sign in with Apple mandatory the moment Google
   > sign-in is offered. Ship both or neither.
4. **Only then** set `NEXT_PUBLIC_CLARITI_OAUTH_PROVIDERS=apple,google` in Vercel
   and redeploy. The buttons are hidden until that variable lists a provider,
   because a provider Supabase has not been configured with returns a 400 the
   moment somebody taps it — a dead button is worse than no button.

## 7. Vercel environment

`clariti-app` → Settings → Environment Variables → Production:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_CLARITI_REVENUECAT_IOS_API_KEY` | `appl_…` from step 4.6 |
| `NEXT_PUBLIC_CLARITI_REVENUECAT_ANDROID_API_KEY` | `goog_…` from step 4.6 |
| `NEXT_PUBLIC_IOS_APP_STORE_URL` | `https://apps.apple.com/app/id<Apple ID from step 2.2>` — **leave unset until the app is actually live** |
| `CLARITI_MIN_NATIVE_BUILD` | `1` |
| `NEXT_PUBLIC_CLARITI_OAUTH_PROVIDERS` | `apple,google` — **only after step 6 is done**; empty until then |
| `CRON_SECRET` | a fresh random string; Vercel Cron sends it as `Authorization: Bearer …` |

Then redeploy — `NEXT_PUBLIC_*` values are inlined at build time, so a restart is
not enough.

## 8. Google Play (Android)

1. Play Console → **Create app** → `Clariti`, package `app.useclariti.mobile`.
2. ~~Generate a release keystore~~ **Done 2026-09-09.** The upload key is
   `~/.android/keystores/clariti-upload.jks` (alias `clariti-upload`, passwords in
   `clariti-upload.properties` beside it). Play App Signing holds the app-signing
   key, so this is only the upload key. Back it up off this machine.
3. ~~Wire `signingConfigs.release`~~ **Done.** `android/app/build.gradle` reads
   `CLARITI_ANDROID_KEYSTORE*` env vars or `android/keystore.properties`
   (gitignored) and falls back to an unsigned build when neither is present.
4. ~~**Monetize → Subscriptions**~~ **Done 2026-09-09.** `clariti_plus_monthly`
   (base plan `monthly`, USD 9.99) and `clariti_plus_annual` (base plan `annual`,
   USD 79.99) are active in Play Console, priced in 177 countries.
5. **Still open.** Grant RevenueCat access: create a Google Cloud service
   account, invite its email in Play Console → Users and permissions with
   *View financial data* and *Manage orders and subscriptions*, and upload its
   JSON key to the RevenueCat `Clariti Android` app. Until then Play purchases
   reach RevenueCat unverified and the paywall cannot be trusted end to end.
6. **App Links** need `https://useclariti.app/.well-known/assetlinks.json` listing
   the SHA-256 fingerprint of your **Play App Signing** certificate (Play Console →
   Setup → App integrity). Until that file exists, `android:autoVerify` fails
   softly and Android shows a chooser instead of opening the app.

## 9. Build and upload

```bash
cd clariti-mobile
npx cap sync
```

**iOS:** bump `CURRENT_PROJECT_VERSION` in `ios/App/App.xcodeproj/project.pbxproj`
first — it appears in **two** configuration blocks and both have to move together,
or the Debug and Release halves of the project disagree. App Store Connect
rejects an upload whose build number it has already seen.

```bash
cd ios/App
xcodebuild -project App.xcodeproj -scheme App -configuration Release \
  -destination 'generic/platform=iOS' -archivePath build/Clariti.xcarchive archive
xcodebuild -exportArchive -archivePath build/Clariti.xcarchive \
  -exportOptionsPlist ExportOptions.plist -exportPath build/export
```

Or open `App.xcodeproj` in Xcode and use Product → Archive → Distribute App, which
is easier the first time.

**Android:**

```bash
cd android && ./gradlew bundleRelease
```

## 10. Before submitting for review

The code side of every item below is already done; these are the ones that need a
human to confirm or to fill in a form.

- [ ] **Attach both subscriptions to the 1.0 version.** On the version page,
      scroll to **In-App Purchases and Subscriptions** → **+** → tick
      `clariti_plus_monthly` and `clariti_plus_annual` → Save. This is a separate
      action from creating them in step 3, and skipping it is silent: the app
      gets reviewed and released while the subscriptions stay in "Ready to
      Submit", so every purchase in the live app fails.
      > Nothing can check this for you. The App Store Connect API rejects
      > `include=subscription` on `appStoreVersions` with a 400, and no other
      > relationship reports the attachment, so the only confirmation is seeing
      > both products listed on the version page before you press **Submit for
      > Review**.
- [ ] **Privacy Policy URL**: `https://useclariti.app/privacy` — mandatory field.
- [ ] **Terms of Use (EULA) URL**: `https://useclariti.app/terms`.
- [ ] **App Privacy questionnaire.** Clariti collects an email address, uploaded
      health documents and their extracted text, and generated analyses. Declare
      **Health & Fitness → Health** and **User Content**, linked to identity, and
      *not* used for tracking. Under-declaring here is a common rejection.
- [ ] **Demo account** in App Review Information, with a saved document already
      attached — a reviewer who cannot get past an empty state rejects for
      Guideline 2.1. Create it with:
      ```bash
      cd clariti-app && npx vercel env pull .env.review --environment=production --yes
      set -a && . ./.env.review && set +a
      REVIEW_EMAIL=review@useclariti.app REVIEW_PASSWORD='pick-one' node scripts/seed-review-account.mjs
      rm .env.review
      ```
      Add a note saying outbound phone calls are not part of this release, and
      that the explainer-video feature renders a single Veo clip and needs no
      Shotstack account. Shotstack is optional stitching for a five-scene cut;
      leave `SHOTSTACK_API_KEY` unset unless you hold a key Shotstack currently
      accepts — a dead key is probed and ignored, so there is no reason to set one.
- [ ] **Age rating**: expect 17+ / "Medical or Treatment Information".
- [ ] **Screenshots**: 6.7" and 6.5" iPhone, plus an iPad set — the shell ships
      with `TARGETED_DEVICE_FAMILY = "1,2"`, so App Store Connect will not accept
      the submission without one. `pnpm --filter clariti-app shots` captures all
      three into `store-assets/clariti-ios-6.7`, `clariti-ios-6.5` and
      `clariti-ipad-12.9`.
      > Upload only the `clariti-` directories. `store-assets/` also holds
      > `nura-ios-6.5` and `nura-ipad-13`, which are the other app in this repo:
      > same green palette, entirely different product. `nura-ipad-13` is the
      > larger 2064 × 2752 set, so it is the one most likely to get picked up by
      > mistake for the iPad slot — `clariti-ipad-12.9` at 2048 × 2732 is the
      > correct upload and Apple accepts it there.
- [ ] **Account deletion** is reachable in-app from Settings — Guideline 5.1.1(v).
      Verify it before submitting; reviewers test this one.
- [ ] **Restore purchases** is on the paywall — Guideline 3.1.1.
- [ ] Buy on a TestFlight build with a **sandbox Apple Account**, then confirm the
      RevenueCat webhook actually wrote `subscription_tier = 'plus'` onto that
      user's `clariti_profiles` row. If it did not, the server log line
      `[revenuecat] paid event matched no Clariti profile` says why.

## 11. After the app is live

- Set `NEXT_PUBLIC_IOS_APP_STORE_URL` (step 7) and redeploy, so the in-app
  "update available" notice can link to the listing.
- Nothing to do about `0006_private_artifacts_and_limits.sql` — it is applied,
  and `clariti-documents` and `clariti-videos` are both private. Left here only
  because an earlier draft of this runbook listed it as outstanding.
