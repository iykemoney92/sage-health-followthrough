import { NextResponse } from "next/server";

// Must never be cached: its entire job is to report what is deployed *right now*.
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * What the running clients poll to notice a deploy.
 *
 * The iOS/Android shell loads usenura.app directly rather than bundling a copy
 * of it, so a Vercel deploy is already live for anyone who cold-starts the app —
 * no store review, no OTA update package. What a deploy can't do is reach a
 * session that is already open, which is what this endpoint is for.
 *
 * `build` is whatever identifies this deployment. Clients don't parse it; they
 * only check whether it still equals the value they saw when they loaded, so
 * any value that changes exactly once per deploy works.
 */
function currentBuild() {
  return (
    process.env.VERCEL_DEPLOYMENT_ID ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    // Local dev has neither, and restarting the server should not look like a
    // deploy to a page that is still open, so this stays constant per process.
    "development"
  );
}

/**
 * Oldest native shell that still works against this deployment.
 *
 * Bump `NURA_MIN_NATIVE_BUILD` only when the web app starts depending on
 * something the older binary genuinely cannot do — a newly added Capacitor
 * plugin, a changed URL scheme. Web-only changes never need it.
 */
function minNativeBuild() {
  const raw = Number.parseInt(process.env.NURA_MIN_NATIVE_BUILD ?? "", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 1;
}

export async function GET() {
  return NextResponse.json(
    { build: currentBuild(), minNativeBuild: minNativeBuild() },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
