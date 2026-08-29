"use client";

import { Trash2, TriangleAlert, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { getSupabaseBrowserClient } from "@/lib/integrations/supabase-browser";

const CONFIRM_WORD = "DELETE";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

const DANGER_BUTTON = { color: "#9a4637", borderColor: "#f1c9c1" } as const;

const CONFIRM_INPUT = {
  width: "100%",
  height: 44,
  marginTop: 8,
  padding: "0 12px",
  border: "1px solid #dfe7e4",
  borderRadius: 12,
  background: "#fbfdfc",
  letterSpacing: "0.08em",
} as const;

export function DeleteAccountButton() {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        className="settings-signout"
        style={DANGER_BUTTON}
        onClick={() => {
          track("account_delete_open");
          setOpen(true);
        }}
      >
        <Trash2 /> Delete account
      </button>
      {open ? <DeleteAccountDialog onClose={() => setOpen(false)} /> : null}
    </div>
  );
}

function DeleteAccountDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const cardRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    return () => opener?.focus?.();
  }, []);

  function handleKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape" && !deleting) {
      onClose();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = Array.from(cardRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setError("");
    try {
      const response = await fetch("/api/account/delete", { method: "POST" });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        track("account_delete_fail");
        // The route hands back copy meant to be read; the one exception is the 401, which
        // is a machine token because every other route in the app answers with the same one.
        setError(response.status === 401
          ? "Your session has expired. Sign in again, then delete your account."
          : payload?.error ?? "Clariti could not delete your account. Please try again.");
        return;
      }

      track("account_delete_confirm");
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.signOut();
      router.push("/");
      router.refresh();
    } catch {
      setError("Clariti could not reach the server. Check your connection and try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="settings-modal-backdrop" onMouseDown={() => !deleting && onClose()}>
      <section
        ref={cardRef}
        className="settings-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-account-title"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          className="settings-modal-close"
          type="button"
          aria-label="Close"
          onClick={onClose}
          disabled={deleting}
        >
          <X />
        </button>
        <span className="modal-icon" style={{ background: "#fff4f2", color: "#9a4637", marginBottom: 10 }}>
          <TriangleAlert />
        </span>
        <h2 id="delete-account-title">This cannot be undone</h2>
        <p>
          Deleting your account permanently removes every document you have uploaded, the text Clariti read from them,
          every analysis and chat, your explainer videos and illustrations, your scheduled check-ins, and your profile.
          Nothing is recoverable afterwards. Export your data first if you want to keep a copy.
        </p>

        <label htmlFor="delete-account-confirm" style={{ display: "block", color: "#344942", fontSize: 11, fontWeight: 800 }}>
          Type {CONFIRM_WORD} to confirm
        </label>
        <input
          id="delete-account-confirm"
          ref={inputRef}
          value={confirmText}
          onChange={(event) => setConfirmText(event.target.value)}
          placeholder={CONFIRM_WORD}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="characters"
          spellCheck={false}
          disabled={deleting}
          style={CONFIRM_INPUT}
        />

        {/* settings.css styles every direct `p` child of the card, and wins on specificity,
            so the error tone has to be restated here to stay red on the pink panel. */}
        {error ? <p className="auth-error" style={{ marginTop: 12, color: "#9a4637" }} role="alert">{error}</p> : null}

        <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
          <button
            type="button"
            className="settings-signout"
            style={DANGER_BUTTON}
            onClick={() => void handleDelete()}
            disabled={deleting || confirmText.trim() !== CONFIRM_WORD}
          >
            {deleting ? "Deleting your account..." : "Permanently delete my account"}
          </button>
          <button type="button" className="settings-signout" onClick={onClose} disabled={deleting}>
            Keep my account
          </button>
        </div>
      </section>
    </div>
  );
}
