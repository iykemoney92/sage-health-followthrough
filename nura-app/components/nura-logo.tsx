import Link from "next/link";
import Image from "next/image";

/** Brand mark from nura-app/visuals (bloom / person-in-plant). */
export function NuraMark({
  size = 36,
  className = "",
  priority = false,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      className={`nura-logo-mark ${className}`.trim()}
      src="/brand/nura-mark.png"
      alt=""
      width={size}
      height={size}
      priority={priority}
      aria-hidden="true"
    />
  );
}

export function NuraLogo({
  href = "/",
  compact = false,
  inverse = false,
  tagline = true,
}: {
  href?: string;
  compact?: boolean;
  inverse?: boolean;
  tagline?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`nura-logo ${compact ? "compact" : ""} ${inverse ? "inverse" : ""}`}
      aria-label="Nura home"
    >
      <NuraMark size={compact ? 30 : 40} priority />
      <span className="nura-logo-copy">
        <b>Nura</b>
        {!compact && tagline && <small>Health follow-through</small>}
      </span>
    </Link>
  );
}
