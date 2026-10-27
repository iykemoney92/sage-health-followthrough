/**
 * The free EOB decoder at /tools/eob-decoder: arithmetic and wording only.
 *
 * Everything runs in the browser. No AI, no API, nothing stored: the figures
 * someone types stay on their device. Amounts are held in whole cents so a
 * "$180.00 = $140.00 + $40.00" check never fails on floating-point dust.
 *
 * Wording rules (as lib/content/topics.ts): explain what the figures say and
 * what to ask, never tell anyone they definitely owe or don't owe money, and
 * name the No Surprises Act only for the situations CMS lists.
 */

export const EOB_FIELDS = [
  "billed",
  "allowed",
  "planPaid",
  "deductible",
  "copay",
  "coinsurance",
  "notCovered",
  "eobOwe",
  "bill",
] as const;

export type EobField = (typeof EOB_FIELDS)[number];

/** Whole cents, or null when the box is empty. */
export type EobFigures = Record<EobField, number | null>;

export type NetworkStatus = "in" | "out" | "unsure";

/**
 * The care settings CMS names for the No Surprises Act, plus ground ambulance,
 * which CMS names as generally not covered.
 */
export type CareSetting = "emergency" | "in-network-facility" | "air-ambulance" | "ground-ambulance" | "other";

export type EobInput = {
  figures: EobFigures;
  network: NetworkStatus;
  setting: CareSetting;
};

export type Tone = "ok" | "check" | "info";

export type Finding = { tone: Tone; title: string; detail: string };

export type LineReading = { field: EobField; label: string; cents: number; meaning: string };

export type BillVerdict = "match" | "higher" | "lower" | "none";

export type EobResult = {
  readings: LineReading[];
  /** Deductible + copay + coinsurance + not covered, from the parts entered. */
  patientResponsibility: number | null;
  /** The figure the bill is compared with: the EOB's printed total if given, else the sum of the parts. */
  compareWith: number | null;
  checks: Finding[];
  bill: { verdict: BillVerdict; difference: number; findings: Finding[] };
};

export const FIELD_LABELS: Record<EobField, string> = {
  billed: "Amount billed",
  allowed: "Allowed amount",
  planPaid: "Plan paid",
  deductible: "Applied to deductible",
  copay: "Copay",
  coinsurance: "Coinsurance",
  notCovered: "Not covered",
  eobOwe: "Patient responsibility on the EOB",
  bill: "Amount due on the provider’s bill",
};

const MEANINGS: Record<EobField, string> = {
  billed: "The provider’s full charge before insurance — its list price. Few insured patients pay this figure.",
  allowed:
    "The most your plan will pay for this covered service, also called the negotiated rate. Your deductible, copay and coinsurance are worked out from this figure, not from the billed amount.",
  planPaid: "What your insurer paid the provider for this line.",
  deductible:
    "Money that went towards your deductible — the amount you pay for covered care before your plan starts to pay. This part is yours to pay the provider.",
  copay: "A fixed amount you pay for this service. This part is yours to pay the provider.",
  coinsurance:
    "Your percentage share of the allowed amount, usually after the deductible is met. This part is yours to pay the provider.",
  notCovered:
    "An amount the plan did not pay for at all. There should be a reason or remark code next to it; if you think the service should be covered, ask your insurer and you can appeal.",
  eobOwe: "The total your insurer says the provider may bill you for this claim. The EOB is not a bill; this is the figure the provider’s bill should match.",
  bill: "What the doctor, hospital or lab is asking you to pay.",
};

/** One cent either way: EOBs round coinsurance to the cent, and so do people typing it. */
const TOLERANCE = 1;

const near = (a: number, b: number, tolerance = TOLERANCE) => Math.abs(a - b) <= tolerance;

export function formatCents(cents: number): string {
  const sign = cents < 0 ? "−" : "";
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100).toLocaleString("en-US");
  return `${sign}$${dollars}.${String(abs % 100).padStart(2, "0")}`;
}

/**
 * Reads a dollar figure as typed or as printed on an EOB: "$1,234.56",
 * "1234.5", "(40.00)" or "-40" for a credit. Returns whole cents, or null for
 * an empty box. Anything else is NaN so the form can say so.
 */
export function parseDollars(raw: string): number | null {
  const text = raw.trim();
  if (!text) return null;
  const negative = /^\(.*\)$/.test(text) || /^[-−–]/.test(text);
  const cleaned = text.replace(/[()$\s,−–-]/g, "");
  if (!/^\d+(\.\d{1,2})?$|^\.\d{1,2}$/.test(cleaned)) return Number.NaN;
  const [whole, fraction = ""] = cleaned.split(".");
  const cents = Number(whole || "0") * 100 + Number(fraction.padEnd(2, "0"));
  return negative ? -cents : cents;
}

