import { describe, expect, it } from "vitest";
import { pendingBillingIssue } from "./sync-plus";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 3, 12, 0, 0);
const iso = (ms: number) => new Date(ms).toISOString();

// Shape of the App Store trial that lapsed on 2 Oct 2026 with a declined charge.
function declinedTrial(overrides: Record<string, string | null> = {}) {
  return {
    store: "app_store",
    period_type: "trial",
    purchase_date: iso(NOW - 15 * DAY),
    expires_date: iso(NOW - 1 * DAY),
    unsubscribe_detected_at: null,
    billing_issues_detected_at: iso(NOW - 1 * DAY + 4 * 60 * 60 * 1000),
    ...overrides,
  };
}

describe("pendingBillingIssue", () => {
  it("reports a declined charge the store is still retrying", () => {
    expect(pendingBillingIssue([declinedTrial()], NOW)).toEqual({
      store: "app_store",
      detectedAt: declinedTrial().billing_issues_detected_at,
    });
  });

  it("ignores a subscription the person cancelled themselves", () => {
    const cancelled = declinedTrial({ unsubscribe_detected_at: iso(NOW - 5 * DAY) });
    expect(pendingBillingIssue([cancelled], NOW)).toBeNull();
  });

  it("ignores a lapse with no billing issue", () => {
    expect(pendingBillingIssue([declinedTrial({ billing_issues_detected_at: null })], NOW)).toBeNull();
  });

  it("stops once the store's retry window is over", () => {
    const stale = declinedTrial({ expires_date: iso(NOW - 61 * DAY) });
    expect(pendingBillingIssue([stale], NOW)).toBeNull();
  });

  it("judges by the most recent subscription only", () => {
    const olderDeclined = declinedTrial({ expires_date: iso(NOW - 40 * DAY) });
    const newerCancelled = declinedTrial({
      store: "stripe",
      billing_issues_detected_at: null,
      unsubscribe_detected_at: iso(NOW - 3 * DAY),
    });
    expect(pendingBillingIssue([olderDeclined, newerCancelled], NOW)).toBeNull();
  });
});
