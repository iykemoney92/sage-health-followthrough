"use client";

import Link from "next/link";
import { ArrowRight, CircleAlert, CircleCheck, Info } from "lucide-react";
import { useId, useRef, useState, type FormEvent } from "react";
import { WebOnly } from "@/components/web-only";
import { track } from "@/lib/analytics";
import {
  EOB_FIELDS,
  FIELD_LABELS,
  decodeEob,
  emptyFigures,
  formatCents,
  hasEnough,
  parseDollars,
  parseEobText,
  type CareSetting,
  type EobField,
  type EobResult,
  type NetworkStatus,
  type Tone,
} from "@/lib/tools/eob-decoder";
import { APP_STORE_URL } from "@/lib/content/guide-links";

// The working tool. Nothing here leaves the browser: no fetch, no storage.
// The wrapper carries ph-mask/ph-sensitive like the home composer, so session
// recordings never show the figures, and the analytics events carry only the
// tool's name.

const TOOL = "eob-decoder";
const UTM = "utm_source=site&utm_medium=web&utm_campaign=clariti_nov26&utm_content=tool-eob-decoder";
const CTA_HREF = `/?${UTM}`;
const PLAY_HREF = `https://play.google.com/store/apps/details?id=app.useclariti.mobile&referrer=${encodeURIComponent(UTM)}`;

const HINTS: Record<EobField, string> = {
  billed: "Also “provider charges” or “total charges”.",
  allowed: "Also “plan allowance”, “eligible amount” or “negotiated rate”.",
  planPaid: "Also “paid by plan” or “insurance paid”.",
  deductible: "The part “applied to deductible”.",
  copay: "A flat amount, such as $30.",
  coinsurance: "Your percentage share, shown in dollars.",
  notCovered: "Only if the EOB shows one.",
  eobOwe: "Also “you may owe” or “your share”. Optional: used to check the parts.",
  bill: "From the provider’s bill for the same date and service. Optional.",
};

const GROUPS: { legend: string; fields: EobField[] }[] = [
  { legend: "From the EOB line", fields: ["billed", "allowed", "planPaid"] },
  { legend: "Your share, as the EOB splits it", fields: ["deductible", "copay", "coinsurance", "notCovered", "eobOwe"] },
  { legend: "From the provider’s bill", fields: ["bill"] },
];

const SETTINGS: { value: CareSetting; label: string }[] = [
  { value: "other", label: "None of these, or not sure" },
  { value: "emergency", label: "Emergency room care" },
  { value: "in-network-facility", label: "At an in-network hospital or surgery center" },
  { value: "air-ambulance", label: "Air ambulance" },
  { value: "ground-ambulance", label: "Ground ambulance" },
];

type Raw = Record<EobField, string>;
const emptyRaw = () => Object.fromEntries(EOB_FIELDS.map((field) => [field, ""])) as Raw;

const toRaw = (cents: number) => (cents / 100).toFixed(2);

