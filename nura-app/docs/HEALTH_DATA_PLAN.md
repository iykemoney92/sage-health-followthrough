# Health data integration — first cut

Status: plan, not built. Written 2026-10-24.

Goal: let Nura read a small set of measurements from Apple Health (iOS) and Health Connect (Android) so check-ins can start from what has actually changed ("your sleep's been shorter this week — how have nights been?") and so Nura can reach out when someone's normal pattern drops off.

Out of scope for this cut: wearable cloud APIs (Oura, Fitbit, Garmin, Whoop), aggregators (Terra, Junction), background sync, writing anything back to Health, clinical records, and sharing any health data with a Care circle.

---

## 1. What exists today, and the one thing that changes the design

- The native apps are a Capacitor 8 shell (`nura-mobile/`) that loads usenura.app live. Web pages already call native plugins over the Capacitor bridge (see `lib/billing/native-purchases.ts`). A health plugin works the same way, but it is a **native change**, so it needs new iOS and Android binaries and store review. Older binaries won't have the plugin, so the web side has to check for it before using it.
- Voice check-ins get their context from `buildVoiceCheckinContext` (`lib/domain/voice-checkin-context.ts`). It already passes the 8 most recent `nura_observations` as "Recent user updates".
- Me → Connections already has a "Future health connections — Coming soon" card (`app/me/[section]/page.tsx`). That card is where this feature goes.
- AI consent is a gate (`lib/ai-consent.ts`) stored in `user_metadata.ai_data_consent_at`. It was added after the 2026-09-11 rejection under 5.1.2(i).
- **The catch:** `nura_observations` has a `circle_member_read` RLS policy (migration 0025), so anyone in a plan's Care circle can read every observation on that plan. Health data **must not** go into `nura_observations`. It gets its own owner-only tables with no circle policy, and it isn't tied to a plan, because a step count belongs to the person, not to a Care plan.

---

## 2. Metrics (v1)

There are five. Each has a reason to be in a check-in, and all of them are readable on both platforms through the chosen plugin.

| Metric | Stored per day as | How it's read (plugin) | Why |
|---|---|---|---|
| Steps | total | `queryAggregated` day bucket, sum | Activity drop-off is the clearest wellbeing and recovery signal |
| Sleep | total minutes asleep for the night ending that morning | `readSamples`, rolled up on the device (no aggregation for sleep) | The most useful signal for mental wellbeing and stress plans |
| Resting heart rate | daily average, in bpm | `queryAggregated` day bucket, average | Shows strain or illness, context only |
| Weight | latest reading that day | `queryAggregated` or the latest sample | GP follow-up and medication plans |
| Blood pressure | latest systolic/diastolic that day, plus the number of readings | `readSamples` (not aggregatable) | "Post-clinic BP watch" style plans |

Deliberately left out of v1:
- **HRV.** HealthKit stores SDNN and Health Connect stores RMSSD, so the numbers aren't comparable across platforms. It's also hard to explain in a check-in.
- **Blood glucose.** No plan category needs it yet.
- **Menstrual or reproductive data.** Too sensitive for a first cut, even with a postpartum category.
- **Workouts, routes, heart-rate samples, ECG, clinical records.**

**Which metric goes with which plan category.** The agent only hears about metrics that fit the plan it's checking in on:

| Category | Metrics the agent sees |
|---|---|
| mental_wellbeing, occupational_stress | sleep, steps, resting HR (**never weight**) |
| recovery_aftercare | steps, sleep, resting HR |
| postpartum_aftercare | sleep, steps (**never weight**) |
| gp_follow_up, medication_follow_through | blood pressure, weight, resting HR, steps |
| default | sleep, steps |

Weight is kept out of the wellbeing and postpartum contexts on purpose, because talking about weight there can do harm. This mapping lives in one constant next to `persona-config.ts`, so it's easy to review.

---

## 3. Plugin choice

**`@capgo/capacitor-health` (v8.x)** is the choice: its peer dependency is `@capacitor/core >=8`, it's actively maintained, and it reads all five metrics on both platforms. Methods used: `isAvailable`, `requestAuthorization`, `checkAuthorization`, `queryAggregated`, `readSamples`, `openHealthConnectSettings`.

