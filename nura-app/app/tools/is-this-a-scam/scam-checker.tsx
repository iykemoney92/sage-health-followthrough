"use client";

import { useId, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import {
  CLAIMS,
  EMPTY_ANSWERS,
  checkMessage,
  type Answer,
  type ScamAnswers,
  type ScamResult,
} from "@/lib/tools/scam-check";

const TOOL = "is-this-a-scam";

const QUESTIONS: { key: "unexpected" | "money" | "pressure" | "linkOrNumber"; label: string; hint: string }[] = [
  { key: "unexpected", label: "Did they contact you out of the blue?", hint: "A message or call you weren't expecting." },
  {
    key: "money",
    label: "Do they want money, gift cards, crypto, bank details or a code?",
    hint: "Including a card number, a PIN or a code sent to your phone.",
  },
  {
    key: "pressure",
    label: "Is there pressure to act now, or to keep it quiet?",
    hint: "\"Today or your account closes\", \"don't tell anyone\".",
  },
  {
    key: "linkOrNumber",
    label: "Is there a link to tap or a number to call back?",
    hint: "Or an app they want you to download.",
  },
];

const ANSWER_LABELS: { value: Answer; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "unsure", label: "Not sure" },
];

/** The pasted text with each matched phrase wrapped in <mark>. */
function Highlighted({ text, result }: { text: string; result: ScamResult }) {
  const parts: React.ReactNode[] = [];
  let at = 0;
  result.spans.forEach((span, i) => {
    if (span.start > at) parts.push(text.slice(at, span.start));
    parts.push(
      <mark key={i} className="scam-mark">
        {text.slice(span.start, span.end)}
      </mark>,
    );
    at = span.end;
  });
  if (at < text.length) parts.push(text.slice(at));
  return <p className="scam-highlighted">{parts}</p>;
}

/**
 * The scam message checker. Everything happens in this component: no network requests, no
 * storage. Analytics events carry only the result level and counts, never the text.
 */
export function ScamChecker() {
  const [text, setText] = useState("");
  const [answers, setAnswers] = useState<ScamAnswers>(EMPTY_ANSWERS);
  const [result, setResult] = useState<{ result: ScamResult; text: string } | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const id = useId();

  function setAnswer<K extends keyof ScamAnswers>(key: K, value: ScamAnswers[K]) {
    setAnswers((current) => ({ ...current, [key]: value }));
  }

  function onCheck(e: React.FormEvent) {
    e.preventDefault();
    const checked = checkMessage(text, answers);
    setResult({ result: checked, text: text.slice(0, 5000) });
    track("tool_used", {
      tool: TOOL,
      action: "check",
      level: checked.level,
      flags: checked.flags.length,
      has_text: text.trim().length > 0,
    });
    // Move focus to the result so keyboard and screen reader users land on it.
    requestAnimationFrame(() => resultRef.current?.focus());
  }

  function onReset() {
    setText("");
    setAnswers(EMPTY_ANSWERS);
    setResult(null);
  }

  const nothingEntered =
    text.trim().length === 0 &&
    answers.claim === "none" &&
    QUESTIONS.every((q) => answers[q.key] === "unsure");

  return (
    <div className="scam-tool">
      <form className="big-panel" onSubmit={onCheck} aria-describedby={`${id}-privacy`}>
        <label className="big-field" htmlFor={`${id}-text`}>
          <span>Paste the message, or describe the call</span>
        </label>
        <textarea
          id={`${id}-text`}
          className="big-textarea ph-no-capture"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={7}
          maxLength={5000}
          placeholder={'For example: "Royal Mail: your parcel is on hold, pay £1.45 at…" or "A man rang saying he was from my bank and asked me to move my savings."'}
          autoComplete="off"
          spellCheck={false}
        />
        <p className="big-hint" id={`${id}-privacy`}>
          Checked on this device only. Nothing you paste is sent or saved. Remove names, account numbers and
          addresses if you like; the checker doesn&apos;t need them.
        </p>

        <h2 className="big-subhead">A few quick questions</h2>
        {QUESTIONS.map((q) => (
          <fieldset key={q.key} className="big-fieldset">
            <legend>{q.label}</legend>
            <p className="big-hint">{q.hint}</p>
            <div className="big-choices">
              {ANSWER_LABELS.map((a) => (
                <label key={a.value} className="big-choice">
                  <input
                    type="radio"
                    name={`${id}-${q.key}`}
                    value={a.value}
                    checked={answers[q.key] === a.value}
                    onChange={() => setAnswer(q.key, a.value)}
                  />
                  <span>{a.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}

        <label className="big-field" htmlFor={`${id}-claim`}>
          <span>Who do they say they are?</span>
        </label>
        <select
          id={`${id}-claim`}
          className="big-select"
          value={answers.claim}
          onChange={(e) => setAnswer("claim", e.target.value as ScamAnswers["claim"])}
        >
          {CLAIMS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>

        <div className="big-actions">
          <button type="submit" className="big-button" disabled={nothingEntered}>
            Check for warning signs
          </button>
          {(result || !nothingEntered) && (
            <button type="button" className="big-button big-button-quiet" onClick={onReset}>
              Start again
            </button>
          )}
        </div>
        {nothingEntered && <p className="big-hint">Paste a message or answer a question to start.</p>}
      </form>

      <div className="scam-result-wrap" aria-live="polite">
        {result && (
          <div
            ref={resultRef}
            tabIndex={-1}
            className={`scam-result scam-result-${result.result.level}`}
            aria-labelledby={`${id}-result-heading`}
          >
            <h2 id={`${id}-result-heading`}>{result.result.heading}</h2>
            <p>{result.result.summary}</p>

            <div className="scam-urgent" role="note">
              <b>Already paid, or shared bank details or a code?</b> Contact your bank straight away, using the number on
              your card or statement, not one from the message. In the UK you can also call 159 to reach most banks.
            </div>

            {result.result.flags.length > 0 && (
              <>
                <h3>What we noticed</h3>
                <ul className="scam-flags">
                  {result.result.flags.map((flag) => (
                    <li key={flag.id}>
                      <b>{flag.label}</b>
                      <span>{flag.why}</span>
                      {flag.phrases.length > 0 && (
                        <span className="scam-phrases">
                          Found:{" "}
                          {flag.phrases.map((p, i) => (
                            <q key={i}>{p}</q>
                          ))}
                        </span>
                      )}
                      {flag.phrases.length === 0 && <span className="scam-phrases">From your answers</span>}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {result.text.trim() && result.result.spans.length > 0 && (
              <>
                <h3>Your message, with the warning signs marked</h3>
                <Highlighted text={result.text} result={result.result} />
              </>
            )}

            <p className="big-hint">
              This checker looks for common patterns. It can&apos;t tell you a message is genuine, and it can miss new
              tricks. If in doubt, don&apos;t reply, and check with the person or company another way.
            </p>
            <p>
              <a href="#next-steps" className="scam-next-link">
                Who to tell and what to do next ↓
              </a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
