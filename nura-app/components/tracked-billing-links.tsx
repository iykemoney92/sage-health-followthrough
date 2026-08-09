"use client";

import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";
import { track } from "@/lib/analytics";

type TrackedCheckoutLinkProps = {
  href: string;
  source: string;
  cta: string;
  className?: string;
  children: ReactNode;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "children">;

/** Fires checkout funnel events then navigates to the billing checkout URL. */
export function TrackedCheckoutLink({
  href,
  source,
  cta,
  children,
  onClick,
  ...rest
}: TrackedCheckoutLinkProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    const returnTo = href.includes("return=locked") ? "locked" : "default";
    track("upgrade_cta_click", { source, cta, return: returnTo });
    track("checkout_start", {
      source,
      cta,
      return: returnTo,
      provider: "revenuecat",
    });
    onClick?.(event);
  }

  return (
    <a href={href} {...rest} onClick={handleClick}>
      {children}
    </a>
  );
}

type TrackedPortalLinkProps = {
  href?: string;
  hasPlus?: boolean;
  className?: string;
  children: ReactNode;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "children">;

export function TrackedPortalLink({
  href = "/api/billing/portal",
  hasPlus,
  children,
  onClick,
  ...rest
}: TrackedPortalLinkProps) {
  return (
    <a
      href={href}
      {...rest}
      onClick={(event) => {
        track("portal_open", { has_plus: Boolean(hasPlus) });
        onClick?.(event);
      }}
    >
      {children}
    </a>
  );
}