export function emptyFigures(): EobFigures {
  return Object.fromEntries(EOB_FIELDS.map((field) => [field, null])) as EobFigures;
}

/** True once there is enough on the form to say anything useful. */
export function hasEnough(figures: EobFigures): boolean {
  const shares = ["deductible", "copay", "coinsurance", "notCovered", "eobOwe"] as const;
  return shares.some((field) => figures[field] !== null) || (figures.allowed !== null && figures.planPaid !== null);
}

export function decodeEob({ figures, network, setting }: EobInput): EobResult {
  const f = figures;
  const readings: LineReading[] = EOB_FIELDS.filter((field) => f[field] !== null).map((field) => ({
    field,
    label: FIELD_LABELS[field],
    cents: f[field]!,
    meaning: MEANINGS[field],
  }));

  const partsEntered = f.deductible !== null || f.copay !== null || f.coinsurance !== null || f.notCovered !== null;
  const costSharing = (f.deductible ?? 0) + (f.copay ?? 0) + (f.coinsurance ?? 0);
  const patientResponsibility = partsEntered ? costSharing + (f.notCovered ?? 0) : null;
  // Without the parts, the allowed amount less the plan's payment is the share left to the patient.
  const derived = patientResponsibility ?? (f.allowed !== null && f.planPaid !== null ? f.allowed - f.planPaid : null);
  const compareWith = f.eobOwe ?? derived;

  const checks: Finding[] = [];

  if (f.billed !== null && f.allowed !== null) {
    if (f.allowed > f.billed) {
      checks.push({
        tone: "check",
        title: "The allowed amount is higher than the amount billed",
        detail: `That is unusual: the allowed amount (${formatCents(f.allowed)}) is normally the same as or lower than the provider’s charge (${formatCents(f.billed)}). Check you copied both figures from the same line.`,
      });
    } else if (f.allowed < f.billed) {
      checks.push({
        tone: "info",
        title: `${formatCents(f.billed - f.allowed)} between billed and allowed`,
        detail:
          network === "out"
            ? "This gap is the difference between the provider’s charge and your plan’s allowed amount. An out-of-network provider has not agreed to the plan’s price, so in some situations it may bill you for this gap — that is balance billing."
            : "This gap is usually a discount or adjustment. For covered care from an in-network (preferred) provider, HealthCare.gov says the provider may not bill you for the difference.",
      });
    }
  }

  if (f.allowed !== null && f.planPaid !== null && partsEntered) {
    const withoutNotCovered = f.planPaid + costSharing;
    const withNotCovered = withoutNotCovered + (f.notCovered ?? 0);
    if (near(withoutNotCovered, f.allowed)) {
      checks.push({
        tone: "ok",
        title: "The figures add up",
        detail: `Plan paid ${formatCents(f.planPaid)} + your deductible, copay and coinsurance ${formatCents(costSharing)} = ${formatCents(withoutNotCovered)}, the allowed amount.${
          f.notCovered ? " The not-covered amount sits outside the allowed amount on this line, which is common." : ""
        }`,
      });
    } else if (f.notCovered && near(withNotCovered, f.allowed)) {
      checks.push({
        tone: "ok",
        title: "The figures add up",
        detail: `Plan paid ${formatCents(f.planPaid)} + your share ${formatCents(costSharing + f.notCovered)} (including ${formatCents(f.notCovered)} not covered) = ${formatCents(withNotCovered)}, the allowed amount.`,
      });
    } else {
      const gap = f.allowed - withoutNotCovered;
      checks.push({
        tone: "check",
        title: "The figures don’t add up",
        detail: `Allowed ${formatCents(f.allowed)} should equal plan paid plus your share, but plan paid ${formatCents(f.planPaid)} + deductible, copay and coinsurance ${formatCents(costSharing)} = ${formatCents(withoutNotCovered)} — ${formatCents(Math.abs(gap))} ${gap > 0 ? "short" : "over"}. Check each figure against the EOB. If they are right, the EOB may hold another amount (such as an “other insurance” or “withhold” column) — ask your insurer to explain the difference.`,
      });
    }
  }

  if (f.eobOwe !== null && patientResponsibility !== null) {
    if (near(f.eobOwe, patientResponsibility)) {
      checks.push({
        tone: "ok",
        title: "Your share matches the EOB’s total",
        detail: `Deductible + copay + coinsurance + not covered = ${formatCents(patientResponsibility)}, the same as the patient responsibility printed on the EOB.`,
      });
    } else {
      checks.push({
        tone: "check",
        title: "Your share doesn’t match the EOB’s total",
        detail: `The parts add up to ${formatCents(patientResponsibility)}, but the EOB says ${formatCents(f.eobOwe)}. Check you entered every part; if you did, ask your insurer what the other ${formatCents(Math.abs(f.eobOwe - patientResponsibility))} is.`,
      });
    }
  }

  if (f.coinsurance && f.allowed !== null) {
    const base = f.allowed - (f.deductible ?? 0) - (f.copay ?? 0);
    if (base > 0 && f.coinsurance <= base) {
      const percent = Math.round((f.coinsurance / base) * 1000) / 10;
      checks.push({
        tone: "info",
        title: `Coinsurance is about ${percent}% of what was left`,
        detail: `${formatCents(f.coinsurance)} of the ${formatCents(base)} left after the deductible and copay. Compare it with the coinsurance rate in your plan’s summary of benefits; out-of-network care often has a higher rate.`,
      });
    }
  }

  return { readings, patientResponsibility, compareWith, checks, bill: compareBill(f, compareWith, network, setting) };
}

