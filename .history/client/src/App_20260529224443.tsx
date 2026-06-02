/**
 * FactionCharacterRegistry — mirrors the Unity uMMORPG 6-race system.
 *
 * Each race uses customizable FBX models with prefix-based child meshes
 * (WK_, BRB_, ELF_, DWF_, ORC_, UD_) that can be toggled for equipment.
 * The same skeleton (Bip001) is shared across all races, enabling
 * universal animation retargeting.
 *
 * This registry also maps to the existing GLB characters in
 * ModelRegistry.ts so both pipelines (FBX prefix-toggle and GLB
 * external-attach) can coexist.
 *
 * CDN PATHS: The 6 grudge6 race GLBs are hosted on the Grudge Object Store.
 * Run `node scripts/convert-grudge6-assets.mjs` to convert local FBX files
 * to GLB and upload. See that script for the expected output layout.
 */

// ---------------------------------------------------------------------------
// Grudge Object Storage CDN roots
// ---------------------------------------------------------------------------
/** Root for grudge6 race character GLBs and their animation packs. */
export const GRUDGE6_CDN = "https://molochdagod.github.io/ObjectStore/models/factioncharacters";
/** Root for Bip001 animation pack GLBs shared across all 6 races. */
export const GRUDGE6_ANIM_CDN = `${GRUDGE6_CDN}/animations`;

import type { Faction, Race } from "../systems/ModelRegistry";

// ---------------------------------------------------------------------------
// Bone containers — identical across all 6 races (Bip001 skeleton)
// ---------------------------------------------------------------------------
export const BONE_CONTAINERS = {
  rightHand:  "R_hand_container",
  leftHand:   "L_hand_container",
  leftShield: "L_shield_container",
  bag:        "Bone_bag",
  wood:       "Bone_wood",
  quiver:     "Quiver_container",
} as const;

export type BoneContainerKey = keyof typeof BONE_CONTAINERS;

// ---------------------------------------------------------------------------
// Equipment slot definitions — regex patterns match mesh names after prefix strip
// ---------------------------------------------------------------------------
export type EquipGroup = "armor" | "weapon_r" | "weapon_l" | "shield" | "utility";

export interface SlotDefinition {
  slot: string;
  re: RegExp;
  group: EquipGroup;
  /** When true, the slot has no variant letter (e.g. pick, spear, bow). */
  noVariant?: boolean;
}

export const SLOT_DEFINITIONS: SlotDefinition[] = [
  // Armor slots — skinned meshes at root
  { slot: "body",       re: /^Units_Body_([A-Z])$/i,           group: "armor" },
  { slot: "arms",       re: /^Units_Arms_([A-Z])$/i,           group: "armor" },
  { slot: "legs",       re: /^Units_Legs_([A-Z])$/i,           group: "armor" },
  { slot: "head",       re: /^Units_head_([A-Z])$/i,           group: "armor" },
  { slot: "shoulders",  re: /^Units_shoulderpads_([A-Z])$/i,   group: "armor" },

  // Right-hand weapons
  { slot: "axe",    re: /(?:Units_|weapon_)axe_([A-Z])$/i,     group: "weapon_r" },
  { slot: "hammer", re: /(?:Units_|weapon_)hammer_([A-Z])$/i,  group: "weapon_r" },
  { slot: "sword",  re: /(?:Units_|weapon_)[Ss]word_([A-Z])$/i,group: "weapon_r" },
  { slot: "pick",   re: /(?:Units_|weapon_)pick$/i,            group: "weapon_r", noVariant: true },
  { slot: "spear",  re: /(?:Units_|weapon_)[Ss]pear$/i,        group: "weapon_r", noVariant: true },

  // Left-hand items
  { slot: "bow",    re: /(?:Units_|weapon_)[Bb]ow$/i,          group: "weapon_l", noVariant: true },
  { slot: "staff",  re: /(?:Units_|weapon_)staff_([A-Z])$/i,   group: "weapon_l" },

  // Shields
  { slot: "shield", re: /(?:Units_|)[Ss]hield_([A-Z])$/i,      group: "shield" },

  // Utility
  { slot: "bag",    re: /(?:Xtra_|Units_)bag$/i,               group: "utility", noVariant: true },
  { slot: "wood",   re: /(?:Xtra_|Units_)wood$/i,              group: "utility", noVariant: true },
  { slot: "quiver", re: /(?:Xtra_|Units_)quiver$/i,            group: "utility", noVariant: true },
];

// Grouped for UI panels (matches Unity PlayerEquipment.slotInfo)
export const SLOT_GROUPS = {
  armor:   ["body", "arms", "legs", "head", "shoulders"],
  weapons: ["axe", "hammer", "sword", "pick", "spear", "bow", "staff"],
  shields: ["shield"],
  utility: ["bag", "wood", "quiver"],
} as const;

