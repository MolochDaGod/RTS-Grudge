/**
 * CDN root for the Grudge 6 faction character GLBs on the Object Store.
 * These are the REAL production models — local /models/characters/ only
 * has the werewolf GLB on disk; everything else must redirect here.
 */
const GRUDGE6_CDN = "https://molochdagod.github.io/ObjectStore/models/factioncharacters";

/**
 * Map local /models/characters/<filename> → CDN URL.
 * Every race model that the rest of the codebase references by local path
 * is redirected to the Object Store CDN because those files were never
 * committed to git (too large). Only stylized_nightmarish_werewolf.glb
 * actually lives on disk.
 */
const LOCAL_TO_CDN: Record<string, string> = {
  // ── Human / Western Kingdoms ──
  "human_battle_mage-male.glb":   `${GRUDGE6_CDN}/wk/WK_Characters_customizable.glb`,
  "human_battle_mage-female.glb": `${GRUDGE6_CDN}/wk/WK_Characters_customizable.glb`,
  "swordman.glb":                 `${GRUDGE6_CDN}/wk/WK_Characters_customizable.glb`,
  // ── Assassin / Rogue → use WK human model ──
  "assassin-male.glb":            `${GRUDGE6_CDN}/wk/WK_Characters_customizable.glb`,
  "assassin-female.glb":          `${GRUDGE6_CDN}/wk/WK_Characters_customizable.glb`,
  // ── Barbarian ──
  "night_stalker-male.glb":       `${GRUDGE6_CDN}/brb/BRB_Characters_customizable.glb`,
  "night_stalker-female.glb":     `${GRUDGE6_CDN}/brb/BRB_Characters_customizable.glb`,
  // ── Elf ──
  "elf-male.glb":                 `${GRUDGE6_CDN}/elf/ELF_Characters_customizable.glb`,
  "elf-female.glb":               `${GRUDGE6_CDN}/elf/ELF_Characters_customizable.glb`,
  // ── Dwarf ──
  "dwarf-male.glb":               `${GRUDGE6_CDN}/dwf/DWF_Characters_customizable.glb`,
  "dwarf-female.glb":             `${GRUDGE6_CDN}/dwf/DWF_Characters_customizable.glb`,
  // ── Orc ──
  "orc_scout-male.glb":           `${GRUDGE6_CDN}/orc/ORC_Characters_Customizable.glb`,
  "orc_scout-female.glb":         `${GRUDGE6_CDN}/orc/ORC_Characters_Customizable.glb`,
  // ── Undead ──
  "undead_grave_knight-male.glb":  `${GRUDGE6_CDN}/ud/UD_Characters_customizable.glb`,
  "undead_grave_knight-female.glb":`${GRUDGE6_CDN}/ud/UD_Characters_customizable.glb`,
  "vampire_aristocrat-male.glb":   `${GRUDGE6_CDN}/ud/UD_Characters_customizable.glb`,
  "vampire_aristocrat-female.glb": `${GRUDGE6_CDN}/ud/UD_Characters_customizable.glb`,
  // ── Exotic races → closest CDN equivalent ──
  "goblin_backstabber-male.glb":  `${GRUDGE6_CDN}/orc/ORC_Characters_Customizable.glb`,
  "goblin_backstabber-female.glb":`${GRUDGE6_CDN}/orc/ORC_Characters_Customizable.glb`,
  "kobold_trap_setter-male.glb":  `${GRUDGE6_CDN}/dwf/DWF_Characters_customizable.glb`,
  "kobold_trap_setter-female.glb":`${GRUDGE6_CDN}/dwf/DWF_Characters_customizable.glb`,
  "avian_wind-male.glb":          `${GRUDGE6_CDN}/elf/ELF_Characters_customizable.glb`,
  "avian_wind-female.glb":        `${GRUDGE6_CDN}/elf/ELF_Characters_customizable.glb`,
  "centaur_outrider-male.glb":    `${GRUDGE6_CDN}/brb/BRB_Characters_customizable.glb`,
  "centaur_outrider-female.glb":  `${GRUDGE6_CDN}/brb/BRB_Characters_customizable.glb`,
  "lizardfolk-male.glb":          `${GRUDGE6_CDN}/orc/ORC_Characters_Customizable.glb`,
  "werewolf.glb":                 `${GRUDGE6_CDN}/brb/BRB_Characters_customizable.glb`,
};

