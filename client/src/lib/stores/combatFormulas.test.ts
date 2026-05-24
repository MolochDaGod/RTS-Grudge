import { describe, it, expect, vi, beforeEach } from "vitest";
import { computeDamageReduction, synthesizeEnemyDefender, computeCombatDamage } from "./combatFormulas";
import type { SecondaryStats } from "./characterTypes";

// ── computeDamageReduction ───────────────────────────────────────────────────

describe("computeDamageReduction", () => {
  it("returns 0 for 0 defense", () => {
    expect(computeDamageReduction(0, 1)).toBe(0);
  });

  it("returns √defense/100 for typical values", () => {
    // defense 100 → √100 = 10 → 0.10
    expect(computeDamageReduction(100, 1)).toBeCloseTo(0.1, 5);
    // defense 400 → √400 = 20 → 0.20
    expect(computeDamageReduction(400, 1)).toBeCloseTo(0.2, 5);
  });

  it("clamps √defense to 100 (10000+ defense)", () => {
    // defense 10000 → √10000 = 100 → 1.0 (100% reduction)
    expect(computeDamageReduction(10000, 1)).toBe(1.0);
    // defense 50000 → still clamped to 1.0
    expect(computeDamageReduction(50000, 1)).toBe(1.0);
  });

  it("treats negative defense as 0", () => {
    expect(computeDamageReduction(-50, 1)).toBe(0);
  });
});

// ── synthesizeEnemyDefender ──────────────────────────────────────────────────

describe("synthesizeEnemyDefender", () => {
  it("returns common tier stats for unknown tier", () => {
    const def = synthesizeEnemyDefender("unknown_tier");
    expect(def.defense).toBe(20);  // common
    expect(def.dodge).toBe(3);
  });

  it("returns correct stats for each tier", () => {
    expect(synthesizeEnemyDefender("common").defense).toBe(20);
    expect(synthesizeEnemyDefender("uncommon").defense).toBe(50);
    expect(synthesizeEnemyDefender("rare").defense).toBe(100);
    expect(synthesizeEnemyDefender("elite").defense).toBe(200);
    expect(synthesizeEnemyDefender("boss").defense).toBe(400);
  });

  it("boss has higher stats than common across the board", () => {
    const common = synthesizeEnemyDefender("common");
    const boss = synthesizeEnemyDefender("boss");
    expect(boss.defense).toBeGreaterThan(common.defense);
    expect(boss.resistance).toBeGreaterThan(common.resistance);
    expect(boss.block).toBeGreaterThan(common.block);
    expect(boss.dodge).toBeGreaterThan(common.dodge);
    expect(boss.critEvasion).toBeGreaterThan(common.critEvasion);
  });

  it("returns a full SecondaryStats shape with all keys", () => {
    const def = synthesizeEnemyDefender("common");
    const requiredKeys: (keyof SecondaryStats)[] = [
      "health", "mana", "stamina", "damage", "defense", "block",
      "blockEffect", "dodge", "critChance", "critDamage", "combatPower",
    ];
    for (const k of requiredKeys) {
      expect(def).toHaveProperty(k);
      expect(typeof def[k]).toBe("number");
    }
  });
});

// ── computeCombatDamage (seeded randomness) ──────────────────────────────────

function makeStats(overrides: Partial<SecondaryStats> = {}): SecondaryStats {
  return {
    health: 0, mana: 0, stamina: 0, damage: 0, defense: 0, block: 0,
    blockEffect: 50, evasion: 0, accuracy: 95, critChance: 0, critDamage: 150,
    attackSpeed: 1, movementSpeed: 1, resistance: 0, cdrResist: 0,
    defenseBreakResist: 0, armorPenetration: 0, blockPenetration: 0,
    defenseBreak: 0, drainHealth: 0, manaRegen: 0, healthRegen: 0,
    cooldownReduction: 0, abilityCost: 0, spellAccuracy: 75, stagger: 0,
    ccResistance: 0, armor: 0, damageReduction: 0, bleedResist: 0,
    statusEffect: 0, spellblock: 0, dodge: 0, reflexTime: 0, critEvasion: 0,
    fallDamage: 0, comboCooldownRed: 0, combatPower: 0,
    ...overrides,
  };
}

describe("computeCombatDamage", () => {
  beforeEach(() => {
    // Pin Math.random to 0.5 so dodge/block/crit rolls are deterministic.
    // 0.5 * 100 = 50 → won't trigger dodge(0), block(0), or crit(0).
    vi.spyOn(Math, "random").mockReturnValue(0.5);
  });

  it("deals reduced damage through defense mitigation", () => {
    const attacker = makeStats({ accuracy: 95 });
    const defender = makeStats({ defense: 100 }); // √100=10 → 10% mit
    const result = computeCombatDamage(100, attacker, defender, "physical", 1);
    expect(result.dodged).toBe(false);
    expect(result.blocked).toBe(false);
    // 100 × (1 - 0.10) = 90
    expect(result.finalDamage).toBe(90);
  });

  it("uses resistance instead of defense for magical damage", () => {
    const attacker = makeStats({ accuracy: 95 });
    const defender = makeStats({ defense: 0, resistance: 100 });
    const result = computeCombatDamage(100, attacker, defender, "magical", 1);
    // √100 = 10 → 10% mit → 90
    expect(result.finalDamage).toBe(90);
  });

  it("never returns less than 1 damage", () => {
    const attacker = makeStats({ accuracy: 95 });
    const defender = makeStats({ defense: 10000 }); // 100% mitigation
    const result = computeCombatDamage(100, attacker, defender, "physical", 1);
    expect(result.finalDamage).toBeGreaterThanOrEqual(1);
  });

  it("reports a dodge when random < effective dodge", () => {
    // Set random to 0.01 → 1 < effectiveDodge
    vi.spyOn(Math, "random").mockReturnValue(0.01);
    const attacker = makeStats({ accuracy: 75 });
    // dodge=30, accuracy=75 → effectiveDodge = max(0, 30 - (100-75)*0.5) = 17.5
    // random*100 = 1 < 17.5 → dodge triggers
    const defender = makeStats({ dodge: 30 });
    const result = computeCombatDamage(100, attacker, defender, "physical", 1);
    expect(result.dodged).toBe(true);
    expect(result.finalDamage).toBe(0);
  });

  it("reports a block when random < block chance (after dodge fails)", () => {
    // First random call → dodge check. Second → block check.
    let callCount = 0;
    vi.spyOn(Math, "random").mockImplementation(() => {
      callCount++;
      if (callCount === 1) return 0.99; // dodge fails
      if (callCount === 2) return 0.01; // block triggers
      return 0.99; // crit fails
    });
    const attacker = makeStats({ accuracy: 95 });
    const defender = makeStats({ block: 50, blockEffect: 80 });
    const result = computeCombatDamage(100, attacker, defender, "physical", 1);
    expect(result.blocked).toBe(true);
    expect(result.isCrit).toBe(false);
    // Block effect 80% → damage * (1 - 0.80) = damage * 0.20
    expect(result.finalDamage).toBeGreaterThanOrEqual(1);
  });
});
