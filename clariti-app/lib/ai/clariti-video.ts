import { z } from "zod";
import { claritiAnalysisSchema, type ClaritiAnalysis } from "@/lib/ai/clariti-analysis";
import { getClaritiKindMeta } from "@/lib/domain/clariti-document-kinds";

export const claritiVideoAnalysisSchema = claritiAnalysisSchema.pick({
  kind: true,
  title: true,
  summary: true,
  plainEnglish: true,
  keyPoints: true,
  questions: true,
  nextActions: true,
  safetyNote: true,
  sourceAnchors: true,
  metrics: true,
  videoScenes: true,
});

export type ClaritiVideoAnalysis = z.infer<typeof claritiVideoAnalysisSchema>;

export type ClaritiVideoScene = {
  sceneIndex: number;
  title: string;
  durationSeconds: number;
  narration: string;
  prompt: string;
  sourceAnchor: string;
  status: "queued" | "generating" | "completed" | "failed";
  /**
   * Whether this clip is the entire explainer rather than one shot of several.
   * The planner is the only thing that knows, and the prompt needs to: a clip
   * told to land the closing question at second twenty when three segments
   * follow it will wrap up, and the rest then continue past an ending that has
   * already happened. Absent on rows queued before segments were planned.
   */
  isWholeExplainer?: boolean;
  videoUrl?: string;
  error?: string;
};

export const supportedHumanVideoDurations = [4, 6, 8] as const;
export type ClaritiHumanVideoDuration = typeof supportedHumanVideoDurations[number];

export function normalizeHumanVideoDuration(durationSeconds: number): ClaritiHumanVideoDuration {
  if (durationSeconds <= 4) return 4;
  if (durationSeconds <= 6) return 6;
  return 8;
}

export const FLUX_VIDEO_MODEL = "bfl/flux-3-video";
export const FLUX_MIN_CLIP_SECONDS = 5;
export const FLUX_MAX_CLIP_SECONDS = 20;
/**
 * How many chained clips one explainer may spend on. A continued segment bills
 * at video-to-video rates — roughly 2.4x a fresh clip — so the chain is bounded
 * rather than left to follow whatever length a client asks for. Four segments is
 * eighty seconds, well past any explainer Clariti has a reason to narrate. Both
 * the enqueue route and the renderer check it, so it lives here rather than
 * being written down twice.
 */
export const FLUX_MAX_CHAINED_SEGMENTS = 4;

/** The Veo id the app shipped with, and still the fallback for the legacy pipeline. */
const LEGACY_VEO_MODEL = "google/veo-3.1-generate-001";

export type ClaritiVideoPipeline =
  | "flux-single"
  | "flux-chained"
  | "ai-video-scenes-shotstack"
  | "ai-video-job-single-render";

/**
 * Matches the family rather than one exact id. The gateway has renamed video
 * models across revisions before, and any `bfl/flux-*-video` carries the same
 * five-to-twenty-second envelope this file plans against — so a point release
 * must not silently fall back to Veo's 4/6/8 rounding.
 */
export function isFluxVideoModel(model: string): boolean {
  const id = model.trim().toLowerCase();
  if (!id) return false;
  return id === FLUX_VIDEO_MODEL || /^bfl\/flux-[a-z0-9.-]*video$/.test(id);
}

/** Flux takes any whole second from 5 to 20; Veo takes only 4, 6 or 8. */
export function normalizeVideoDuration(model: string, durationSeconds: number): number {
  if (!isFluxVideoModel(model)) return normalizeHumanVideoDuration(durationSeconds);
  return clampFluxClipSeconds(durationSeconds);
}

function clampFluxClipSeconds(durationSeconds: number) {
  if (!Number.isFinite(durationSeconds)) return FLUX_MIN_CLIP_SECONDS;
  const whole = Math.round(durationSeconds);
  if (whole < FLUX_MIN_CLIP_SECONDS) return FLUX_MIN_CLIP_SECONDS;
  if (whole > FLUX_MAX_CLIP_SECONDS) return FLUX_MAX_CLIP_SECONDS;
  return whole;
}

/**
 * The AI SDK wants pixels, the gateway publishes `hd` and `fhd`.
 *
 * The opt-in only applies to Flux. Veo stays pinned at 720p so switching models
 * cannot quietly change what the legacy pipeline costs per second.
 */
export function videoResolutionFor(model: string): `${number}x${number}` {
  const wantsFhd = (process.env.CLARITI_VIDEO_RESOLUTION ?? "").trim().toLowerCase() === "fhd";
  return wantsFhd && isFluxVideoModel(model) ? "1920x1080" : "1280x720";
}

/**
 * Splits an explainer into clips Flux will actually accept.
 *
 * Anything up to twenty seconds is one call — the whole point of the move off
 * Veo is that the common case stops being five renders and a stitch. Longer
 * explainers split evenly rather than filling twenty-second clips and leaving a
 * remainder: `ceil(45 / 20)` is three segments of fifteen, where greedy packing
 * would hand the model a five-second tail today and a two-second one at 42
 * seconds, which it rejects outright.
 */
export function planFluxSegments(analysis: ClaritiVideoAnalysis, totalSeconds: number): ClaritiVideoScene[] {
  const durations = planFluxSegmentDurations(totalSeconds);
  const isWholeExplainer = durations.length === 1;
  const beatGroups = splitExplainerBeats(getExplainerBeats(analysis), durations.length);

  return durations.map((durationSeconds, index) => {
    const beats = beatGroups[index];
    const scene: ClaritiVideoScene = {
      sceneIndex: index,
      title: isWholeExplainer ? "Full explainer" : beats[0].title,
      durationSeconds,
      narration: joinBeatNarration(beats, durationSeconds, { keepClosing: index === durations.length - 1 }),
      // `||` rather than `??` throughout: verifyKeyPointAnchors writes an empty
      // string for a quote it could not find in the document, and an empty string
      // is neither null nor undefined — so `??` handed it straight through as the
      // scene's cited source, which is the fabricated citation the check exists to
      // catch, now narrated aloud in a video.
      sourceAnchor: beats[0].sourceAnchor || analysis.sourceAnchors[0] || "Saved analysis",
      status: "queued",
      isWholeExplainer,
      prompt: "",
    };
    return {
      ...scene,
      prompt: buildFluxSegmentPrompt(analysis, scene, { isContinuation: index > 0 }),
    };
  });
}

