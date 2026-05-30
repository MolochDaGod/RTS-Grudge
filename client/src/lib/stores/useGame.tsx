import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import * as THREE from "three";
import type { BodyMorphConfig, WeaponOffsetConfig } from "@/game/systems/BoneAliases";
import { DEFAULT_WEAPON_OFFSET } from "@/game/systems/BoneAliases";
import { useCharacterStats, type HeroClass } from "@/lib/stores/useCharacterStats";
export type { HeroClass };
import { onModeSwitch } from "@/game/controllers/ModeController";
import { useCampaign } from "@/lib/stores/useCampaign";
import { markIntroSeen } from "@/lib/save/introFlags";

export type GamePhase = "menu" | "home" | "characterSelect" | "loading" | "intro" | "playing" | "dead" | "paused" | "admin" | "gge" | "controller" | "combat2d" | "islandV2" | "wallet" | "playEntrypoint";
export type InteractionMode = "combat" | "build" | "harvest";

export type WeaponType = "sword" | "greatsword" | "staff" | "wand" | "bow" | "axe" | "poleaxe" | "hammer" | "dagger" | "shield" | "fists" | "crossbow" | "gun";

// === Class taxonomy ===
// CombatClass is the underlying combat archetype (melee / caster / ranger).
// Every character — unit OR hero — uses one of these for animations & weapon resolution.
// Units are the workers the player recruits/trains. Heroes are unique champions.
// A unit that reaches level 100 promotes into a hero of the matching class:
//   worker-melee   -> warrior
//   worker-caster  -> mage   (or worge variant)
//   worker-ranger  -> ranger
export type CombatClass = "melee" | "caster" | "ranger";
export type UnitClass = "worker-melee" | "worker-caster" | "worker-ranger";
// HeroClass is the single source of truth in useCharacterStats: warrior | ranger | mage | worge
export type Rank = "unit" | "hero";

export const UNIT_TO_HERO_CLASS: Record<UnitClass, HeroClass> = {
  "worker-melee": "warrior",
  "worker-ranger": "ranger",
  "worker-caster": "mage",
};
export const HERO_TO_COMBAT_CLASS: Record<HeroClass, CombatClass> = {
  warrior: "melee",
  ranger: "ranger",
  mage: "caster",
  worge: "caster",
};
export const UNIT_TO_COMBAT_CLASS: Record<UnitClass, CombatClass> = {
  "worker-melee": "melee",
  "worker-ranger": "ranger",
  "worker-caster": "caster",
};
export const HERO_PROMOTION_LEVEL = 100;

let resetEnemies: (() => void) | null = null;

export function registerEnemyReset(fn: () => void) {
  resetEnemies = fn;
}

export interface MaterialColors {
  skin: string | null;
  clothing: string | null;
  pants: string | null;
  hair: string | null;
  hat: string | null;
  armor: string | null;
  detail: string | null;
}

export interface CharacterConfig {
  characterId: string;
  modelPath: string;
  name: string;
  scale: number;
  baseHeight: number;
  speedMultiplier: number;
  combatClass: CombatClass;
  weaponRight: WeaponType;
  weaponLeft: WeaponType | null;
  materialColors: MaterialColors;
  bodyMorph?: BodyMorphConfig;
  weaponOffset?: WeaponOffsetConfig;
  weaponModelRight?: string | null;
  weaponModelLeft?: string | null;
  arrowModelId?: string | null;
  backAccessoryId?: string | null;
  faction?: string;
  /**
   * When set, this character is a Worge and can transform into bear form.
   * CLASS_ABILITY_3 toggles between modelPath (human/night-stalker form) and
   * this path (werewolf / bear form). Null for non-worge characters.
   */
  worgeFormModelPath?: string | null;
}

export const DEFAULT_CHARACTER: CharacterConfig = {
  characterId: "human_warrior",
  // Default to the Grudge 6 Human (Western Kingdoms) race model —
  // Crusade faction warrior with sword + shield.
  modelPath: "https://molochdagod.github.io/ObjectStore/models/factioncharacters/wk/WK_Characters_customizable.glb",
  name: "Warlord",
  scale: 1.0,
  baseHeight: 1.8,
  speedMultiplier: 1.0,
  combatClass: "melee",
  weaponRight: "sword",
  weaponLeft: "shield",
  faction: "crusade",
  materialColors: {
    skin: null,
    clothing: null,
    pants: null,
    hair: null,
    hat: null,
    armor: null,
    detail: null,
  },
};

