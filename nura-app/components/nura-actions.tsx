"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, FileUp, Plus, X, Clock3, MessageCircle } from "lucide-react";
import { WhatsAppOpenButton } from "@/components/whatsapp-open-button";
import { useToast } from "@/components/toast";
import { formatCheckInWhen } from "@/lib/domain/journey-naming";

type PlanOption = { id: string; title: string };

type Mode = "log" | "upload" | null;
type RescheduleChoice = "tonight" | "tomorrow" | "custom";

function nextAt(hours: number, minutes: number, daysFromNow: number) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function toDatetimeLocalValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function friendlyLabel(date: Date) {
  return formatCheckInWhen(date.toISOString());
}

export function NuraActions({
  compact = false,
  plans = [],
}: {
  compact?: boolean;
  plans?: PlanOption[];
}) {
  const [mode, setMode] = useState<Mode>(null);
  const [selectedPlanId, setSelectedPlanId] = useState(plans[0]?.id ?? "");
  const [note, setNote] = useState("");
  const router = useRouter();
  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) ?? plans[0];
  const updateTemplate = selectedPlan
    ? `Update for ${selectedPlan.title}: I want to log how things have been since my last check-in. Today, `
    : "";
  const updateDraft = note || updateTemplate;
  const workspaceHref = selectedPlan
    ? `/workspace?planId=${encodeURIComponent(selectedPlan.id)}&planTitle=${encodeURIComponent(selectedPlan.title)}&draft=${encodeURIComponent(updateDraft)}`
    : "/workspace";
  const close = () => {
    setMode(null);
    setNote("");
  };

  return (
    <>
      <div className={compact ? "action-stack compact" : "action-stack"}>
        <button onClick={() => router.push("/plans/new")}>
          <span className="rail-icon"><MessageCircle /></span>
          <span><b>Start a new Care plan</b><small>Guided setup from what&rsquo;s going on</small></span>
        </button>
        {plans.length > 0 && (
          <button onClick={() => { setNote(updateTemplate); setMode("log"); }}>
            <span className="rail-icon blue"><Plus /></span>
            <span><b>Log an update</b><small>Update an existing Care plan</small></span>
          </button>
        )}
        <button onClick={() => setMode("upload")}><span className="rail-icon amber"><FileUp /></span><span><b>Share media or files</b><small>Images, voice, notes or results</small></span></button>
      </div>
      {mode && (
        <div className="modal-backdrop" onMouseDown={close}>
          <section className="nura-modal" onMouseDown={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={close}><X /></button>
            {mode === "log" && (
              <>
                <div className="modal-heading">
                  <span className="modal-icon blue"><Plus /></span>
                  <div>
                    <h2>Log an update</h2>
                    <p>Choose the Care plan, then continue with Nura. The message is already prepared so the update stays conversational.</p>
                  </div>
                </div>
                <div className="modal-fields">
                  <label>
                    <span className="field-label">Related Care plan</span>
                    <select
                      value={selectedPlanId}
                      onChange={(e) => {
                        const nextPlan = plans.find((plan) => plan.id === e.target.value);
                        setSelectedPlanId(e.target.value);
                        setNote(
                          nextPlan
                            ? `Update for ${nextPlan.title}: I want to log how things have been since my last check-in. Today, `
                            : "",
                        );
                      }}
                    >
                      {plans.map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          {plan.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="field-label">Prepared message</span>
                    <textarea
                      placeholder="Add a symptom, thought, measurement or note…"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </label>
                </div>
                <div className="modal-actions modal-actions-triple">
                  <button type="button" className="secondary-cta" onClick={close}>
                    Cancel
                  </button>
                  <WhatsAppOpenButton message={updateDraft}>WhatsApp</WhatsAppOpenButton>
                  <Link href={workspaceHref} className="primary-cta">
                    <MessageCircle /> Message in app
                  </Link>
                </div>
              </>
            )}
            {mode === "upload" && (
              <>
                <div className="modal-heading">
                  <span className="modal-icon amber"><FileUp /></span>
                  <div>
                    <h2>Share media or files</h2>
                    <p>Send images, voice notes, documents, care instructions or results in the conversation. Nura will use them to update the right Care plan.</p>
                  </div>
                </div>
                <Link href="/workspace" className="drop-zone upload-drop-zone">
                  <FileUp />
                  <b>Open messaging to attach files</b>
                  <span>Images, voice notes, PDFs, documents and notes are added inside the conversation.</span>
                </Link>
                <div className="modal-actions">
                  <button className="secondary-cta" onClick={close}>Cancel</button>
                  <Link href="/workspace" className="primary-cta">Open messaging</Link>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}

export function RescheduleButton({
  planId,
  onRescheduled,
}: {
  planId: string;
  /** Called after a successful reschedule (e.g. refresh a client-fetched calendar). */
  onRescheduled?: (scheduledFor: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [selected, setSelected] = useState<RescheduleChoice>("tomorrow");
  const [customValue, setCustomValue] = useState("");
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const tonight = nextAt(19, 30, 0);
  const tomorrow = nextAt(18, 0, 1);
  const now = new Date();
  const tonightAvailable = tonight.getTime() > now.getTime() + 5 * 60_000;

  useEffect(() => {
    // Portals need document.body, which only exists client-side after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  function openModal() {
    const defaultChoice: RescheduleChoice = tonightAvailable ? "tonight" : "tomorrow";
    setSelected(defaultChoice);
    setCustomValue(toDatetimeLocalValue(nextAt(19, 30, tonightAvailable ? 0 : 1)));
    setOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setOpen(false);
  }

  async function save() {
    let scheduledFor: Date;
    if (selected === "tonight") {
      if (!tonightAvailable) {
        toast({ tone: "error", message: "Tonight’s slot has already passed." });
        return;
      }
      scheduledFor = tonight;
    } else if (selected === "tomorrow") {
      scheduledFor = tomorrow;
    } else {
      if (!customValue) {
        toast({ tone: "error", message: "Pick a date and time first." });
        return;
      }
      scheduledFor = new Date(customValue);
      if (Number.isNaN(scheduledFor.getTime()) || scheduledFor.getTime() < Date.now() + 60_000) {
        toast({ tone: "error", message: "Choose a time at least a minute from now." });
        return;
      }
    }

    const label = friendlyLabel(scheduledFor);
    setSaving(true);
    try {
      const res = await fetch("/api/check-ins/reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, scheduledFor: scheduledFor.toISOString(), label }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        const message =
          typeof data?.error === "string" && data.error.includes("future")
            ? "Choose a time in the future."
            : "Could not reschedule. Please try again.";
        toast({ tone: "error", message });
        return;
      }
      toast({ title: "Rescheduled", message: `Check-in moved to ${label}.` });
      setOpen(false);
      if (typeof data?.scheduledFor === "string") {
        onRescheduled?.(data.scheduledFor);
      } else {
        onRescheduled?.(scheduledFor.toISOString());
      }
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const modal =
    open && mounted
      ? createPortal(
          <div className="modal-backdrop" onMouseDown={closeModal} role="presentation">
            <section
              className="nura-modal small reschedule-modal"
              onMouseDown={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="reschedule-title"
            >
              <button type="button" className="modal-close" onClick={closeModal} aria-label="Close">
                <X />
              </button>
              <div className="modal-heading">
                <span className="modal-icon">
                  <CalendarDays />
                </span>
                <div>
                  <h2 id="reschedule-title">Reschedule check-in</h2>
                  <p>Pick a time that works better. Nura will follow up then.</p>
                </div>
              </div>
              <div className="time-options" role="radiogroup" aria-label="Suggested times">
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected === "tonight"}
                  className={selected === "tonight" ? "selected" : ""}
                  disabled={!tonightAvailable}
                  onClick={() => setSelected("tonight")}
                >
                  <Clock3 />
                  <span>
                    <b>Tonight · 7:30 PM</b>
                    <small>{tonightAvailable ? "Later today" : "Already passed"}</small>
                  </span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected === "tomorrow"}
                  className={selected === "tomorrow" ? "selected" : ""}
                  onClick={() => setSelected("tomorrow")}
                >
                  <Clock3 />
                  <span>
                    <b>Tomorrow · 6:00 PM</b>
                    <small>Next evening</small>
                  </span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected === "custom"}
                  className={selected === "custom" ? "selected" : ""}
                  onClick={() => setSelected("custom")}
                >
                  <CalendarDays />
                  <span>
                    <b>Choose another time</b>
                    <small>Pick any date and time</small>
                  </span>
                </button>
              </div>
              {selected === "custom" && (
                <label className="datetime-field">
                  Date and time
                  <input
                    type="datetime-local"
                    className="datetime-input"
                    value={customValue}
                    min={toDatetimeLocalValue(new Date(now.getTime() + 60_000))}
                    onChange={(e) => setCustomValue(e.target.value)}
                  />
                </label>
              )}
              <div className="modal-actions">
                <button type="button" className="secondary-cta" onClick={closeModal} disabled={saving}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="primary-cta"
                  onClick={save}
                  disabled={saving || (selected === "custom" && !customValue) || (selected === "tonight" && !tonightAvailable)}
                >
                  {saving ? "Saving…" : "Save time"}
                </button>
              </div>
            </section>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button type="button" className="secondary-cta" onClick={openModal}>
        Reschedule
      </button>
      {modal}
    </>
  );
}
