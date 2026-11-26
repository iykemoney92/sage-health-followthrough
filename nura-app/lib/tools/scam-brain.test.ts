import { describe, expect, it } from "vitest";
import {
  EMPTY_PROGRESS,
  ROUND_LENGTH,
  answersFor,
  checkGuess,
  currentStreak,
  dateKey,
  makeDeck,
  makeQuestion,
  markPlayed,
  parseProgress,
  puzzleForDate,
  seededRandom,
  type MathsLevel,
} from "./brain-games";
import { checkMessage, linkConcern } from "./scam-check";
import { PUZZLES, WORDS } from "./word-list";

const MESSAGES = {
  bank: "Barclays: Unusual activity detected on your account. Your account has been suspended. Verify your details immediately at http://barclays-secure-login.top/verify",
  hmrc: "HMRC: You are owed a tax refund of £326.18. Claim your refund within 24 hours: https://hmrc-refund-claim.com/start",
  irs: "IRS notice: you are due a refund. Final notice, act now or your claim will be cancelled. Visit irs-gov-refunds.info",
  hiMum:
    "Hi Mum, this is my new number, I dropped my phone down the loo! Can you save it? I need to pay a bill today, can you send money by bank transfer? Don't tell Dad x",
  parcel:
    "Royal Mail: Your parcel could not be delivered due to an unpaid fee of £1.45. Reschedule your delivery at https://bit.ly/3xYzRm",
  prize: "Congratulations! You have won a £500 Tesco voucher. Click here to claim your prize: tinyurl.com/win500now",
  otp: "Hi, this is Amazon security. We sent you a verification code by mistake. Please read the code back to us so we can cancel the order.",
  remote: "Microsoft Support: your computer has a virus. Please install AnyDesk so our engineer can fix it right away.",
  appointment:
    "Reminder: your appointment at Riverside Dental is on Tue 3 Dec at 10:30am. Reply C to confirm or call 01234 567890 to rearrange.",
  friend: "Hey! Are we still on for coffee on Saturday? Let me know if 11 works for you. Love, Sue",
};

describe("scam checker", () => {
  it.each([
    ["classic bank", MESSAGES.bank],
    ["HMRC refund", MESSAGES.hmrc],
    ["IRS refund", MESSAGES.irs],
    ["Hi Mum new number", MESSAGES.hiMum],
    ["parcel fee", MESSAGES.parcel],
    ["prize", MESSAGES.prize],
    ["one-time passcode request", MESSAGES.otp],
    ["remote access", MESSAGES.remote],
  ])("finds strong signs in a %s message", (_name, text) => {
    const result = checkMessage(text);
    expect(result.level).toBe("strong");
    expect(result.heading).toBe("Strong signs of a scam");
    expect(result.spans.length).toBeGreaterThan(0);
  });

  it("names the flags that triggered", () => {
    const ids = (text: string) => checkMessage(text).flags.map((f) => f.id);
    expect(ids(MESSAGES.bank)).toEqual(expect.arrayContaining(["account-alert", "urgency", "lookalike-link"]));
    expect(ids(MESSAGES.hmrc)).toEqual(expect.arrayContaining(["prize-refund", "urgency", "lookalike-link"]));
    expect(ids(MESSAGES.hiMum)).toEqual(expect.arrayContaining(["new-number", "payment-method", "secrecy"]));
    expect(ids(MESSAGES.parcel)).toEqual(expect.arrayContaining(["parcel-fee", "short-link"]));
    expect(ids(MESSAGES.otp)).toContain("passcode");
    expect(ids(MESSAGES.remote)).toContain("remote-access");
  });

  it("highlights the phrases it matched, in order and without overlaps", () => {
    const result = checkMessage(MESSAGES.hiMum);
    const phrases = result.spans.map((s) => MESSAGES.hiMum.slice(s.start, s.end).toLowerCase());
    expect(phrases).toEqual(expect.arrayContaining(["hi mum", "new number", "send money"]));
    for (let i = 1; i < result.spans.length; i++) expect(result.spans[i].start).toBeGreaterThanOrEqual(result.spans[i - 1].end);
  });

  it("finds no common signs in a genuine-looking appointment reminder", () => {
    const result = checkMessage(MESSAGES.appointment);
    expect(result.level).toBe("none");
    expect(result.heading).toBe("No common warning signs found, but stay careful");
  });

  it("finds no common signs in a friend's ordinary message", () => {
    const result = checkMessage(MESSAGES.friend);
    expect(result.level).toBe("none");
    expect(result.flags).toEqual([]);
  });

  it("never calls anything safe", () => {
    for (const text of Object.values(MESSAGES)) {
      const { heading, summary } = checkMessage(text);
      expect(`${heading} ${summary}`.toLowerCase()).not.toMatch(/\bsafe\b|\bgenuine\b|\blegitimate\b/);
    }
  });

  it("counts the quick answers, without needing any text", () => {
    expect(checkMessage("").level).toBe("none");
    expect(checkMessage("", { unexpected: "yes" }).level).toBe("none");
    expect(checkMessage("", { money: "yes" }).level).toBe("some");
    expect(checkMessage("", { unexpected: "yes", money: "yes", pressure: "yes", claim: "bank" }).level).toBe("strong");
    expect(checkMessage("", { claim: "family", money: "yes" }).level).toBe("strong");
  });

  it("raises an ordinary message when the answers are worrying", () => {
    expect(checkMessage(MESSAGES.friend, { money: "yes", pressure: "yes" }).level).not.toBe("none");
  });

  it("spots lookalike and shortened links but not the real sites", () => {
    expect(linkConcern("https://royalmail-redelivery.com/pay")).toBe("lookalike-link");
    expect(linkConcern("paypa1.com/login")).toBe("lookalike-link");
    expect(linkConcern("http://192.168.4.20/bank")).toBe("lookalike-link");
    expect(linkConcern("https://bit.ly/abc")).toBe("short-link");
    expect(linkConcern("https://www.royalmail.com/track")).toBeNull();
    expect(linkConcern("https://www.gov.uk/hmrc")).toBeNull();
    expect(linkConcern("https://www.tax.service.gov.uk/")).toBeNull();
  });

  it("flags a brand writing from a free email address", () => {
    const result = checkMessage("From: PayPal Service <paypal.support.team@gmail.com>\nDear customer, please confirm your account.");
    expect(result.flags.map((f) => f.id)).toEqual(expect.arrayContaining(["odd-sender", "generic-greeting", "account-alert"]));
  });
});