export interface SkillCooldowns {
  skill1: number;
  skill2: number;
  skill3: number;
  skill4: number;
  skill5: number;
  classAbility1: number;
  classAbility2: number;
  classAbility3: number;
}

interface GameState {
  phase: GamePhase;
  score: number;
  wave: number;
  enemiesKilled: number;
  dayTime: number;
  isDaytime: boolean;
  /**
   * Active weather mode. Drives the `WeatherEvents` overlay (volumetric storm
   * clouds, lightning, screen-space rain). The base sky/sun/lensflare always
   * render underneath; weather is a layered effect, not a sky replacement.
   */
  weather: "clear" | "cloudy" | "rain" | "storm";
  /**
   * 0..1. Maps to the Shadertoy `cloudy` parameter that drives cloud density,
   * rain density, lightning frequency, and the global darken-vignette. Stored
   * separately from `weather` so transitions can lerp this without flipping
   * the discrete mode mid-fade.
   */
  weatherIntensity: number;
  setWeather: (mode: "clear" | "cloudy" | "rain" | "storm", intensity?: number) => void;
  showCrafting: boolean;
  activePanel: "combat" | "inventory" | "skills" | "settings" | "campaign" | "hotkeys" | null;
  inDungeon: boolean;
  inHousing: boolean;
  inTutorialIsland: boolean;
  dungeonLevel: number;
  dungeonSeed: number;
  overworldReturnPos: { x: number; z: number } | null;
  housingReturnPos: { x: number; z: number } | null;
  tutorialReturnPos: { x: number; z: number } | null;
  interactionMode: InteractionMode;
  selectedCharacter: CharacterConfig;
  playerPosition: THREE.Vector3 | null;
  updatePlayerPosition: (pos: THREE.Vector3) => void;
  cycleInteractionMode: () => void;
  setInteractionMode: (mode: InteractionMode) => void;

  xp: number;
  level: number;
  xpToNext: number;
  comboCount: number;
  comboTimer: number;
  maxCombo: number;
  critChance: number;
  skillCooldowns: SkillCooldowns;

  start: () => void;
  restart: () => void;
  die: () => void;
  pause: () => void;
  resume: () => void;
  addScore: (points: number) => void;
  addKill: () => void;
  updateDayTime: (delta: number) => void;
  toggleCrafting: () => void;
  togglePanel: (panel: "combat" | "inventory" | "skills" | "settings" | "campaign" | "hotkeys") => void;
  closePanel: () => void;
  nextWave: () => void;
  enterDungeon: (level: number, returnPos: { x: number; z: number }) => void;
  exitDungeon: () => void;
  enterHousing: (returnPos: { x: number; z: number }) => void;
  exitHousing: () => void;
  enterTutorialIsland: (returnPos?: { x: number; z: number } | null) => void;
  exitTutorialIsland: () => void;
  goToHome: () => void;
  goToCharacterSelect: () => void;
  goToAdmin: () => void;
  goToGGE: () => void;
  goToController: () => void;
  goToCombat2d: () => void;
  goToIslandV2: () => void;
  goToWallet: () => void;
  goToPlayEntrypoint: () => void;
  startLoading: (config: CharacterConfig) => void;
  finishLoading: () => void;
  finishIntro: () => void;
  startWithCharacter: (config: CharacterConfig) => void;
  setSelectedCharacterWeaponOffset: (offset: WeaponOffsetConfig) => void;
  addXP: (amount: number) => boolean;
  incrementCombo: () => number;
  resetCombo: () => void;
  tickComboTimer: (delta: number) => void;
  tickSkillCooldowns: (delta: number) => void;
  useSkillCooldown: (skill: keyof SkillCooldowns, cooldownTime: number) => boolean;
  getComboMultiplier: () => number;
  rollCrit: () => boolean;
}

const INITIAL_PROGRESSION = {
  xp: 0,
  level: 1,
  xpToNext: 100,
  comboCount: 0,
  comboTimer: 0,
  maxCombo: 0,
  critChance: 0.05,
  skillCooldowns: { skill1: 0, skill2: 0, skill3: 0, skill4: 0, skill5: 0, classAbility1: 0, classAbility2: 0, classAbility3: 0 } as SkillCooldowns,
};