const NSA_SETTINGS: Record<Exclude<CareSetting, "ground-ambulance" | "other">, string> = {
  emergency: "emergency room care",
  "in-network-facility": "non-emergency care linked to a visit to an in-network hospital, hospital outpatient department or ambulatory surgical center",
  "air-ambulance": "air ambulance services",
};

function compareBill(f: EobFigures, target: number | null, network: NetworkStatus, setting: CareSetting): EobResult["bill"] {
  if (f.bill === null || target === null) return { verdict: "none", difference: 0, findings: [] };
  const difference = f.bill - target;

  if (near(difference, 0)) {
    return {
      verdict: "match",
      difference: 0,
      findings: [
        {
          tone: "ok",
          title: "The bill matches the EOB",
          detail: `The provider is asking for ${formatCents(f.bill)}, the same as your share on the EOB. That suggests the bill reflects the processed claim. Check the date of service and provider are the same on both before you pay.`,
        },
      ],
    };
  }

  if (difference < 0) {
    return {
      verdict: "lower",
      difference,
      findings: [
        {
          tone: "info",
          title: `The bill is ${formatCents(-difference)} lower than the EOB`,
          detail:
            "Often because you already paid part of it — a copay at check-in, say — or the provider applied a credit or a discount. Check the bill for earlier payments. A lower bill is rarely a problem, but keep the EOB in case another bill follows.",
        },
      ],
    };
  }

  const findings: Finding[] = [];
  const extra = formatCents(difference);

  // The extra lines up with a figure on the EOB: say which, because that is usually the explanation.
  if (f.billed !== null && near(f.bill, f.billed)) {
    findings.push({
      tone: "check",
      title: "The bill asks for the full charge",
      detail: `The amount due equals the amount billed (${formatCents(f.billed)}), as if insurance had not been applied. The bill may have been sent before the claim was processed. Ask the provider’s billing office whether your insurer’s payment and adjustment are on your account.`,
    });
  } else if (f.planPaid !== null && f.planPaid > 0 && near(difference, f.planPaid)) {
    findings.push({
      tone: "check",
      title: "The extra equals what the plan paid",
      detail: `The bill is higher by ${extra}, exactly the plan’s payment. The insurer’s payment may not have reached the provider’s account yet. Ask the billing office to check, quoting the claim number.`,
    });
  } else if (f.billed !== null && f.allowed !== null && f.billed > f.allowed && near(difference, f.billed - f.allowed)) {
    findings.push({
      tone: "check",
      title: "The extra equals the gap between billed and allowed",
      detail: `The bill is higher by ${extra}, the difference between the provider’s charge and the allowed amount. Either the plan’s discount was not applied, or the provider is billing you for the balance — balance billing.`,
    });
  }

  findings.push({
    tone: "check",
    title: `The bill asks for ${extra} more than the EOB says you owe`,
    detail:
      "Common reasons: the bill went out before the claim finished processing (the EOB may also say it is still pending); the provider is balance billing — charging you the difference between its charge and the allowed amount; or a coding or billing error, such as a wrong code, date or a duplicate line. Ask the provider for an itemized bill and compare each line with the EOB, and ask your insurer whether the claim is final. Ask before you pay the difference.",
  });

  if (network === "in") {
    findings.push({
      tone: "info",
      title: "In-network provider",
      detail:
        "HealthCare.gov says a preferred (in-network) provider may not balance bill you for covered services. If the claim is final and the provider was in-network, ask the provider why the bill is higher, and tell your insurer.",
    });
  }

  if (setting === "emergency" || setting === "in-network-facility" || setting === "air-ambulance") {
    findings.push({
      tone: "check",
      title: "The No Surprises Act may apply",
      detail: `CMS says the No Surprises Act protects most people with private insurance from unexpected out-of-network bills for ${NSA_SETTINGS[setting]}. In most of those cases you can’t be charged more than your in-network cost-sharing (deductible, copay and coinsurance). Protections can be lost if you signed a notice and consent form, and some plans are not covered. If you think they apply, contact the provider and your insurer, or call the No Surprises Help Desk on 1-800-985-3059.`,
    });
  } else if (setting === "ground-ambulance") {
    findings.push({
      tone: "info",
      title: "Ground ambulance bills",
      detail:
        "CMS says ground ambulance services generally aren’t covered by the No Surprises Act billing protections unless a state law has different rules. Ask your insurer and your state insurance department what applies.",
    });
  } else if (network === "out") {
    findings.push({
      tone: "info",
      title: "Out-of-network care",
      detail:
        "Outside emergency care, care at an in-network hospital or surgery center, and air ambulances, CMS says the No Surprises Act protections don’t apply, so an out-of-network provider may be allowed to balance bill. Ask the provider whether it will reduce the bill, and ask your insurer how the payment was worked out.",
    });
  }

  return { verdict: "higher", difference, findings };
}