Alternative to keep an eye on: `@capacitor/health-fitness`, the official Ionic plugin. It's only two months old (1.0.2), and resting HR support isn't confirmed. It's the fallback if capgo becomes a problem. The plugin calls stay behind one small module (`lib/health/native-health.ts`), so swapping later is cheap.

Neither plugin syncs in the background. That's fine for v1 (see §5).

---

## 4. Schema — migration `0031_health_data.sql`

```sql
-- One row per person per platform. A row with revoked_at null is what makes health
-- data usable at all; every server path checks it, not just the UI.
create table nura_health_connections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references nura_profiles(id) on delete cascade,
  platform text not null check (platform in ('apple_health', 'health_connect')),
  consented_at timestamptz not null,          -- Nura's own consent screen (§6), minted server-side
  consent_version text not null,              -- which copy they agreed to
  metrics text[] not null,                    -- what Nura asked for (iOS won't say what was granted)
  last_synced_at timestamptz,
  last_sync_status text,                      -- 'ok' | 'no_data' | 'error'
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (owner_id, platform)
);

-- Daily summaries only, never raw samples. Long format so adding a metric is not a migration.
create table nura_health_daily (
  owner_id uuid not null references nura_profiles(id) on delete cascade,
  day date not null,                          -- the user's local date (resolveUserTimeZone)
  metric text not null check (metric in ('steps', 'sleep_minutes', 'resting_hr', 'weight_kg', 'blood_pressure')),
  value numeric not null,                     -- systolic for blood_pressure
  value_secondary numeric,                    -- diastolic for blood_pressure
  sample_count int not null default 1,
  platform text not null,
  synced_at timestamptz not null default now(),
  primary key (owner_id, day, metric)
);

-- Why Nura reached out. Prevents duplicate triggers, and gives the user (and us) an
-- honest answer to "why did Nura call me?".
create table nura_health_signals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references nura_profiles(id) on delete cascade,
  plan_id uuid references nura_plans(id) on delete set null,
  signal text not null,                       -- e.g. 'sleep_drop', 'activity_drop'
  window_start date not null,
  detail jsonb not null,                      -- baseline vs recent, rounded
  check_in_id uuid references nura_check_ins(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (owner_id, signal, window_start)
);
```

RLS: `owner_access` on all three, using the same pattern as migration 0013. **No `circle_member_read` policy.** Add a test (alongside `care-circle-pass-on.test.ts`) that fails if anyone adds one later.

Retention: keep 90 days of `nura_health_daily`, which is more than enough for the 28-day baseline. A nightly purge goes in the droplet crontab next to the circle jobs.

Other places that have to know about these tables:
- `app/api/account/delete/route.ts`: add all three tables to the delete list.
- `app/api/account/export/route.ts`: add all three tables to the export.
- **Disconnect** (§6) deletes the person's `nura_health_daily` and `nura_health_signals` rows straight away and sets `revoked_at`.

Per the drift memory: apply the migration to prod and **check the columns exist with SQL afterwards**, because the app silently ignores missing columns.

---

## 5. Sync flow

```
App opened / returns to foreground (native only, plugin present, connection active)
  → throttle: skip if last_synced_at < 6h ago
  → range: first sync = last 30 days (the Android default history window, no extra permission)
           later syncs = from (last synced day − 2) to today, so late-arriving sleep and readings get picked up
  → device: queryAggregated (steps, resting HR, weight) + readSamples (sleep, BP) → roll up per local day
  → POST /api/health/sync { platform, days: [{ day, metric, value, value_secondary, sample_count }] }
  → server: session user + active connection + AI consent → zod validation with sane ranges
            (e.g. steps 0–100k, sleep 0–1080 min, RHR 25–220, BP 50–260/30–160) → upsert
  → update last_synced_at / last_sync_status
```

