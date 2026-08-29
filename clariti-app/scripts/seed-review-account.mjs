/**
 * Creates the demo account App Review needs, with a document and a finished
 * analysis already in it.
 *
 * A reviewer who signs in and lands on "no documents yet" cannot evaluate the
 * app, which is a Guideline 2.1 rejection — and Clariti's whole product only
 * exists once a document has been analysed. This seeds one end to end so the
 * first screen after sign-in shows the real thing.
 *
 * The password is yours to choose and is never written to the repo. Run it
 * against production with the service-role key:
 *
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   REVIEW_EMAIL=review@useclariti.app REVIEW_PASSWORD='...' \
 *   node scripts/seed-review-account.mjs
 *
 * Re-running is safe: it reuses the existing account and replaces its seeded
 * session rather than piling up duplicates.
 *
 * The document below is fabricated. It has to be: seeding App Review with a real
 * person's medical bill would be the exact thing this product promises not to do.
 */
import { createClient } from "@supabase/supabase-js";
import { pathToFileURL } from "node:url";


export const DOCUMENT_TITLE = "Radiology report — lumbar spine MRI";
export const DOCUMENT_TEXT = `PATIENT: Sample, Alex   MRN: 000-DEMO
EXAM: MRI LUMBAR SPINE WITHOUT CONTRAST
INDICATION: Low back pain radiating to the left leg for 6 weeks.

TECHNIQUE: Multiplanar, multisequence imaging of the lumbar spine was performed
without intravenous contrast.

COMPARISON: None available.

FINDINGS:
Vertebral body heights and alignment are maintained. Marrow signal is normal.
The conus medullaris terminates at L1 and appears normal.
L3-L4: Mild disc desiccation without significant disc bulge. No stenosis.
L4-L5: Broad-based disc bulge with a small left paracentral protrusion measuring
approximately 4 mm, contacting the traversing left L5 nerve root. Mild facet
arthropathy. Mild left neural foraminal narrowing.
L5-S1: Disc desiccation with mild loss of disc height. No focal protrusion.
No spinal canal stenosis at any level.

IMPRESSION:
1. Small left paracentral disc protrusion at L4-L5 contacting the traversing
   left L5 nerve root, with mild left neural foraminal narrowing. This may
   correlate with the reported left leg symptoms.
2. Mild degenerative disc disease at L4-L5 and L5-S1.
3. No spinal canal stenosis.`;

/**
 * Shaped to match what lib/ai/clariti-analysis.ts produces, so the workspace
 * renders it exactly as it renders a real one. If that schema changes, this has
 * to change with it — a seeded analysis that fails to parse renders an empty
 * canvas, which is worse than no seed at all.
 */
export const ANALYSIS = {
  kind: "radiology_report",
  title: DOCUMENT_TITLE,
  summary:
    "This MRI found a small disc bulge in your lower back that is pressing on a nerve on the left side. That is the most likely reason for the pain going down your left leg.",
  plainEnglish:
    "Your lower back was scanned to find out why your left leg hurts. The scan found one small bulge in a disc — the cushion between two bones in your spine — at the level called L4-L5. That bulge is touching a nerve on the left, and that nerve runs down your left leg, which is why the radiologist thinks it may be causing your symptoms. The rest of the scan is reassuring: your bones line up normally, there is no narrowing of the main spinal canal, and the other wear the scan describes is the ordinary kind that shows up on most adult scans. The report says this bulge \"may correlate\" with your symptoms, which is careful wording — it means the picture fits, not that the cause is settled. That is a decision for the clinician who ordered the scan.",
  sourceAnchors: ["IMPRESSION", "FINDINGS", "TECHNIQUE"],
  keyPoints: [
    {
      label: "What the scan found",
      detail:
        "A small disc protrusion, about 4 mm, at L4-L5 on the left, touching the nerve that runs down your left leg.",
      sourceAnchor: "IMPRESSION 1",
    },
    {
      label: "Why your leg may hurt",
      detail:
        "The report connects that nerve contact to the leg symptoms you described, using the careful phrase \"may correlate\".",
      sourceAnchor: "IMPRESSION 1",
    },
    {
      label: "What looks normal",
      detail:
        "Bone height, alignment and marrow signal are all normal, and there is no spinal canal narrowing at any level.",
      sourceAnchor: "FINDINGS",
    },
    {
      label: "Ordinary wear",
      detail:
        "Disc desiccation at L4-L5 and L5-S1 means those discs have dried out a little. The report calls this mild, and it is common.",
      sourceAnchor: "IMPRESSION 2",
    },
  ],
  metrics: [
    { label: "Disc protrusion", value: "About 4 mm", caveat: "At L4-L5, left paracentral" },
    { label: "Spinal canal stenosis", value: "None at any level" },
    { label: "Comparison scans", value: "None", caveat: "No earlier scan was available to compare against" },
  ],
  flags: [
    {
      label: "\"May correlate\" is not a diagnosis",
      detail:
        "The report offers this as a likely explanation, not a confirmed one. Your clinician decides whether the scan explains your symptoms.",
      severity: "check",
    },
  ],
  questions: [
    "Does the L4-L5 finding explain my left leg symptoms, or should we look for another cause?",
    "Is a 4 mm protrusion something that usually settles on its own?",
    "What would make you consider something more than physiotherapy?",
    "Are there movements I should avoid while this settles?",
  ],
  nextActions: [
    "Book a follow-up with the clinician who ordered the scan, and bring the questions above.",
    "Ask whether physiotherapy is the right first step for a finding this size.",
    "Keep a short note of when the leg pain is worst, so the follow-up has something concrete to work from.",
  ],
  safetyNote:
    "Clariti explains what this report says. It does not diagnose, and it does not replace the clinician who ordered the scan. Sudden weakness, numbness around the groin, or loss of bladder or bowel control needs urgent medical care.",
};

