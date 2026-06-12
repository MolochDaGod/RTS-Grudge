// ── Level / XP progression formulas ──────────────────────────────────────────

/**
 * Player heroes (the 6-race x 4-class characters from grudge-studio / grudge6)
 * are designed to finish their build at level 20 — distinct from allies, which
 * level 1-100 (see useAllies.MAX_ALLY_LEVEL). useCharacterStats.addExperience
 * clamps hero progression to this cap.
 */
export const HERO_MAX_LEVEL = 20;

const LEVEL_XP_TABLE = [0, 100, 250, 500, 850, 1300, 1900, 2700, 3700, 5000,
  6500, 8300, 10500, 13100, 16200, 19800, 24000, 28900, 34500, 41000,
  48500, 57000, 66500, 77200, 89200, 102500, 117500, 134200, 152800, 173500];

export function xpForLevel(level: number): number {
  if (level <= 0) return 0;
  if (level <= 30) return LEVEL_XP_TABLE[level - 1] || 0;
  return Math.round(173500 + (level - 30) * 25000 * Math.pow(1.1, level - 30));
}

// Spendable attribute points. A hero's class and race grant fixed base
// attributes (see CLASS_BASE_ATTRIBUTES + RACE_BONUSES); on top of that the
// player spends 7 points at character creation (level 1) and earns +7 every
// level after — i.e. 7 x level spendable. At the level-20 cap that is 140
// spendable points. Canonical source: info.grudge-studio.com.
export function attributePointsForLevel(level: number): number {
  return Math.max(0, level) * 7;
}

export function skillPointsForLevel(level: number): number {
  return Math.max(0, level - 1) + Math.floor(level / 5);
}
