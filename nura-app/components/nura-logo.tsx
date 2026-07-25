import Link from "next/link";

export function NuraMark({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    <svg className={`nura-logo-mark ${className}`} width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="46" height="46" rx="14" fill="currentColor" opacity=".10"/>
      <path d="M23.7 38.5c.2-8.7 1.1-15.5 5.8-22.2" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/>
      <path d="M24.4 29.5c-7.9-.5-12.3-5.2-12.9-13.6 8.5-.1 13.2 4.6 12.9 13.6Z" fill="currentColor" opacity=".9"/>
      <path d="M26.1 23.3c.3-7.7 4.7-12 12.6-12.8.5 8-3.9 12.4-12.6 12.8Z" fill="currentColor" opacity=".62"/>
      <path d="M24.1 36.4c-5.2-.5-8.1-3.6-8.4-9.1 5.5.1 8.5 3.1 8.4 9.1Z" fill="currentColor" opacity=".48"/>
      <circle cx="24" cy="39" r="2.1" fill="currentColor"/>
    </svg>
  );
}

export function NuraLogo({ href = "/", compact = false, inverse = false }: { href?: string; compact?: boolean; inverse?: boolean }) {
  return (
    <Link href={href} className={`nura-logo ${compact ? "compact" : ""} ${inverse ? "inverse" : ""}`} aria-label="Nura home">
      <NuraMark size={compact ? 30 : 40}/>
      <span className="nura-logo-copy"><b>Nura</b>{!compact && <small>Your AI health companion</small>}</span>
    </Link>
  );
}