describe("daily word puzzle", () => {
  it("uses the visitor's local date", () => {
    expect(dateKey(new Date(2026, 10, 26, 23, 59))).toBe("2026-11-26");
    expect(dateKey(new Date(2026, 0, 5, 0, 1))).toBe("2026-01-05");
  });

  it("gives everyone the same puzzle on the same day", () => {
    const a = puzzleForDate("2026-11-26");
    const b = puzzleForDate("2026-11-26");
    expect(a).toEqual(b);
    expect(a.letters).toHaveLength(7);
    expect(a.letters[0]).toBe(a.key);
    expect([...a.letters].sort().join("")).toBe(a.pangram.split("").sort().join(""));
  });

  it("changes the puzzle from day to day", () => {
    const days = Array.from({ length: 14 }, (_, i) => dateKey(new Date(2026, 10, 20 + i)));
    const words = new Set(days.map((d) => puzzleForDate(d).pangram));
    expect(words.size).toBeGreaterThanOrEqual(8);
    for (let i = 1; i < days.length; i++) expect(days[i]).not.toBe(days[i - 1]);
  });

  it("has a fair, solvable puzzle for every entry", () => {
    expect(PUZZLES.length).toBeGreaterThanOrEqual(30);
    for (const p of PUZZLES) {
      expect(p.word, p.word).toMatch(/^[a-z]{7}$/);
      expect(p.word.includes(p.key), p.word).toBe(true);
      const answers = answersFor(p.word, p.key);
      expect(answers, p.word).toContain(p.word);
      expect(answers.length, p.word).toBeGreaterThanOrEqual(8);
      expect(answers.length, p.word).toBeLessThanOrEqual(60);
    }
  });

  it("keeps the word list clean", () => {
    expect(new Set(WORDS).size).toBe(WORDS.length);
    for (const w of WORDS) expect(w).toMatch(/^[a-z]{3,8}$/);
  });

  it("explains why a guess doesn't count", () => {
    const puzzle = puzzleForDate("2026-11-26");
    const valid = puzzle.answers.find((w) => w !== puzzle.pangram)!;
    expect(checkGuess(puzzle, valid.toUpperCase(), [])).toEqual({ ok: true, word: valid, pangram: false });
    expect(checkGuess(puzzle, puzzle.pangram, [])).toEqual({ ok: true, word: puzzle.pangram, pangram: true });
    expect(checkGuess(puzzle, valid, [valid])).toMatchObject({ ok: false, reason: "found" });
    expect(checkGuess(puzzle, "ab", [])).toMatchObject({ ok: false, reason: "short" });
    expect(checkGuess(puzzle, "zzzz", [])).toMatchObject({ ok: false, reason: "letters" });
  });
});

describe("number games and memory match", () => {
  it("makes questions with the right answer among four different choices", () => {
    const random = seededRandom(42);
    for (const level of [1, 2, 3] as MathsLevel[]) {
      for (let i = 0; i < ROUND_LENGTH * 5; i++) {
        const q = makeQuestion(level, random);
        expect(q.choices).toHaveLength(4);
        expect(new Set(q.choices).size).toBe(4);
        expect(q.choices).toContain(q.answer);
        expect(q.answer).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("deals each picture exactly twice", () => {
    for (const pairs of [6, 8, 12] as const) {
      const deck = makeDeck(pairs, seededRandom(pairs));
      expect(deck).toHaveLength(pairs * 2);
      const counts = new Map<number, number>();
      for (const c of deck) counts.set(c.pair, (counts.get(c.pair) ?? 0) + 1);
      expect([...counts.values()].every((n) => n === 2)).toBe(true);
    }
  });
});

describe("streaks", () => {
  it("adds a day for consecutive days and resets after a gap", () => {
    let p = markPlayed(EMPTY_PROGRESS, "2026-11-26");
    expect(p.streak).toBe(1);
    p = markPlayed(p, "2026-11-26");
    expect(p.streak).toBe(1);
    p = markPlayed(p, "2026-11-27");
    expect(p.streak).toBe(2);
    expect(currentStreak(p, "2026-11-28")).toBe(2);
    expect(currentStreak(p, "2026-11-29")).toBe(0);
    p = markPlayed(p, "2026-11-30");
    expect(p.streak).toBe(1);
    expect(p.bestStreak).toBe(2);
  });

  it("carries a streak across the end of a month and year", () => {
    const p = markPlayed(markPlayed(EMPTY_PROGRESS, "2026-12-31"), "2027-01-01");
    expect(p.streak).toBe(2);
  });

  it("ignores broken or tampered saved progress", () => {
    expect(parseProgress(null)).toEqual(EMPTY_PROGRESS);
    expect(parseProgress("not json")).toEqual(EMPTY_PROGRESS);
    expect(parseProgress(JSON.stringify({ streak: -4, lastPlayed: "yesterday" }))).toMatchObject({ streak: 0, lastPlayed: null });
  });
});
