"use client";

export function MetricChip({ label, value, caveat }: { label: string; value: string; caveat?: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
      {caveat && <small>{caveat}</small>}
    </div>
  );
}
