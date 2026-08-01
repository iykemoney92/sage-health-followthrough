"use client";

import { useEffect, useRef } from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";

type AuthErrorLike = {
  message?: string;
  msg?: string;
  error?: string;
  error_description?: string;
  status?: number;
  code?: string;
  name?: string;
};

function extractAuthError(raw: unknown): { message: string; status?: number; code?: string; name?: string } {
  if (typeof raw === "string") return { message: raw.trim() };
  if (!raw || typeof raw !== "object") return { message: "" };

  const error = raw as AuthErrorLike;
  const candidates = [error.message, error.msg, error.error_description, error.error];
  const message = candidates.find((value) => typeof value === "string" && value.trim() && value.trim() !== "{}")?.trim() ?? "";

  return {
    message,
    status: typeof error.status === "number" ? error.status : undefined,
    code: typeof error.code === "string" ? error.code : undefined,
    name: typeof error.name === "string" ? error.name : undefined,
  };
}

export function friendlyAuthError(raw: unknown) {
  const { message, status, code, name } = extractAuthError(raw);
  const lower = message.toLowerCase();
  const codeLower = (code || "").toLowerCase();
  const nameLower = (name || "").toLowerCase();

  if (
    lower.includes("invalid login credentials") ||
    lower.includes("invalid credentials") ||
    (lower.includes("invalid") && lower.includes("credential"))
  ) {
    return {
      title: "Couldn’t sign you in",
      message: "That email or password doesn’t match. Check them and try again.",
    };
  }

  if (lower.includes("email not confirmed")) {
    return {
      title: "Confirm your email",
      message: "Check your inbox for the confirmation link, then come back to sign in.",
    };
  }

  if (lower.includes("user already registered") || lower.includes("already been registered") || lower.includes("already exists")) {
    return {
      title: "Account already exists",
      message: "An account with this email already exists. Sign in, or reset your password if you’ve forgotten it.",
    };
  }

  if (lower.includes("password") && (lower.includes("weak") || lower.includes("least") || lower.includes("characters"))) {
    return {
      title: "Password too short",
      message: "Use at least 6 characters, then try again.",
    };
  }

  if (
    lower.includes("rate limit") ||
    lower.includes("too many") ||
    lower.includes("security purposes") ||
    codeLower.includes("over_email_send_rate_limit")
  ) {
    return {
      title: "Slow down for a moment",
      message: "Too many attempts. Wait a bit, then try again.",
    };
  }

  if (
    lower.includes("error sending recovery email") ||
    lower.includes("error sending") ||
    lower.includes("error sending confirmation") ||
    codeLower.includes("unexpected_failure") ||
    message === "{}" ||
    ((status === 500 || nameLower.includes("retryable")) && (!message || message === "{}"))
  ) {
    return {
      title: "Couldn’t send the email",
      message: "We couldn’t send the email right now. Try again in a minute, or contact support if it keeps failing.",
    };
  }

  if (lower.includes("redirect") || lower.includes("redirect_uri")) {
    return {
      title: "Reset link isn’t ready",
      message: "The reset link destination isn’t configured yet. Contact support and we’ll sort it.",
    };
  }

  if (lower.includes("network") || lower.includes("fetch") || nameLower.includes("retryable")) {
    return {
      title: "Connection issue",
      message: "Check your internet connection and try again.",
    };
  }

  return {
    title: "Something went wrong",
    message: message && message !== "{}" ? message : "Please try again in a moment.",
  };
}

export function AuthAlert({
  tone = "error",
  title,
  message,
  onDismiss,
}: {
  tone?: "error" | "success";
  title?: string;
  message: string;
  onDismiss?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, [message, title]);

  const Icon = tone === "success" ? CheckCircle2 : AlertCircle;

  return (
    <div
      ref={ref}
      className={`auth-alert ${tone}`}
      role="alert"
      aria-live="assertive"
      tabIndex={-1}
    >
      <span className="auth-alert-icon" aria-hidden>
        <Icon size={18} />
      </span>
      <div className="auth-alert-copy">
        {title ? <b>{title}</b> : null}
        <p>{message}</p>
      </div>
      {onDismiss ? (
        <button type="button" className="auth-alert-dismiss" aria-label="Dismiss" onClick={onDismiss}>
          <X size={15} />
        </button>
      ) : null}
    </div>
  );
}
