import { describe, it, expect } from "vitest";
import { deriveSaveIdentity } from "./saveIdentity";

/**
 * Verifies the grudge6-UUID integration for save records: a save must be tagged
 * with the chosen grudge6 character's cross-game UUID (and real name/race) when
 * known, while still falling back to the legacy local "hero" stats key so old
 * saves and guests keep working.
 */
describe("deriveSaveIdentity", () => {
  const heroes = { hero: { heroClass: "warrior", race: "human", level: 7 } };

  it("prefers the grudge6 UUID + real name/race when identity is present", () => {
    const out = deriveSaveIdentity({
      activeCharacterId: "hero",
      heroes,
      identity: { serverCharacterId: "char_abc123def456", name: "Ragnar", race: "barbarian" },
    });
    // The save's character_id maps back to /api/characters, not the "hero" key.
    expect(out.characterId).toBe("char_abc123def456");
    expect(out.characterName).toBe("Ragnar");
    expect(out.characterRace).toBe("barbarian");
    // class + level still come from the local hero stat block.
    expect(out.characterClass).toBe("warrior");
    expect(out.level).toBe(7);
  });

  it("falls back to the local stats key for legacy snapshots (no identity)", () => {
    const out = deriveSaveIdentity({ activeCharacterId: "hero", heroes });
    expect(out.characterId).toBe("hero");
    expect(out.characterName).toBe("hero");
    expect(out.characterRace).toBe("human"); // from the hero stat block
    expect(out.characterClass).toBe("warrior");
    expect(out.level).toBe(7);
  });

  it("uses the first hero key when activeCharacterId is null", () => {
    const out = deriveSaveIdentity({ activeCharacterId: null, heroes, identity: null });
    expect(out.characterId).toBe("hero");
    expect(out.characterClass).toBe("warrior");
    expect(out.level).toBe(7);
  });

  it("still records the UUID when the hero stats map is empty", () => {
    const out = deriveSaveIdentity({
      activeCharacterId: null,
      heroes: {},
      identity: { serverCharacterId: "char_solo", name: "Solo", race: "elf" },
    });
    expect(out.characterId).toBe("char_solo");
    expect(out.characterName).toBe("Solo");
    expect(out.characterRace).toBe("elf");
    expect(out.characterClass).toBeNull();
    expect(out.level).toBe(1);
  });

  it("ignores a null serverCharacterId inside an otherwise-present identity", () => {
    const out = deriveSaveIdentity({
      activeCharacterId: "hero",
      heroes,
      identity: { serverCharacterId: null, name: "Guest Hero", race: null },
    });
    // No UUID yet (unsaved/guest) → keep the local key, but still use the name.
    expect(out.characterId).toBe("hero");
    expect(out.characterName).toBe("Guest Hero");
    expect(out.characterRace).toBe("human"); // falls through to hero stat block
  });
});