function planFluxSegmentDurations(totalSeconds: number) {
  const total = Number.isFinite(totalSeconds) ? Math.round(totalSeconds) : FLUX_MAX_CLIP_SECONDS;
  if (total <= FLUX_MAX_CLIP_SECONDS) return [clampFluxClipSeconds(total)];

  const segmentCount = Math.ceil(total / FLUX_MAX_CLIP_SECONDS);
  const base = Math.floor(total / segmentCount);
  const remainder = total - base * segmentCount;
  return Array.from({ length: segmentCount }, (_, index) =>
    clampFluxClipSeconds(base + (index < remainder ? 1 : 0)));
}

/**
 * What the length recommendation reads.
 *
 * A subset on purpose, like ThreadAnalysisFacts: a full `ClaritiAnalysis` and
 * the video-shaped pick both satisfy it, so neither caller needs an adapter.
 * `flags` is optional because `claritiVideoAnalysisSchema` does not carry them —
 * the enqueue route parses them away, so a server-side call simply reasons with
 * one signal fewer rather than failing to type-check.
 */
export type ExplainerLengthFacts = ClaritiVideoAnalysis & { flags?: ClaritiAnalysis["flags"] };

export type ExplainerLengthSignal =
  | "arc"
  | "beats"
  | "metrics"
  | "urgent_flags"
  | "check_flags"
  | "script_fit"
  | "beats_available"
  | "ceiling";

export type ExplainerLengthEvidence = {
  signal: ExplainerLengthSignal;
  /** Written for the reader, not for a log. This string is what the UI shows. */
  reason: string;
  /** Seconds this signal asked for, or gave back when it is a trim. */
  seconds: number;
};

export type ExplainerLengthRecommendation = {
  seconds: number;
  /** What those seconds cost: one render per segment, each billed for its own length. */
  segments: number;
  /** Best first. Safe to show beside the confirm button. */
  reasons: string[];
  evidence: ExplainerLengthEvidence[];
  /** The ends of the slider, so a caller adjusting the proposal does not re-derive them. */
  minSeconds: number;
  maxSeconds: number;
};

/** Saying what the document is, and what to ask once it is explained. Every explainer pays this. */
const EXPLAINER_ARC_SECONDS = 14;
/** The storyboard's own unit — the scene prompt asks for "one continuous spoken beat of about six seconds". */
const SECONDS_PER_BEAT = 6;
const SECONDS_PER_METRIC = 2;
/** A bill is read line by line rather than summed up in a breath, so its numbers each take longer. */
const SECONDS_PER_MONEY_METRIC = 3;
/** Past this the numbers stop being walked through and become a list, which a video is the wrong place for. */
const MAX_WALKED_METRICS = 6;
const SECONDS_PER_URGENT_FLAG = 8;
const SECONDS_PER_CHECK_FLAG = 4;
const MAX_FLAG_SECONDS = 16;
/** A beat has to carry at least this many words of its own to have earned screen time. */
const MIN_BEAT_WORDS = 3;
/** Whole steps: the segmenter's arithmetic stays whole and the number reads like a choice rather than a measurement. */
const EXPLAINER_SECONDS_STEP = 5;
const MAX_EXPLAINER_SECONDS = FLUX_MAX_CHAINED_SEGMENTS * FLUX_MAX_CLIP_SECONDS;

/**
 * How long this document's explainer should run, and why it should run that long.
 *
 * A recommendation, never a decision. A Flux second is real money and the free
 * tier grants one explainer, so a length Clariti settles on its own can spend
 * somebody's entire allowance — four renders instead of one — before they have
 * been asked. So this answers the way `scoreThreadRelatedness` does: the number
 * is worth less than the sentences beside it, because the sentences are what
 * let a person say "twenty is plenty" and be right.
 *
 * `segments` comes back with the seconds because that is the number with the
 * price on it. One segment is one render; four is four renders and roughly four
 * times the money, and a caller showing the proposal has to be able to say so
 * before the person commits, not after.
 *
 * It errs short in both directions. Signals are read for what the explainer has
 * to cover, and a script longer than the recommendation is not a reason to
 * spend more — `joinBeatNarration` trims a long script to fit, and trimming
 * costs nothing while a second segment costs a render. The reverse is not
 * symmetric: a clip longer than its own script is silence, and silence bills at
 * the same rate as speech.
 */
