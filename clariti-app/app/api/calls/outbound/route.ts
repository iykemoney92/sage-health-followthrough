import { NextResponse } from "next/server";

/** Phone outbound calling is temporarily disabled in favor of email check-ins. */
export async function POST() {
  return NextResponse.json({
    ok: false,
    error: "Phone calls are temporarily disabled. Use Set email check-in instead.",
  }, { status: 410 });
}
