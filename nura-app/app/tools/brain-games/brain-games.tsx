"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import {
  EMPTY_PROGRESS,
  PAIR_OPTIONS,
  PROGRESS_KEY,
  ROUND_LENGTH,
  checkGuess,
  currentStreak,
  dateKey,
  makeDeck,
  makeQuestion,
  markPlayed,
  parseProgress,
  puzzleForDate,
  shuffle,
  type Card,
  type MathsLevel,
  type MathsQuestion,
  type PairCount,
  type Progress,
} from "@/lib/tools/brain-games";

const TOOL = "brain-games";

type GameId = "memory" | "words" | "numbers";

const GAMES: { id: GameId; label: string }[] = [
  { id: "memory", label: "Memory match" },
  { id: "words", label: "Daily word puzzle" },
  { id: "numbers", label: "Number games" },
];

/* ---------- Saved progress (localStorage, try/catch: private windows can throw) ---------- */

function loadProgress(): Progress {
  try {
    return parseProgress(window.localStorage.getItem(PROGRESS_KEY));
  } catch {
    return EMPTY_PROGRESS;
  }
}

function saveProgress(progress: Progress) {
  try {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // Storage blocked or full: the games still work, they just won't remember.
  }
}

/* ---------- Optional timer ---------- */

function useElapsed(running: boolean, resetKey: unknown) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSeconds(0);
  }, [resetKey]);
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(timer);
  }, [running]);
  return seconds;
}