export function recommendExplainerSeconds(analysis: ExplainerLengthFacts): ExplainerLengthRecommendation {
  const beats = getExplainerBeats(analysis);
  const evidence: ExplainerLengthEvidence[] = [{
    signal: "arc",
    // The one item that is the same for every document, so it names none.
    reason: `Every explainer spends about ${EXPLAINER_ARC_SECONDS} seconds saying which document this is and what to ask about it afterwards, before anything specific to this one.`,
    seconds: EXPLAINER_ARC_SECONDS,
  }];

  const substantiveBeats = countSubstantiveBeats(beats, analysis);
  if (substantiveBeats > 0) {
    evidence.push({
      signal: "beats",
      reason: substantiveBeats === 1
        ? `One beat of the storyboard says something of its own, which is about ${SECONDS_PER_BEAT} seconds.`
        : `${sentenceCase(countWord(substantiveBeats))} beats of the storyboard say something of their own, at about ${SECONDS_PER_BEAT} seconds each.`,
      seconds: substantiveBeats * SECONDS_PER_BEAT,
    });
  }

  const isMoney = getClaritiKindMeta(analysis.kind).uiFamily === "money";
  const walkedMetrics = Math.min(analysis.metrics.length, MAX_WALKED_METRICS);
  if (walkedMetrics > 0) {
    const counted = analysis.metrics.length > walkedMetrics
      ? `${sentenceCase(countWord(walkedMetrics))} of the ${countWord(analysis.metrics.length)}`
      : sentenceCase(countWord(walkedMetrics));
    evidence.push({
      signal: "metrics",
      reason: isMoney
        ? `${counted} number${walkedMetrics === 1 ? "" : "s"} on this ${getDocumentNoun(analysis)} get read out one at a time — a bill is gone through line by line, not summed up in a breath.`
        : `${counted} number${walkedMetrics === 1 ? "" : "s"} the viewer has to be walked through rather than just shown.`,
      seconds: walkedMetrics * (isMoney ? SECONDS_PER_MONEY_METRIC : SECONDS_PER_METRIC),
    });
  }

  const flags = analysis.flags ?? [];
  const urgentCount = flags.filter((flag) => flag.severity === "urgent").length;
  const checkCount = flags.filter((flag) => flag.severity === "check").length;
  // Capped together: a document with five warnings on it is a conversation with
  // a clinician, not a longer video.
  const urgentSeconds = Math.min(urgentCount * SECONDS_PER_URGENT_FLAG, MAX_FLAG_SECONDS);
  const checkSeconds = Math.min(checkCount * SECONDS_PER_CHECK_FLAG, MAX_FLAG_SECONDS - urgentSeconds);
  if (urgentSeconds > 0) {
    evidence.push({
      signal: "urgent_flags",
      reason: `${sentenceCase(countWord(urgentCount))} ${urgentCount === 1 ? "flag is" : "flags are"} marked urgent, and a warning needs long enough to say what to do about it rather than only that it is there.`,
      seconds: urgentSeconds,
    });
  }
  if (checkSeconds > 0) {
    evidence.push({
      signal: "check_flags",
      reason: `${sentenceCase(countWord(checkCount))} thing${checkCount === 1 ? "" : "s"} to check with someone, each needing a sentence of its own.`,
      seconds: checkSeconds,
    });
  }

  let seconds = evidence.reduce((total, item) => total + item.seconds, 0);

  // Whatever the signals asked for, the presenter can only speak what the
  // storyboard actually says. A clip longer than its script is a person standing
  // there, billed by the second like any other footage.
  const scriptSeconds = Math.floor(countSpokenWords(beats.map((beat) => beat.narration).join(" ")) / SPOKEN_WORDS_PER_SECOND);
  if (scriptSeconds < seconds) {
    evidence.push({
      signal: "script_fit",
      reason: scriptSeconds >= 1
        ? `Spoken aloud, the script Clariti has for this document runs about ${scriptSeconds} seconds. Past that the presenter is standing in silence, and silence bills by the second like any other footage.`
        : "There is almost nothing here to say out loud, and silence bills by the second like any other footage.",
      seconds: scriptSeconds - seconds,
    });
    seconds = scriptSeconds;
  }

  if (seconds > MAX_EXPLAINER_SECONDS) {
    evidence.push({
      signal: "ceiling",
      reason: `Clariti plans at most ${countWord(FLUX_MAX_CHAINED_SEGMENTS)} clips, so ${MAX_EXPLAINER_SECONDS} seconds is as long as an explainer gets.`,
      seconds: MAX_EXPLAINER_SECONDS - seconds,
    });
    seconds = MAX_EXPLAINER_SECONDS;
  }

  let segments = segmentsEarnedBy(seconds);
  // splitExplainerBeats pads a segment that would otherwise be empty by
  // repeating a neighbouring beat, so asking for more segments than there are
  // beats buys a render that says something twice.
  if (segments > beats.length) {
    const capped = Math.max(1, beats.length);
    const cappedSeconds = Math.min(seconds, capped * FLUX_MAX_CLIP_SECONDS);
    evidence.push({
      signal: "beats_available",
      reason: `The storyboard has ${countWord(beats.length)} beat${beats.length === 1 ? "" : "s"} in it, and a clip with nothing of its own to say repeats the one before it.`,
      seconds: cappedSeconds - seconds,
    });
    seconds = cappedSeconds;
    segments = capped;
  }

  // Rounded down, and kept inside this segment count's window: 41 seconds would
  // otherwise become three clips of fourteen, which is a third render bought for
  // one second of video. The floor of the window is what keeps the segmenter
  // from cutting a stub clip below the minimum Flux accepts.
  const windowFloor = (segments - 1) * FLUX_MAX_CLIP_SECONDS + FLUX_MIN_CLIP_SECONDS;
  const windowCeiling = segments * FLUX_MAX_CLIP_SECONDS;
  const stepped = Math.floor(Math.max(0, seconds) / EXPLAINER_SECONDS_STEP) * EXPLAINER_SECONDS_STEP;

  return {
    seconds: Math.min(windowCeiling, Math.max(windowFloor, stepped)),
    segments,
    reasons: [...evidence].sort((first, second) => second.seconds - first.seconds).map((item) => item.reason),
    evidence,
    minSeconds: FLUX_MIN_CLIP_SECONDS,
    maxSeconds: MAX_EXPLAINER_SECONDS,
  };
}

/**
 * What a length costs, in renders.
 *
 * Exported for the confirm step: a person shortening the proposal needs the
 * render count to move with them, and asking `planFluxSegments` would build
 * every prompt to answer a question about arithmetic. Delegates to the real
 * planner so the two can never disagree about what a number costs.
 */
export function segmentsForExplainerSeconds(totalSeconds: number): number {
  return planFluxSegmentDurations(totalSeconds).length;
}

/**
 * How many clips a length has earned.
 *
 * A second segment has to be worth having. Crossing twenty seconds by two buys
 * a whole extra render — at video-to-video rates, which are the expensive ones —
 * for two seconds of video, so nothing under a minimum clip's worth of overflow
 * earns the next segment.
 */
function segmentsEarnedBy(totalSeconds: number) {
  let segments = 1;
  while (
    segments < FLUX_MAX_CHAINED_SEGMENTS &&
    totalSeconds >= segments * FLUX_MAX_CLIP_SECONDS + FLUX_MIN_CLIP_SECONDS
  ) {
    segments += 1;
  }
  return segments;
}

/**
 * Beats carrying something of their own, not counting the opening and the
 * closing that every explainer has anyway and that the arc already pays for.
 *
 * The default storyboard is scaffolding, not evidence of substance: given an
 * analysis with one key point and nothing else, three of its five beats are the
 * summary and the plain-English line said again in different words. Screen time
 * bought for a restatement is screen time bought twice. The lead-ins stripped
 * here are written further down this same file, which is what makes a
 * restatement recognisable as one.
 */
