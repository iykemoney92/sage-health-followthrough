"use client";

import type { ReactNode } from "react";
import type { ClaritiSeverityToken } from "@/lib/domain/clariti-severity";

export function SeverityBadge({
  token,
  label,
  icon,
}: {
  token: ClaritiSeverityToken;
  label: string;
  icon?: ReactNode;
}) {
  return (
    <span className={`sev-badge sev-${token}`}>
      {icon}
      {label}
    </span>
  );
}