// ---------------------------------------------------------------------------
// Race prefix → uMMORPG Unity slot mapping
//
// Maps to the Unity PlayerEquipment.slotInfo categories:
//   Weapon, Head, Chest, Legs, Shield, Shoulders, Hands, Feet
// ---------------------------------------------------------------------------
export type RacePrefix = "WK_" | "BRB_" | "ELF_" | "DWF_" | "ORC_" | "UD_";

export interface RaceConfig {
  name: string;
  prefix: RacePrefix;
  race: Race;
  faction: Faction | string;
  /** FBX model path (prefix-based child mesh toggle) */
  fbxModel: string;
  /** GLB model path (external weapon attach — current RTS-Grudge pipeline) */
  glbModels: { male: string; female: string };
  /**
   * Bear-form GLB for the Worge race. When set, CLASS_ABILITY_3 (KeyX) swaps
   * the player model to this path and back to the base human form.
   */
  bearFormGlb?: string;
  /**
   * Wolf-form GLB for the Worge race. When set, CLASS_ABILITY_1 (KeyE) swaps
   * the player model to this path. Distinct from bear so a Worge can hot-swap
   * between predator (wolf) and bruiser (bear) silhouettes from any form.
   */
  wolfFormGlb?: string;
  /**
   * Optional per-form visual-height multiplier consumed by the player model
   * loader. Lets wolf/bear reuse the same GLB at different silhouettes.
   */
  formScale?: { bear?: number; wolf?: number };
  /** Unity equipment slot mapping: category → bone Transform name */
  unitySlots: {
    weapon: string;   // mainHand bone
    head: string;     // helmet attach point
    chest: string;    // chest armor (skinned mesh toggle)
    legs: string;     // leg armor (skinned mesh toggle)
    shield: string;   // offHand / shield bone
    shoulders: string; // shoulder armor (skinned mesh toggle)
    hands: string;    // glove armor (skinned mesh toggle)
    feet: string;     // boot armor (skinned mesh toggle)
  };
}

