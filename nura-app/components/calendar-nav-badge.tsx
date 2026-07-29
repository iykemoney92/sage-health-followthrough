"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function CalendarNavBadge() {
  const pathname = usePathname();
  const [count, setCount] = useState(0);
  const onCalendarPage = pathname.startsWith("/calendar");

  useEffect(() => {
    if (onCalendarPage) return;
    fetch("/api/calendar/unseen-count")
      .then((res) => res.json())
      .then((data) => setCount(data.ok ? data.count : 0))
      .catch(() => setCount(0));
  }, [onCalendarPage]);

  if (onCalendarPage || count === 0) return null;

  return <span className="calendar-nav-badge">{count > 9 ? "9+" : `+${count}`}</span>;
}