function countSubstantiveBeats(beats: ScenePlan[], analysis: ExplainerLengthFacts) {
  const alreadySaid = [analysis.summary, analysis.plainEnglish].map(toComparableNarration).filter(Boolean);
  let substantive = 0;

  for (const beat of beats.slice(1, -1)) {
    const content = toComparableNarration(beat.narration);
    if (countSpokenWords(content) < MIN_BEAT_WORDS) continue;
    if (alreadySaid.some((earlier) => restates(earlier, content))) continue;
    alreadySaid.push(content);
    substantive += 1;
  }

  return substantive;
}

/** These reasons are read, not parsed, and small numbers read better as words. */
const COUNT_WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];

function countWord(value: number) {
  return COUNT_WORDS[value] ?? String(value);
}

function sentenceCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Long enough that one containing the other is a restatement rather than a coincidence. */
const RESTATEMENT_MIN_CHARS = 12;

function restates(earlier: string, content: string) {
  if (earlier === content) return true;
  if (earlier.length >= RESTATEMENT_MIN_CHARS && content.includes(earlier)) return true;
  return content.length >= RESTATEMENT_MIN_CHARS && earlier.includes(content);
}

/** The phrasings this file wraps around a beat's content, so what is left is the content. */
const BEAT_LEAD_INS = [
  /^let['’]s walk through this .*? together\.?\s*/,
  /^in plain words:?\s*/,
  /^here is what matters most:?\s*/,
  /^the main takeaway is\s*/,
  /^the main thing it says is\s*/,
  /^the report is talking about\s*/,
  /^the key numbers are\s*/,
  /^it also notes\s*/,
  /^your report describes\s*/,
  /^this .{0,40}? says\s*/,
  /^a good next step:?\s*/,
  /^ask:?\s*/,
];

function toComparableNarration(value: string) {
  let comparable = value.replace(/\s+/g, " ").trim().toLowerCase();
  let stripped = true;
  while (stripped) {
    stripped = false;
    for (const leadIn of BEAT_LEAD_INS) {
      const next = comparable.replace(leadIn, "");
      if (next !== comparable) {
        comparable = next;
        stripped = true;
      }
    }
  }
  return comparable.replace(/[.!?,;:]+$/, "").trim();
}

function getExplainerBeats(analysis: ClaritiVideoAnalysis): ScenePlan[] {
  const designed = analysis.videoScenes?.filter((scene) => scene.script.trim().length > 0);
  if (designed?.length) {
    return designed.map((scene) => ({
      title: scene.title,
      narration: scene.script,
      sourceAnchor: scene.sourceAnchor,
      visual: scene.visual,
    }));
  }

  return buildDefaultFiveScenePlan({
    analysis,
    documentNoun: getDocumentNoun(analysis),
    reportType: getReportType(analysis),
    visualDirection: getVisualDirection(analysis),
    main: analysis.keyPoints[0],
    second: analysis.keyPoints[1],
    third: analysis.keyPoints[2],
    question: analysis.questions[0] ?? getDefaultQuestion(analysis),
    nextAction: analysis.nextActions[0] ?? "Bring this document to your next conversation with the right person.",
  });
}

function splitExplainerBeats(beats: ScenePlan[], segmentCount: number): ScenePlan[][] {
  if (segmentCount <= 1) return [beats];

  const groups: ScenePlan[][] = Array.from({ length: segmentCount }, () => []);
  beats.forEach((beat, index) => {
    const group = Math.min(segmentCount - 1, Math.floor((index * segmentCount) / beats.length));
    groups[group].push(beat);
  });
  // More segments than beats is possible on a long explainer built from a short
  // storyboard; an empty segment would be a clip with nothing to say.
  return groups.map((group, index) => (group.length ? group : [beats[Math.min(index, beats.length - 1)]]));
}

/**
 * Spoken text, so the beats need sentence breaks between them. The storyboard
 * writes each beat as its own line and several end without punctuation, which a
 * bare space run-ons into "...billed for a visit The key numbers are".
 */
function joinBeatNarration(beats: ScenePlan[], durationSeconds: number, options: { keepClosing: boolean }) {
  const spoken = beats
    .map((beat) => beat.narration.replace(/\s+/g, " ").trim())
    .filter((narration) => narration.length > 0)
    .map((narration) => (/[.!?:]$/.test(narration) ? narration : `${narration}.`));
  return fitNarrationToDuration(spoken, durationSeconds, options);
}

/** A calm presenter speaks a little over two and a half words a second. */
const SPOKEN_WORDS_PER_SECOND = 2.6;

/**
 * Slack before anything is cut. A clip that runs a few words long is paced
 * slightly faster; half a beat is a script that stops mid-thought, which is the
 * worse of the two by a distance.
 */
const NARRATION_OVERRUN_TOLERANCE = 1.15;

/**
 * Budgets the script by how long the clip is rather than by how many characters
 * it runs to.
 *
 * The five-beat storyboard was written for a thirty-second stitched cut, so
 * handing all of it to a twenty-second clip asks the presenter to speak at
 * roughly twice the pace the same prompt tells them to keep. Whole beats give
 * way first, from the middle outwards: the opening says what the document is,
 * and the last beat of the explainer carries the question the reader is meant to
 * leave with. Only after that does a beat lose a sentence, and a cut always
 * lands on a sentence boundary — this text is spoken aloud, and a trailing
 * ellipsis is something the presenter has to read out.
 */
function fitNarrationToDuration(beats: string[], durationSeconds: number, options: { keepClosing: boolean }) {
  const seconds = Number.isFinite(durationSeconds) ? durationSeconds : FLUX_MAX_CLIP_SECONDS;
  const budget = Math.round(Math.max(12, seconds * SPOKEN_WORDS_PER_SECOND) * NARRATION_OVERRUN_TOLERANCE);
  const kept = beats.filter((beat) => beat.length > 0);
  if (!kept.length) return "";

  const isOverBudget = () => countSpokenWords(kept.join(" ")) > budget;
  while (kept.length > 2 && isOverBudget()) {
    kept.splice(Math.floor(kept.length / 2), 1);
  }
  while (kept.length > 1 && isOverBudget()) {
    // The end this segment can spare: a closing segment shortens its opening,
    // any other one shortens its tail.
    const index = options.keepClosing ? 0 : kept.length - 1;
    const shortened = dropTrailingSentence(kept[index]);
    if (shortened === kept[index]) kept.splice(index, 1);
    else kept[index] = shortened;
  }

  if (!isOverBudget()) return kept.join(" ");
  return options.keepClosing
    ? keepTrailingSentences(kept[0], budget)
    : keepLeadingSentences(kept[0], budget);
}

function countSpokenWords(value: string) {
  return value.split(/\s+/).filter(Boolean).length;
}

function splitSentences(value: string) {
  return value.match(/[^.!?]+[.!?]*\s*/g)?.map((sentence) => sentence.trim()).filter(Boolean) ?? [value];
}

function dropTrailingSentence(value: string) {
  const sentences = splitSentences(value);
  if (sentences.length <= 1) return value;
  return sentences.slice(0, -1).join(" ");
}

/** Last resort for one long beat, keeping at least a sentence either way. */
function keepLeadingSentences(value: string, budget: number) {
  const kept: string[] = [];
  for (const sentence of splitSentences(value)) {
    if (kept.length && countSpokenWords([...kept, sentence].join(" ")) > budget) break;
    kept.push(sentence);
  }
  return kept.join(" ");
}

function keepTrailingSentences(value: string, budget: number) {
  const kept: string[] = [];
  for (const sentence of splitSentences(value).reverse()) {
    if (kept.length && countSpokenWords([sentence, ...kept].join(" ")) > budget) break;
    kept.unshift(sentence);
  }
  return kept.join(" ");
}

/**
 * The prompt for one Flux clip.
 *
 * The base presenter prompt carries the grounding, the safety rules and the
 * spoken script; this adds what is specific to the clip. Continuation segments
 * are handed the previous mp4 through `inputReferences`, so the wording has to
 * tell the model it is still inside that shot — otherwise it re-establishes the
 * room and the finished explainer reads as several unrelated videos.
 */
export function buildFluxSegmentPrompt(
  analysis: ClaritiVideoAnalysis,
  scene: ClaritiVideoScene,
  options: { isContinuation: boolean },
): string {
  const base = buildHumanPresenterPrompt(analysis, scene.durationSeconds, {
    model: FLUX_VIDEO_MODEL,
    script: scene.narration,
  });
  const segmentNumber = scene.sceneIndex + 1;
  // Only the clip that is the entire explainer is told to close the piece out.
  // An opener that signs off at second twenty leaves the segments after it
  // continuing past an ending that has already happened — each of them billed at
  // video-to-video rates.
  const isWholeExplainer = !options.isContinuation && scene.isWholeExplainer === true;

  return [
    base,
    "",
    options.isContinuation
      ? `This shot continues the video supplied as a reference. Segment ${segmentNumber}, ${scene.durationSeconds} seconds, 24 fps, with spoken audio.`
      : isWholeExplainer
        ? `This shot is the whole explainer. ${scene.durationSeconds} seconds, 24 fps, with spoken audio.`
        : `This shot opens the explainer and more segments follow it. Segment ${segmentNumber}, ${scene.durationSeconds} seconds, 24 fps, with spoken audio.`,
    options.isContinuation
      ? "Continue the existing shot: same consultation room, same presenter, same wardrobe, same lighting and framing, continuing mid-explanation from the final frames of the reference clip. Do not restart the introduction, do not re-establish the setting, and do not open on a new scene or a new person."
      : isWholeExplainer
        ? `Pace the narration to fill the full ${scene.durationSeconds} seconds without rushing and without padding, and land the closing question before the end.`
        : `Pace the narration to fill the full ${scene.durationSeconds} seconds without rushing and without padding. Do not sign off, do not summarise the whole document, and do not close on a question: the explanation carries on in the next shot.`,
  ].join("\n");
}

/**
 * What a returned continuation clip turned out to hold. `extended` means the
 * model handed back the whole video so far, which is the only shape that leaves
 * one file worth saving; `continuation` means it returned the new footage alone.
 */
export type ClaritiChainedSegmentShape = "fresh" | "extended" | "continuation" | "unknown";

/**
 * Reads a continued clip's length against the two lengths it could plausibly be:
 * this segment alone, or everything up to and including it. A quarter is a
 * generous tolerance, but the two candidates are always at least five seconds
 * apart, so it separates them without mistaking encoder slack for a verdict.
 */
export function classifyContinuation(
  measuredSeconds: number | null,
  segmentSeconds: number,
  cumulativeSeconds: number,
): ClaritiChainedSegmentShape {
  if (measuredSeconds === null || !Number.isFinite(measuredSeconds) || measuredSeconds <= 0) return "unknown";
  const offSegment = Math.abs(measuredSeconds - segmentSeconds);
  const offCumulative = Math.abs(measuredSeconds - cumulativeSeconds);
  if (offCumulative < offSegment && offCumulative <= cumulativeSeconds * 0.25) return "extended";
  if (offSegment < offCumulative && offSegment <= segmentSeconds * 0.25) return "continuation";
  return "unknown";
}

/**
 * The gateway publishes no schema for a video response's metadata, and the
 * duration is the one number that would settle what a continued clip holds, so
 * it is looked for wherever the provider chose to put it rather than at one
 * fixed key. Null when there is nothing plausible to read.
 */
export function readReportedDuration(metadata: unknown, depth = 0): number | null {
  if (!metadata || typeof metadata !== "object" || depth > 4) return null;
  for (const [key, value] of Object.entries(metadata as Record<string, unknown>)) {
    if (/^(video_?)?duration(_?seconds|_?secs)?$/i.test(key)) {
      const seconds = typeof value === "number"
        ? value
        : typeof value === "string" ? Number.parseFloat(value) : Number.NaN;
      if (Number.isFinite(seconds) && seconds > 0) return seconds;
    }
    const nested = readReportedDuration(value, depth + 1);
    if (nested !== null) return nested;
  }
  return null;
}

export function formatHumanVideoError(error: unknown) {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const cleaned = message.replace(/\s+/g, " ").trim();

  if (!cleaned) return "The video was not generated. Please try again.";
  if (/unsupported output video duration|duration (is )?(not supported|out of range|unsupported)|supported[_ ]durations/i.test(cleaned)) {
    return "That video length is not supported. Please try again.";
  }
  // Checked ahead of the continuation branch below: a Shotstack failure payload
  // is passed through verbatim and routinely says "invalid video asset" or
  // "unsupported media type", which would otherwise tell a reader on the legacy
  // stitch that Clariti could not continue from a previous clip it never had.
  if (/shotstack/i.test(cleaned)) {
    return "Clariti could not finish stitching the video scenes. Please try again.";
  }
  // Continuation clips hand the model the previous mp4. When it comes back
  // rejected the reader should be told the join failed, not shown a provider
  // complaint about a media type they never chose.
  if (/input ?references?|reference video|video input|invalid video|unsupported (media|mime) type/i.test(cleaned)) {
    return "Clariti could not continue the video from the previous clip. Please try again.";
  }
  if (/minimum balance|insufficient/i.test(cleaned)) {
    return "Video generation is not available right now. Please try again later.";
  }
  // Storage and schema failures are operator problems. The reader gets told the
  // video did not save and that their analysis survived; the specifics stay in
  // the server log rather than being passed through verbatim, which used to
  // surface bucket names and migration instructions in the UI.
  if (/clariti_video_generations|relation .* does not exist|could not save the video to storage|clariti-videos|not found in storage/i.test(cleaned)) {
    return "Clariti could not save the finished video. Your analysis is saved — try generating it again.";
  }
  if (/sign in|unauthorized|auth/i.test(cleaned)) {
    return "Sign in again, then generate the video so Clariti can save it to your account.";
  }
  if (/save this analysis first/i.test(cleaned)) {
    return cleaned;
  }
  if (cleaned.length <= 180 && !/api[_ -]?key|token|secret/i.test(cleaned)) {
    return cleaned;
  }
  return "The video was not generated. Please try again.";
}

export function buildVideoScenes(analysis: ClaritiVideoAnalysis, durationSeconds: number): ClaritiVideoScene[] {
  const isStitchedExplainer = durationSeconds >= 24;
  const safeDuration = isStitchedExplainer ? 30 : normalizeVideoDuration(LEGACY_VEO_MODEL, durationSeconds);
  const reportType = getReportType(analysis);
  const documentNoun = getDocumentNoun(analysis);
  const visualDirection = getVisualDirection(analysis);
  const main = analysis.keyPoints[0];
  const second = analysis.keyPoints[1];
  const third = analysis.keyPoints[2];
  const question = analysis.questions[0] ?? getDefaultQuestion(analysis);
  const nextAction = analysis.nextActions[0] ?? "Bring this document to your next conversation with the right person.";
  const sceneCount = isStitchedExplainer ? 5 : safeDuration >= 8 ? 2 : 1;
  const perSceneDuration = isStitchedExplainer ? 6 : Math.min(8, Math.ceil(safeDuration / sceneCount));
  const character =
    "A calm, realistic healthcare explainer in a modern consultation room, warm eye contact, professional clothing, natural speech, premium healthcare product demo lighting.";

  const sourceStoryboard = analysis.videoScenes?.slice(0, sceneCount).map((scene) => ({
    title: scene.title,
    narration: scene.script,
    sourceAnchor: scene.sourceAnchor,
    visual: scene.visual,
  }));

  const plan = sourceStoryboard?.length === sceneCount
    ? sourceStoryboard
    : isStitchedExplainer
      ? buildDefaultFiveScenePlan({
        analysis,
        documentNoun,
        reportType,
        visualDirection,
        main,
        second,
        third,
        question,
        nextAction,
      })
    : sceneCount === 1
    ? [{
      title: "Main report finding",
      narration: `Your report describes ${main?.detail ?? analysis.summary}. Ask your clinician: ${question}`,
      sourceAnchor: main?.sourceAnchor || analysis.sourceAnchors[0] || "Saved analysis",
      visual: visualDirection,
    }]
    : [
      {
        title: "Main report finding",
        narration: `Your report describes ${main?.detail ?? analysis.summary}`,
        sourceAnchor: main?.sourceAnchor || analysis.sourceAnchors[0] || "Saved analysis",
        visual: visualDirection,
      },
      {
        title: "Question to ask",
        narration: `Clariti is explaining the wording, not diagnosing. Ask your clinician: ${question}`,
        sourceAnchor: analysis.sourceAnchors[0] || "Saved analysis",
        visual: "Show a concise question checklist and educational disclaimer.",
      },
    ];

  return plan.map((scene, index) => ({
    sceneIndex: index,
    title: scene.title,
    durationSeconds: perSceneDuration,
    narration: scene.narration,
    sourceAnchor: scene.sourceAnchor,
    status: "queued",
    prompt: [
      character,
      `Create scene ${index + 1} of ${sceneCount} for a ${safeDuration}-second patient explainer video.`,
      "Keep this as one continuous spoken beat of about six seconds.",
      `Document type: ${documentNoun}.`,
      `The human presenter speaks this narration as closely as possible: "${trimNarration(scene.narration)}"`,
      `Scene visual: ${scene.visual}`,
      `Overall visual style: ${visualDirection}`,
      "No fear imagery, hospital drama, invented findings, invented charges, invented coverage decisions, or diagnostic claims.",
      `Clearly include this safety note: ${getEducationalDisclaimer(analysis)}`,
      "No brand logos. Captions should be clean and legible if included.",
      `Safety boundary: ${analysis.safetyNote}`,
    ].join(" "),
  }));
}

type ScenePlan = {
  title: string;
  narration: string;
  sourceAnchor: string;
  visual: string;
};

function buildDefaultFiveScenePlan({
  analysis,
  documentNoun,
  reportType,
  visualDirection,
  main,
  second,
  third,
  question,
  nextAction,
}: {
  analysis: ClaritiVideoAnalysis;
  documentNoun: string;
  reportType: string;
  visualDirection: string;
  main?: ClaritiVideoAnalysis["keyPoints"][number];
  second?: ClaritiVideoAnalysis["keyPoints"][number];
  third?: ClaritiVideoAnalysis["keyPoints"][number];
  question: string;
  nextAction: string;
}): ScenePlan[] {
  const family = getClaritiKindMeta(analysis.kind).uiFamily;
  return [
    {
      title: "What this document is",
      narration: `Let's walk through this ${documentNoun} together. In plain words: ${analysis.summary}`,
      sourceAnchor: analysis.sourceAnchors[0] || main?.sourceAnchor || "Document header",
      visual: "Show the document header and highlight the opening source phrase being explained.",
    },
    {
      title: family === "clinical_report" ? "What the report focuses on" : family === "money" ? "How the money flows" : "What matters most",
      narration: family === "clinical_report"
        ? `The report is talking about ${reportType}. Match this wording with how you feel when you talk with your clinician.`
        : family === "money"
          ? `The key numbers are ${analysis.metrics.slice(0, 3).map((metric) => `${metric.label}: ${metric.value}`).join(", ") || analysis.summary}.`
          : `Here is what matters most: ${main?.detail ?? analysis.summary}`,
      sourceAnchor: analysis.metrics[0]?.label || main?.sourceAnchor || "Key detail",
      visual: visualDirection,
    },
    {
      title: "Main takeaway",
      narration: `The main takeaway is ${main?.detail ?? analysis.plainEnglish}`,
      sourceAnchor: main?.sourceAnchor || analysis.sourceAnchors[0] || "Main point",
      visual: family === "clinical_report"
        ? visualDirection
        : "Show the most important source-grounded point as a clean explainer card.",
    },
    {
      title: "Another important detail",
      narration: second
        ? `It also notes ${second.detail}`
        : third
          ? `It also notes ${third.detail}`
          : analysis.plainEnglish,
      sourceAnchor: second?.sourceAnchor || third?.sourceAnchor || analysis.sourceAnchors[1] || analysis.sourceAnchors[0] || "Document wording",
      visual: "Show a secondary source phrase and a short plain-English explanation beside it.",
    },
    {
      title: "What to ask next",
      narration: `${getSafetyShortLine(analysis)} A good next step: ${nextAction} Ask: ${question}`,
      sourceAnchor: analysis.sourceAnchors[0] || "Next step",
      visual: "Show a concise next-question checklist with the educational disclaimer.",
    },
  ];
}

function trimNarration(value: string) {
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (cleaned.length <= 220) return cleaned;
  return `${cleaned.slice(0, 217).trim()}...`;
}

export async function designExplainerStoryboard(analysis: ClaritiVideoAnalysis) {
  if (analysis.videoScenes?.length === 5) return analysis.videoScenes;

  const hasGatewayAuth = Boolean(process.env.VERCEL_OIDC_TOKEN || process.env.AI_GATEWAY_API_KEY);
  const hasAnthropicKey = Boolean(process.env.ANTHROPIC_API_KEY);
  if (!hasGatewayAuth && !hasAnthropicKey) {
    return buildDefaultFiveScenePlan({
      analysis,
      documentNoun: getDocumentNoun(analysis),
      reportType: getReportType(analysis),
      visualDirection: getVisualDirection(analysis),
      main: analysis.keyPoints[0],
      second: analysis.keyPoints[1],
      third: analysis.keyPoints[2],
      question: analysis.questions[0] ?? getDefaultQuestion(analysis),
      nextAction: analysis.nextActions[0] ?? "Bring this document to your next conversation with the right person.",
    }).map((scene) => ({
      title: scene.title,
      script: scene.narration,
      visual: scene.visual,
      sourceAnchor: scene.sourceAnchor,
    }));
  }

  try {
    const { anthropic } = await import("@ai-sdk/anthropic");
    const { generateObject } = await import("ai");
    const { claritiSceneSchema } = await import("@/lib/ai/clariti-analysis");
    const { z } = await import("zod");

    const result = await generateObject({
      model: hasGatewayAuth
        ? process.env.AI_GATEWAY_MODEL ?? "anthropic/claude-sonnet-4.6"
        : anthropic(process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5-20250929"),
      schema: z.object({ videoScenes: z.array(claritiSceneSchema).length(5) }),
      // Thinking shares this budget. Claude Opus 5 runs adaptive thinking by
      // default, so a cap tuned for a non-thinking model leaves the visible
      // answer truncated — and for the structured call below that means
      // generateObject throws and the reader gets the regex fallback instead of
      // an explanation. A ceiling is not a target: unused headroom costs nothing.
      maxOutputTokens: 5000,
      temperature: 0.3,
      schemaName: "ClaritiVideoStoryboard",
      schemaDescription: "A five-scene spoken explainer storyboard for one health document.",
      system:
        "You design short spoken video scripts for Clariti. " +
        "Write like a calm friend explaining paperwork. Exactly 5 scenes. " +
        "Each script must be one or two short spoken sentences that fit about six seconds. " +
        "Ground every scene in the provided analysis source anchors. " +
        "Do not diagnose, invent findings, invent charges, or invent coverage decisions.",
      prompt: [
        `Document type: ${analysis.kind} (${getDocumentNoun(analysis)})`,
        `Title: ${analysis.title}`,
        `Summary: ${analysis.summary}`,
        `Plain English: ${analysis.plainEnglish}`,
        `Key points: ${analysis.keyPoints.map((point) => `${point.label}: ${point.detail} [${point.sourceAnchor}]`).join(" | ")}`,
        `Metrics: ${analysis.metrics.map((metric) => `${metric.label}: ${metric.value}`).join(" | ") || "none"}`,
        `Questions: ${analysis.questions.slice(0, 3).join(" | ")}`,
        `Next actions: ${analysis.nextActions.slice(0, 3).join(" | ")}`,
        `Safety note: ${analysis.safetyNote}`,
        "Create 5 scenes in this arc: 1) what this document is, 2) the focus or money flow, 3) main takeaway, 4) another important detail, 5) what to ask next.",
        "Each visual should describe a calm on-screen graphic or document highlight, not medical drama.",
      ].join("\n"),
    });

    return result.object.videoScenes;
  } catch {
    return buildDefaultFiveScenePlan({
      analysis,
      documentNoun: getDocumentNoun(analysis),
      reportType: getReportType(analysis),
      visualDirection: getVisualDirection(analysis),
      main: analysis.keyPoints[0],
      second: analysis.keyPoints[1],
      third: analysis.keyPoints[2],
      question: analysis.questions[0] ?? getDefaultQuestion(analysis),
      nextAction: analysis.nextActions[0] ?? "Bring this document to your next conversation with the right person.",
    }).map((scene) => ({
      title: scene.title,
      script: scene.narration,
      visual: scene.visual,
      sourceAnchor: scene.sourceAnchor,
    }));
  }
}

export function buildHumanPresenterPrompt(
  analysis: ClaritiVideoAnalysis,
  durationSeconds: number,
  options?: { model?: string; script?: string },
) {
  const safeDuration = normalizeVideoDuration(options?.model ?? LEGACY_VEO_MODEL, durationSeconds);
  const findings = analysis.keyPoints
    .slice(0, 4)
    .map((point) => `- ${point.label}: ${point.detail} Source: ${point.sourceAnchor}`)
    .join("\n");
  const questions = analysis.questions.slice(0, 3).map((question) => `- ${question}`).join("\n");
  const documentNoun = getDocumentNoun(analysis);
  const visualDirection = getVisualDirection(analysis);
  // A caller planning segments has already written the narration for this clip;
  // letting the default script through as well would put two competing scripts
  // in one prompt, and on a continuation clip they disagree about where the
  // explainer starts.
  const script = options?.script?.replace(/\s+/g, " ").trim() || buildPresenterScript(analysis, safeDuration);

  return `
Create a realistic ${safeDuration}-second 16:9 human explainer video for a patient reviewing one ${documentNoun}.

This must look like a real human presenter explainer, not a slideshow and not animated slides.
Show a calm healthcare explainer speaking directly to camera in a modern consultation room, with tasteful cutaways to:
- the uploaded report on a screen with the exact source phrases highlighted,
- ${visualDirection},
- clean captions that match the narration,
- a closing checklist of the safest next question or action.

Narration must follow this exact script as closely as possible:
"${script}"

Safety and accuracy rules:
- ${getEducationalDisclaimer(analysis)}
- Do not diagnose, prescribe treatment, or imply certainty beyond the report wording.
- Do not invent findings, anatomy, symptoms, charges, coverage decisions, severity, or urgency.
- Do not show surgery, injury, blood, scans that imply a different body part, hospital drama, or fear-based imagery.
- The presenter may say "the document describes" or "the report describes" when appropriate; never say "you have" as a diagnosis.

Grounding from the saved Clariti analysis:
Title: ${analysis.title}
Summary: ${analysis.summary}
Plain English: ${analysis.plainEnglish}
Key points:
${findings}

Useful clinician questions:
${questions}

Safety caption to include near the end:
${analysis.safetyNote}

Style: premium healthcare product demo, realistic lighting, warm and precise presenter, subtle report overlays, legible captions, no brand logos, no extra medical claims.
`.trim();
}

function buildPresenterScript(analysis: ClaritiVideoAnalysis, durationSeconds: number) {
  const main = analysis.keyPoints[0];
  const question = analysis.questions[0] ?? getDefaultQuestion(analysis);

  // Veo could never be asked for more than eight seconds, so three lines was a
  // full script. A Flux clip runs to twenty, and the same three lines leave the
  // presenter standing in silence for most of it — so the long form walks the
  // whole arc the five-scene storyboard walks.
  if (durationSeconds >= 12) {
    const second = analysis.keyPoints[1];
    const nextAction = analysis.nextActions[0] ?? "Bring this document to your next conversation with the right person.";
    return [
      `Let's walk through this ${getDocumentNoun(analysis)} together.`,
      `In plain words: ${analysis.summary}`,
      `The main thing it says is ${main?.detail ?? analysis.plainEnglish}`,
      second ? `It also notes ${second.detail}` : analysis.plainEnglish,
      getSafetyShortLine(analysis),
      `A good next step: ${nextAction}`,
      `Ask: ${question}`,
    ].join(" ");
  }

  if (durationSeconds >= 8) {
    return [
      `This ${getDocumentNoun(analysis)} says ${main?.detail ?? analysis.summary}`,
      getSafetyShortLine(analysis),
      `Ask: ${question}`,
    ].join(" ");
  }

  return [
    `This ${getDocumentNoun(analysis)} says ${main?.detail ?? analysis.summary}`,
    `Ask: ${question}`,
  ].join(" ");
}

function getReportType(analysis: ClaritiVideoAnalysis) {
  return analysis.metrics.find((metric) => /report type|exam|study/i.test(metric.label))?.value ?? "the radiology report";
}

function getDocumentNoun(analysis: ClaritiVideoAnalysis) {
  return getClaritiKindMeta(analysis.kind).documentNoun;
}

function getVisualDirection(analysis: ClaritiVideoAnalysis) {
  const family = getClaritiKindMeta(analysis.kind).uiFamily;
  if (family === "money" && analysis.kind === "insurance_eob") {
    return "a clean claim-flow visual showing provider billed, plan allowed, insurer paid, and possible patient responsibility using only source-grounded numbers";
  }
  if (family === "money" && analysis.kind === "medical_bill") {
    return "a clean bill-breakdown visual showing total charges, adjustments/payments if present, amount due, and charges to check using only source-grounded numbers";
  }
  if (family === "money") {
    return "a clean decision or money-flow visual using only source-grounded amounts, statuses, and next steps";
  }
  if (family === "lab") {
    return "a clean lab-results visual highlighting key markers and reference-range language from the source text only";
  }
  if (family === "medication") {
    return "a clean medication-list visual showing medicine names, doses, and timing cues from the source text only";
  }
  if (family === "care_plan") {
    return "a clean care-plan visual showing what happened, what to do next, and warning or follow-up cues from the source text only";
  }
  if (family === "clinical_report") {
    return `a clean non-graphic educational illustration tailored to ${getReportType(analysis)} and the source-grounded finding`;
  }
  return "a clean patient-education visual summarizing the main source-grounded takeaway and next question";
}

function getSafetyShortLine(analysis: ClaritiVideoAnalysis) {
  return getClaritiKindMeta(analysis.kind).safetyShort;
}

function getEducationalDisclaimer(analysis: ClaritiVideoAnalysis) {
  return `Educational explanation only. ${getClaritiKindMeta(analysis.kind).educationDisclaimer}`;
}

function getDefaultQuestion(analysis: ClaritiVideoAnalysis) {
  return analysis.questions[0] ?? getClaritiKindMeta(analysis.kind).defaultQuestion;
}
