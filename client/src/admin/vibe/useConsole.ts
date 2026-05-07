import { create } from "zustand";

// Lightweight global flag for the in-game VIBE console overlay. Game
// controllers / KeyboardControls subscribers check `isConsoleFocused()`
// to suspend input capture while the console is taking key events.

interface ConsoleState {
  open: boolean;
  toggle: () => void;
  setOpen: (v: boolean) => void;
}

export const useConsoleOverlay = create<ConsoleState>((set) => ({
  open: false,
  toggle: () => set((s) => ({ open: !s.open })),
  setOpen: (v) => set({ open: v }),
}));

let focused = false;
export function setConsoleFocused(v: boolean) { focused = v; }
export function isConsoleFocused(): boolean { return focused; }
