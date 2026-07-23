"use client";

import { X } from "lucide-react";
import { ReactNode, useState } from "react";

export function PrototypeAction({
  label,
  title,
  description,
  children,
  className = "app-btn outline",
}: {
  label: ReactNode;
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>{label}</button>
      {open && (
        <div className="prototype-overlay" role="presentation" onMouseDown={() => setOpen(false)}>
          <section className="prototype-dialog" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
            <button type="button" className="prototype-close" onClick={() => setOpen(false)} aria-label="Close"><X /></button>
            <div className="panel-label">SAGE PROTOTYPE</div>
            <h2>{title}</h2>
            {description && <p className="muted">{description}</p>}
            <div className="prototype-dialog-body">{children ?? <p>This interaction is represented in the frontend prototype. The live integration will be connected during the hackathon build.</p>}</div>
            <div className="prototype-dialog-actions"><button className="app-btn primary" type="button" onClick={() => setOpen(false)}>Done</button></div>
          </section>
        </div>
      )}
    </>
  );
}
