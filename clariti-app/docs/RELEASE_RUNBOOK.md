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
| Google Analytics property | `G-XSL79NR83X` — property "Clariti" `555031958`, stream "Clariti web" `15807148476`, under GA account `360570050` | `NEXT_PUBLIC_GA_MEASUREMENT_ID`, `components/google-analytics.tsx` |
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
   to `plus` and to the `default` packages. Service-account credentials are
   uploaded and valid (see step 8.5).
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
| `NEXT_PUBLIC_ANDROID_PLAY_STORE_URL` | `https://play.google.com/store/apps/details?id=app.useclariti.mobile` — **set this now**; Android is live, and it is what makes the Google Play button appear on the landing page |
| `CLARITI_MIN_NATIVE_BUILD` | `1` |
| `NEXT_PUBLIC_CLARITI_OAUTH_PROVIDERS` | `apple,google` — **only after step 6 is done**; empty until then |
| `CRON_SECRET` | a fresh random string; Vercel Cron sends it as `Authorization: Bearer …` |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | `G-XSL79NR83X` — see **Analytics** below |

Then redeploy — `NEXT_PUBLIC_*` values are inlined at build time, so a restart is
not enough.

### Analytics

Set on production 2026-09-19. Until then the variable was simply absent, so
`getGaMeasurementId()` returned `""`, `<GoogleAnalytics>` rendered `null` and
every one of the 14 `track()` calls returned on its first line — the cookie
banner was asking consent for a tag that could never load.

It is a `NEXT_PUBLIC_*`, so setting it is only half the job: the value is inlined
at build time and this project has an Ignored Build Step that skips deploys not
touching `clariti-app/`. An env change on its own never reaches the bundle; push
a commit that touches this directory.

Web only, by design. `getAnalyticsConsent()` returns a hard `"denied"` inside the
Capacitor shells, so the tag never loads there and no event is sent — that is the
guideline 5.1.2(i) remedy from the September rejection, and it is what keeps App
Tracking Transparency from applying. Do not add a GA stream for the iOS or
Android apps without revisiting that.

### Explainer video

The explainer runs on FLUX 3 (`bfl/flux-3-video`) through the AI Gateway, which
renders 5 to 20 seconds with audio in a single call. So the default,
`CLARITI_VIDEO_PIPELINE=single`, is one clip: no storyboard fan-out, no stitch,
nothing to fail between the model and the finished file. At roughly $0.17 per
second for text-to-video that is about $3.40 for a full 20-second explainer.

`chained` is for explainers longer than one clip. Each segment after the first is
handed the previous mp4 so the model continues from its last frames, and that
video-to-video call runs around $0.41 per second — near 2.4x a fresh clip. Two
segments therefore cost far more than one, which is the reason a single clip is
the default rather than merely the simplest option.

A chain does not finish in one request: four sequential renders do not fit inside
the worker's 300-second ceiling. It renders what its claim has time for, saves
each finished segment to the row, and hands the job back as `queued` so the next
poll continues from the last completed segment. Nothing is rendered twice, and a
request that is cut off costs at most the segment that was in flight. What this
means operationally is that a long explainer takes several polls to finish, and
the workspace tab has to stay open for them. Nothing about `chained` has been
exercised against the live model yet — the shape of a continued clip is still an
open question, recorded per segment in `provider_response`.

`shotstack` is the legacy path and stays reachable for the Veo models it was
built for: five scenes at Veo's $0.40 per second plus a Shotstack render, all to
work around a ceiling Flux does not have. It engages only when
`CLARITI_VIDEO_PIPELINE=shotstack`, a Veo model is configured, and the Shotstack
key is one Shotstack currently accepts. There is no reason to set it up for a
release.

### Web checkout and support mail

Both changed on 2026-09-19, and neither is visible from the Vercel dashboard:

- `/api/billing/checkout` will not open a Stripe session without
  `STRIPE_WEBHOOK_SECRET`. Nothing in this repo receives Stripe events, so a
  Stripe subscription is written once as a 7-day trial and never written again —
  on day 8 it expires into `/billing/locked` while Stripe goes on charging the
  card. Until either that secret or `CLARITI_REVENUECAT_WEB_PURCHASE_URL` is set,
  the web paywall says Plus cannot be bought on the web and points people at the
  iPhone app, which is where it is actually on sale.
