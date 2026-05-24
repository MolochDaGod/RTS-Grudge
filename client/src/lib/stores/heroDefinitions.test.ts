import { describe, it, expect } from "vitest";
import { getHeroDefinition, HERO_DEFINITIONS, RACE_BONUSES, CLASS_LABELS } from "./heroDefinitions";
import type { HeroClass, HeroRace } from "./characterTypes";

// ── getHeroDefinition ────────────────────────────────────────────────────────

describe("getHeroDefinition", () => {
  it("finds a known hero by characterId", () => {
    const knight = getHeroDefinition("knight");
    expect(knight).toBeDefined();
    expect(knight!.name).toBe("Knight");
    expect(knight!.heroClass).toBe("warrior");
    expect(knight!.race).toBe("human");
  });

  it("returns undefined for unknown characterId", () => {
    expect(getHeroDefinition("nonexistent_hero")).toBeUndefined();
    expect(getHeroDefinition("")).toBeUndefined();
  });

  it("finds the project creator's hero", () => {
    const rac = getHeroDefinition("racalvin");
    expect(rac).toBeDefined();
    expect(rac!.name).toBe("Racalvin");
  });
});

// ── HERO_DEFINITIONS data integrity ──────────────────────────────────────────

describe("HERO_DEFINITIONS", () => {
  it("contains at least 20 heroes", () => {
    expect(HERO_DEFINITIONS.length).toBeGreaterThanOrEqual(20);
  });

  it("has unique characterIds", () => {
    const ids = HERO_DEFINITIONS.map(h => h.characterId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every hero has valid class and race", () => {
    const validClasses: HeroClass[] = ["warrior", "mage", "worge", "ranger"];
    const validRaces: HeroRace[] = ["human", "elf", "dwarf", "orc", "barbarian", "undead"];
    for (const hero of HERO_DEFINITIONS) {
      expect(validClasses).toContain(hero.heroClass);
      expect(validRaces).toContain(hero.race);
    }
  });

  it("every hero has 8 base attributes that sum to a positive value", () => {
    for (const hero of HERO_DEFINITIONS) {
      const attrs = hero.baseAttributes;
      const keys = ["strength", "vitality", "endurance", "intellect", "wisdom", "dexterity", "agility", "tactics"] as const;
      expect(Object.keys(attrs)).toHaveLength(8);
      const total = keys.reduce((sum, k) => sum + attrs[k], 0);
      expect(total).toBeGreaterThan(0);
    }
  });

  it("every hero has a non-empty lore string", () => {
    for (const hero of HERO_DEFINITIONS) {
      expect(hero.lore.length).toBeGreaterThan(0);
    }
  });
});

// ── RACE_BONUSES ─────────────────────────────────────────────────────────────

describe("RACE_BONUSES", () => {
  it("covers all 6 races", () => {
    const races: HeroRace[] = ["human", "elf", "dwarf", "orc", "barbarian", "undead"];
    for (const race of races) {
      expect(RACE_BONUSES[race]).toBeDefined();
      expect(RACE_BONUSES[race].label).toBeTruthy();
      expect(RACE_BONUSES[race].bonus).toBeTruthy();
    }
  });

  it("each race has at least one attribute bonus", () => {
    for (const race of Object.keys(RACE_BONUSES) as HeroRace[]) {
      const bonuses = RACE_BONUSES[race].bonuses;
      const total = Object.values(bonuses).reduce((s, v) => s + (v ?? 0), 0);
      expect(total).toBeGreaterThan(0);
    }
  });
});

// ── CLASS_LABELS ─────────────────────────────────────────────────────────────

describe("CLASS_LABELS", () => {
  it("covers all 4 classes", () => {
    const classes: HeroClass[] = ["warrior", "mage", "worge", "ranger"];
    for (const cls of classes) {
      expect(CLASS_LABELS[cls]).toBeDefined();
      expect(CLASS_LABELS[cls].label).toBeTruthy();
      expect(CLASS_LABELS[cls].color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
