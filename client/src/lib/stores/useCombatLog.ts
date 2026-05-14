import { create } from "zustand";

export interface CombatLogEntry {
  id: number;
  text: string;
  color: string;
  timestamp: number;
}

let _logId = 0;
const MAX_ENTRIES = 50;

interface CombatLogState {
  entries: CombatLogEntry[];
  addEntry: (text: string, color?: string) => void;
  clear: () => void;
}

export const useCombatLog = create<CombatLogState>((set) => ({
  entries: [
    { id: _logId++, text: "[System] Welcome, warrior.", color: "#c9950a", timestamp: Date.now() },
    { id: _logId++, text: "[System] Enemies approach...", color: "#66ff66", timestamp: Date.now() },
  ],

  addEntry: (text: string, color: string = "#cccccc") => {
    set((state) => ({
      entries: [
        ...state.entries.slice(-(MAX_ENTRIES - 1)),
        { id: _logId++, text, color, timestamp: Date.now() },
      ],
    }));
  },

  clear: () => set({
    entries: [
      { id: _logId++, text: "[System] Welcome, warrior.", color: "#c9950a", timestamp: Date.now() },
    ],
  }),
}));
