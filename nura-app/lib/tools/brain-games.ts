/**
 * Logic for /tools/brain-games: the daily word puzzle, the number games, the memory-match deck
 * and the streak kept in localStorage. Pure functions, so they can be tested; nothing here
 * touches the network.
 */
import { PUZZLES, WORDS } from "./word-list";

/* ---------- Dates and the daily seed ---------- */

/** The visitor's local calendar date as YYYY-MM-DD (the day changes at their midnight). */
export function dateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** FNV-1a: a small, stable string hash, so the same date always gives the same puzzle. */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mulberry32: a seeded random number generator returning numbers in [0, 1). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/* ---------- Daily word puzzle ---------- */

export const MIN_WORD = 3;

export type DailyPuzzle = {
  date: string;
  /** The seven letters, in a shuffled order that is the same all day. */
  letters: string[];
  /** The letter every word must use. */
  key: string;
  /** The seven-letter word that uses every letter. */
  pangram: string;
  answers: string[];
};

function letterCounts(word: string) {
  const counts = new Map<string, number>();
  for (const c of word) counts.set(c, (counts.get(c) ?? 0) + 1);
  return counts;
}

/** Can `word` be made from `letters`, using each letter no more often than it appears? */
export function canMake(word: string, letters: string): boolean {
  const have = letterCounts(letters);
  for (const [c, n] of letterCounts(word)) if ((have.get(c) ?? 0) < n) return false;
  return true;
}

export function answersFor(word: string, key: string): string[] {
  return WORDS.filter((w) => w.length >= MIN_WORD && w.includes(key) && canMake(w, word)).sort(
    (a, b) => a.length - b.length || a.localeCompare(b),
  );
}

/** The puzzle for a date key (YYYY-MM-DD). Everyone gets the same puzzle on the same day. */
export function puzzleForDate(key: string): DailyPuzzle {
  const seed = hashString(`nura-word-${key}`);
  const puzzle = PUZZLES[seed % PUZZLES.length];
  const random = seededRandom(seed);
  const others = shuffle(
    puzzle.word.split("").filter((_, i) => i !== puzzle.word.indexOf(puzzle.key)),
    random,
  );
  return {
    date: key,
    letters: [puzzle.key, ...others],
    key: puzzle.key,
    pangram: puzzle.word,
    answers: answersFor(puzzle.word, puzzle.key),
  };
}

export type GuessResult =
  | { ok: true; word: string; pangram: boolean }
  | { ok: false; reason: "short" | "key" | "letters" | "found" | "unknown"; message: string };

export function checkGuess(puzzle: DailyPuzzle, raw: string, found: readonly string[]): GuessResult {
  const word = raw.trim().toLowerCase().replace(/[^a-z]/g, "");
  if (word.length < MIN_WORD) return { ok: false, reason: "short", message: `Words need at least ${MIN_WORD} letters.` };
  if (!canMake(word, puzzle.pangram))
    return { ok: false, reason: "letters", message: "That uses a letter that isn't in today's seven, or uses one too often." };
  if (!word.includes(puzzle.key))
    return { ok: false, reason: "key", message: `Every word needs the centre letter, ${puzzle.key.toUpperCase()}.` };
  if (found.includes(word)) return { ok: false, reason: "found", message: "You've already found that one." };
  if (!puzzle.answers.includes(word))
    return {
      ok: false,
      reason: "unknown",
      message: "That one isn't in today's word list. It may still be a real word: our list is short and simple.",
    };
  return { ok: true, word, pangram: word === puzzle.pangram };
}

/* ---------- Numbers ---------- */

export type MathsLevel = 1 | 2 | 3;

export type MathsQuestion = {
  prompt: string;
  /** Spoken-friendly version for screen readers. */
  spoken: string;
  answer: number;
  choices: number[];
};

function int(random: () => number, min: number, max: number) {
  return min + Math.floor(random() * (max - min + 1));
}

function choicesAround(answer: number, random: () => number, step = 1): number[] {
  const set = new Set<number>([answer]);
  const offsets = shuffle([-3, -2, -1, 1, 2, 3, 10, -10].map((o) => o * step), random);
  for (const o of offsets) {
    if (set.size >= 4) break;
    const n = answer + o;
    if (n >= 0) set.add(n);
  }
  let extra = answer + 4 * step;
  while (set.size < 4) set.add(extra++);
  return shuffle([...set], random);
}

/**
 * Level 1: adding and taking away within 20. Level 2: bigger sums and times tables to 10.
 * Level 3: what comes next in a number sequence.
 */