- Hook it into the existing native bootstrap, where push and RevenueCat are configured, so it runs once per session plus on `appStateChange` to active.
- Days are bucketed in the user's timezone, using `resolveUserTimeZone`. Sleep counts toward the morning you wake up.
- **Data goes stale without background sync.** Every part of the agent treats data older than 3 days as missing and never says "this week" about old numbers. The brief always says when the data is from.
- **iOS doesn't say what was granted.** HealthKit hides whether read access was given, so "connected but no data" is normal (permission denied, or no watch). Show "No data yet from Apple Health" with a link to the Health app's settings, not an error.

New routes: `POST /api/health/sync`, `GET /api/health/connection`, `POST /api/health/connection` (records consent), `DELETE /api/health/connection` (disconnect and delete).

---

## 6. Consent screen

This is a separate consent from the AI gate. It's shown only when someone taps **Connect Apple Health** (or **Connect Health Connect**) in Me → Connections, and it always comes **before** the system permission sheet. It's a page, `/connections/health`, so it renders identically in both apps and can be screenshotted for review.

Draft copy:

> **Connect Apple Health**
>
> Nura can read five things from Apple Health to make your check-ins more personal:
> - Steps
> - Sleep
> - Resting heart rate
> - Weight
> - Blood pressure
>
> Nura only reads. It never writes to Apple Health. You choose which of these to allow on the next screen.
>
> **What happens with it**
> - Nura keeps a daily summary (for example, "6h 40m asleep") on its servers, not every reading.
> - When Nura prepares a check-in, a short summary of what's changed is sent to **Anthropic** (which writes Nura's messages) and, during voice calls, to **ElevenLabs** (which runs the call). They process it only for your check-in and can't use it to train models.
> - Nura uses it to notice when things have shifted, and may check in when, for example, your sleep has been much shorter than usual.
>
> **What never happens**
> - Your Care circle never sees it.
> - It's never shown in notifications or sent over WhatsApp.
> - It's never used for ads or analytics, and it's never sold.
>
> You can disconnect at any time in Me → Connections. Disconnecting deletes everything Nura has stored from Apple Health.
>
> [ Continue ]  [ Not now ]

- **Continue** posts `POST /api/health/connection` (the server stamps `consented_at` and `consent_version`), then calls `requestAuthorization`, then runs the first sync.
- The Android version says "Health Connect" and uses the same list.
- Plugin missing (older binary): "Update Nura to connect Apple Health". On web or desktop: "Available in the Nura app on iPhone and Android".
- Me → Connections card states: Connected (last synced at…), with **Disconnect** and **Manage permissions** (`openHealthConnectSettings` on Android, instructions for the Health app on iOS); No data yet; or Not connected.
- Copy changes elsewhere: `/data-use` and `/privacy` (`app/legal-content.tsx`) name the five data types, the Health source, the recipients, the retention period, and that the Care circle is excluded. The AI consent page doesn't change. Health has its own consent, and the AI consent still applies on top of it.

---

## 7. How the agent uses it

### 7a. The health brief, a pure function

`lib/health/health-brief.ts`:

```ts
buildHealthBrief({ dailies, category, timeZone, now }): string | null
```

- Returns `null` when there's no active connection, the latest data is more than 3 days old, or the baseline is under 14 days for anything comparative.
- Uses only the metrics mapped to the plan's category (§2).
- Compares the recent window (last 3 nights for sleep, last 7 days for steps and resting HR) with the median of the 28 days before it. It reports **only notable changes**, plus the latest BP or weight when the category asks for them.
- Output is short, rounded, factual and dated, for example:
  `Health data (Apple Health, as of this morning): sleep has averaged 5h 10m over the last 3 nights, usually about 7h. Steps are about 40% below their usual level this week. Nothing else notable.`
- Unit-tested with vitest like the other `lib/domain` code: thresholds, stale data, category filtering, the never-weight rule, and timezone day boundaries.

### 7b. Where the brief goes