- `support@useclariti.app` receives mail as of 2026-09-21, through **Cloudflare
  Email Routing**, forwarded to the verified destination `labszapx@gmail.com`.
  Before that the domain had no MX at all, while `/privacy`, `/terms` and
  `/delete-account` all told people to write there — including the sign-in-less
  deletion request Guideline 5.1.1(v) expects to work.
  - DNS lives on **Cloudflare**, not Vercel (`vercel domains ls` reports it as
    Third Party), under the `Labszapx@gmail.com` account. Email Routing had been
    half-enabled for 41 days: the destination was verified but no routing rule
    existed and the MX records had never been added, which is why mail bounced.
  - The three `route{1,2,3}.mx.cloudflare.net` MX records and the DKIM TXT are
    **locked** — Email Routing manages them, so do not hand-edit them in the DNS
    panel.
  - The SPF is `v=spf1 include:_spf.mx.cloudflare.net ~all`, which covers
    *receiving* only. Nothing sends from `useclariti.app` today (`AUTH_EMAIL_FROM`
    is `hello@usenura.app`), but the day anything does, Resend has to be added to
    that record or the mail will soft-fail.

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
5. ~~Grant RevenueCat access~~ **Done 2026-09-09.** Service account
   `revenuecat-play@aisp-2039c.iam.gserviceaccount.com` (GCP project `aisp-2039c`,
   key at `~/.android/keystores/revenuecat-play-sa.json`, never committed) is a
   Play Console user with *View app information*, *View financial data* and
   *Manage orders and subscriptions* only. Its JSON is uploaded to both RevenueCat
   Play apps and reads **Valid credentials**. Real-time developer notifications
   go through Pub/Sub topic `projects/aisp-2039c/topics/revenuecat-clariti-rtdn`
   (set in Play Console → Monetization setup, connected in RevenueCat).
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
      that the explainer-video feature renders one short AI clip for education
      only. It no longer depends on a funded Shotstack account: FLUX 3 produces
      the whole explainer in a single call, so leave `SHOTSTACK_API_KEY` unset.
      The legacy five-scene stitch is still reachable behind
      `CLARITI_VIDEO_PIPELINE=shotstack` on a Veo model, and nothing about a
      review needs it.
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

- Set `NEXT_PUBLIC_IOS_APP_STORE_URL` (step 7) and redeploy. That one value does
  two things: it gives the in-app "update available" notice a listing to link
  to, and it is the gate on the App Store button at the foot of the landing
  page, which stays hidden until the URL is set. No code change is needed — the
  button appears on the next build. Leave it unset until version 1.0 is on sale
  in at least one territory, because until then the listing URL 404s.
- Nothing to do about `0006_private_artifacts_and_limits.sql` — it is applied,
  and `clariti-documents` and `clariti-videos` are both private. Left here only
  because an earlier draft of this runbook listed it as outstanding.

## Explainer video: what production actually runs

As of 2026-09-15 production renders the explainer with **FLUX 3** (`bfl/flux-3-video`)
through the Vercel AI Gateway. There is no Replicate account in this path — the gateway
serves the model and bills the Vercel AI Gateway credit balance, authenticated in
production by `VERCEL_OIDC_TOKEN` rather than a stored key.

`CLARITI_VIDEO_MODEL=bfl/flux-3-video` is set; `CLARITI_VIDEO_PIPELINE` is deliberately
**unset**, which resolves to `flux-single` — one call of up to twenty seconds with audio.
Its previous value was `shotstack`, which is meaningless on a Flux model and was removed
so the dashboard does not imply a stitch that cannot run.

Two things to know before anyone debugs this:

- **The video path has never executed.** `clariti_video_generations` has no rows. The code
  is reviewed and typechecked but no clip has been generated against the gateway, so the
  first real run is also the first test. Watch that the gateway balance can cover it —
  roughly $0.17 per second, so about $3.40 for a twenty-second clip.
- **Env changes need a commit.** This project has an Ignored Build Step that skips builds
  when nothing under `clariti-app/` changed, so `vercel redeploy` of the same commit is
  cancelled and a new env value never reaches the running app.
