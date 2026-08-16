# Nura Mobile

A [Capacitor](https://capacitorjs.com) shell that wraps the live Nura web app
(`https://usenura.app`) for iOS and Android. It is not a rewrite — `nura-app`
is a server-rendered Next.js app (auth middleware, cookies, API routes), so it
can't be statically exported into the shell. Instead the native WebView loads
the production deployment directly, configured in `capacitor.config.ts`:

```ts
server: {
  url: process.env.NURA_SERVER_URL || "https://usenura.app",
}
```

Point a build at a different deployment (a Vercel preview, or `http://localhost:3000`
on your LAN IP for local dev) by setting `NURA_SERVER_URL` before `npx cap sync`.

## Layout

- `capacitor.config.ts` — app id, name, and the `server.url` the WebView loads.
- `ios/App` — native Xcode project (Swift Package Manager, no CocoaPods needed).
- `android` — native Android Studio / Gradle project.
- `www/` — unused placeholder required by Capacitor's config; the real UI is
  the live site loaded via `server.url`, not anything bundled here.

## Local development

```bash
npm install
npx cap sync          # copies capacitor.config.ts into both native projects
npx cap open ios      # opens ios/App/App.xcodeproj in Xcode
npx cap open android  # opens android/ in Android Studio
```

Requires Xcode (iOS) and a JDK compatible with the Android Gradle Plugin
(Gradle 8.14 supports up to Java 24 — a fresh macOS install with only the
latest JDK may need `brew install --cask temurin@21` for local Android
builds; CI pins JDK 21 explicitly so this doesn't affect it).

## CI

`.github/workflows/nura-mobile-build.yml` builds on every push/PR touching
`nura-mobile/**`:

- **android** (ubuntu-latest): `./gradlew assembleDebug` — Gradle's debug
  build self-signs with a throwaway debug keystore, so this needs no secrets
  and produces an installable APK, uploaded as a workflow artifact.
- **ios-simulator** (macos-latest): `xcodebuild ... -sdk iphonesimulator
  CODE_SIGNING_ALLOWED=NO` — an unsigned simulator build, proving the app
  compiles without needing an Apple Developer account.

Both are unsigned dev builds. They confirm the app builds; they are not what
you'd ship to TestFlight/Play or hand to a real device.

## Wiring up real (signed) builds — not done yet

**iOS, to run on a physical device or submit to TestFlight/App Store:**
1. Apple Developer Program account ($99/yr).
2. Create an App ID matching `capacitor.config.ts`'s `appId`
   (`app.usenura.mobile` — change this to your own reverse-DNS id before
   registering it anywhere; it's a placeholder).
3. Generate a distribution certificate + provisioning profile, export the
   certificate as a base64-encoded `.p12`, and add as GitHub Secrets
   (`IOS_CERTIFICATE_P12`, `IOS_CERTIFICATE_PASSWORD`,
   `IOS_PROVISIONING_PROFILE`).
4. Swap the CI step for an `xcodebuild archive` + `xcodebuild -exportArchive`
   pair (or introduce [fastlane](https://fastlane.tools) `match`/`gym` for
   this — worth it once you're doing this regularly).

**Android, to sign a release build for Play Console:**
1. Generate a release keystore: `keytool -genkey -v -keystore release.keystore ...`
2. Add it as a GitHub Secret (base64-encoded) plus the keystore/key
   passwords, decode it in CI, and point `android/app/build.gradle`'s
   `signingConfigs.release` at it via env vars.
3. Swap `assembleDebug` for `bundleRelease` (Play Store wants an `.aab`, not
   an `.apk`).
4. Google Play Console account ($25 one-time).

**Billing note:** `nura-app`'s RevenueCat integration currently uses a *web*
purchase link (`lib/billing/revenuecat.ts`) to avoid the App Store's IAP cut.
Once this ships as a native iOS app with paid subscriptions, Apple's
guideline 3.1.1 generally requires using RevenueCat's native IAP SDK instead
of an external checkout link — factor that in before submitting to App
Store review.
