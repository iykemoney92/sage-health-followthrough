"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, MoreHorizontal } from "lucide-react";

export function ThreadRowMenu({ planId, status }: { planId: string; status: string }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const isArchived = status === "archived";

  useEffect(() => {
    if (!open) return;
    function onClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  async function setStatus(nextStatus: "active" | "archived") {
    setSaving(true);
    try {
      const res = await fetch(`/api/plans/${planId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="thread-row-menu" ref={ref}>
      <button
        type="button"
        className="thread-row-more-btn"
        aria-label="Care plan options"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        <MoreHorizontal />
      </button>
      {open && (
        <div className="thread-row-menu-popover" role="menu" onClick={(event) => event.preventDefault()}>
          {isArchived ? (
            <button type="button" role="menuitem" disabled={saving} onClick={(event) => { event.stopPropagation(); void setStatus("active"); }}>
              <ArchiveRestore /> Move to Active
            </button>
          ) : (
            <button type="button" role="menuitem" disabled={saving} onClick={(event) => { event.stopPropagation(); void setStatus("archived"); }}>
              <Archive /> Archive Care plan
            </button>
          )}
        </div>
      )}
    </div>
  );
}
