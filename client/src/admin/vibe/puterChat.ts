import { puterReady, type PuterAIMessage, type PuterAIChunk } from "@/lib/auth/puter";

// Models the Puter SDK exposes via `puter.ai.chat`. Source:
// https://docs.puter.com/AI/chat/  — these are the publicly-documented
// model ids the in-browser router accepts.
export const PUTER_MODELS = [
  { id: "gpt-5-nano", name: "GPT-5 Nano" },
  { id: "gpt-5-mini", name: "GPT-5 Mini" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini" },
  { id: "gpt-4o", name: "GPT-4o" },
  { id: "claude-sonnet-4", name: "Claude Sonnet 4" },
  { id: "claude-opus-4", name: "Claude Opus 4" },
  { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash" },
  { id: "deepseek-chat", name: "DeepSeek Chat" },
] as const;

export interface PuterStreamHandlers {
  onToken: (chunk: string) => void;
  onDone: (full: string) => void;
  onError: (err: Error) => void;
}

export async function puterChatStream(
  messages: PuterAIMessage[],
  model: string,
  handlers: PuterStreamHandlers,
): Promise<void> {
  const sdk = await puterReady();
  if (!sdk) {
    handlers.onError(new Error("Puter SDK not loaded — sign in unavailable"));
    return;
  }
  try {
    const result = await sdk.ai.chat(messages, { model, stream: true });
    let full = "";
    if (result && typeof (result as any)[Symbol.asyncIterator] === "function") {
      for await (const part of result as AsyncIterable<PuterAIChunk>) {
        const txt = part?.text ?? "";
        if (txt) {
          full += txt;
          handlers.onToken(txt);
        }
      }
    } else {
      // Fallback: SDK ignored stream:true and returned a single response.
      const r: any = result;
      const txt: string = r?.message?.content ?? r?.toString?.() ?? String(r ?? "");
      full = txt;
      handlers.onToken(txt);
    }
    handlers.onDone(full);
  } catch (e: any) {
    handlers.onError(new Error(e?.message || String(e)));
  }
}
