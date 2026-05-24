import { describe, it, expect } from "vitest";
import { xpForLevel, attributePointsForLevel, skillPointsForLevel } from "./levelFormulas";

// ── xpForLevel ───────────────────────────────────────────────────────────────

describe("xpForLevel", () => {
  it("returns 0 for level 0 and negative levels", () => {
    expect(xpForLevel(0)).toBe(0);
    expect(xpForLevel(-1)).toBe(0);
  });

  it("returns table values for levels 1-30", () => {
    expect(xpForLevel(1)).toBe(0);     // first entry
    expect(xpForLevel(2)).toBe(100);   // second entry
    expect(xpForLevel(3)).toBe(250);
    expect(xpForLevel(10)).toBe(5000);
    expect(xpForLevel(30)).toBe(173500);
  });

  it("uses exponential formula beyond level 30", () => {
    const xp31 = xpForLevel(31);
    // 173500 + 1 * 25000 * 1.1^1 = 173500 + 27500 = 201000
    expect(xp31).toBe(201000);
  });

  it("increases monotonically", () => {
    for (let lv = 2; lv <= 40; lv++) {
      expect(xpForLevel(lv)).toBeGreaterThanOrEqual(xpForLevel(lv - 1));
    }
  });
});

// ── attributePointsForLevel ──────────────────────────────────────────────────

describe("attributePointsForLevel", () => {
  it("gives 20 starting points at level 1", () => {
    expect(attributePointsForLevel(1)).toBe(20);
  });

  it("adds 7 points per level", () => {
    // level 2: 20 + 1*7 = 27
    expect(attributePointsForLevel(2)).toBe(27);
    // level 5: 20 + 4*7 = 48
    expect(attributePointsForLevel(5)).toBe(48);
  });

  it("caps at 160 points", () => {
    // level 21: 20 + 20*7 = 160 (cap)
    expect(attributePointsForLevel(21)).toBe(160);
    // level 50: still 160
    expect(attributePointsForLevel(50)).toBe(160);
    expect(attributePointsForLevel(100)).toBe(160);
  });

  it("returns 20 for level 0 or below (no negative)", () => {
    // max(0, 0-1) * 7 = 0 → 20
    expect(attributePointsForLevel(0)).toBe(20);
  });
});

// ── skillPointsForLevel ──────────────────────────────────────────────────────

describe("skillPointsForLevel", () => {
  it("gives 0 skill points at level 1", () => {
    // max(0, 0) + floor(1/5) = 0 + 0 = 0
    expect(skillPointsForLevel(1)).toBe(0);
  });

  it("gives 1 per level after 1, plus bonus every 5 levels", () => {
    // level 2: 1 + floor(2/5) = 1 + 0 = 1
    expect(skillPointsForLevel(2)).toBe(1);
    // level 5: 4 + floor(5/5) = 4 + 1 = 5
    expect(skillPointsForLevel(5)).toBe(5);
    // level 10: 9 + floor(10/5) = 9 + 2 = 11
    expect(skillPointsForLevel(10)).toBe(11);
    // level 20: 19 + floor(20/5) = 19 + 4 = 23
    expect(skillPointsForLevel(20)).toBe(23);
  });

  it("increases monotonically", () => {
    for (let lv = 2; lv <= 50; lv++) {
      expect(skillPointsForLevel(lv)).toBeGreaterThanOrEqual(skillPointsForLevel(lv - 1));
    }
  });
});