export const RACE_CONFIGS: Record<string, RaceConfig> = {
  human: {
    name: "Human (WK)",
    prefix: "WK_",
    race: "human",
    faction: "crusade",
    fbxModel: "/models/factioncharacters/WesternKingdoms/models/WK_Characters_customizable.FBX",
    // CDN GLB path — uploaded via scripts/convert-grudge6-assets.mjs
    glbModels: {
      male:   `${GRUDGE6_CDN}/wk/WK_Characters_customizable.glb`,
      female: `${GRUDGE6_CDN}/wk/WK_Characters_customizable.glb`,
    },
    unitySlots: {
      weapon: "R_hand_container",
      head: "Bip001 Head",
      chest: "body",
      legs: "legs",
      shield: "L_shield_container",
      shoulders: "shoulders",
      hands: "arms",
      feet: "legs",
    },
  },
  barbarian: {
    name: "Barbarian (BRB)",
    prefix: "BRB_",
    race: "barbarian",
    faction: "crusade",
    fbxModel: "/models/factioncharacters/Barbarians/models/BRB_Characters_customizable.FBX",
    glbModels: {
      male:   `${GRUDGE6_CDN}/brb/BRB_Characters_customizable.glb`,
      female: `${GRUDGE6_CDN}/brb/BRB_Characters_customizable.glb`,
    },
    unitySlots: {
      weapon: "R_hand_container",
      head: "Bip001 Head",
      chest: "body",
      legs: "legs",
      shield: "L_shield_container",
      shoulders: "shoulders",
      hands: "arms",
      feet: "legs",
    },
  },
  elf: {
    name: "Elf (ELF)",
    prefix: "ELF_",
    race: "elf",
    faction: "fabled",
    fbxModel: "/models/factioncharacters/Elves/models/ELF_Characters_customizable.FBX",
    glbModels: {
      male:   `${GRUDGE6_CDN}/elf/ELF_Characters_customizable.glb`,
      female: `${GRUDGE6_CDN}/elf/ELF_Characters_customizable.glb`,
    },
    unitySlots: {
      weapon: "R_hand_container",
      head: "Bip001 Head",
      chest: "body",
      legs: "legs",
      shield: "L_shield_container",
      shoulders: "shoulders",
      hands: "arms",
      feet: "legs",
    },
  },
  dwarf: {
    name: "Dwarf (DWF)",
    prefix: "DWF_",
    race: "dwarf",
    faction: "fabled",
    fbxModel: "/models/factioncharacters/Dwarves/models/DWF_Characters_customizable.FBX",
    glbModels: {
      male:   `${GRUDGE6_CDN}/dwf/DWF_Characters_customizable.glb`,
      female: `${GRUDGE6_CDN}/dwf/DWF_Characters_customizable.glb`,
    },
    unitySlots: {
      weapon: "R_hand_container",
      head: "Bip001 Head",
      chest: "body",
      legs: "legs",
      shield: "L_shield_container",
      shoulders: "shoulders",
      hands: "arms",
      feet: "legs",
    },
  },
  orc: {
    name: "Orc (ORC)",
    prefix: "ORC_",
    race: "orc",
    faction: "legion",
    fbxModel: "/models/factioncharacters/Orcs/models/ORC_Characters_Customizable.FBX",
    glbModels: {
      male:   `${GRUDGE6_CDN}/orc/ORC_Characters_Customizable.glb`,
      female: `${GRUDGE6_CDN}/orc/ORC_Characters_Customizable.glb`,
    },
    unitySlots: {
      weapon: "R_hand_container",
      head: "Bip001 Head",
      chest: "body",
      legs: "legs",
      shield: "L_shield_container",
      shoulders: "shoulders",
      hands: "arms",
      feet: "legs",
    },
  },
  worge: {
    name: "Worge",
    prefix: "WK_", // shares the WK skeleton for animation compatibility
    race: "barbarian" as any,
    faction: "wild",
    fbxModel: "/models/factioncharacters/WesternKingdoms/models/WK_Characters_customizable.FBX",
    glbModels: {
      male: "/models/characters/night_stalker-male.glb",
      female: "/models/characters/night_stalker-female.glb",
    },
    /** Bear-form model — swapped in when the Worge's CLASS_ABILITY_3 fires. */
    bearFormGlb: "/models/characters/stylized_nightmarish_werewolf.glb",
    unitySlots: {
      weapon: "R_hand_container",
      head: "Bip001 Head",
      chest: "body",
      legs: "legs",
      shield: "L_shield_container",
      shoulders: "shoulders",
      hands: "arms",
      feet: "legs",
    },
  },
  undead: {
    name: "Undead (UD)",
    prefix: "UD_",
    race: "undead",
    faction: "legion",
    fbxModel: "/models/factioncharacters/Undead/models/UD_Characters_customizable.FBX",
    glbModels: {
      male:   `${GRUDGE6_CDN}/ud/UD_Characters_customizable.glb`,
      female: `${GRUDGE6_CDN}/ud/UD_Characters_customizable.glb`,
    },
    unitySlots: {
      weapon: "R_hand_container",
      head: "Bip001 Head",
      chest: "body",
      legs: "legs",
      shield: "L_shield_container",
      shoulders: "shoulders",
      hands: "arms",
      feet: "legs",
    },
  },
};

// ---------------------------------------------------------------------------
// Weapon animation packs — shared across all races via retargeting
// ---------------------------------------------------------------------------
export const WEAPON_ANIM_PACK_IDS = {
  "1h_sword_shield": "1H Sword & Shield",
  "2h_melee":        "2H Melee (Axe/Hammer)",
  "longbow":         "Longbow",
  "magic":           "Magic Staff",
  "rifle_crossbow":  "Rifle / Crossbow",
  "advanced_gun":    "Advanced Gun (8-Dir)",
  "great_sword":     "Great Sword",
} as const;

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

/** Get all 6 core race configs */
export function getAllRaceConfigs(): RaceConfig[] {
  return Object.values(RACE_CONFIGS);
}

/** Get a race config by race key */
export function getRaceConfig(raceKey: string): RaceConfig | null {
  return RACE_CONFIGS[raceKey] ?? null;
}

/** Get race config by prefix (e.g. "WK_" → human config) */
export function getRaceByPrefix(prefix: RacePrefix): RaceConfig | null {
  return Object.values(RACE_CONFIGS).find(r => r.prefix === prefix) ?? null;
}

/** Map a model path to its race config (works for both FBX and GLB paths) */
export function getRaceForModelPath(modelPath: string): RaceConfig | null {
  for (const config of Object.values(RACE_CONFIGS)) {
    if (modelPath === config.fbxModel) return config;
    if (modelPath === config.glbModels.male || modelPath === config.glbModels.female) return config;
  }
  return null;
}

/** Detect the prefix from a mesh name (returns null if no known prefix found) */
export function detectPrefix(meshName: string): RacePrefix | null {
  const prefixes: RacePrefix[] = ["WK_", "BRB_", "ELF_", "DWF_", "ORC_", "UD_"];
  for (const p of prefixes) {
    if (meshName.startsWith(p)) return p;
  }
  return null;
}
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
      } catch { }
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