/** Legacy asset names (old packs) → CDN redirects. */
const CHARACTER_FALLBACKS: Record<string, string> = {
  "Knight_Male.glb":              `${GRUDGE6_CDN}/ud/UD_Characters_customizable.glb`,
  "Knight_Golden_Male.glb":       `${GRUDGE6_CDN}/brb/BRB_Characters_customizable.glb`,
  "Knight.glb":                   `${GRUDGE6_CDN}/ud/UD_Characters_customizable.glb`,
  "Soldier_Male.glb":             `${GRUDGE6_CDN}/ud/UD_Characters_customizable.glb`,
  "BlueSoldier_Male.glb":         `${GRUDGE6_CDN}/ud/UD_Characters_customizable.glb`,
  "Viking_Male.glb":              `${GRUDGE6_CDN}/brb/BRB_Characters_customizable.glb`,
  "BarbarianGlad.glb":            `${GRUDGE6_CDN}/brb/BRB_Characters_customizable.glb`,
  "Pirate_Male.glb":              `${GRUDGE6_CDN}/wk/WK_Characters_customizable.glb`,
  "Cowboy_Male.glb":              `${GRUDGE6_CDN}/wk/WK_Characters_customizable.glb`,
  "Worker_Male.glb":              `${GRUDGE6_CDN}/wk/WK_Characters_customizable.glb`,
  "Ninja_Male.glb":               `${GRUDGE6_CDN}/wk/WK_Characters_customizable.glb`,
  "Ninja_Sand.glb":               `${GRUDGE6_CDN}/wk/WK_Characters_customizable.glb`,
  "Wizard.glb":                   `${GRUDGE6_CDN}/wk/WK_Characters_customizable.glb`,
  "Animated_Wizard.glb":          `${GRUDGE6_CDN}/wk/WK_Characters_customizable.glb`,
  "Witch.glb":                    `${GRUDGE6_CDN}/wk/WK_Characters_customizable.glb`,
  "Elf.glb":                      `${GRUDGE6_CDN}/elf/ELF_Characters_customizable.glb`,
  "Zombie_Male.glb":              `${GRUDGE6_CDN}/ud/UD_Characters_customizable.glb`,
  "Zombie_Female.glb":            `${GRUDGE6_CDN}/ud/UD_Characters_customizable.glb`,
  "Goblin_Male.glb":              `${GRUDGE6_CDN}/orc/ORC_Characters_Customizable.glb`,
  "Adventurer.glb":               `${GRUDGE6_CDN}/wk/WK_Characters_customizable.glb`,
  "berserker.glb":                `${GRUDGE6_CDN}/brb/BRB_Characters_customizable.glb`,
  "racalvin.glb":                 `${GRUDGE6_CDN}/brb/BRB_Characters_customizable.glb`,
  "HumanBaseMesh_WithEquips.glb": `${GRUDGE6_CDN}/wk/WK_Characters_customizable.glb`,
  "Animated_Character_Base.glb":  `${GRUDGE6_CDN}/wk/WK_Characters_customizable.glb`,
  "Animated_Human.glb":           `${GRUDGE6_CDN}/wk/WK_Characters_customizable.glb`,
  "Animated_Woman.glb":           `${GRUDGE6_CDN}/wk/WK_Characters_customizable.glb`,
  "Animated_Zombie.glb":          `${GRUDGE6_CDN}/ud/UD_Characters_customizable.glb`,
  "Anne.glb":                     `${GRUDGE6_CDN}/wk/WK_Characters_customizable.glb`,
  "Cow.glb":                      "/models/wildlife/Cow.glb",
  "Pug.glb":                      "/models/wildlife/Pug.glb",
  "Swat.glb":                     `${GRUDGE6_CDN}/wk/WK_Characters_customizable.glb`,
  "King.glb":                     `${GRUDGE6_CDN}/wk/WK_Characters_customizable.glb`,
};

const warnedPaths = new Set<string>();

/** Default CDN humanoid — used when no specific mapping exists. */
const GENERIC_HUMANOID = `${GRUDGE6_CDN}/wk/WK_Characters_customizable.glb`;
/** Default local monster — uses an existing dinosaur model. */
const GENERIC_MONSTER = "/models/monsters/dinosaurs/Velociraptor.glb";

/**
 * Only this file actually exists in client/public/models/characters/.
 * Everything else redirects to the Grudge Object Store CDN.
 */
const LOCAL_CHARACTER_FILES = new Set<string>([
  "stylized_nightmarish_werewolf.glb",
]);

export function resolveCharacterModelPath(path: string): string {
  if (!path || typeof path !== "string") return path;

  // Grudge Object Store CDN URLs — pass through unchanged; no local fallback.
  if (path.startsWith("https://") || path.startsWith("http://")) return path;

  if (path.startsWith("/models/characters/")) {
    const filename = path.substring("/models/characters/".length).split("?")[0];

    // Only the werewolf GLB actually exists on disk — serve it locally.
    if (LOCAL_CHARACTER_FILES.has(filename)) {
      return path;
    }

    // Check the CDN redirect map first (covers all 27 race models).
    const cdnUrl = LOCAL_TO_CDN[filename];
    if (cdnUrl) {
      logRemap(path, cdnUrl);
      return cdnUrl;
    }

    // Legacy asset names (Knight_Male.glb, Animated_Wizard.glb, etc.)
    const fallback = CHARACTER_FALLBACKS[filename];
    if (fallback) {
      logRemap(path, fallback);
      return fallback;
    }

    // Unknown character → generic CDN humanoid
    logRemap(path, GENERIC_HUMANOID, true);
    return GENERIC_HUMANOID;
  }

  // The threejs-games pack is partially missing (no characters/ subdir).
  if (path.startsWith("/models/threejs-games/characters/")) {
    logRemap(path, GENERIC_MONSTER, true);
    return GENERIC_MONSTER;
  }

  return path;
}

function logRemap(from: string, to: string, generic = false) {
  if (warnedPaths.has(from)) return;
  warnedPaths.add(from);
  if (generic) console.warn(`[CharacterModelResolver] No specific fallback for ${from}; using ${to}`);
  else console.info(`[CharacterModelResolver] ${from} -> ${to}`);
}

/**
 * Returns true when a path references a character model that is NOT available
 * locally (i.e. it will be redirected to the CDN). Only the werewolf GLB
 * is truly on disk.
 */
export function isCharacterModelMissing(path: string): boolean {
  if (typeof path !== "string" || !path.startsWith("/models/characters/")) return false;
  const filename = path.substring("/models/characters/".length).split("?")[0];
  return !LOCAL_CHARACTER_FILES.has(filename);
}