function formatSeconds(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function Timer({ show, running, resetKey }: { show: boolean; running: boolean; resetKey: unknown }) {
  const seconds = useElapsed(show && running, resetKey);
  if (!show) return null;
  return (
    <p className="bg-timer" aria-live="off">
      Time: <span>{formatSeconds(seconds)}</span>
    </p>
  );
}

/* ---------- Memory match ---------- */

function MemoryGame({ showTimer, onPlayed, onWin, best }: GameProps & { best: Progress["memoryBest"]; onWin: (pairs: PairCount, turns: number) => void }) {
  const [pairs, setPairs] = useState<PairCount>(6);
  const [round, setRound] = useState(0);
  const [deck, setDeck] = useState<Card[]>([]);
  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [turns, setTurns] = useState(0);
  const [message, setMessage] = useState("Turn over two cards to find a pair.");
  const done = deck.length > 0 && matched.size === pairs;

  function newGame(nextPairs: PairCount = pairs) {
    setPairs(nextPairs);
    setDeck(makeDeck(nextPairs, Math.random));
    setRound((r) => r + 1);
    setOpen([]);
    setMatched(new Set());
    setTurns(0);
    setMessage("Turn over two cards to find a pair.");
  }

  // Deal after the first render, so the server and browser agree on the empty starting state.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDeck(makeDeck(6, Math.random));
  }, []);

  function flip(card: Card) {
    if (done || matched.has(card.pair) || open.includes(card.id)) return;
    onPlayed();
    // Two unmatched cards are showing: this tap turns them back over and opens the new one.
    const showing = open.length === 2 ? [] : open;
    const next = [...showing, card.id];
    setOpen(next);
    if (next.length < 2) {
      setMessage(`${card.word}. Now find its pair.`);
      return;
    }
    const [a, b] = next.map((id) => deck[id]);
    const turnCount = turns + 1;
    setTurns(turnCount);
    if (a.pair === b.pair) {
      const nextMatched = new Set(matched).add(a.pair);
      setMatched(nextMatched);
      setOpen([]);
      if (nextMatched.size === pairs) {
        setMessage(`Well done! You found all ${pairs} pairs in ${turnCount} turns.`);
        onWin(pairs, turnCount);
      } else {
        setMessage(`A pair of ${a.word}s. ${pairs - nextMatched.size} to go.`);
      }
    } else {
      setMessage(`${a.word} and ${b.word} don't match. Tap any card to carry on.`);
    }
  }

  const bestTurns = best[String(pairs)];

  return (
    <div className="bg-game">
      <div className="bg-toolbar">
        <fieldset className="bg-segment">
          <legend>Pairs</legend>
          {PAIR_OPTIONS.map((n) => (
            <label key={n} className="big-choice">
              <input type="radio" name="memory-pairs" checked={pairs === n} onChange={() => newGame(n)} />
              <span>{n}</span>
            </label>
          ))}
        </fieldset>
        <button type="button" className="big-button big-button-quiet" onClick={() => newGame()}>
          New game
        </button>
      </div>
      <p className="bg-stats">
        Turns: <b>{turns}</b> · Pairs found: <b>{matched.size}</b> of {pairs}
        {bestTurns ? (
          <>
            {" "}
            · Your best: <b>{bestTurns}</b> turns
          </>
        ) : null}
      </p>
      <Timer show={showTimer} running={!done && turns > 0} resetKey={`${pairs}-${round}`} />
      <p className="bg-message" aria-live="polite">
        {message}
      </p>
      <ul className={`bg-cards bg-cards-${pairs}`} aria-label="Cards">
        {deck.map((card, i) => {
          const isMatched = matched.has(card.pair);
          const faceUp = isMatched || open.includes(card.id);
          return (
            <li key={`${round}-${card.id}`}>
              <button
                type="button"
                className={`bg-card${faceUp ? " is-up" : ""}${isMatched ? " is-matched" : ""}`}
                onClick={() => flip(card)}
                aria-label={faceUp ? `Card ${i + 1}: ${card.word}${isMatched ? ", matched" : ""}` : `Card ${i + 1}, face down`}
                aria-disabled={isMatched || undefined}
              >
                {faceUp ? (
                  <>
                    <span className="bg-card-emoji" aria-hidden="true">
                      {card.emoji}
                    </span>
                    <span className="bg-card-word" aria-hidden="true">
                      {card.word}
                    </span>
                  </>
                ) : (
                  <span className="bg-card-back" aria-hidden="true">
                    {i + 1}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {done && (
        <button type="button" className="big-button" onClick={() => newGame()}>
          Play again
        </button>
      )}
    </div>
  );
}

/* ---------- Daily word puzzle ---------- */

function WordGame({
  showTimer,
  onPlayed,
  today,
  found,
  onFound,
}: GameProps & { today: string; found: string[]; onFound: (word: string) => void }) {
  const puzzle = useMemo(() => puzzleForDate(today), [today]);
  const [order, setOrder] = useState(() => puzzle.letters.slice(1));
  const [guess, setGuess] = useState("");
  const [message, setMessage] = useState("");
  const [showAnswers, setShowAnswers] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const complete = found.length === puzzle.answers.length;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const result = checkGuess(puzzle, guess, found);
    if (result.ok) {
      onPlayed();
      onFound(result.word);
      setMessage(
        result.pangram
          ? `Brilliant, "${result.word.toUpperCase()}" uses all seven letters!`
          : `Yes, "${result.word.toUpperCase()}" is in today's list.`,
      );
      setGuess("");
    } else {
      setMessage(result.message);
    }
    inputRef.current?.focus();
  }

  function addLetter(letter: string) {
    setGuess((g) => (g + letter).slice(0, 7));
    inputRef.current?.focus();
  }

  return (
    <div className="bg-game">
      <p>
        Make words of three letters or more from these seven. Every word must use the centre letter,{" "}
        <b>{puzzle.key.toUpperCase()}</b>, and each letter can be used once per word. One word uses all seven. A new
        puzzle starts at midnight.
      </p>
      <div className="bg-letters" role="group" aria-label="Today's letters. Tap a letter to add it to your word.">
        <button type="button" className="bg-letter bg-letter-key" onClick={() => addLetter(puzzle.key)} aria-label={`${puzzle.key.toUpperCase()}, centre letter`}>
          {puzzle.key.toUpperCase()}
        </button>
        {order.map((letter, i) => (
          <button type="button" key={`${letter}-${i}`} className="bg-letter" onClick={() => addLetter(letter)}>
            {letter.toUpperCase()}
          </button>
        ))}
      </div>
      <form className="bg-word-form" onSubmit={submit}>
        <label htmlFor="bg-word-input" className="big-field">
          <span>Your word</span>
        </label>
        <div className="bg-word-row">
          <input
            id="bg-word-input"
            ref={inputRef}
            className="big-input bg-word-input"
            value={guess}
            onChange={(e) => setGuess(e.target.value.replace(/[^a-zA-Z]/g, "").slice(0, 7))}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            inputMode="text"
            maxLength={7}
          />
          <button type="submit" className="big-button" disabled={!guess}>
            Enter
          </button>
        </div>
        <div className="big-actions">
          <button type="button" className="big-button big-button-quiet" onClick={() => setGuess((g) => g.slice(0, -1))}>
            Delete a letter
          </button>
          <button type="button" className="big-button big-button-quiet" onClick={() => setOrder((o) => shuffle(o, Math.random))}>
            Shuffle letters
          </button>
        </div>
      </form>
      <p className="bg-message" aria-live="polite">
        {message}
      </p>
      <Timer show={showTimer} running={!complete && found.length > 0} resetKey={today} />
      <p className="bg-stats">
        Found <b>{found.length}</b> of {puzzle.answers.length} words in today&apos;s list
      </p>
      {found.length > 0 && (
        <ul className="bg-found" aria-label="Words you've found">
          {[...found].sort().map((w) => (
            <li key={w} className={w === puzzle.pangram ? "is-pangram" : undefined}>
              {w}
            </li>
          ))}
        </ul>
      )}
      <details className="bg-answers" open={showAnswers} onToggle={(e) => setShowAnswers((e.target as HTMLDetailsElement).open)}>
        <summary>Show today&apos;s answers</summary>
        {showAnswers && (
          <ul className="bg-found">
            {puzzle.answers.map((w) => (
              <li key={w} className={found.includes(w) ? "is-found" : undefined}>
                {w}
              </li>
            ))}
          </ul>
        )}
      </details>
    </div>
  );
}

/* ---------- Number games ---------- */

const LEVELS: { id: MathsLevel; label: string; hint: string }[] = [
  { id: 1, label: "Level 1", hint: "Adding and taking away up to 20" },
  { id: 2, label: "Level 2", hint: "Bigger sums and times tables" },
  { id: 3, label: "Level 3", hint: "What comes next in the sequence?" },
];

function NumberGame({ showTimer, onPlayed, onCorrect }: GameProps & { onCorrect: () => void }) {
  const [level, setLevel] = useState<MathsLevel>(1);
  const [round, setRound] = useState(0);
  const [question, setQuestion] = useState<MathsQuestion | null>(null);
  const [asked, setAsked] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const done = asked >= ROUND_LENGTH && picked !== null;

  function start(nextLevel: MathsLevel) {
    setLevel(nextLevel);
    setRound((r) => r + 1);
    setQuestion(makeQuestion(nextLevel, Math.random));
    setAsked(1);
    setScore(0);
    setPicked(null);
  }

  // The first question is made in the browser, after the first render.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuestion(makeQuestion(1, Math.random));
    setAsked(1);
  }, []);

  function choose(n: number) {
    if (!question || picked !== null) return;
    onPlayed();
    setPicked(n);
    if (n === question.answer) {
      setScore((s) => s + 1);
      onCorrect();
    }
  }

  function next() {
    if (asked >= ROUND_LENGTH) {
      start(level);
      return;
    }
    setQuestion(makeQuestion(level, Math.random));
    setAsked((a) => a + 1);
    setPicked(null);
  }

  const feedback =
    picked === null || !question
      ? ""
      : picked === question.answer
        ? `Correct, it's ${question.answer}.`
        : `Not quite: the answer is ${question.answer}.`;

  return (
    <div className="bg-game">
      <fieldset className="bg-segment">
        <legend>Choose a level</legend>
        {LEVELS.map((l) => (
          <label key={l.id} className="big-choice">
            <input type="radio" name="maths-level" checked={level === l.id} onChange={() => start(l.id)} />
            <span>{l.label}</span>
          </label>
        ))}
      </fieldset>
      <p className="big-hint">{LEVELS.find((l) => l.id === level)?.hint}</p>
      <Timer show={showTimer} running={!done} resetKey={`${level}-${round}`} />
      {question && (
        <>
          <p className="bg-stats">
            Question <b>{asked}</b> of {ROUND_LENGTH} · Score <b>{score}</b>
          </p>
          <p className="bg-question" aria-label={question.spoken}>
            {question.prompt} {level !== 3 && "= ?"}
          </p>
          <div className="bg-options" role="group" aria-label="Choose an answer">
            {question.choices.map((n) => (
              <button
                key={n}
                type="button"
                className={`bg-option${picked !== null && n === question.answer ? " is-right" : ""}${picked === n && n !== question.answer ? " is-wrong" : ""}`}
                onClick={() => choose(n)}
                aria-disabled={picked !== null || undefined}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="bg-message" aria-live="polite">
            {feedback}
            {done && ` That's the end of the round: you scored ${score} out of ${ROUND_LENGTH}.`}
          </p>
          {picked !== null && (
            <button type="button" className="big-button" onClick={next}>
              {asked >= ROUND_LENGTH ? "Play another round" : "Next question"}
            </button>
          )}
        </>
      )}
    </div>
  );
}

/* ---------- The page's games panel ---------- */

type GameProps = { showTimer: boolean; onPlayed: () => void };

export function BrainGames() {
  const [game, setGame] = useState<GameId>("memory");
  const [showTimer, setShowTimer] = useState(false);
  const [progress, setProgress] = useState<Progress>(EMPTY_PROGRESS);
  const [today, setToday] = useState<string | null>(null);
  const usedTracked = useRef<Set<GameId>>(new Set());

  // The date and saved progress only exist in the browser, so they load after the first render.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(dateKey(new Date()));
    setProgress(loadProgress());
  }, []);

  const update = useCallback((change: (p: Progress) => Progress) => {
    setProgress((current) => {
      const next = change(current);
      if (next !== current) saveProgress(next);
      return next;
    });
  }, []);

  const onPlayed = useCallback(() => {
    if (!today) return;
    update((p) => markPlayed(p, today));
    if (!usedTracked.current.has(game)) {
      usedTracked.current.add(game);
      track("tool_used", { tool: TOOL, action: "play", game });
    }
  }, [today, update, game]);

  const streak = today ? currentStreak(progress, today) : 0;
  const foundToday = today && progress.words?.date === today ? progress.words.found : [];

  return (
    <div className="bg-tool">
      <div className="bg-progress" aria-live="polite">
        {streak > 0 ? (
          <p>
            You&apos;ve played <b>{streak}</b> day{streak === 1 ? "" : "s"} in a row
            {progress.bestStreak > streak ? ` (your best is ${progress.bestStreak})` : ""}.
          </p>
        ) : (
          <p>Play any game to start a daily streak. It&apos;s kept on this device only.</p>
        )}
        <label className="big-check">
          <input type="checkbox" checked={showTimer} onChange={(e) => setShowTimer(e.target.checked)} />
          <span>Show a timer</span>
        </label>
      </div>

      <div className="bg-tabs" role="tablist" aria-label="Games">
        {GAMES.map((g) => (
          <button
            key={g.id}
            type="button"
            role="tab"
            id={`bg-tab-${g.id}`}
            aria-selected={game === g.id}
            aria-controls={`bg-panel-${g.id}`}
            tabIndex={game === g.id ? 0 : -1}
            className="bg-tab"
            onClick={() => setGame(g.id)}
            onKeyDown={(e) => {
              if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
              const i = GAMES.findIndex((x) => x.id === game);
              const next = GAMES[(i + (e.key === "ArrowRight" ? 1 : GAMES.length - 1)) % GAMES.length];
              setGame(next.id);
              document.getElementById(`bg-tab-${next.id}`)?.focus();
            }}
          >
            {g.label}
          </button>
        ))}
      </div>

      <section
        className="bg-panel"
        role="tabpanel"
        id={`bg-panel-${game}`}
        aria-labelledby={`bg-tab-${game}`}
      >
        <h2>{GAMES.find((g) => g.id === game)?.label}</h2>
        {game === "memory" && (
          <MemoryGame
            showTimer={showTimer}
            onPlayed={onPlayed}
            best={progress.memoryBest}
            onWin={(pairs, turns) => {
              track("tool_used", { tool: TOOL, action: "complete", game: "memory", pairs });
              update((p) => {
                const prev = p.memoryBest[String(pairs)];
                return {
                  ...p,
                  memoryWins: p.memoryWins + 1,
                  memoryBest: { ...p.memoryBest, [String(pairs)]: prev ? Math.min(prev, turns) : turns },
                };
              });
            }}
          />
        )}
        {game === "words" &&
          (today ? (
            <WordGame
              key={today}
              showTimer={showTimer}
              onPlayed={onPlayed}
              today={today}
              found={foundToday || []}
              onFound={(word) =>
                update((p) => {
                  const current = p.words?.date === today ? p.words.found : [];
                  return { ...p, words: { date: today, found: [...current, word] } };
                })
              }
            />
          ) : (
            <p>Loading today&apos;s puzzle…</p>
          ))}
        {game === "numbers" && (
          <NumberGame
            showTimer={showTimer}
            onPlayed={onPlayed}
            onCorrect={() => update((p) => ({ ...p, mathsCorrect: p.mathsCorrect + 1 }))}
          />
        )}
      </section>
    </div>
  );
}