export function EobDecoderTool() {
  const id = useId();
  const [raw, setRaw] = useState<Raw>(emptyRaw);
  const [network, setNetwork] = useState<NetworkStatus>("in");
  const [setting, setSetting] = useState<CareSetting>("other");
  const [paste, setPaste] = useState("");
  const [pasteNote, setPasteNote] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<EobResult | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const invalid = EOB_FIELDS.filter((field) => Number.isNaN(parseDollars(raw[field])));

  const update = (field: EobField, value: string) => setRaw((current) => ({ ...current, [field]: value }));

  const readPaste = () => {
    const { figures, found } = parseEobText(paste);
    if (found.length === 0) {
      setPasteNote(
        "No labelled amounts found. This box reads lines like “Allowed amount $180.00”; if your EOB is a table, type the figures into the boxes below instead.",
      );
      return;
    }
    setRaw((current) => {
      const next = { ...current };
      for (const field of found) next[field] = toRaw(figures[field]!);
      return next;
    });
    setPasteNote(
      `Filled ${found.length} box${found.length === 1 ? "" : "es"}: ${found.map((field) => FIELD_LABELS[field]).join(", ")}. Check each one against your EOB before you rely on the result.`,
    );
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (invalid.length > 0) {
      setError(`Check ${invalid.map((field) => FIELD_LABELS[field]).join(", ")}: use numbers only, such as 180 or 180.00.`);
      return;
    }
    const figures = emptyFigures();
    for (const field of EOB_FIELDS) figures[field] = parseDollars(raw[field]);
    if (!hasEnough(figures)) {
      setError("Enter at least your share (deductible, copay, coinsurance or the patient responsibility total), or the allowed amount and plan paid.");
      return;
    }
    setError("");
    setResult(decodeEob({ figures, network, setting }));
    track("tool_used", { tool: TOOL });
    requestAnimationFrame(() => resultRef.current?.focus());
  };

  const reset = () => {
    setRaw(emptyRaw());
    setResult(null);
    setError("");
    setPaste("");
    setPasteNote("");
  };

  return (
    <div className="eob-tool ph-mask ph-sensitive">
      <details className="eob-paste">
        <summary>Paste text from your EOB instead</summary>
        <label htmlFor={`${id}-paste`}>
          Copy the text of one claim line from your insurer’s portal or a PDF. It is read on this device, never sent anywhere.
        </label>
        <textarea
          id={`${id}-paste`}
          rows={5}
          value={paste}
          onChange={(event) => setPaste(event.target.value)}
          placeholder={"Amount billed $310.00\nAllowed amount $180.00\nPlan paid $140.00\nCopay $40.00"}
        />
        <button type="button" className="eob-secondary" onClick={readPaste} disabled={!paste.trim()}>
          Find the figures
        </button>
        {pasteNote && (
          <p className="eob-note" role="status">
            {pasteNote}
          </p>
        )}
      </details>

      <form onSubmit={submit} noValidate>
        {GROUPS.map((group) => (
          <fieldset key={group.legend} className="eob-group">
            <legend>{group.legend}</legend>
            <div className="eob-fields">
              {group.fields.map((field) => (
                <div key={field} className="eob-field">
                  <label htmlFor={`${id}-${field}`}>{FIELD_LABELS[field]}</label>
                  <div className="eob-money">
                    <span aria-hidden="true">$</span>
                    <input
                      id={`${id}-${field}`}
                      inputMode="decimal"
                      autoComplete="off"
                      value={raw[field]}
                      onChange={(event) => update(field, event.target.value)}
                      aria-describedby={`${id}-${field}-hint`}
                      aria-invalid={invalid.includes(field) || undefined}
                    />
                  </div>
                  <small id={`${id}-${field}-hint`}>{HINTS[field]}</small>
                </div>
              ))}
            </div>
          </fieldset>
        ))}

        <fieldset className="eob-group">
          <legend>About the provider</legend>
          <fieldset className="eob-choices">
            <legend>Was the provider in your plan’s network?</legend>
            {(
              [
                ["in", "In-network"],
                ["out", "Out-of-network"],
                ["unsure", "Not sure"],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="eob-choice">
                <input type="radio" name={`${id}-network`} value={value} checked={network === value} onChange={() => setNetwork(value)} />
                {label}
              </label>
            ))}
          </fieldset>
          <div className="eob-field">
            <label htmlFor={`${id}-setting`}>Was this care one of these?</label>
            <select id={`${id}-setting`} value={setting} onChange={(event) => setSetting(event.target.value as CareSetting)}>
              {SETTINGS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <small>Used only to say whether the No Surprises Act may apply.</small>
          </div>
        </fieldset>

        {error && (
          <p className="eob-error" role="alert">
            {error}
          </p>
        )}
        <div className="eob-actions">
          <button type="submit" className="eob-primary">
            Decode my EOB
          </button>
          <button type="button" className="eob-secondary" onClick={reset}>
            Clear
          </button>
        </div>
      </form>

      <div ref={resultRef} tabIndex={-1} className="eob-result" aria-live="polite">
        {result && <ResultView result={result} />}
      </div>

      {result && (
        <section className="guide-cta" aria-label="Try Clariti">
          <p>
            Want the whole EOB explained, not just one line? Attach it or take a photo, and Clariti explains every line in
            plain words, quoting your document, flags anything worth checking and suggests what to ask your insurer or the
            billing office.
          </p>
          <div className="guide-cta-actions">
            <Link className="guide-cta-primary" href={CTA_HREF} onClick={() => track("tool_cta_click", { tool: TOOL })}>
              Explain my whole EOB <ArrowRight aria-hidden="true" />
            </Link>
          </div>
          <WebOnly>
            <p className="guide-cta-note">
              Your first 3 analyses are free. Also on <a href={PLAY_HREF}>Android</a> and <a href={APP_STORE_URL}>iPhone</a>.
            </p>
          </WebOnly>
        </section>
      )}
    </div>
  );
}

const ICONS: Record<Tone, typeof Info> = { ok: CircleCheck, check: CircleAlert, info: Info };

function FindingList({ items }: { items: { tone: Tone; title: string; detail: string }[] }) {
  return (
    <ul className="eob-findings">
      {items.map((item) => {
        const Icon = ICONS[item.tone];
        return (
          <li key={item.title} className={`eob-finding eob-${item.tone}`}>
            <Icon aria-hidden="true" />
            <div>
              <b>{item.title}</b>
              <p>{item.detail}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function ResultView({ result }: { result: EobResult }) {
  const share = result.patientResponsibility ?? result.compareWith;
  return (
    <>
      <h2>Your result</h2>
      {share !== null && (
        <p className="eob-total">
          <span>What the EOB says you may owe the provider</span>
          <b>{formatCents(share)}</b>
          <small>
            {result.patientResponsibility !== null
              ? "Deductible + copay + coinsurance + not covered."
              : "Allowed amount less what the plan paid."}{" "}
            Pay the provider’s bill, not the EOB, once you have checked they match.
          </small>
        </p>
      )}

      {result.bill.verdict !== "none" && (
        <>
          <h3>Does the bill match?</h3>
          <FindingList items={result.bill.findings} />
        </>
      )}

      {result.checks.length > 0 && (
        <>
          <h3>Do the figures add up?</h3>
          <FindingList items={result.checks} />
        </>
      )}

      <h3>What each number means</h3>
      <dl className="guide-parts">
        {result.readings.map((reading) => (
          <div key={reading.field}>
            <dt>
              {reading.label}: <span className="eob-figure">{formatCents(reading.cents)}</span>
            </dt>
            <dd>{reading.meaning}</dd>
          </div>
        ))}
      </dl>
      <p className="guide-aside">General information, not insurance or legal advice. Your plan documents and insurer have the final word.</p>
    </>
  );
}
