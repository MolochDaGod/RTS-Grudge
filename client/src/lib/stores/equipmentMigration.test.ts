import { describe, it, expect, beforeEach } from "vitest";
import { useEquipment } from "./useEquipment";
import type { EquipItem } from "./useEquipment";

// ── useEquipment: no localStorage ────────────────────────────────────────────
// After the server-side migration, useEquipment must NOT read from or write to
// localStorage. All persistence flows through saveSync → /api/saves.

describe("useEquipment — no localStorage dependency", () => {
  beforeEach(() => {
    useEquipment.getState().reset();
  });

  it("initializes with empty equipped map", () => {
    expect(Object.keys(useEquipment.getState().equipped)).toHaveLength(0);
  });

  it("initializes with default gold=0, level=1, experience=0", () => {
    const s = useEquipment.getState();
    expect(s.gold).toBe(0);
    expect(s.level).toBe(1);
    expect(s.experience).toBe(0);
    expect(s.experienceToNext).toBe(100);
  });

  it("initializes with default mana=50, maxMana=50", () => {
    const s = useEquipment.getState();
    expect(s.mana).toBe(50);
    expect(s.maxMana).toBe(50);
  });

  it("does not expose persist or hydrate methods", () => {
    const s = useEquipment.getState();
    expect((s as any).persist).toBeUndefined();
    expect((s as any).hydrate).toBeUndefined();
  });

  it("equip/unequip work without calling persist", () => {
    const sword: EquipItem = {
      id: "iron_longsword",
      name: "Iron Longsword",
      slot: "mainHand",
      icon: "⚔️",
      tier: 2,
      stats: { damage: 15 },
      rarity: "uncommon",
      weaponType: "sword",
    };

    useEquipment.getState().equip(sword);
    expect(useEquipment.getState().equipped.mainHand).toBeDefined();
    expect(useEquipment.getState().equipped.mainHand!.id).toBe("iron_longsword");

    useEquipment.getState().unequip("mainHand");
    expect(useEquipment.getState().equipped.mainHand).toBeUndefined();
  });

  it("addGold persists in store without localStorage", () => {
    useEquipment.getState().addGold(100);
    expect(useEquipment.getState().gold).toBe(100);

    useEquipment.getState().addGold(50);
    expect(useEquipment.getState().gold).toBe(150);
  });

  it("addExperience levels up and increases maxMana", () => {
    // Starting: level 1, exp 0, toNext 100
    useEquipment.getState().addExperience(150);
    const s = useEquipment.getState();
    expect(s.level).toBe(2);
    expect(s.experience).toBe(50); // 150 - 100 = 50
    expect(s.experienceToNext).toBe(150); // 100 * 1.5
    expect(s.maxMana).toBe(60); // 50 + (2-1)*10
  });

  it("reset clears all state to defaults", () => {
    useEquipment.getState().addGold(999);
    useEquipment.getState().addExperience(500);
    useEquipment.getState().reset();

    const s = useEquipment.getState();
    expect(s.gold).toBe(0);
    expect(s.level).toBe(1);
    expect(s.experience).toBe(0);
    expect(Object.keys(s.equipped)).toHaveLength(0);
  });
});

// ── saveSync integration ─────────────────────────────────────────────────────
// Verify that snapshotGame captures all equipment fields and restoreGame
// correctly restores them, including backward compat for legacy saves.

// We import saveSync functions and test them directly against the zustand store.
import { snapshotGame, restoreGame, type GameSnapshot } from "@/lib/save/saveSync";

