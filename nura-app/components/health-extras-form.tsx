"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useToast } from "@/components/toast";
import type { HealthContact, HealthMedication } from "@/lib/profile-settings";

export function HealthExtrasForm({
  initialMedications,
  initialContacts,
}: {
  initialMedications: HealthMedication[];
  initialContacts: HealthContact[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [medications, setMedications] = useState(initialMedications);
  const [contacts, setContacts] = useState(initialContacts);
  const [medName, setMedName] = useState("");
  const [medNote, setMedNote] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactRole, setContactRole] = useState("");
  const [contactNote, setContactNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(body: Record<string, unknown>, onOk: () => void) {
    setBusy(true);
    try {
      const res = await fetch("/api/profile/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        toast({ tone: "error", message: "Couldn’t save that. Please try again." });
        return;
      }
      if (data.settings) {
        setMedications(data.settings.medications ?? []);
        setContacts(data.settings.contacts ?? []);
      }
      onOk();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section>
        <h3>Medications</h3>
        <p className="muted">Keep a simple list Nura can reference during follow-ups. This is not a prescription record.</p>
        {medications.length === 0 ? (
          <p className="muted">No medications added yet.</p>
        ) : (
          <div className="health-item-list">
            {medications.map((row) => (
              <div className="health-item-row" key={row.id}>
                <div>
                  <b>{row.name}</b>
                  {row.note ? <small>{row.note}</small> : null}
                </div>
                <button
                  type="button"
                  className="ghost-danger-btn compact"
                  disabled={busy}
                  onClick={() =>
                    void run({ action: "remove_medication", id: row.id }, () =>
                      toast({ title: "Removed", message: "Medication removed from your list." }),
                    )
                  }
                >
                  <Trash2 size={14} /> Remove
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="health-add-form">
          <label>
            Medication
            <input
              value={medName}
              onChange={(event) => setMedName(event.target.value)}
              placeholder="e.g. Amlodipine 5mg"
              disabled={busy}
            />
          </label>
          <label>
            Note (optional)
            <input
              value={medNote}
              onChange={(event) => setMedNote(event.target.value)}
              placeholder="Evening dose, after food…"
              disabled={busy}
            />
          </label>
          <button
            type="button"
            className="secondary-cta"
            disabled={busy || !medName.trim()}
            onClick={() =>
              void run(
                { action: "add_medication", name: medName.trim(), note: medNote.trim() },
                () => {
                  setMedName("");
                  setMedNote("");
                  toast({ title: "Added", message: "Medication saved to your health list." });
                },
              )
            }
          >
            <Plus size={16} /> Add medication
          </button>
        </div>
      </section>

      <section>
        <h3>Care contacts</h3>
        <p className="muted">People or clinics you may want Nura to keep in mind for this account.</p>
        {contacts.length === 0 ? (
          <p className="muted">No care contacts added yet.</p>
        ) : (
          <div className="health-item-list">
            {contacts.map((row) => (
              <div className="health-item-row" key={row.id}>
                <div>
                  <b>{row.name}</b>
                  <small>
                    {row.role}
                    {row.note ? ` · ${row.note}` : ""}
                  </small>
                </div>
                <button
                  type="button"
                  className="ghost-danger-btn compact"
                  disabled={busy}
                  onClick={() =>
                    void run({ action: "remove_contact", id: row.id }, () =>
                      toast({ title: "Removed", message: "Care contact removed." }),
                    )
                  }
                >
                  <Trash2 size={14} /> Remove
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="health-add-form">
          <label>
            Name
            <input
              value={contactName}
              onChange={(event) => setContactName(event.target.value)}
              placeholder="e.g. Dr Patel"
              disabled={busy}
            />
          </label>
          <label>
            Role
            <input
              value={contactRole}
              onChange={(event) => setContactRole(event.target.value)}
              placeholder="GP, pharmacist, therapist…"
              disabled={busy}
            />
          </label>
          <label>
            Note (optional)
            <input
              value={contactNote}
              onChange={(event) => setContactNote(event.target.value)}
              placeholder="Clinic days, phone, etc."
              disabled={busy}
            />
          </label>
          <button
            type="button"
            className="secondary-cta"
            disabled={busy || !contactName.trim()}
            onClick={() =>
              void run(
                {
                  action: "add_contact",
                  name: contactName.trim(),
                  role: contactRole.trim(),
                  note: contactNote.trim(),
                },
                () => {
                  setContactName("");
                  setContactRole("");
                  setContactNote("");
                  toast({ title: "Added", message: "Care contact saved." });
                },
              )
            }
          >
            <Plus size={16} /> Add care contact
          </button>
        </div>
      </section>
    </>
  );
}
