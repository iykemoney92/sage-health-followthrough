"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, MessageCircle, Phone, Smartphone } from "lucide-react";
import { track } from "@/lib/analytics";
import { NURA_PRODUCT } from "@/lib/product/nura-story";
import { saveTryFirst, TRY_FIRST_MAX_CHARS, TRY_FIRST_MIN_CHARS, type TryFirstResult } from "@/lib/try-first";

// Companion first: everyday wellbeing and the people you look out for, not clinics or drugs.
const EXAMPLES = [
  "I’ve been sleeping badly since I changed jobs and I want to get back into a routine.",
  "Work’s been really stressful lately. I’d like someone to check in on me in the evenings.",
  "I want more energy: move more, drink more water, and stop crashing in the afternoon.",
  "Mum lives on her own now and I’d like a gentle check-in on how she’s doing.",
];

const CHANNEL_COPY: Record<TryFirstResult["checkIn"]["channel"], { label: string; Icon: typeof Phone }> = {
  in_app: { label: "in the app", Icon: Smartphone },
  whatsapp: { label: "on WhatsApp", Icon: MessageCircle },
  voice: { label: "with a short call", Icon: Phone },
};

function whenLabel(iso: string) {
  try {
    const date = new Date(iso);
    const day = date.toLocaleDateString(undefined, { weekday: "long" });
    const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    return `${day} at ${time}`;
  } catch {
    return "soon";
  }
}

/**
 * "Try Nura first" on the home page: type what's going on, see the Care plan and first check-in
 * Nura would make, then sign up to keep it. No account and nothing stored until then.
 */
export function TryFirst() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TryFirstResult | null>(null);

  const ready = text.trim().length >= TRY_FIRST_MIN_CHARS;

  const submit = async () => {
    if (!ready || loading) return;
    setLoading(true);
    setError(null);
    track("try_first_submit", { length: text.trim().length });
    try {
      const res = await fetch("/api/try/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = (await res.json().catch(() => null)) as (TryFirstResult & { ok?: boolean; message?: string }) | null;
      if (!res.ok || !data?.ok) {
        setError(data?.message || "Nura couldn’t build that just now. Please try again.");
        track("try_first_error", { status: res.status });
        return;
      }
      setResult({ plan: data.plan, checkIn: data.checkIn });
      track("try_first_result", { channel: data.checkIn.channel });
    } catch {
      setError("Nura couldn’t build that just now. Please try again.");
      track("try_first_error", { status: 0 });
    } finally {
      setLoading(false);
    }
  };

  const keep = () => {
    saveTryFirst(text);
    track("try_first_save_click");
    router.push("/signup?from=try");
  };

  const reset = () => {
    setResult(null);
    setError(null);
    track("try_first_reset");
  };

  if (result) {
    const channel = CHANNEL_COPY[result.checkIn.channel] ?? CHANNEL_COPY.in_app;
    return (
      <div className="try-first-result" aria-live="polite">
        <article className="try-first-plan">
          <span className="try-first-label">Your plan with Nura · preview</span>
          <h3>{result.plan.title}</h3>
          <dl>
            <div>
              <dt>Why it exists</dt>
              <dd>{result.plan.why_this_exists}</dd>
            </div>
            <div>
              <dt>Focus right now</dt>
              <dd>{result.plan.current_focus}</dd>
            </div>
            <div>
              <dt>Next step</dt>
              <dd>{result.plan.next_step}</dd>
            </div>
          </dl>
        </article>
        <article className="try-first-checkin">
          <span className="try-first-label">
            <channel.Icon size={14} /> Nura would check in {whenLabel(result.checkIn.when)}, {channel.label}
          </span>
          <p className="try-first-bubble">{result.checkIn.message}</p>
        </article>
        <div className="try-first-actions">
          <button type="button" className="primary-cta large" onClick={keep}>
            Keep this plan and start check-ins <ArrowRight size={18} />
          </button>
          <button type="button" className="try-first-again" onClick={reset}>
            Try something else
          </button>
        </div>
        <p className="try-first-note">Free to start, and your first check-in is on us. No card needed to sign up.</p>
        <p className="try-first-fineprint">
          Nura is a wellbeing companion, not a medical device. {NURA_PRODUCT.crisisLine}
        </p>
      </div>
    );
  }

  return (
    <form
      className="try-first-form"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <label htmlFor="try-first-text" className="try-first-prompt">
        How are things? Tell Nura the way you’d tell a friend.
      </label>
      <textarea
        id="try-first-text"
        value={text}
        maxLength={TRY_FIRST_MAX_CHARS}
        rows={4}
        placeholder="e.g. I’ve been sleeping badly and want to get back into a routine…"
        onChange={(event) => {
          setText(event.target.value);
          setError(null);
        }}
      />
      <div className="try-first-examples" role="group" aria-label="Examples">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => {
              setText(example);
              setError(null);
              track("try_first_example");
            }}
          >
            {example}
          </button>
        ))}
      </div>
      {error ? <p className="try-first-error" role="alert">{error}</p> : null}
      <div className="try-first-actions">
        <button type="submit" className="primary-cta large" disabled={!ready || loading}>
          {loading ? (
            <>
              <Loader2 size={18} className="spin" /> Nura is thinking…
            </>
          ) : (
            <>
              Show me how Nura would help <ArrowRight size={18} />
            </>
          )}
        </button>
      </div>
      <p className="try-first-fineprint">
        No account needed. To draft this, what you write is sent to Anthropic’s Claude model; nothing is saved
        unless you sign up. Please don’t include names or contact details.
      </p>
    </form>
  );
}
