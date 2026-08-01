"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

export type ToastTone = "success" | "error" | "info" | "warning";

export type ToastInput = {
  title?: string;
  message: string;
  tone?: ToastTone;
  duration?: number;
};

type ToastItem = ToastInput & {
  id: string;
  tone: ToastTone;
  duration: number;
};

type ToastContextValue = {
  toast: (input: ToastInput | string) => void;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION = 4200;
const MAX_TOASTS = 3;

function normalize(input: ToastInput | string): Omit<ToastItem, "id"> {
  if (typeof input === "string") {
    return { message: input, tone: "success", duration: DEFAULT_DURATION };
  }
  return {
    title: input.title,
    message: input.message,
    tone: input.tone ?? "success",
    duration: input.duration ?? DEFAULT_DURATION,
  };
}

function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const [leaving, setLeaving] = useState(false);
  const paused = useRef(false);
  const remaining = useRef(item.duration);
  const startedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finish = useCallback(() => {
    setLeaving(true);
    window.setTimeout(() => onDismiss(item.id), 200);
  }, [item.id, onDismiss]);

  const arm = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    if (item.duration <= 0) return;
    startedAt.current = Date.now();
    timer.current = setTimeout(finish, remaining.current);
  }, [finish, item.duration]);

  useEffect(() => {
    arm();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [arm]);

  function onEnter() {
    paused.current = true;
    if (timer.current) clearTimeout(timer.current);
    remaining.current = Math.max(800, remaining.current - (Date.now() - startedAt.current));
  }

  function onLeave() {
    if (!paused.current) return;
    paused.current = false;
    arm();
  }

  const icon =
    item.tone === "error" || item.tone === "warning" ? (
      <AlertCircle />
    ) : item.tone === "info" ? (
      <Info />
    ) : (
      <CheckCircle2 />
    );

  return (
    <div
      className={`nura-toast ${item.tone}${leaving ? " leaving" : ""}`}
      role="status"
      aria-live="polite"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
    >
      <span className="nura-toast-icon" aria-hidden>
        {icon}
      </span>
      <div className="nura-toast-body">
        {item.title ? <b>{item.title}</b> : null}
        <p>{item.message}</p>
      </div>
      <button
        type="button"
        className="nura-toast-dismiss"
        aria-label="Dismiss"
        onClick={finish}
      >
        <X />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback((input: ToastInput | string) => {
    const next = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ...normalize(input),
    };
    setItems((prev) => [...prev, next].slice(-MAX_TOASTS));
  }, []);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="nura-toast-viewport" aria-live="polite" aria-relevant="additions">
        {items.map((item) => (
          <ToastCard key={item.id} item={item} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