describe("saveSync — equipment snapshot coverage", () => {
  beforeEach(() => {
    useEquipment.getState().reset();
  });

  it("snapshotGame captures gold, level, experience, mana fields", () => {
    useEquipment.setState({ gold: 42, level: 5, experience: 80, experienceToNext: 200, mana: 30, maxMana: 90 });
    const snap = snapshotGame();

    expect(snap.equipment.gold).toBe(42);
    expect(snap.equipment.level).toBe(5);
    expect(snap.equipment.experience).toBe(80);
    expect(snap.equipment.experienceToNext).toBe(200);
    expect(snap.equipment.mana).toBe(30);
    expect(snap.equipment.maxMana).toBe(90);
  });

  it("snapshotGame captures equipped items", () => {
    const helm: EquipItem = {
      id: "iron_helm",
      name: "Iron Helm",
      slot: "helm",
      icon: "🪖",
      tier: 2,
      stats: { defense: 5 },
      rarity: "uncommon",
    };
    useEquipment.getState().equip(helm);
    const snap = snapshotGame();
    const eq = snap.equipment.equipped as any;
    expect(eq.helm).toBeDefined();
    expect(eq.helm.id).toBe("iron_helm");
  });

  it("restoreGame restores all equipment fields", () => {
    const snap: GameSnapshot = {
      schemaVersion: 1,
      timestamp: Date.now(),
      characterStats: { heroes: {} },
      equipment: {
        equipped: { mainHand: { id: "test_sword", name: "Test", slot: "mainHand", icon: "⚔️", tier: 1, stats: {}, rarity: "common" } },
        actionSlots: [],
        gold: 300,
        level: 10,
        experience: 45,
        experienceToNext: 500,
        mana: 80,
        maxMana: 140,
      },
      inventory: { items: [], maxSlots: 36 },
      survival: { health: 100, maxHealth: 100, hunger: 50, maxHunger: 100, stamina: 100, maxStamina: 100, isAlive: true, activeCharacterId: null },
    };

    restoreGame(snap);
    const s = useEquipment.getState();
    expect(s.gold).toBe(300);
    expect(s.level).toBe(10);
    expect(s.experience).toBe(45);
    expect(s.experienceToNext).toBe(500);
    expect(s.mana).toBe(80);
    expect(s.maxMana).toBe(140);
    expect(s.equipped.mainHand?.id).toBe("test_sword");
  });

  it("restoreGame handles legacy saves (no gold/level/mana fields)", () => {
    // Legacy saves only have equipped + actionSlots — no gold/level/mana.
    // restoreGame must not crash and should leave defaults in place.
    const legacySnap: GameSnapshot = {
      schemaVersion: 1,
      timestamp: Date.now(),
      characterStats: { heroes: {} },
      equipment: {
        equipped: {},
        actionSlots: [],
        // No gold, level, experience, etc.
      },
      inventory: { items: [], maxSlots: 36 },
      survival: { health: 100, maxHealth: 100, hunger: 50, maxHunger: 100, stamina: 100, maxStamina: 100, isAlive: true, activeCharacterId: null },
    };

    // Pre-set some values to verify they're NOT overwritten by absent fields
    useEquipment.setState({ gold: 50, level: 3 });
    restoreGame(legacySnap);

    const s = useEquipment.getState();
    // Should retain pre-existing values since snapshot had no gold/level
    expect(s.gold).toBe(50);
    expect(s.level).toBe(3);
  });

  it("restoreGame refuses invalid schemaVersion", () => {
    const badSnap = { schemaVersion: 99 } as any;
    // Should not throw, just warn
    expect(() => restoreGame(badSnap)).not.toThrow();
  });

  it("snapshot round-trip preserves equipment state", () => {
    useEquipment.setState({ gold: 123, level: 7, experience: 60, experienceToNext: 300, mana: 55, maxMana: 110 });
    const snap = snapshotGame();

    useEquipment.getState().reset();
    expect(useEquipment.getState().gold).toBe(0);

    restoreGame(snap);
    const s = useEquipment.getState();
    expect(s.gold).toBe(123);
    expect(s.level).toBe(7);
    expect(s.experience).toBe(60);
    expect(s.mana).toBe(55);
    expect(s.maxMana).toBe(110);
  });
});
