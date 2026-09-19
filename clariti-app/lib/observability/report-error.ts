import { after } from "next/server";

/**
 * Clariti runs with no error tracker of any kind. Every failure used to end at a
 * console.error whose shape was different at every call site, so nothing could be
 * searched, counted or alerted on: a failed extraction on a real scanned bill, a
 * stuck render and a webhook rejected with 401 all read as prose in a log tail
 * nobody opens. This writes one JSON object per failure on one line instead, so
 * Vercel's log search — and any drain pointed at it later — can filter on `tag`
 * and `scope` without parsing English, and optionally mirrors the same record to
 * a webhook so a failure can reach a human on its own.
 */

/** On every record, so one log-search filter finds all of them. */
const TAG = "clariti_error";

/**
 * Context strings are dropped past this length rather than truncated. This
 * product's requests carry medical documents, and an id, a status, a MIME type
 * or a byte count all fit well inside 200 characters while a line of somebody's
 * lab report does not — so anything longer is replaced by its length, which
 * still says something was there without saying what it was. Truncating would
 * have kept the first 200 characters of that report, which is the failure mode
 * this is here to prevent.
 */
const MAX_CONTEXT_STRING_LENGTH = 200;

/** How long the alerting hop gets before it is abandoned. */
const WEBHOOK_TIMEOUT_MS = 3_000;

/**
 * Forwarding budget for a throttled key: this many hops per window, then the
 * rest of the window is logged and not forwarded. The first report of a key
 * always takes the hop, so a failure that happens once a month still reaches a
 * human at once — the budget only ever costs the repeats behind it.
 */
const FORWARD_LIMIT = 2;
const FORWARD_WINDOW_MS = 5 * 60_000;

type ForwardBudget = { windowEndsAt: number; count: number };

/**
 * One counter per reporting site rather than per caller: `throttleKey` is a
 * constant chosen at the call site, never built out of request data. Expired
 * counters are dropped once the map grows past a handful, which is only a
 * backstop in case that stops being true.
 *
 * The counters live in this process. Vercel runs many instances and freezes
 * them between requests, so a flood spread wide enough gets a fresh budget on
 * each one and a cold start begins again at zero: the ceiling is per instance,
 * not global. Read it as what it is — it stops one caller looping as fast as it
 * can from turning every request into an outbound POST, and it is not a hard
 * cap on what the alerting destination can be made to receive. That needs a
 * counter in shared storage, which is a migration and an async reporter.
 */
const forwardBudgets = new Map<string, ForwardBudget>();
const MAX_FORWARD_BUDGETS = 32;

function withinForwardBudget(key: string, now = Date.now()) {
  const existing = forwardBudgets.get(key);
  const budget = existing && existing.windowEndsAt > now
    ? existing
    : { windowEndsAt: now + FORWARD_WINDOW_MS, count: 0 };

  budget.count += 1;
  forwardBudgets.set(key, budget);

  if (forwardBudgets.size > MAX_FORWARD_BUDGETS) {
    for (const [id, entry] of forwardBudgets) {
      if (entry.windowEndsAt <= now) forwardBudgets.delete(id);
    }
  }

  return budget.count <= FORWARD_LIMIT;
}

/**
 * Identifiers and counts only — document id, user id, kind, byte length. Never
 * document text, report content, prompts or email bodies. The scalar-only type
 * is the first half of that guarantee and the length cap above is the second.
 */
export type ErrorContext = Record<string, string | number | boolean | null | undefined>;

export type ReportOptions = {
  /**
   * Ration the webhook hop under this key instead of forwarding every record.
   * Pass it wherever an anonymous caller decides how often the report fires: a
   * public route that reports on rejection otherwise hands whoever calls it one
   * outbound POST per request, at whatever rate they like. Give each such call
   * site its own key, so a flood on a public path cannot spend the budget of a
   * failure nobody outside can trigger. The log line is written either way.
   */
  throttleKey?: string;
};

function describeError(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack ?? null };
  }

  if (typeof error === "string") {
    return { name: "NonError", message: error, stack: null };
  }

  // Supabase and RevenueCat hand back plain objects carrying a message, not
  // Errors. Only that message is read: serialising a whole caught object is how
  // echoed request content — here, somebody's medical document — reaches a log.
  if (error && typeof error === "object" && typeof (error as { message?: unknown }).message === "string") {
    const shape = error as { name?: unknown; message: string };
    return {
      name: typeof shape.name === "string" ? shape.name : "NonError",
      message: shape.message,
      stack: null,
    };
  }

  return { name: "NonError", message: "unknown error", stack: null };
}

function sanitizeContext(context?: ErrorContext) {
  if (!context) return undefined;

  const safe: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(context)) {
    if (value === undefined || value === null) continue;
    safe[key] = typeof value === "string" && value.length > MAX_CONTEXT_STRING_LENGTH
      ? `[dropped ${value.length} chars]`
      : value;
  }

  return Object.keys(safe).length ? safe : undefined;
}

function forwardToWebhook(record: unknown) {
  const url = process.env.CLARITI_ERROR_WEBHOOK_URL;
  if (!url) return;

  const post = () => {
    try {
      void fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(record),
        signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
      }).catch(() => undefined);
    } catch {
      // The .catch covers a rejected request; this covers the throw that happens
      // before there is a promise at all — a malformed URL in the env var, or a
      // runtime without AbortSignal.timeout. Inside after() that throw belongs
      // to the callback, not to this function's try, so it would escape.
    }
  };

  // Never awaited by the caller: the routes that report are mid-response to a
  // user, and an alerting hop that is down must not add its timeout to their
  // request. after() runs the POST once the response is out but before the
  // function can be frozen; outside a request scope — a script importing this —
  // it throws, and the plain fire-and-forget is the fallback.
  try {
    after(post);
  } catch {
    post();
  }
}

export function reportError(
  scope: string,
  error: unknown,
  context?: ErrorContext,
  options?: ReportOptions,
) {
  try {
    const described = describeError(error);
    const record = {
      tag: TAG,
      scope,
      name: described.name,
      message: described.message,
      stack: described.stack,
      context: sanitizeContext(context),
      at: new Date().toISOString(),
    };

    // JSON.stringify escapes the newlines inside a stack, so the record stays on
    // a single line and survives collectors that split output on them.
    console.error(JSON.stringify(record));

    // The line above is unconditional — a throttled report is still diagnosable
    // in the log — and only the hop out of the function is rationed.
    if (!options?.throttleKey || withinForwardBudget(options.throttleKey)) {
      forwardToWebhook(record);
    }
  } catch {
    // A reporter that can break the request it is reporting on is worse than no
    // reporter, so it swallows its own failures and reports nothing about them.
  }
}
