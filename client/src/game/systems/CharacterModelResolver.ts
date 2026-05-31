/**
 * CDN root for the Grudge 6 faction character GLBs on the Object Store.
 * These are the REAL production models — local /models/characters/ only
 * has the werewolf GLB on disk; everything else must redirect here.
 */
const GRUDGE6_CDN = "https://assets.grudge-studio.com/models/grudge6";

/**
 * Map local /models/characters/<filename> → CDN URL.
 * Every race model that the rest of the codebase references by local path
 * is redirected to the assets CDN (Cloudflare R2) because those files were
 * never committed to git (too large). Only stylized_nightmarish_werewolf.glb
 * actually lives on disk.
 *
 * NOTE: The GLB filenames on R2 do NOT have the `_customizable` suffix.
 * They are: WK_Characters.glb, BRB_Characters.glb, etc.
 */
const LOCAL_TO_CDN: Record<string, string> = {
  // ── Human / Western Kingdoms ──
  "human_battle_mage-male.glb":   `${GRUDGE6_CDN}/wk/WK_Characters.glb`,
  "human_battle_mage-female.glb": `${GRUDGE6_CDN}/wk/WK_Characters.glb`,
  "swordman.glb":                 `${GRUDGE6_CDN}/wk/WK_Characters.glb`,
  // ── Assassin / Rogue → use WK human model ──
  "assassin-male.glb":            `${GRUDGE6_CDN}/wk/WK_Characters.glb`,
  "assassin-female.glb":          `${GRUDGE6_CDN}/wk/WK_Characters.glb`,
  // ── Barbarian ──
  "night_stalker-male.glb":       `${GRUDGE6_CDN}/brb/BRB_Characters.glb`,
  "night_stalker-female.glb":     `${GRUDGE6_CDN}/brb/BRB_Characters.glb`,
  // ── Elf ──
  "elf-male.glb":                 `${GRUDGE6_CDN}/elf/ELF_Characters.glb`,
  "elf-female.glb":               `${GRUDGE6_CDN}/elf/ELF_Characters.glb`,
  // ── Dwarf ──
  "dwarf-male.glb":               `${GRUDGE6_CDN}/dwf/DWF_Characters.glb`,
  "dwarf-female.glb":             `${GRUDGE6_CDN}/dwf/DWF_Characters.glb`,
  // ── Orc ──
  "orc_scout-male.glb":           `${GRUDGE6_CDN}/orc/ORC_Characters.glb`,
  "orc_scout-female.glb":         `${GRUDGE6_CDN}/orc/ORC_Characters.glb`,
  // ── Undead ──
  "undead_grave_knight-male.glb":  `${GRUDGE6_CDN}/ud/UD_Characters.glb`,
  "undead_grave_knight-female.glb":`${GRUDGE6_CDN}/ud/UD_Characters.glb`,
  "vampire_aristocrat-male.glb":   `${GRUDGE6_CDN}/ud/UD_Characters.glb`,
  "vampire_aristocrat-female.glb": `${GRUDGE6_CDN}/ud/UD_Characters.glb`,
  // ── Exotic races → closest CDN equivalent ──
  "goblin_backstabber-male.glb":  `${GRUDGE6_CDN}/orc/ORC_Characters.glb`,
  "goblin_backstabber-female.glb":`${GRUDGE6_CDN}/orc/ORC_Characters.glb`,
  "kobold_trap_setter-male.glb":  `${GRUDGE6_CDN}/dwf/DWF_Characters.glb`,
  "kobold_trap_setter-female.glb":`${GRUDGE6_CDN}/dwf/DWF_Characters.glb`,
  "avian_wind-male.glb":          `${GRUDGE6_CDN}/elf/ELF_Characters.glb`,
  "avian_wind-female.glb":        `${GRUDGE6_CDN}/elf/ELF_Characters.glb`,
  "centaur_outrider-male.glb":    `${GRUDGE6_CDN}/brb/BRB_Characters.glb`,
  "centaur_outrider-female.glb":  `${GRUDGE6_CDN}/brb/BRB_Characters.glb`,
  "lizardfolk-male.glb":          `${GRUDGE6_CDN}/orc/ORC_Characters.glb`,
  "werewolf.glb":                 `${GRUDGE6_CDN}/brb/BRB_Characters.glb`,
};

