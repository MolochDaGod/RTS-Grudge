import { useCallback, useEffect, useRef, useState } from "react";

// Minimal local typings for the Web Speech API — TS lib.dom doesn't ship
// SpeechRecognition globals because the spec is still vendor-prefixed.
interface SRAlternative {
  transcript: string;
  confidence: number;
}
interface SRResult {
  readonly length: number;
  readonly isFinal: boolean;
  [index: number]: SRAlternative;
}
interface SRResultList {
  readonly length: number;
  [index: number]: SRResult;
}
interface SREvent extends Event {
  readonly resultIndex: number;
  readonly results: SRResultList;
}
interface SRErrorEvent extends Event {
  readonly error: string;
  readonly message?: string;
}
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((ev: SREvent) => void) | null;
  onerror: ((ev: SRErrorEvent) => void) | null;
  onend: ((ev: Event) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
interface SpeechRecognitionCtor {
  new (): SpeechRecognition;
}
interface SpeechRecognitionWindow {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
}

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as SpeechRecognitionWindow;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isDictationSupported(): boolean {
  return getSpeechRecognition() !== null;
}

export interface UseDictationOptions {
  onTranscript: (text: string, isFinal: boolean) => void;
  /**
   * Fired when a stop word is detected. The `finalText` argument is the
   * cleaned transcript chunk (stop word stripped) that was just committed
   * via `onTranscript`, so callers don't need to read potentially-stale
   * React state to know what was just dictated.
   */
  onStopWord?: (finalText: string) => void;
  onError?: (msg: string) => void;
  lang?: string;
}

const STOP_WORDS = [
  "send it",
  "send message",
  "submit",
  "stop dictation",
  "stop listening",
];

export function useDictation(opts: UseDictationOptions) {
  const { onError, lang = "en-US" } = opts;
  const [listening, setListening] = useState(false);
  const recogRef = useRef<SpeechRecognition | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const stop = useCallback(() => {
    const r = recogRef.current;
    if (r) {
      try { r.stop(); } catch { /* already stopped */ }
    }
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      onError?.("Voice dictation is not supported in this browser.");
      return;
    }
    if (recogRef.current) {
      try { recogRef.current.stop(); } catch { /* ignore */ }
    }
    const r: SpeechRecognition = new Ctor();
    r.continuous = true;
    r.interimResults = true;
    r.lang = lang;

    r.onresult = (event: SREvent) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const txt = res[0]?.transcript ?? "";
        if (res.isFinal) final += txt;
        else interim += txt;
      }
      if (final) {
        // Normalize trailing punctuation/whitespace before stop-word match
        // (Chrome often emits "send it.", "submit!", etc.).
        const lower = final.toLowerCase().replace(/[\s.!?,;:]+$/g, "");
        const matched = STOP_WORDS.find((w) => lower.endsWith(w));
        if (matched) {
          const cleaned = final.replace(new RegExp(matched + "[\\s.!?,;:]*$", "i"), "").trim();
          if (cleaned) optsRef.current.onTranscript(cleaned, true);
          optsRef.current.onStopWord?.(cleaned);
          try { r.stop(); } catch { /* ignore */ }
          return;
        }
        optsRef.current.onTranscript(final, true);
      } else if (interim) {
        optsRef.current.onTranscript(interim, false);
      }
    };

    r.onerror = (e: SRErrorEvent) => {
      const msg = e.error || "speech-error";
      if (msg !== "no-speech" && msg !== "aborted") {
        optsRef.current.onError?.(`Dictation error: ${msg}`);
      }
      setListening(false);
    };
    r.onend = () => {
      setListening(false);
    };

    recogRef.current = r;
    try {
      r.start();
      setListening(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      onError?.(`Could not start dictation: ${msg}`);
      setListening(false);
    }
  }, [lang, onError]);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  useEffect(() => {
    return () => {
      const r = recogRef.current;
      if (r) {
        try { r.stop(); } catch { /* ignore */ }
      }
    };
  }, []);

  return { listening, start, stop, toggle, supported: isDictationSupported() };
}
