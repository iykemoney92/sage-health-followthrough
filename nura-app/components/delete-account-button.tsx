"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, X } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/integrations/supabase-browser";

export function DeleteAccountButton() {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleDelete() {
    setDeleting(true);
    setError("");
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "Could not delete your account. Please try again.");
        return;
      }
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.signOut();
      router.push("/");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <button className="danger-button" onClick={() => setOpen(true)}>Delete account</button>
      {open && (
        <div className="modal-backdrop" onMouseDown={() => !deleting && setOpen(false)}>
          <section className="nura-modal small" onMouseDown={(e) => e.stopPropagation()}>
            <button className="modal-close" aria-label="Close" onClick={() => setOpen(false)} disabled={deleting}><X /></button>
            <span className="modal-icon danger"><AlertTriangle /></span>
            <h2>Delete your account?</h2>
            <p>This permanently deletes every Care plan, message, check-in, and document you&apos;ve shared with Nura. This cannot be undone.</p>
            <label htmlFor="confirm-delete">Type <b>DELETE</b> to confirm</label>
            <input
              id="confirm-delete"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              disabled={deleting}
            />
            {error && <p className="auth-error">{error}</p>}
            <div className="modal-actions">
              <button className="secondary-cta" onClick={() => setOpen(false)} disabled={deleting}>Cancel</button>
              <button
                className="danger-button"
                onClick={handleDelete}
                disabled={deleting || confirmText !== "DELETE"}
              >
                {deleting ? "Deleting…" : "Permanently delete"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
