// ── Level / XP progression formulas ──────────────────────────────────────────

const LEVEL_XP_TABLE = [0, 100, 250, 500, 850, 1300, 1900, 2700, 3700, 5000,
  6500, 8300, 10500, 13100, 16200, 19800, 24000, 28900, 34500, 41000,
  48500, 57000, 66500, 77200, 89200, 102500, 117500, 134200, 152800, 173500];

export function xpForLevel(level: number): number {
  if (level <= 0) return 0;
  if (level <= 30) return LEVEL_XP_TABLE[level - 1] || 0;
  return Math.round(173500 + (level - 30) * 25000 * Math.pow(1.1, level - 30));
}

// Canonical Grudge: 20 starting points + 7 per level, capped at 160
// (cap reached at level 21). Source: stats-guide.html "Per Level / Max Points".
export function attributePointsForLevel(level: number): number {
  return Math.min(160, 20 + Math.max(0, level - 1) * 7);
}

export function skillPointsForLevel(level: number): number {
  return Math.max(0, level - 1) + Math.floor(level / 5);
}
