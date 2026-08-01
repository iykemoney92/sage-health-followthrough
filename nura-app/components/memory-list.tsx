"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useToast } from "@/components/toast";

export type MemoryItem = {
  id: string;
  text: string;
  source: string;
  recordedAt: string;
};

export function MemoryList({ items }: { items: MemoryItem[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [rows, setRows] = useState(items);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function remove(id: string) {
    if (busyId) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/observations/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        toast({ tone: "error", message: data?.error || "Couldn’t remove that memory." });
        return;
      }
      setRows((prev) => prev.filter((row) => row.id !== id));
      toast({ title: "Removed", message: "That memory won’t be used in future follow-ups." });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  if (rows.length === 0) {
    return (
      <p className="muted">
        Nothing stored yet. As you message Nura and complete check-ins, useful details will show up here.
      </p>
    );
  }

  return (
    <div className="memory-list">
      {rows.map((row) => (
        <div className="memory-row" key={row.id}>
          <div>
            <span>{row.text}</span>
            <small>
              {row.source} · {row.recordedAt}
            </small>
          </div>
          <button type="button" onClick={() => remove(row.id)} disabled={busyId === row.id} aria-label="Remove memory">
            <Trash2 size={15} /> {busyId === row.id ? "…" : "Remove"}
          </button>
        </div>
      ))}
    </div>
  );
}