/** Legacy asset names (old packs) → CDN redirects. */
const CHARACTER_FALLBACKS: Record<string, string> = {
  "Knight_Male.glb":              `${GRUDGE6_CDN}/ud/UD_Characters.glb`,
  "Knight_Golden_Male.glb":       `${GRUDGE6_CDN}/brb/BRB_Characters.glb`,
  "Knight.glb":                   `${GRUDGE6_CDN}/ud/UD_Characters.glb`,
  "Soldier_Male.glb":             `${GRUDGE6_CDN}/ud/UD_Characters.glb`,
  "BlueSoldier_Male.glb":         `${GRUDGE6_CDN}/ud/UD_Characters.glb`,
  "Viking_Male.glb":              `${GRUDGE6_CDN}/brb/BRB_Characters.glb`,
  "BarbarianGlad.glb":            `${GRUDGE6_CDN}/brb/BRB_Characters.glb`,
  "Pirate_Male.glb":              `${GRUDGE6_CDN}/wk/WK_Characters.glb`,
  "Cowboy_Male.glb":              `${GRUDGE6_CDN}/wk/WK_Characters.glb`,
  "Worker_Male.glb":              `${GRUDGE6_CDN}/wk/WK_Characters.glb`,
  "Ninja_Male.glb":               `${GRUDGE6_CDN}/wk/WK_Characters.glb`,
  "Ninja_Sand.glb":               `${GRUDGE6_CDN}/wk/WK_Characters.glb`,
  "Wizard.glb":                   `${GRUDGE6_CDN}/wk/WK_Characters.glb`,
  "Animated_Wizard.glb":          `${GRUDGE6_CDN}/wk/WK_Characters.glb`,
  "Witch.glb":                    `${GRUDGE6_CDN}/wk/WK_Characters.glb`,
  "Elf.glb":                      `${GRUDGE6_CDN}/elf/ELF_Characters.glb`,
  "Zombie_Male.glb":              `${GRUDGE6_CDN}/ud/UD_Characters.glb`,
  "Zombie_Female.glb":            `${GRUDGE6_CDN}/ud/UD_Characters.glb`,
  "Goblin_Male.glb":              `${GRUDGE6_CDN}/orc/ORC_Characters.glb`,
  "Adventurer.glb":               `${GRUDGE6_CDN}/wk/WK_Characters.glb`,
  "berserker.glb":                `${GRUDGE6_CDN}/brb/BRB_Characters.glb`,
  "racalvin.glb":                 `${GRUDGE6_CDN}/brb/BRB_Characters.glb`,
  "HumanBaseMesh_WithEquips.glb": `${GRUDGE6_CDN}/wk/WK_Characters.glb`,
  "Animated_Character_Base.glb":  `${GRUDGE6_CDN}/wk/WK_Characters.glb`,
  "Animated_Human.glb":           `${GRUDGE6_CDN}/wk/WK_Characters.glb`,
  "Animated_Woman.glb":           `${GRUDGE6_CDN}/wk/WK_Characters.glb`,
  "Animated_Zombie.glb":          `${GRUDGE6_CDN}/ud/UD_Characters.glb`,
  "Anne.glb":                     `${GRUDGE6_CDN}/wk/WK_Characters.glb`,
  "Cow.glb":                      "/models/wildlife/Cow.glb",
  "Pug.glb":                      "/models/wildlife/Pug.glb",
  "Swat.glb":                     `${GRUDGE6_CDN}/wk/WK_Characters.glb`,
  "King.glb":                     `${GRUDGE6_CDN}/wk/WK_Characters.glb`,
};

const warnedPaths = new Set<string>();

/** Default CDN humanoid — used when no specific mapping exists. */
const GENERIC_HUMANOID = `${GRUDGE6_CDN}/wk/WK_Characters.glb`;
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