async function findOrCreateUser(supabase, email, password) {
  // listUsers is paginated and there is no get-by-email, so page until found.
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`Could not list users: ${error.message}`);
    const existing = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (existing) {
      // Reset the password so a rerun always leaves credentials you can hand to
      // App Review, even if the account already existed with a forgotten one.
      await supabase.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
      return { id: existing.id, created: false };
    }
    if (data.users.length < 200) break;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: "App Review" },
  });
  if (error) throw new Error(`Could not create the review user: ${error.message}`);
  return { id: data.user.id, created: true };
}

async function seed(supabase, ownerId) {
  await supabase
    .from("clariti_profiles")
    .upsert({ id: ownerId, display_name: "App Review" }, { onConflict: "id" });

  // Clear any previous seed so reruns do not stack identical sessions in the
  // reviewer's history. Only rows this script created are matched.
  const { data: previous } = await supabase
    .from("clariti_sessions")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("title", DOCUMENT_TITLE);
  const previousIds = (previous ?? []).map((row) => row.id);
  if (previousIds.length) {
    await supabase.from("clariti_messages").delete().in("session_id", previousIds);
    await supabase.from("clariti_artifacts").delete().in("session_id", previousIds);
    await supabase.from("clariti_session_documents").delete().in("session_id", previousIds);
    await supabase.from("clariti_sessions").delete().in("id", previousIds);
  }
  await supabase.from("clariti_documents").delete().eq("owner_id", ownerId).eq("file_name", "lumbar-spine-mri.txt");

  const { data: document, error: documentError } = await supabase
    .from("clariti_documents")
    .insert({
      owner_id: ownerId,
      file_name: "lumbar-spine-mri.txt",
      kind: "radiology_report",
      status: "extracted",
      extracted_text: DOCUMENT_TEXT,
    })
    .select("id")
    .single();
  if (documentError) throw new Error(`Could not insert the document: ${documentError.message}`);

  const { data: session, error: sessionError } = await supabase
    .from("clariti_sessions")
    .insert({ owner_id: ownerId, title: DOCUMENT_TITLE, status: "ready" })
    .select("id")
    .single();
  if (sessionError) throw new Error(`Could not insert the session: ${sessionError.message}`);

  await supabase
    .from("clariti_session_documents")
    .insert({ session_id: session.id, document_id: document.id });

  await supabase.from("clariti_messages").insert([
    {
      session_id: session.id,
      role: "user",
      content: "Can you explain what this MRI report actually says?",
    },
    {
      session_id: session.id,
      role: "assistant",
      content: ANALYSIS.summary,
    },
  ]);

  const { error: artifactError } = await supabase.from("clariti_artifacts").insert({
    session_id: session.id,
    kind: "analysis",
    title: DOCUMENT_TITLE,
    summary: ANALYSIS.summary,
    payload: ANALYSIS,
  });
  if (artifactError) throw new Error(`Could not insert the analysis: ${artifactError.message}`);

  return { documentId: document.id, sessionId: session.id };
}

// Only when run, never when imported — clariti-review-fixture.test.ts imports
// this module to hold ANALYSIS to the real schema, and must not touch a database
// to do it.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const email = process.env.REVIEW_EMAIL;
  const password = process.env.REVIEW_PASSWORD;

  if (!url || !serviceKey || !email || !password) {
    console.error(
      "Missing config. Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, REVIEW_EMAIL, REVIEW_PASSWORD",
    );
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  const user = await findOrCreateUser(supabase, email, password);
  const seeded = await seed(supabase, user.id);

  console.log(`${user.created ? "Created" : "Reused"} review account: ${email}`);
  console.log(`  user id:     ${user.id}`);
  console.log(`  document id: ${seeded.documentId}`);
  console.log(`  session id:  ${seeded.sessionId}`);
  console.log("");
  console.log("Put these credentials in App Store Connect → App Review Information.");
  console.log("The account is on the free tier, so the reviewer can also exercise the paywall.");
}
