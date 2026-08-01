/** Client-only helpers for voice notes in browser + Capacitor WKWebView. */

type CapacitorBridge = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
};

function capacitorBridge(): CapacitorBridge | null {
  if (typeof window === "undefined") return null;
  return (window as Window & { Capacitor?: CapacitorBridge }).Capacitor ?? null;
}

export function isNativeCapacitorShell() {
  try {
    return Boolean(capacitorBridge()?.isNativePlatform?.());
  } catch {
    return false;
  }
}

export function isAppleMobileClient() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/i.test(ua)) return true;
  // iPadOS desktop UA
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

/** Prefer formats WKWebView / Safari actually record. */
export function pickRecorderMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  const apple = isAppleMobileClient() || capacitorBridge()?.getPlatform?.() === "ios";
  const candidates = apple
    ? ["audio/mp4", "audio/aac", "audio/webm;codecs=opus", "audio/webm"]
    : ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return candidates.find((type) => {
    try {
      return MediaRecorder.isTypeSupported(type);
    } catch {
      return false;
    }
  }) || "";
}

export function voiceRecordingFileName(mimeType: string) {
  if (mimeType.includes("mp4") || mimeType.includes("aac") || mimeType.includes("m4a")) {
    return "voice-note.m4a";
  }
  if (mimeType.includes("ogg")) return "voice-note.ogg";
  return "voice-note.webm";
}

export function voiceMicDeniedMessage() {
  if (isNativeCapacitorShell()) {
    return "Allow microphone access for Nura in your phone Settings, then try again — or type it in.";
  }
  return "Allow mic access for this site, or type it in.";
}

export function voiceUnavailableMessage() {
  if (isNativeCapacitorShell()) {
    return "Voice recording isn’t available on this device right now. Type it in instead.";
  }
  return "This browser can’t record audio. Type it in instead.";
}
