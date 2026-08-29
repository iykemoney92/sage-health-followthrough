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
- `useclariti.app` resolves and serves the production app.
- The Clariti RevenueCat project exists with the `plus` entitlement and a
  `default` offering — but that offering returns **`"packages": []`**. It has a web
  checkout link attached and nothing else.
- `CLARITI_REVENUECAT_PLUS_PRODUCT_IDS` in Vercel production already allowlists
  `clariti_plus_monthly` and `clariti_plus_annual`, so an entitlement granted for
  either flows through the existing webhook with no code change.
- No App ID for `app.useclariti.mobile` is registered (no matching provisioning
  profile exists locally, and there is no `appl_` key anywhere in the repo or in
  Vercel).

---

## 1. Apple Developer portal

<https://developer.apple.com/account/resources>

1. **Identifiers → +** → App IDs → App.
   - Description: `Clariti`
   - Bundle ID: **Explicit**, `app.useclariti.mobile`
   - Capabilities — tick exactly these, because the entitlements file already
     claims all three and a mismatch fails the signing step:
     - **Push Notifications**
     - **Associated Domains**
     - **Sign In with Apple** (Enable as a primary App ID)
   - Register.

2. **Keys → +** → tick **Apple Push Notifications service (APNs)** → name it
   `Clariti APNs` → Continue → Register → **Download the `.p8`**. Note the **Key
   ID**. Apple lets you download this file exactly once.
   > An APNs key is per-team, not per-app, so if you already made one for Nura you
   > can reuse that key and skip this step.

3. **Keys → +** → tick **Sign in with Apple** → Configure → set the primary App ID
   to `app.useclariti.mobile` → Register → download the `.p8`, note the Key ID.
   This is the key Supabase needs in step 6.

4. **Profiles → +** → **App Store Connect** distribution →
   App ID `app.useclariti.mobile` → your Apple Distribution certificate →
   **name it exactly `Clariti App Store`** (the Xcode Release configuration looks
   it up by that name) → Generate → Download → double-click to install.

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
2. **Apps → + New** → **Play Store** (only when doing Android; see step 8).
3. **Products → + New**, twice, on the iOS app: `clariti_plus_monthly` and
   `clariti_plus_annual`.
4. **Offerings → `default`** → add two packages:
   - `$rc_monthly` → `clariti_plus_monthly`
   - `$rc_annual` → `clariti_plus_annual`
   > This is the step that fixes `"packages": []`. Until it is done, the app's
   > paywall correctly refuses to show a buy button, because a button that cannot
   > complete a purchase is worse than none.
5. **Entitlements → `plus`** → attach both products.
6. **API keys** → copy the **public** app-specific keys:
   - iOS key (`appl_…`) → Vercel `NEXT_PUBLIC_CLARITI_REVENUECAT_IOS_API_KEY`
   - Android key (`goog_…`) → `NEXT_PUBLIC_CLARITI_REVENUECAT_ANDROID_API_KEY`
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

## 7. Vercel environment

`clariti-app` → Settings → Environment Variables → Production:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_CLARITI_REVENUECAT_IOS_API_KEY` | `appl_…` from step 4.6 |
| `NEXT_PUBLIC_CLARITI_REVENUECAT_ANDROID_API_KEY` | `goog_…` from step 4.6 |
| `NEXT_PUBLIC_IOS_APP_STORE_URL` | `https://apps.apple.com/app/id<Apple ID from step 2.2>` — **leave unset until the app is actually live** |
| `CLARITI_MIN_NATIVE_BUILD` | `1` |
| `CRON_SECRET` | a fresh random string; Vercel Cron sends it as `Authorization: Bearer …` |

Then redeploy — `NEXT_PUBLIC_*` values are inlined at build time, so a restart is
not enough.

## 8. Google Play (Android)

1. Play Console → **Create app** → `Clariti`, package `app.useclariti.mobile`.
2. Generate a release keystore and keep it somewhere you will still have in three
   years — losing it means never updating the app again:
   ```bash
   keytool -genkey -v -keystore clariti-release.keystore \
     -alias clariti -keyalg RSA -keysize 2048 -validity 10000
   ```
3. Wire `android/app/build.gradle`'s `signingConfigs.release` to it via
   environment variables (never commit the keystore or its passwords).
4. **Monetize → Subscriptions** → create `clariti_plus_monthly` and
   `clariti_plus_annual` with the same ids as iOS.
5. Grant RevenueCat access: create a Google Cloud service account with the
   *Pub/Sub Editor* and *Android Publisher* roles, and upload its JSON to the
   RevenueCat Play Store app.
6. **App Links** need `https://useclariti.app/.well-known/assetlinks.json` listing
   the SHA-256 fingerprint of your **Play App Signing** certificate (Play Console →
   Setup → App integrity). Until that file exists, `android:autoVerify` fails
   softly and Android shows a chooser instead of opening the app.

## 9. Build and upload

```bash
cd clariti-mobile
npx cap sync
```

**iOS:**

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

- [ ] **Privacy Policy URL**: `https://useclariti.app/privacy` — mandatory field.
- [ ] **Terms of Use (EULA) URL**: `https://useclariti.app/terms`.
- [ ] **App Privacy questionnaire.** Clariti collects an email address, uploaded
      health documents and their extracted text, and generated analyses. Declare
      **Health & Fitness → Health** and **User Content**, linked to identity, and
      *not* used for tracking. Under-declaring here is a common rejection.
- [ ] **Demo account** in App Review Information, with a saved document already
      attached — a reviewer who cannot get past an empty state rejects for
      Guideline 2.1. Add a note saying the outbound-call and explainer-video
      features depend on funded third-party accounts, and say whether they are
      funded at review time.
- [ ] **Age rating**: expect 17+ / "Medical or Treatment Information".
- [ ] **Screenshots**: 6.7" and 6.5" iPhone are required.
      `pnpm --filter clariti-app shots` captures them.
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
- Apply migration `0006_private_artifacts_and_limits.sql` **before** the first
  native release if it has not been applied already — it makes the
  `clariti-videos` bucket private, and the app's media route depends on that.
