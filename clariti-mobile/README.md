# Clariti Mobile

A [Capacitor](https://capacitorjs.com) shell that wraps the live Clariti web app
(`https://useclariti.app`) for iOS and Android. It is not a rewrite — `clariti-app`
is a server-rendered Next.js app (auth proxy, cookies, API routes), so it can't be
statically exported into the shell. Instead the native WebView loads the production
deployment directly, configured in `capacitor.config.ts`:

```ts
server: {
  url: process.env.CLARITI_SERVER_URL || "https://useclariti.app",
}
```

Point a build at a different deployment (a Vercel preview, or `http://<your-LAN-ip>:3001`
for local dev) by setting `CLARITI_SERVER_URL` before `npx cap sync`.

## Identity

| | |
|---|---|
| Bundle / application id | `app.useclariti.mobile` |
| Apple Team | `7DXS32H632` (ZAPX SOLUTIONS LIMITED) |
| Release provisioning profile | `Clariti App Store` |
| Custom URL scheme | `app.useclariti.mobile://` |
| Associated domain | `applinks:useclariti.app` |
| RevenueCat entitlement | `plus` |
| StoreKit product ids | `clariti_plus_monthly`, `clariti_plus_annual` |

## Layout

- `capacitor.config.ts` — app id, name, and the `server.url` the WebView loads.
- `ios/App` — native Xcode project (Swift Package Manager, no CocoaPods needed).
- `android` — native Android Studio / Gradle project.
- `resources/` — 1024² icon and 2732² splash sources. Regenerate every platform
  size with `npx capacitor-assets generate`.
- `www/` — unused placeholder required by Capacitor's config; the real UI is the
  live site loaded via `server.url`, not anything bundled here.

## Local development

```bash
npm install
npx cap sync          # copies capacitor.config.ts into both native projects
npx cap open ios      # opens ios/App/App.xcodeproj in Xcode
npx cap open android  # opens android/ in Android Studio
```

Requires Xcode (iOS) and a JDK the Android Gradle Plugin supports. Gradle 8.14
rejects class files newer than Java 24, so a machine with only the newest JDK
installed needs `brew install --cask temurin@21` for local Android builds; CI
pins JDK 21 explicitly so this doesn't affect it.

## Native pieces that differ from a plain Capacitor scaffold

**Deep links arrive at `SceneDelegate`, not `AppDelegate`.** This is a scene-based
app (`UIApplicationSceneManifest` in `Info.plist`), so iOS delivers both the
custom-scheme OAuth return and `useclariti.app` Universal Links to
`SceneDelegate.scene(_:openURLContexts:)` / `scene(_:continue:)`, which forward to
Capacitor. `AppDelegate` exists only for push registration, whose callbacks stay on
the app delegate even under `UIScene`.

**Firebase is optional at runtime.** `AppDelegate` calls `FirebaseApp.configure()`
only when `GoogleService-Info.plist` is present in the bundle, because that call
traps at launch when the file is missing. So the shell builds and runs — in CI, and
for anyone who hasn't set up the Firebase project — with push simply inert. Drop
`GoogleService-Info.plist` into `ios/App/App/` (and `google-services.json` into
`android/app/`) to switch push on. Both files are gitignored.

**`contentInset: "never"`.** With `"always"`, iOS insets the WebView's scroll view
for the safe areas while CSS still measures the full WebView height, so `100dvh`
overflows by the top inset and pushes the composer off screen. The web app sets
`viewport-fit=cover` and pads with `env(safe-area-inset-*)`, so CSS owns the insets.

**`allowNavigation` lists the host.** Capacitor's iOS WebView only treats a
top-level navigation as "inside the app" if the URL starts with `server.url`
verbatim; allowlisting the hostname keeps `/workspace`, `/history`, and `/billing`
in the WebView rather than kicking them to Safari.

## CI

`.github/workflows/clariti-mobile-build.yml` builds on every push/PR touching
`clariti-mobile/**`:

- **android** (ubuntu-latest): `./gradlew assembleDebug` — Gradle's debug build
  self-signs with a throwaway keystore, so this needs no secrets and produces an
  installable APK, uploaded as a workflow artifact.
- **ios-simulator** (macos-latest): `xcodebuild ... -sdk iphonesimulator
  CODE_SIGNING_ALLOWED=NO` — an unsigned simulator build proving the app compiles.

Both are unsigned dev builds. They confirm the app builds; they are not what you'd
ship to TestFlight or Play.

## Shipping a signed build

The full ordered runbook — Apple Developer portal, App Store Connect, StoreKit
products, RevenueCat, Firebase, and Play Console — lives in
[`../clariti-app/docs/RELEASE_RUNBOOK.md`](../clariti-app/docs/RELEASE_RUNBOOK.md).
Do that first; the commands below assume it is done.

**iOS archive:**

```bash
cd ios/App
xcodebuild -project App.xcodeproj -scheme App -configuration Release \
  -destination 'generic/platform=iOS' -archivePath build/Clariti.xcarchive archive
```

The Release configuration is set to **manual** signing (`Apple Distribution` +
the `Clariti App Store` profile) because automatic signing cannot select a
distribution profile non-interactively.

**Android release bundle** (Play wants an `.aab`, not an `.apk`):

```bash
cd android
./gradlew bundleRelease
```

Release signing is not configured in `app/build.gradle` yet — see the runbook's
Play Console section for generating the keystore and wiring `signingConfigs.release`
to it via environment variables.
