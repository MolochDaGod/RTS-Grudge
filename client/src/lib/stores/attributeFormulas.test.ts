import { describe, it, expect } from "vitest";
import { effectivePoints, computeSecondaryStats, STAT_CAPS, RESOURCE_STATS } from "./attributeFormulas";
import type { PrimaryAttributes } from "./characterTypes";

// ── effectivePoints (diminishing returns) ────────────────────────────────────

describe("effectivePoints", () => {
  it("returns 0 for non-positive input", () => {
    expect(effectivePoints(0)).toBe(0);
    expect(effectivePoints(-5)).toBe(0);
  });

  it("returns raw value in the 1-25 range (no diminishing returns)", () => {
    expect(effectivePoints(1)).toBe(1);
    expect(effectivePoints(10)).toBe(10);
    expect(effectivePoints(25)).toBe(25);
  });

  it("applies 50% diminishing returns in the 26-50 range", () => {
    // 26 → 25 + (1)*0.5 = 25.5
    expect(effectivePoints(26)).toBe(25.5);
    // 50 → 25 + 25*0.5 = 37.5
    expect(effectivePoints(50)).toBe(37.5);
    // 30 → 25 + 5*0.5 = 27.5
    expect(effectivePoints(30)).toBe(27.5);
  });

  it("applies 25% diminishing returns beyond 50", () => {
    // 51 → 25 + 12.5 + 1*0.25 = 37.75
    expect(effectivePoints(51)).toBe(37.75);
    // 60 → 25 + 12.5 + 10*0.25 = 40
    expect(effectivePoints(60)).toBe(40);
    // 100 → 25 + 12.5 + 50*0.25 = 50
    expect(effectivePoints(100)).toBe(50);
  });
});

// ── computeSecondaryStats ────────────────────────────────────────────────────

const ZERO_ATTRS: PrimaryAttributes = {
  strength: 0, vitality: 0, endurance: 0, intellect: 0,
  wisdom: 0, dexterity: 0, agility: 0, tactics: 0,
};

describe("computeSecondaryStats", () => {
  it("returns base values at level 1 with zero attributes", () => {
    const stats = computeSecondaryStats(ZERO_ATTRS, 1);
    expect(stats.health).toBe(100);
    expect(stats.mana).toBe(50);
    expect(stats.stamina).toBe(100);
    expect(stats.damage).toBe(5);
    expect(stats.defense).toBe(5);
    expect(stats.block).toBe(5);
    expect(stats.critChance).toBe(5);
    expect(stats.critDamage).toBe(150);
    expect(stats.accuracy).toBe(75);
  });

  it("scales base values with level", () => {
    const stats = computeSecondaryStats(ZERO_ATTRS, 10);
    // level 10: lv = 9
    expect(stats.health).toBe(100 + 9 * 12);      // 208
    expect(stats.mana).toBe(50 + 9 * 5);           // 95
    expect(stats.stamina).toBe(100 + 9 * 3);       // 127
  });

  it("increases health from strength points", () => {
    const attrs: PrimaryAttributes = { ...ZERO_ATTRS, strength: 10 };
    const stats = computeSecondaryStats(attrs, 1);
    // 10 STR in the full (1-25) range → eff=10, +26 HP/pt → +260 HP
    // base=100, total=360
    expect(stats.health).toBe(360);
  });

  it("applies tactics multiplier to non-resource stats only", () => {
    // 10 tactics → multiplier = 1.05
    const attrs: PrimaryAttributes = { ...ZERO_ATTRS, tactics: 10 };
    const stats = computeSecondaryStats(attrs, 1);
    // Health is a RESOURCE stat → tactics multiplier should NOT apply
    // base 100 + eff(10)*10 (tactics.health=10) = 200
    expect(stats.health).toBe(200);
    // Damage is non-resource: base 5 + eff(10)*3 = 35, × 1.05 = 36.75, rounded → 36.8
    expect(stats.damage).toBe(36.8);
  });

  it("respects stat caps", () => {
    // Stack multiple attributes that all contribute critChance so the
    // uncapped total exceeds 75. Dexterity alone maxes at ~42 due to DR,
    // but dex+wisdom+strength+agility together push well past the 75 cap.
    const attrs: PrimaryAttributes = {
      ...ZERO_ATTRS,
      dexterity: 200,
      wisdom: 200,
      strength: 200,
      agility: 200,
    };
    const stats = computeSecondaryStats(attrs, 1);
    expect(stats.critChance).toBe(STAT_CAPS.critChance);
  });

  it("produces integer resource stats and decimal combat stats", () => {
    const attrs: PrimaryAttributes = {
      strength: 14, vitality: 14, endurance: 8, intellect: 3,
      wisdom: 4, dexterity: 6, agility: 4, tactics: 5,
    };
    const stats = computeSecondaryStats(attrs, 1);
    // Resources should be integers
    expect(Number.isInteger(stats.health)).toBe(true);
    expect(Number.isInteger(stats.mana)).toBe(true);
    expect(Number.isInteger(stats.stamina)).toBe(true);
    // attackSpeed should be 2-decimal
    const decimalPlaces = (stats.attackSpeed.toString().split(".")[1] || "").length;
    expect(decimalPlaces).toBeLessThanOrEqual(2);
  });

  it("computes a positive combatPower composite", () => {
    const attrs: PrimaryAttributes = {
      strength: 14, vitality: 14, endurance: 8, intellect: 3,
      wisdom: 4, dexterity: 6, agility: 4, tactics: 5,
    };
    const stats = computeSecondaryStats(attrs, 5);
    expect(stats.combatPower).toBeGreaterThan(0);
    expect(Number.isInteger(stats.combatPower)).toBe(true);
  });
});

// ── RESOURCE_STATS and STAT_CAPS integrity ───────────────────────────────────

describe("constants", () => {
  it("RESOURCE_STATS contains exactly health, mana, stamina", () => {
    expect(RESOURCE_STATS.size).toBe(3);
    expect(RESOURCE_STATS.has("health")).toBe(true);
    expect(RESOURCE_STATS.has("mana")).toBe(true);
    expect(RESOURCE_STATS.has("stamina")).toBe(true);
  });

  it("STAT_CAPS has reasonable cap values", () => {
    expect(STAT_CAPS.block).toBe(75);
    expect(STAT_CAPS.critChance).toBe(75);
    expect(STAT_CAPS.blockEffect).toBe(90);
    expect(STAT_CAPS.critDamage).toBe(300);
    expect(STAT_CAPS.cooldownReduction).toBe(40);
  });
});