| Surface | Uses the brief? | Notes |
|---|---|---|
| Voice check-in (`buildVoiceCheckinContext`) | **Yes** | New dynamic variable `health_brief`, defaulting to `"No health data shared."` so it's always defined. The agent prompt is updated with `scripts/sync-elevenlabs-agent.mjs`. |
| In-app chat (`app/api/messages`) | **Yes** | Added to the system context for the active plan |
| Push notification text | **No** | It shows on the lock screen |
| WhatsApp openers (`composeCheckinOpener`) | **No** | WhatsApp is another third party, and the disclosure doesn't name it |
| Care circle updates / pass-on | **No** | Health data never reaches the circle |
| Analytics (GA, Quora pixel, native analytics) | **No** | Only `health_connected` / `health_disconnected` with the platform, no values |

Instructions added to the agent prompt for `health_brief`:
- Bring it up **at most once**, as a question, not a finding: "I noticed your sleep's been shorter — how have the nights been?"
- Device data can be wrong (the watch wasn't worn, the phone was left at home). If the user says it's off, believe them and move on.
- Never call a number normal, abnormal, good, bad or dangerous, and never diagnose. If the user describes worrying symptoms, the existing `NURA_SAFETY_BOUNDARIES` escalation applies as usual.
- If the user doesn't want to talk about it, drop it for the rest of the call.

### 7c. Check-ins triggered by health data

`scheduleHealthSignalCheckIns(supabase, now)` runs in `app/api/agent/trigger-check-ins/route.ts`, right after `scheduleIdleWellnessCheckIns`. It's behind the env flag `HEALTH_SIGNALS_ENABLED`.

v1 has only two wellness signals:
- `sleep_drop`: the 3-night average is at least 90 minutes below the 28-day median, with a baseline of at least 14 nights.
- `activity_drop`: the 7-day average of steps is below 50% of the 28-day median, with a baseline of at least 14 days.

Resting HR and BP are **context only, never triggers**. Calling someone out of the blue because of a blood-pressure number moves Nura toward being a medical device, and the plugin data isn't reliable enough for that.

Guards, reusing what idle-wellness already does:
- The person has an active plan whose category includes that metric.
- At most one health-triggered check-in per person every 7 days, and none if any check-in for that plan is already open.
- Quiet hours and the preferred channel are respected (`isWithinQuietHours`, `pickIdleChannel`). It counts as contact for the idle-wellness gap.
- It's de-duplicated through `nura_health_signals (owner_id, signal, window_start)`, and the new row links to the check-in it created.
- Channel entitlements are the same as for other proactive check-ins (Plus for voice).

The check-in prompt stored on `nura_check_ins` carries the specifics, so the voice call can use them. The push or WhatsApp opener stays generic: "Nura here, checking in — how have the last few days been?"

---

## 8. Store review requirements

### Apple
- **Capability and entitlement:** HealthKit (`com.apple.developer.healthkit`) on the `app.usenura.mobile` App ID and in `App.entitlements`. **No** background-delivery entitlement in v1.
- **Info.plist:** `NSHealthShareUsageDescription`, for example: "Nura reads your steps, sleep, resting heart rate, weight and blood pressure to personalise your check-ins." No `NSHealthUpdateUsageDescription`, because Nura doesn't write. The app crashes on the authorization request if the share string is missing.
- **5.1.2(i):** disclose in the app, and get explicit permission, before sharing with third-party AI. The consent screen in §6 does this and names Anthropic and ElevenLabs.
- **5.1.3(i):** disclose the specific health data collected (the consent screen and privacy policy list all five). No advertising or data-mining use.
- **5.1.3(ii):** no health data in iCloud. Nura doesn't use CloudKit, but check the shell doesn't back anything health-related up to iCloud.
- **The real review risk:** Apple's HealthKit docs say an app may share with a third party, even with permission, only if that party "also provide[s] a health or fitness service to the user". Anthropic and ElevenLabs are processors working on Nura's behalf, not independent services. Apple doesn't define where that line falls. How we handle it:
  1. Send only derived, rounded summaries (the brief), never raw HealthKit samples.
  2. The consent screen names both processors and what they're allowed to do.
  3. The App Review notes explain this up front: Nura is the health service, the AI vendors are processors under no-training terms, and the data is summarised before it's sent.
  4. A fallback is ready if they push back: a mode where health data **only drives the trigger rules on Nura's own servers**. The check-in it creates gets a generic prompt, and nothing health-related reaches the LLM or voice vendors. That would let the binary ship while we argue the rest.
- **App Privacy label:** add Health and Fitness, both "Linked to you" and used for "App Functionality" only. Update `PrivacyInfo.xcprivacy` to match.
- **Privacy policy:** name the HealthKit data types and the AI recipients.
- **Review notes:** a demo account with a connected plan and steps to reproduce. Health data on a simulator is thin, so include a short screen recording from a real device.

### Google Play
- **Health Connect declaration** (App content → Health apps): justify each of the five data types. Changing the set of types later triggers a new review.
- **Manifest:** `android.permission.health.READ_STEPS`, `READ_SLEEP`, `READ_RESTING_HEART_RATE`, `READ_WEIGHT`, `READ_BLOOD_PRESSURE`. Also:
  - the rationale activity (`androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE`)
  - an `activity-alias` for Android 14+ with `android.intent.action.VIEW_PERMISSION_USAGE`, category `android.intent.category.HEALTH_PERMISSIONS`, and `START_VIEW_PERMISSION_USAGE`
  - the rationale screen shows the same privacy policy (usenura.app/privacy)
  - **no** background or history permissions in v1
- **SDK levels:** the plugin needs minSdk 26 and `connect-client` 1.1.0, which needs compileSdk 36 and AGP 8.9.1. Check `nura-mobile/android/variables.gradle` and the Gradle plugin version, which may mean a toolchain bump (and the JDK 21 rule still applies). The Health Connect app itself needs Android 9 or later.
- **Limited Use and third-party AI:** the Play User Data policy now applies to third-party AI integrations. It requires a prominent in-app disclosure plus an affirmative opt-in (the consent screen in §6). Use limited to user-facing features, no ads, no data brokers.
- **Data safety form:** add Health and Fitness, collected and shared (with the processors), encrypted in transit, deletable.
- **Review time:** Google publishes no SLA. Allow a week or more and submit early.

---

## 9. Build order

The web side ships behind flags while the binaries are in review.

1. **Migration 0031**, RLS, the no-circle-policy test, delete and export coverage. Apply to prod and verify.
2. **Server:** sync and connection routes, `health-brief.ts` and the signal detection, with tests. Nothing reads the data yet.
3. **Native:** add `@capgo/capacitor-health` to `nura-mobile`, plus the entitlement, plist key, manifest entries and rationale activity, and any SDK/AGP bump. Build iOS (next `CURRENT_PROJECT_VERSION`) and Android (versionCode 3). Test on TestFlight internal and on the internal track with real devices.
   - **Prereq:** `nura-mobile/` is iCloud-offloaded right now. `variables.gradle`, `capacitor.config.ts` and `Info.plist` are dataless, so download it or set it to Keep Downloaded first.
4. **Web UI:** replace the "Coming soon" card, add the `/connections/health` consent page, the plugin detection and the sync on open. Behind `NEXT_PUBLIC_HEALTH_CONNECT_ENABLED`.
5. **Agent wiring:** the `health_brief` dynamic variable and the ElevenLabs prompt sync, plus the chat context.
6. **Policy pages, privacy label, Play forms** → submit both binaries.
7. **After approval:** turn on the connect flag, watch for a week, then turn on `HEALTH_SIGNALS_ENABLED`.

Rough effort: about a week of build for steps 1–6. Store review is the long pole, especially the Health Connect declaration and any argument with Apple over third-party sharing.

---

## 10. Decisions needed before building

1. **Metric list:** are the five above right? (Add glucose or HRV now, or leave them for later?)
2. **Plus or free:** is connecting health data a Plus feature, or free with Plus-only health-triggered calls?
3. **Triggers in v1, or context only first?** Shipping context only first is lower risk with reviewers. Triggers could follow two weeks later.
4. **Fallback if Apple objects** to LLM/voice sharing: is the "triggers only, nothing sent to AI vendors" mode acceptable, or do we hold the feature back?