export function makeQuestion(level: MathsLevel, random: () => number): MathsQuestion {
  if (level === 1) {
    if (random() < 0.5) {
      const a = int(random, 1, 10);
      const b = int(random, 1, 10);
      return { prompt: `${a} + ${b}`, spoken: `${a} plus ${b}`, answer: a + b, choices: choicesAround(a + b, random) };
    }
    const a = int(random, 5, 20);
    const b = int(random, 1, a);
    return { prompt: `${a} − ${b}`, spoken: `${a} take away ${b}`, answer: a - b, choices: choicesAround(a - b, random) };
  }
  if (level === 2) {
    const kind = int(random, 0, 2);
    if (kind === 0) {
      const a = int(random, 12, 60);
      const b = int(random, 11, 39);
      return { prompt: `${a} + ${b}`, spoken: `${a} plus ${b}`, answer: a + b, choices: choicesAround(a + b, random) };
    }
    if (kind === 1) {
      const a = int(random, 30, 99);
      const b = int(random, 11, a - 5);
      return { prompt: `${a} − ${b}`, spoken: `${a} take away ${b}`, answer: a - b, choices: choicesAround(a - b, random) };
    }
    const a = int(random, 2, 10);
    const b = int(random, 2, 10);
    return { prompt: `${a} × ${b}`, spoken: `${a} times ${b}`, answer: a * b, choices: choicesAround(a * b, random, a) };
  }
  const kind = int(random, 0, 2);
  if (kind === 0) {
    const start = int(random, 1, 20);
    const step = int(random, 2, 9);
    const seq = [0, 1, 2, 3].map((i) => start + i * step);
    const answer = start + 4 * step;
    return {
      prompt: `${seq.join(", ")}, ?`,
      spoken: `What comes next: ${seq.join(", ")}`,
      answer,
      choices: choicesAround(answer, random, 1),
    };
  }
  if (kind === 1) {
    const start = int(random, 60, 120);
    const step = int(random, 3, 11);
    const seq = [0, 1, 2, 3].map((i) => start - i * step);
    const answer = start - 4 * step;
    return {
      prompt: `${seq.join(", ")}, ?`,
      spoken: `What comes next: ${seq.join(", ")}`,
      answer,
      choices: choicesAround(answer, random, 1),
    };
  }
  const start = int(random, 1, 5);
  const seq = [0, 1, 2, 3].map((i) => start * 2 ** i);
  const answer = start * 16;
  return {
    prompt: `${seq.join(", ")}, ?`,
    spoken: `What comes next: ${seq.join(", ")}`,
    answer,
    choices: choicesAround(answer, random, start),
  };
}

export const ROUND_LENGTH = 10;

/* ---------- Memory match ---------- */

export const PICTURES: readonly { emoji: string; word: string }[] = [
  { emoji: "🍎", word: "Apple" },
  { emoji: "🐶", word: "Dog" },
  { emoji: "🌻", word: "Sunflower" },
  { emoji: "☕", word: "Cup of tea" },
  { emoji: "🏠", word: "House" },
  { emoji: "🚲", word: "Bicycle" },
  { emoji: "🔑", word: "Key" },
  { emoji: "🌙", word: "Moon" },
  { emoji: "🐟", word: "Fish" },
  { emoji: "🍞", word: "Bread" },
  { emoji: "☂️", word: "Umbrella" },
  { emoji: "🐱", word: "Cat" },
];

export const PAIR_OPTIONS = [6, 8, 12] as const;
export type PairCount = (typeof PAIR_OPTIONS)[number];

export type Card = { id: number; pair: number; emoji: string; word: string };

export function makeDeck(pairs: PairCount, random: () => number): Card[] {
  const chosen = shuffle(PICTURES, random).slice(0, pairs);
  const cards = chosen.flatMap((p, pair) => [
    { pair, emoji: p.emoji, word: p.word },
    { pair, emoji: p.emoji, word: p.word },
  ]);
  return shuffle(cards, random).map((c, id) => ({ ...c, id }));
}

/* ---------- Progress and streaks (localStorage) ---------- */

export const PROGRESS_KEY = "nura-brain-games-v1";

export type Progress = {
  /** Date key of the last day any game was played. */
  lastPlayed: string | null;
  streak: number;
  bestStreak: number;
  /** Words found in the word puzzle, for one date only. */
  words: { date: string; found: string[] } | null;
  memoryWins: number;
  /** Fewest turns to clear the memory game, per pair count. */
  memoryBest: Partial<Record<string, number>>;
  mathsCorrect: number;
};

export const EMPTY_PROGRESS: Progress = {
  lastPlayed: null,
  streak: 0,
  bestStreak: 0,
  words: null,
  memoryWins: 0,
  memoryBest: {},
  mathsCorrect: 0,
};

function previousDay(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return dateKey(new Date(y, m - 1, d - 1));
}

/** Record that the visitor played today. Playing again on the same day doesn't add to the streak. */
export function markPlayed(progress: Progress, today: string): Progress {
  if (progress.lastPlayed === today) return progress;
  const streak = progress.lastPlayed === previousDay(today) ? progress.streak + 1 : 1;
  return { ...progress, lastPlayed: today, streak, bestStreak: Math.max(progress.bestStreak, streak) };
}

/** The streak to show today: it lapses if yesterday was missed. */
export function currentStreak(progress: Progress, today: string): number {
  if (progress.lastPlayed === today || progress.lastPlayed === previousDay(today)) return progress.streak;
  return 0;
}

export function parseProgress(raw: string | null): Progress {
  if (!raw) return EMPTY_PROGRESS;
  try {
    const data = JSON.parse(raw) as Partial<Progress>;
    if (!data || typeof data !== "object") return EMPTY_PROGRESS;
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
    const words =
      data.words && typeof data.words.date === "string" && Array.isArray(data.words.found)
        ? { date: data.words.date, found: data.words.found.filter((w): w is string => typeof w === "string").slice(0, 200) }
        : null;
    const memoryBest: Progress["memoryBest"] = {};
    if (data.memoryBest && typeof data.memoryBest === "object") {
      for (const [k, v] of Object.entries(data.memoryBest)) if (num(v) > 0) memoryBest[k] = num(v);
    }
    return {
      lastPlayed: typeof data.lastPlayed === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data.lastPlayed) ? data.lastPlayed : null,
      streak: num(data.streak),
      bestStreak: num(data.bestStreak),
      words,
      memoryWins: num(data.memoryWins),
      memoryBest,
      mathsCorrect: num(data.mathsCorrect),
    };
  } catch {
    return EMPTY_PROGRESS;
  }
}
