import { create } from "zustand";

export interface KeybindConfig {
  forward: string[];
  backward: string[];
  left: string[];
  right: string[];
  sprint: string[];
  jump: string[];
  interact: string[];
  dash: string[];
  roll: string[];
  use: string[];
  attack: string;
  block: string;
  skill1: string;
  skill2: string;
  skill3: string;
  skill4: string;
  skill5: string;
  classAbility: string;
  classAbility2: string;
  inventory: string;
  combat: string;
  skills: string;
  pause: string;
  tabTarget: string;
}

export interface GraphicsSettings {
  quality: "low" | "medium" | "high";
  shadows: boolean;
  particles: boolean;
  postProcessing: boolean;
  viewDistance: number;
}

export interface AudioSettings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  ambientVolume: number;
  muted: boolean;
}

export interface GameplaySettings {
  showDamageNumbers: boolean;
  showHealthBars: boolean;
  showMinimap: boolean;
  showFPS: boolean;
  cameraDistance: number;
  cameraSensitivity: number;
  autoAttack: boolean;
  screenShake: boolean;
  flashEffects: boolean;
}

export interface SettingsState {
  graphics: GraphicsSettings;
  audio: AudioSettings;
  gameplay: GameplaySettings;
  keybinds: KeybindConfig;
  settingsOpen: boolean;

  setGraphics: (partial: Partial<GraphicsSettings>) => void;
  setAudio: (partial: Partial<AudioSettings>) => void;
  setGameplay: (partial: Partial<GameplaySettings>) => void;
  openSettings: () => void;
  closeSettings: () => void;
  resetDefaults: () => void;
}

const DEFAULT_KEYBINDS: KeybindConfig = {
  forward: ["KeyW", "ArrowUp"],
  backward: ["KeyS", "ArrowDown"],
  left: ["KeyA", "ArrowLeft"],
  right: ["KeyD", "ArrowRight"],
  sprint: ["ShiftLeft", "ShiftRight"],
  jump: ["Space"],
  interact: ["KeyT"],
  dash: ["KeyQ"],
  roll: ["ControlLeft", "ControlRight"],
  use: ["KeyF"],
  attack: "LMB",
  block: "RMB",
  skill1: "1",
  skill2: "2",
  skill3: "3",
  skill4: "4",
  skill5: "5",
  classAbility: "R",
  classAbility2: "E",
  inventory: "B",
  combat: "C",
  skills: "K",
  pause: "ESC",
  tabTarget: "TAB",
};

const DEFAULT_GRAPHICS: GraphicsSettings = {
  quality: "medium",
  shadows: true,
  particles: true,
  postProcessing: true,
  viewDistance: 250,
};

const DEFAULT_AUDIO: AudioSettings = {
  masterVolume: 0.7,
  musicVolume: 0.3,
  sfxVolume: 0.5,
  ambientVolume: 0.4,
  muted: false,
};

const DEFAULT_GAMEPLAY: GameplaySettings = {
  showDamageNumbers: true,
  showHealthBars: true,
  showMinimap: true,
  showFPS: false,
  cameraDistance: 15,
  cameraSensitivity: 1.0,
  autoAttack: false,
  screenShake: true,
  flashEffects: true,
};

export const useSettings = create<SettingsState>()((set) => ({
  graphics: { ...DEFAULT_GRAPHICS },
  audio: { ...DEFAULT_AUDIO },
  gameplay: { ...DEFAULT_GAMEPLAY },
  keybinds: { ...DEFAULT_KEYBINDS },
  settingsOpen: false,

  setGraphics: (partial) => set((s) => ({ graphics: { ...s.graphics, ...partial } })),
  setAudio: (partial) => set((s) => ({ audio: { ...s.audio, ...partial } })),
  setGameplay: (partial) => set((s) => ({ gameplay: { ...s.gameplay, ...partial } })),
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
  resetDefaults: () => set({
    graphics: { ...DEFAULT_GRAPHICS },
    audio: { ...DEFAULT_AUDIO },
    gameplay: { ...DEFAULT_GAMEPLAY },
  }),
}));
