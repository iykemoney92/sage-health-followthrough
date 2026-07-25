"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, FileUp, Plus, X, Clock3, MessageCircle, CheckCircle2 } from "lucide-react";
import { WhatsAppOpenButton } from "@/components/whatsapp-open-button";

type PlanOption = { id: string; title: string };

type Mode = "new" | "log" | "upload" | null;

function nextAt(hours: number, daysFromNow: number) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  date.setHours(hours, 0, 0, 0);
  return date;
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
  const [intake, setIntake] = useState("");
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
    setIntake("");
  };

  function startWithNura() {
    if (intake.trim()) {
      sessionStorage.setItem("nura-intake", intake.trim());
    }
    router.push("/workspace");
  }

  return (
    <>
      <div className={compact ? "action-stack compact" : "action-stack"}>
        <button onClick={() => setMode("new")}><span className="rail-icon"><MessageCircle /></span><span><b>Start a new Thread</b><small>Tell Nura what&rsquo;s going on</small></span></button>
        {plans.length > 0 && (
          <button onClick={() => { setNote(updateTemplate); setMode("log"); }}>
            <span className="rail-icon blue"><Plus /></span>
            <span><b>Log an update</b><small>Update an existing Thread</small></span>
          </button>
        )}
        <button onClick={() => setMode("upload")}><span className="rail-icon amber"><FileUp /></span><span><b>Share media or files</b><small>Images, voice, notes or results</small></span></button>
      </div>
      {mode && (
        <div className="modal-backdrop" onMouseDown={close}>
          <section className="nura-modal" onMouseDown={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={close}><X /></button>
            {mode === "new" && (
              <>
                <div className="modal-heading">
                  <span className="modal-icon"><MessageCircle /></span>
                  <div>
                    <h2>Start a new Thread</h2>
                    <p>Tell Nura what changed, what you&rsquo;re worried about, or what you want help keeping track of.</p>
                  </div>
                </div>
                <textarea aria-label="Tell Nura what is going on" placeholder="e.g. I saw my GP today and need to monitor my headaches…" value={intake} onChange={(e) => setIntake(e.target.value)} />
                <div className="modal-actions">
                  <button className="secondary-cta" onClick={close}>Cancel</button>
                  <button className="primary-cta" onClick={startWithNura} disabled={!intake.trim()}>Continue with Nura</button>
                </div>
              </>
            )}
            {mode === "log" && (
              <>
                <span className="modal-icon blue"><Plus /></span>
                <h2>Log an update</h2>
                <p>Choose the Thread, then continue with Nura. The message is already prepared so the update stays conversational.</p>
                <label>Related Thread
                  <select
                    value={selectedPlanId}
                    onChange={(e) => {
                      const nextPlan = plans.find((plan) => plan.id === e.target.value);
                      setSelectedPlanId(e.target.value);
                      setNote(nextPlan ? `Update for ${nextPlan.title}: I want to log how things have been since my last check-in. Today, ` : "");
                    }}
                  >
                    {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.title}</option>)}
                  </select>
                </label>
                <label>Prepared message
                  <textarea placeholder="Add a symptom, thought, measurement or note…" value={note} onChange={(e) => setNote(e.target.value)} />
                </label>
                <div className="modal-actions">
                  <button className="secondary-cta" onClick={close}>Cancel</button>
                  <WhatsAppOpenButton message={updateDraft}>WhatsApp</WhatsAppOpenButton>
                  <Link href={workspaceHref} className="primary-cta"><MessageCircle /> Message in app</Link>
                </div>
              </>
            )}
            {mode === "upload" && (
              <>
                <div className="modal-heading">
                  <span className="modal-icon amber"><FileUp /></span>
                  <div>
                    <h2>Share media or files</h2>
                    <p>Send images, voice notes, documents, care instructions or results in the conversation. Nura will use them to update the right Thread.</p>
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

export function RescheduleButton({ planId }: { planId: string }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<"tonight" | "tomorrow" | "custom">("tonight");
  const [customValue, setCustomValue] = useState("");
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function save() {
    setSaving(true);
    try {
      let scheduledFor: Date;
      let label: string;
      if (selected === "tonight") {
        scheduledFor = nextAt(19, 0);
        label = "tonight, 7:30 PM";
      } else if (selected === "tomorrow") {
        scheduledFor = nextAt(18, 1);
        label = "tomorrow, 6:00 PM";
      } else {
        if (!customValue) return;
        scheduledFor = new Date(customValue);
        label = scheduledFor.toLocaleString();
      }

      await fetch("/api/check-ins/reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, scheduledFor: scheduledFor.toISOString(), label }),
      });
      router.refresh();
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button className="secondary-cta" onClick={() => setOpen(true)}>Reschedule</button>
      {open && (
        <div className="modal-backdrop" onMouseDown={() => setOpen(false)}>
          <section className="nura-modal small" onMouseDown={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setOpen(false)}><X /></button>
            <span className="modal-icon"><CalendarDays /></span>
            <h2>Reschedule check-in</h2>
            <div className="time-options">
              <button className={selected === "tonight" ? "selected" : ""} onClick={() => setSelected("tonight")}><Clock3 />Tonight · 7:30 PM</button>
              <button className={selected === "tomorrow" ? "selected" : ""} onClick={() => setSelected("tomorrow")}><Clock3 />Tomorrow · 6:00 PM</button>
              <button className={selected === "custom" ? "selected" : ""} onClick={() => setSelected("custom")}><CalendarDays />Choose another time</button>
            </div>
            {selected === "custom" && (
              <input
                type="datetime-local"
                className="datetime-input"
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
              />
            )}
            <div className="modal-actions">
              <button className="secondary-cta" onClick={() => setOpen(false)}>Cancel</button>
              <button className="primary-cta" onClick={save} disabled={saving || (selected === "custom" && !customValue)}>
                {saving ? "Saving…" : "Save time"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

export function SuccessToast() {
  return <div className="success-toast"><CheckCircle2 /><span><b>Saved</b><small>Your update is organised in this Thread.</small></span></div>;
}
