import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { claritiIllustrationAnalysisSchema, generateClaritiIllustration } from "@/lib/ai/clariti-illustration";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";

const bodySchema = z.object({
  analysis: claritiIllustrationAnalysisSchema,
  sessionId: z.string().uuid().nullish(),
  sceneIndex: z.coerce.number().int().min(0).max(4).default(0),
});

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Sign in before generating illustrations." }, { status: 401 });
  }

  const limited = await enforceRateLimit(await getSupabaseSessionClient(), "illustrations");
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "A saved Clariti document analysis is required." }, { status: 400 });
  }

  const { analysis, sceneIndex, sessionId } = parsed.data;
  const supabase = await getSupabaseSessionClient();

  if (sessionId) {
    const { data: session, error } = await supabase
      .from("clariti_sessions")
      .select("id")
      .eq("id", sessionId)
      .eq("owner_id", user.id)
      .maybeSingle();
    if (error || !session) {
      return NextResponse.json({ ok: false, error: "Clariti could not find this saved session." }, { status: 404 });
    }
  }

  try {
    const generated = await generateClaritiIllustration({ analysis, sceneIndex });
    const extension = extensionFor(generated.image.mediaType);
    const path = `${user.id}/${sessionId ?? "adhoc"}/illustration-${sceneIndex + 1}-${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("clariti-videos")
      .upload(path, Buffer.from(generated.image.base64, "base64"), {
        contentType: generated.image.mediaType,
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) throw new Error(uploadError.message);

    // An app-relative path, not a public URL: clariti-videos is private, because
    // an illustration generated from someone's radiology report is as sensitive
    // as the report. /api/media re-checks ownership and signs on each read.
    return NextResponse.json({
      ok: true,
      illustration: {
        url: `/api/media/${path.split("/").map(encodeURIComponent).join("/")}`,
        sceneIndex,
        model: generated.model,
        sourceAnchor: analysis.videoScenes?.[sceneIndex]?.sourceAnchor ?? analysis.sourceAnchors[0] ?? null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Clariti could not generate the illustration.";
    return NextResponse.json({ ok: false, error: formatIllustrationError(message) }, { status: 502 });
  }
}

function extensionFor(mediaType: string) {
  if (mediaType.includes("jpeg") || mediaType.includes("jpg")) return "jpg";
  if (mediaType.includes("webp")) return "webp";
  return "png";
}

/**
 * Every branch here reaches a real person, so none of them names a bucket, a
 * migration, or a model provider. The operator detail stays in the server log;
 * the reader gets something they can act on.
 */
function formatIllustrationError(message: string) {
  if (/insufficient|balance|quota|credit|no such provider|NoSuchProvider|bucket/i.test(message)) {
    return "Illustrations are unavailable right now. Your analysis is saved — try again in a little while.";
  }
  return "Clariti could not generate the illustration. Please try again.";
}
