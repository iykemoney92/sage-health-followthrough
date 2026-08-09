import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { claritiIllustrationAnalysisSchema, generateClaritiIllustration } from "@/lib/ai/clariti-illustration";
import { getSessionUser, getSupabaseSessionClient, hasSupabaseBrowserConfig } from "@/lib/integrations/supabase-server";

const bodySchema = z.object({
  analysis: claritiIllustrationAnalysisSchema,
  sessionId: z.string().uuid().nullish(),
  sceneIndex: z.coerce.number().int().min(0).max(4).default(0),
});

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (hasSupabaseBrowserConfig() && !user) {
    return NextResponse.json({ ok: false, error: "Sign in before generating illustrations." }, { status: 401 });
  }
  if (!user) {
    return NextResponse.json({ ok: false, error: "Supabase auth is required for generated illustrations." }, { status: 503 });
  }

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

    const { data } = supabase.storage.from("clariti-videos").getPublicUrl(path);
    return NextResponse.json({
      ok: true,
      illustration: {
        url: data.publicUrl,
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

function formatIllustrationError(message: string) {
  if (/no such bucket|bucket/i.test(message)) return "Generated asset storage is not ready. Apply the Supabase storage migration and try again.";
  if (/insufficient|balance|quota|credit/i.test(message)) return "Illustration generation is not available right now. Please check model credits and try again.";
  if (/No such provider|NoSuchProvider|model/i.test(message)) return "Illustration generation needs a supported Vercel AI Gateway image model.";
  return "Clariti could not generate the illustration. Please try again.";
}