const SKILL_MAX_COOLDOWNS: Record<string, number> = {
  skill1: 3.0,
  skill2: 4.0,
  skill3: 5.0,
  skill4: 3.0,
  skill5: 4.0,
  classAbility1: 6.0,
  classAbility2: 8.0,
  classAbility3: 12.0,
};

export { SKILL_MAX_COOLDOWNS };

export const useGame = create<GameState>()(
  subscribeWithSelector((set, get) => ({
    phase: "menu",
    score: 0,
    wave: 1,
    enemiesKilled: 0,
    dayTime: 0.3,
    isDaytime: true,
    weather: "clear",
    weatherIntensity: 0,
    showCrafting: false,
    activePanel: null,
    inDungeon: false,
    inHousing: false,
    inTutorialIsland: false,
    dungeonLevel: 1,
    dungeonSeed: 0,
    overworldReturnPos: null,
    housingReturnPos: null,
    tutorialReturnPos: null,
    interactionMode: "combat" as InteractionMode,
    selectedCharacter: DEFAULT_CHARACTER,
    playerPosition: null,
    ...INITIAL_PROGRESSION,

    cycleInteractionMode: () => set((s) => {
      const modes: InteractionMode[] = ["combat", "build", "harvest"];
      const idx = modes.indexOf(s.interactionMode);
      const next = modes[(idx + 1) % modes.length];
      onModeSwitch(s.interactionMode, next);
      return { interactionMode: next };
    }),
    setInteractionMode: (mode: InteractionMode) => set((s) => {
      if (s.interactionMode !== mode) {
        onModeSwitch(s.interactionMode, mode);
      }
      return { interactionMode: mode };
    }),

    updatePlayerPosition: (pos: THREE.Vector3) => {
      const state = get();
      if (!state.playerPosition) {
        set({ playerPosition: pos.clone() });
      } else {
        state.playerPosition.copy(pos);
      }
    },

    start: () => set({
      phase: "playing", score: 0, wave: 1, enemiesKilled: 0,
      dayTime: 0.3, isDaytime: true, weather: "clear", weatherIntensity: 0, showCrafting: false, activePanel: null,
      inDungeon: false, inHousing: false, dungeonLevel: 1, dungeonSeed: 0,
      overworldReturnPos: null, housingReturnPos: null,
      interactionMode: "combat" as InteractionMode,
      ...INITIAL_PROGRESSION,
    }),
    restart: () => set({
      phase: "menu", score: 0, wave: 1, enemiesKilled: 0,
      dayTime: 0.3, isDaytime: true, weather: "clear", weatherIntensity: 0, showCrafting: false, activePanel: null,
      inDungeon: false, inHousing: false, dungeonLevel: 1, dungeonSeed: 0,
      overworldReturnPos: null, housingReturnPos: null,
      interactionMode: "combat" as InteractionMode,
      ...INITIAL_PROGRESSION,
    }),
    die: () => set({ phase: "dead" }),
    pause: () => set((s) => (s.phase === "playing" ? { phase: "paused" } : {})),
    resume: () => set((s) => (s.phase === "paused" ? { phase: "playing" } : {})),
    addScore: (points) => set((s) => ({ score: s.score + points })),
    addKill: () => set((s) => ({ enemiesKilled: s.enemiesKilled + 1 })),
    updateDayTime: (delta) =>
      set((s) => {
        // Day/night cycle: 20 real minutes of day, 10 real minutes of night.
        // dayTime is 0..1 mapping to 0..24 game hours.
        // Day window: 6:00 -> 21:00 (15 game hours, dayTime 0.25 -> 0.875)
        // Night window: 21:00 -> 6:00 next day (9 game hours, wraps)
        const hours = (s.dayTime * 24) % 24;
        const isDay = hours >= 6 && hours < 21;
        // Rate (dayTime units per real second):
        //   day:   (15h / 24h) / (20*60s) = 0.625 / 1200 ≈ 5.208e-4
        //   night: (9h  / 24h) / (10*60s) = 0.375 / 600  ≈ 6.250e-4
        const rate = isDay ? 0.625 / 1200 : 0.375 / 600;
        const newTime = (s.dayTime + delta * rate) % 1;
        const newHours = (newTime * 24) % 24;
        return { dayTime: newTime, isDaytime: newHours >= 6 && newHours < 21 };
      }),
    setWeather: (mode, intensity) => set(() => {
      // Default intensity per mode mirrors the Shadertoy `cloudy` parameter
      // ranges where rain triggers around 0.15+ and lightning around 0.2+.
      const fallback = mode === "clear" ? 0 : mode === "cloudy" ? 0.4 : mode === "rain" ? 0.7 : 1.0;
      const i = intensity == null ? fallback : Math.max(0, Math.min(1, intensity));
      return { weather: mode, weatherIntensity: i };
    }),
    toggleCrafting: () => set((s) => ({ showCrafting: !s.showCrafting })),
    togglePanel: (panel) => set((s) => ({
      activePanel: s.activePanel === panel ? null : panel,
      showCrafting: false,
    })),
    closePanel: () => set({ activePanel: null, showCrafting: false }),
    nextWave: () => set((s) => ({ wave: s.wave + 1 })),
    enterDungeon: (level, returnPos) => {
      if (resetEnemies) resetEnemies();
      set({
        inDungeon: true,
        dungeonLevel: level,
        dungeonSeed: Math.floor(Math.random() * 999999),
        overworldReturnPos: returnPos,
      });
    },
    exitDungeon: () => {
      if (resetEnemies) resetEnemies();
      set({
        inDungeon: false,
      });
    },
    enterHousing: (returnPos) => {
      set({
        inHousing: true,
        housingReturnPos: returnPos,
        showCrafting: false,
      });
    },
    exitHousing: () => {
      set((s) => ({
        inHousing: false,
        housingReturnPos: s.housingReturnPos,
      }));
    },
    enterTutorialIsland: (returnPos = null) => {
      if (resetEnemies) resetEnemies();
      set({
        inTutorialIsland: true,
        tutorialReturnPos: returnPos ?? null,
        showCrafting: false,
        activePanel: null,
        phase: "playing",
      });
    },
    exitTutorialIsland: () => {
      if (resetEnemies) resetEnemies();
      set({
        inTutorialIsland: false,
      });
    },
    goToHome: () => set({ phase: "home" }),
    goToCharacterSelect: () => set({ phase: "characterSelect" }),
    goToAdmin: () => set({ phase: "admin" }),
    goToGGE: () => set({ phase: "gge" }),
    goToController: () => set({ phase: "controller" }),
    goToCombat2d: () => set({ phase: "combat2d" }),
    goToIslandV2: () => set({ phase: "islandV2" }),
    goToWallet: () => set({ phase: "wallet" }),
    goToPlayEntrypoint: () => set({ phase: "playEntrypoint" }),
    startLoading: (config) => set({
      selectedCharacter: config,
      phase: "loading",
    }),
    finishLoading: () => {
      const s = get();
      if (s.phase === "loading") {
        const campaignActive = useCampaign.getState().active;
        if (campaignActive) {
          set({ phase: "intro" });
        } else {
          set({
            phase: "playing", score: 0, wave: 1, enemiesKilled: 0,
            dayTime: 0.3, isDaytime: true, weather: "clear", weatherIntensity: 0, showCrafting: false,
            inDungeon: false, inHousing: false, dungeonLevel: 1, dungeonSeed: 0,
            overworldReturnPos: null, housingReturnPos: null,
            ...INITIAL_PROGRESSION,
          });
        }
      }
    },
    finishIntro: () => {
      const s = get();
      if (s.phase === "intro") {
        // Mark intro as seen so returning players skip it.
        markIntroSeen();
        // The campaign flow (PLAY button → PlayEntrypoint → intro cinematic)
        // always intends to land on the shipwreck / tutorial island after
        // the intro. `finishIntro` is only reachable from the "intro" phase,
        // which is only entered when `startCampaign()` ran, so unconditionally
        // forcing the wreck-island flag here is safe and matches the
        // cinematic's final beat (player washing up on the shore).
        set({
          phase: "playing", score: 0, wave: 1, enemiesKilled: 0,
          dayTime: 0.3, isDaytime: true, weather: "clear", weatherIntensity: 0, showCrafting: false,
          inDungeon: false, inHousing: false, dungeonLevel: 1, dungeonSeed: 0,
          overworldReturnPos: null, housingReturnPos: null,
          inTutorialIsland: true,
          ...INITIAL_PROGRESSION,
        });
      }
    },
    setSelectedCharacterWeaponOffset: (offset) => {
      set((s) => ({
        selectedCharacter: { ...s.selectedCharacter, weaponOffset: offset },
      }));
      try {
        const all = JSON.parse(localStorage.getItem("character_edits") || "{}");
        const isDefault =
          offset.rightPos.every((v) => v === 0) &&
          offset.rightRot.every((v) => v === 0) &&
          offset.rightScale.every((v) => v === 1) &&
          offset.leftPos.every((v) => v === 0) &&
          offset.leftRot.every((v) => v === 0) &&
          offset.leftScale.every((v) => v === 1);
        const charId = get().selectedCharacter.characterId || "hero";
        const existing = all[charId] || {};
        all[charId] = {
          ...existing,
          weaponOffset: isDefault ? { ...DEFAULT_WEAPON_OFFSET } : offset,
          _ts: Date.now(),
        };
        localStorage.setItem("character_edits", JSON.stringify(all));
      } catch {}
    },
    startWithCharacter: (config) => set({
      selectedCharacter: config,
      phase: "playing", score: 0, wave: 1, enemiesKilled: 0,
      dayTime: 0.3, isDaytime: true, weather: "clear", weatherIntensity: 0, showCrafting: false,
      inDungeon: false, inHousing: false, dungeonLevel: 1, dungeonSeed: 0,
      overworldReturnPos: null, housingReturnPos: null,
      ...INITIAL_PROGRESSION,
    }),

    addXP: (amount) => {
      const s = get();
      const charId = s.selectedCharacter.characterId;
      const charStats = useCharacterStats.getState();
      const hero = charStats.heroes[charId];
      if (hero) {
        charStats.addExperience(charId, amount);
        const updated = useCharacterStats.getState().heroes[charId];
        if (updated) {
          const leveled = updated.level > s.level;
          set({
            xp: updated.experience,
            level: updated.level,
            xpToNext: updated.experienceToNext,
            critChance: Math.min(0.35, 0.05 + updated.level * 0.02),
          });
          return leveled;
        }
      }
      const newXP = s.xp + amount;
      if (newXP >= s.xpToNext) {
        const newLevel = s.level + 1;
        set({
          xp: newXP - s.xpToNext,
          level: newLevel,
          xpToNext: 100 * newLevel,
          critChance: Math.min(0.35, 0.05 + newLevel * 0.02),
        });
        return true;
      }
      set({ xp: newXP });
      return false;
    },

    incrementCombo: () => {
      const s = get();
      const newCombo = s.comboCount + 1;
      set({
        comboCount: newCombo,
        comboTimer: 2.0,
        maxCombo: Math.max(s.maxCombo, newCombo),
      });
      return newCombo;
    },

    resetCombo: () => set({ comboCount: 0, comboTimer: 0 }),

    tickComboTimer: (delta) => {
      const s = get();
      if (s.comboTimer <= 0) return;
      const newTimer = s.comboTimer - delta;
      if (newTimer <= 0) {
        set({ comboTimer: 0, comboCount: 0 });
      } else {
        set({ comboTimer: newTimer });
      }
    },

    tickSkillCooldowns: (delta) => {
      set((s) => {
        const cd = { ...s.skillCooldowns };
        let changed = false;
        for (const key of Object.keys(cd) as (keyof SkillCooldowns)[]) {
          if (cd[key] > 0) {
            cd[key] = Math.max(0, cd[key] - delta);
            changed = true;
          }
        }
        return changed ? { skillCooldowns: cd } : {};
      });
    },

    useSkillCooldown: (skill, cooldownTime) => {
      const s = get();
      if (s.skillCooldowns[skill] > 0) return false;
      set({
        skillCooldowns: { ...s.skillCooldowns, [skill]: cooldownTime },
      });
      return true;
    },

    getComboMultiplier: () => {
      const s = get();
      if (s.comboCount <= 1) return 1.0;
      return 1.0 + Math.min(s.comboCount * 0.1, 1.0);
    },

    rollCrit: () => {
      const s = get();
      return Math.random() < s.critChance;
    },
  }))
);
