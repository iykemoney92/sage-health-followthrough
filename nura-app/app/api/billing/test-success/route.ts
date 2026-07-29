import { NextRequest, NextResponse } from "next/server";
import { getStripeTestCheckoutSession, grantStripeTestPlus } from "@/lib/billing/stripe-test";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";
import { appUrl } from "@/lib/url";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.redirect(appUrl("/login", request));
  }

  const sessionId = request.nextUrl.searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.redirect(appUrl("/billing", request));
  }

  const session = await getStripeTestCheckoutSession(sessionId);
  if (session?.mode !== "subscription" || session.status !== "complete" || session.metadata?.owner_id !== user.id) {
    const url = appUrl("/billing", request);
    url.searchParams.set("checkout", "failed");
    return NextResponse.redirect(url);
  }

  const supabase = await getSupabaseSessionClient();
  const { error } = await grantStripeTestPlus(supabase, user.id);

  if (error) {
    const url = appUrl("/billing", request);
    url.searchParams.set("checkout", "profile-update-failed");
    return NextResponse.redirect(url);
  }

  const url = appUrl("/billing", request);
  url.searchParams.set("checkout", "success");
  return NextResponse.redirect(url);
}
