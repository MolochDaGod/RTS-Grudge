import { create } from "zustand";
import type { DialogueLine } from "../dialog/dialogueData";
import type { VoicePackKey } from "../dialog/voicePacks";
import { playVoice, stopCurrentVoice } from "../dialog/playVoice";
import { getDialogueScript } from "../dialog/dialogueData";

const TYPEWRITER_CHARS_PER_SEC = 45;

interface NearbyEntry {
  npcId: string;
  dist: number;
}

interface DialogState {
  active: boolean;
  npcId: string | null;
  speakerName: string;
  voicePack: VoicePackKey | null;
  lines: DialogueLine[];
  index: number;
  revealedChars: number;

  nearby: NearbyEntry | null;

  open: (npcId: string) => boolean;
  next: () => void;
  close: () => void;
  tickReveal: (delta: number) => void;
  setNearby: (npcId: string, dist: number) => void;
  clearNearby: (npcId: string) => void;
}

export const useDialog = create<DialogState>((set, get) => ({
  active: false,
  npcId: null,
  speakerName: "",
  voicePack: null,
  lines: [],
  index: 0,
  revealedChars: 0,
  nearby: null,

  open: (npcId) => {
    const script = getDialogueScript(npcId);
    if (!script) return false;
    set({
      active: true,
      npcId,
      speakerName: script.speakerName,
      voicePack: script.voicePack,
      lines: script.lines,
      index: 0,
      revealedChars: 0,
    });
    return true;
  },

  next: () => {
    const { lines, index, revealedChars } = get();
    if (lines.length === 0) return;
    const fullLen = lines[index]?.text.length ?? 0;
    if (revealedChars < fullLen) {
      set({ revealedChars: fullLen });
      return;
    }
    if (index + 1 < lines.length) {
      set({ index: index + 1, revealedChars: 0 });
    } else {
      get().close();
    }
  },

  close: () => {
    const { voicePack, npcId } = get();
    if (voicePack) {
      playVoice(voicePack, "bye", { cooldownKey: `bye:${npcId}`, cooldownMs: 1500, interrupt: true });
    } else {
      stopCurrentVoice();
    }
    set({
      active: false,
      npcId: null,
      speakerName: "",
      voicePack: null,
      lines: [],
      index: 0,
      revealedChars: 0,
    });
  },

  tickReveal: (delta) => {
    const { active, lines, index, revealedChars } = get();
    if (!active) return;
    const fullLen = lines[index]?.text.length ?? 0;
    if (revealedChars >= fullLen) return;
    const next = Math.min(fullLen, revealedChars + TYPEWRITER_CHARS_PER_SEC * delta);
    set({ revealedChars: next });
  },

  setNearby: (npcId, dist) => {
    const cur = get().nearby;
    // Switch ownership when there is no current claim, the new dist is closer
    // than the current claim, or it's the same NPC and the distance changed
    // by more than a small epsilon (avoids re-render churn each frame).
    if (!cur) {
      set({ nearby: { npcId, dist } });
      return;
    }
    if (cur.npcId === npcId) {
      if (Math.abs(cur.dist - dist) > 0.15) {
        set({ nearby: { npcId, dist } });
      }
      return;
    }
    if (dist < cur.dist) {
      set({ nearby: { npcId, dist } });
    }
  },

  clearNearby: (npcId) => {
    const cur = get().nearby;
    if (cur && cur.npcId === npcId) {
      set({ nearby: null });
    }
  },
}));
