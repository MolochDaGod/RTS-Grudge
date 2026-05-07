const CHARACTER_FALLBACKS: Record<string, string> = {
  "Knight_Male.glb": "/models/characters/undead_grave_knight-male.glb",
  "Knight_Golden_Male.glb": "/models/characters/night_stalker-male.glb",
  "Knight.glb": "/models/characters/undead_grave_knight-male.glb",
  "Soldier_Male.glb": "/models/characters/undead_grave_knight-male.glb",
  "BlueSoldier_Male.glb": "/models/characters/undead_grave_knight-male.glb",
  "Viking_Male.glb": "/models/characters/night_stalker-male.glb",
  "BarbarianGlad.glb": "/models/characters/night_stalker-male.glb",
  "Pirate_Male.glb": "/models/characters/human_battle_mage-male.glb",
  "Cowboy_Male.glb": "/models/characters/human_battle_mage-male.glb",
  "Worker_Male.glb": "/models/characters/human_battle_mage-male.glb",
  "Ninja_Male.glb": "/models/characters/assassin-male.glb",
  "Ninja_Sand.glb": "/models/characters/assassin-male.glb",
  "Wizard.glb": "/models/characters/human_battle_mage-male.glb",
  "Animated_Wizard.glb": "/models/characters/human_battle_mage-male.glb",
  "Witch.glb": "/models/characters/human_battle_mage-female.glb",
  "Elf.glb": "/models/characters/elf-male.glb",
  "Zombie_Male.glb": "/models/characters/undead_grave_knight-male.glb",
  "Zombie_Female.glb": "/models/characters/undead_grave_knight-female.glb",
  "Goblin_Male.glb": "/models/characters/goblin_backstabber-male.glb",
  "Adventurer.glb": "/models/characters/human_battle_mage-male.glb",
  "berserker.glb": "/models/characters/night_stalker-male.glb",
  "racalvin.glb": "/models/characters/night_stalker-male.glb",
  "HumanBaseMesh_WithEquips.glb": "/models/characters/human_battle_mage-male.glb",
  "Animated_Character_Base.glb": "/models/characters/human_battle_mage-male.glb",
  "Animated_Human.glb": "/models/characters/human_battle_mage-male.glb",
  "Animated_Woman.glb": "/models/characters/human_battle_mage-female.glb",
  "Animated_Zombie.glb": "/models/characters/undead_grave_knight-male.glb",
  "Anne.glb": "/models/characters/assassin-female.glb",
  "Cow.glb": "/models/monsters/blob/Mushnub_Evolved.glb",
  "Pug.glb": "/models/monsters/blob/Dog.glb",
  "Swat.glb": "/models/characters/human_battle_mage-male.glb",
  "King.glb": "/models/characters/human_battle_mage-male.glb",
};

const warnedPaths = new Set<string>();

const GENERIC_HUMANOID = "/models/characters/human_battle_mage-male.glb";
const GENERIC_MONSTER = "/models/monsters/blob/Orc.glb";

/**
 * Files that actually exist under client/public/models/characters/ — these
 * pass through the resolver unchanged. Without this allowlist any path
 * under /models/characters/ that wasn't in CHARACTER_FALLBACKS would be
 * silently remapped to the generic Henry model, masking the new race GLBs.
 * Keep this in sync with `client/public/models/characters/` on disk.
 */
const LOCAL_CHARACTER_FILES = new Set<string>([
  "assassin-female.glb",
  "assassin-male.glb",
  "avian_wind-female.glb",
  "avian_wind-male.glb",
  "centaur_outrider-female.glb",
  "centaur_outrider-male.glb",
  "dwarf-female.glb",
  "dwarf-male.glb",
  "elf-female.glb",
  "elf-male.glb",
  "goblin_backstabber-female.glb",
  "goblin_backstabber-male.glb",
  "human_battle_mage-female.glb",
  "human_battle_mage-male.glb",
  "kobold_trap_setter-female.glb",
  "kobold_trap_setter-male.glb",
  "lizardfolk-male.glb",
  "night_stalker-female.glb",
  "night_stalker-male.glb",
  "orc_scout-female.glb",
  "orc_scout-male.glb",
  "swordman.glb",
  "undead_grave_knight-female.glb",
  "undead_grave_knight-male.glb",
  "vampire_aristocrat-female.glb",
  "vampire_aristocrat-male.glb",
  "werewolf.glb",
]);

export function resolveCharacterModelPath(path: string): string {
  if (!path || typeof path !== "string") return path;

  if (path.startsWith("/models/characters/")) {
    const filename = path.substring("/models/characters/".length).split("?")[0];
    if (LOCAL_CHARACTER_FILES.has(filename)) {
      return path;
    }
    const fallback = CHARACTER_FALLBACKS[filename];
    if (fallback) {
      logRemap(path, fallback);
      return fallback;
    }
    logRemap(path, GENERIC_HUMANOID, true);
    return GENERIC_HUMANOID;
  }

  // The threejs-games pack is partially missing too (no characters/ subdir).
  // Anything under /models/threejs-games/characters/ falls back to monsters.
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

export function isCharacterModelMissing(path: string): boolean {
  return typeof path === "string" && path.startsWith("/models/characters/");
}
