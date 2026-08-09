"use client";

import Link from "next/link";
import type { ComponentProps, MouseEvent } from "react";
import { track } from "@/lib/analytics";

type TrackedLinkProps = ComponentProps<typeof Link> & {
  event: string;
  eventParams?: Record<string, string | number | boolean | undefined | null>;
};

/** Next.js Link that fires a GA event on click. */
export function TrackedLink({ event, eventParams, onClick, ...rest }: TrackedLinkProps) {
  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    track(event, eventParams);
    onClick?.(e);
  }

  return <Link {...rest} onClick={handleClick} />;
}
