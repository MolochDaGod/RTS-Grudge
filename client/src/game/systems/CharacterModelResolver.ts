/**
 * Local FBX paths for the 6 Grudge6 race character models. Loaded at runtime
 * via FBXLoader which preserves the embedded material colors that the GLB
 * conversion stripped (the yellow model bug). CDN GLB paths are kept as
 * fallback comments only.
 */
const G6 = "/models/grudge6/races";
/** Legacy CDN root — kept for reference, NOT used for loading. */
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
  // ── Human / Western Kingdoms → local FBX with correct textures ──
  "human_battle_mage-male.glb":   `${G6}/WK_Characters.fbx`,
  "human_battle_mage-female.glb": `${G6}/WK_Characters.fbx`,
  "swordman.glb":                 `${G6}/WK_Characters.fbx`,
  "assassin-male.glb":            `${G6}/WK_Characters.fbx`,
  "assassin-female.glb":          `${G6}/WK_Characters.fbx`,
  // ── Barbarian ──
  "night_stalker-male.glb":       `${G6}/BRB_Characters.fbx`,
  "night_stalker-female.glb":     `${G6}/BRB_Characters.fbx`,
  // ── Elf ──
  "elf-male.glb":                 `${G6}/ELF_Characters.fbx`,
  "elf-female.glb":               `${G6}/ELF_Characters.fbx`,
  // ── Dwarf ──
  "dwarf-male.glb":               `${G6}/DWF_Characters.fbx`,
  "dwarf-female.glb":             `${G6}/DWF_Characters.fbx`,
  // ── Orc ──
  "orc_scout-male.glb":           `${G6}/ORC_Characters.fbx`,
  "orc_scout-female.glb":         `${G6}/ORC_Characters.fbx`,
  // ── Undead ──
  "undead_grave_knight-male.glb":  `${G6}/UD_Characters.fbx`,
  "undead_grave_knight-female.glb":`${G6}/UD_Characters.fbx`,
  "vampire_aristocrat-male.glb":   `${G6}/UD_Characters.fbx`,
  "vampire_aristocrat-female.glb": `${G6}/UD_Characters.fbx`,
  // ── Exotic races → closest race FBX ──
  "goblin_backstabber-male.glb":  `${G6}/ORC_Characters.fbx`,
  "goblin_backstabber-female.glb":`${G6}/ORC_Characters.fbx`,
  "kobold_trap_setter-male.glb":  `${G6}/DWF_Characters.fbx`,
  "kobold_trap_setter-female.glb":`${G6}/DWF_Characters.fbx`,
  "avian_wind-male.glb":          `${G6}/ELF_Characters.fbx`,
  "avian_wind-female.glb":        `${G6}/ELF_Characters.fbx`,
  "centaur_outrider-male.glb":    `${G6}/BRB_Characters.fbx`,
  "centaur_outrider-female.glb":  `${G6}/BRB_Characters.fbx`,
  "lizardfolk-male.glb":          `${G6}/ORC_Characters.fbx`,
  "werewolf.glb":                 `${G6}/BRB_Characters.fbx`,
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

/** Default humanoid — local FBX with correct materials. */
const GENERIC_HUMANOID = `${G6}/WK_Characters.fbx`;
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