/**
 * The paste box: picks labelled dollar figures out of copied EOB text with
 * plain patterns, on the device. It only reads "label … $amount" on one line,
 * so a table copied with headers on one row and figures on the next won't
 * match — the form says to check every figure it fills.
 *
 * Order matters: a more specific label is tried before a looser one that
 * would also match ("patient responsibility" before "responsibility").
 */
const PATTERNS: [EobField, RegExp][] = [
  ["billed", /\b(?:amount\s+billed|billed\s+amount|billed\s+charges?|total\s+charges?|provider\s+charges?|amount\s+charged|billed)\b/i],
  ["allowed", /\b(?:allowed\s+amount|amount\s+allowed|allowed|plan\s+allowance|eligible\s+(?:amount|expense)|negotiated\s+(?:rate|amount)|approved\s+amount)\b/i],
  ["planPaid", /\b(?:plan\s+paid|paid\s+by\s+(?:plan|insurance|insurer)|insurance\s+paid|plan\s+payment|plan\s+pays|we\s+paid|amount\s+paid\s+to\s+provider|paid\s+to\s+provider|benefit\s+paid)\b/i],
  ["deductible", /\b(?:applied\s+to\s+(?:your\s+)?deductible|deductible)\b/i],
  ["copay", /\b(?:co-?payment|co-?pay)\b/i],
  ["coinsurance", /\b(?:co-?insurance)\b/i],
  ["notCovered", /\b(?:amount\s+not\s+covered|not\s+covered|non-?covered(?:\s+amount)?)\b/i],
  ["eobOwe", /\b(?:patient\s+responsibility|member\s+responsibility|your\s+responsibility|you\s+may\s+owe|what\s+you\s+owe|amount\s+you\s+owe|you\s+owe|your\s+share|your\s+total\s+cost)\b/i],
];

/** A dollar figure: $1,234.56, 1234.56, (40.00) or $0. Requires cents or a $ so "Claim 12345" doesn't count. */
const MONEY = /(\(?-?\$\s?[\d,]+(?:\.\d{1,2})?\)?|\(?-?[\d,]*\d\.\d{2}\)?)/;

export type ParsedEob = { figures: Partial<Record<EobField, number>>; found: EobField[] };

export function parseEobText(text: string): ParsedEob {
  const figures: Partial<Record<EobField, number>> = {};
  const found: EobField[] = [];
  // Each label is looked for on every line; the first labelled figure wins.
  const lines = text.split(/\r?\n/);
  for (const [field, label] of PATTERNS) {
    for (const line of lines) {
      const match = label.exec(line);
      if (!match) continue;
      const after = line.slice(match.index + match[0].length);
      // A figure must follow within a short gap, with no other label in between.
      const money = MONEY.exec(after);
      if (!money || money.index > 40) continue;
      const between = after.slice(0, money.index);
      if (PATTERNS.some(([other, pattern]) => other !== field && pattern.test(between))) continue;
      const cents = parseDollars(money[1]);
      if (cents === null || Number.isNaN(cents)) continue;
      figures[field] = Math.abs(cents);
      found.push(field);
      break;
    }
  }
  return { figures, found };
}
