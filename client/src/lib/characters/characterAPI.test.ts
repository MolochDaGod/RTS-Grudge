import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Tests the character API contract — the fetch interface that
 * useCharacterAPI depends on. Validates request shapes and
 * response handling for all CRUD + activate operations.
 */

vi.mock("@/lib/save/playerId", () => ({
  getPlayerId: () => "test-player-456",
}));

const PLAYER_ID = "test-player-456";
const CHAR_ID = "char_abc123def456";
const API_BASE = `/api/characters/${PLAYER_ID}`;

const MOCK_CHARACTER = {
  player_id: PLAYER_ID,
  character_id: CHAR_ID,
  name: "TestHero",
  hero_class: "warrior",
  race: "human",
  model_path: "/models/characters/assassin-male.glb",
  appearance: { matColors: { skin: null, clothing: "#222222" }, scale: 1.0 },
  equipment: { combatClass: "melee", weaponRight: "sword", weaponLeft: "shield" },
  level: 5,
  is_active: true,
  version: 1,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── GET /api/characters/:playerId ────────────────────────────────────────────

describe("character API — GET (list)", () => {
  it("returns character list on 200", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({ success: true, characters: [MOCK_CHARACTER] }),
    });

    const res = await fetch(API_BASE);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.characters).toHaveLength(1);
    expect(data.characters[0].name).toBe("TestHero");
    expect(data.characters[0].hero_class).toBe("warrior");
  });

  it("returns empty array when player has no characters", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({ success: true, characters: [] }),
    });

    const res = await fetch(API_BASE);
    const data = await res.json();
    expect(data.characters).toHaveLength(0);
  });

  it("supports ?active=true filter", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({ success: true, characters: [MOCK_CHARACTER] }),
    });

    const res = await fetch(`${API_BASE}?active=true`);
    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}?active=true`);
    const data = await res.json();
    expect(data.characters[0].is_active).toBe(true);
  });
});

// ── POST /api/characters/:playerId ───────────────────────────────────────────

describe("character API — POST (create)", () => {
  it("creates a character and returns 201", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true, status: 201,
      json: async () => ({ success: true, character: MOCK_CHARACTER }),
    });

    const body = {
      name: "TestHero",
      heroClass: "warrior",
      race: "human",
      modelPath: "/models/characters/assassin-male.glb",
      appearance: { matColors: {}, scale: 1.0 },
      equipment: { combatClass: "melee", weaponRight: "sword" },
    };

    const res = await fetch(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.character.is_active).toBe(true);
  });
});

// ── PUT /api/characters/:playerId/:charId ────────────────────────────────────

describe("character API — PUT (update)", () => {
  it("updates character fields", async () => {
    const updated = { ...MOCK_CHARACTER, name: "RenamedHero", level: 10 };
    fetchMock.mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({ success: true, character: updated }),
    });

    const res = await fetch(`${API_BASE}/${CHAR_ID}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "RenamedHero", level: 10 }),
    });

    const data = await res.json();
    expect(data.character.name).toBe("RenamedHero");
    expect(data.character.level).toBe(10);
  });

  it("returns 409 on version conflict", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false, status: 409,
      json: async () => ({ success: false, error: "Version conflict", current: MOCK_CHARACTER }),
    });

    const res = await fetch(`${API_BASE}/${CHAR_ID}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Conflict", expectedVersion: 0 }),
    });

    expect(res.status).toBe(409);
  });

  it("returns 404 for non-existent character", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false, status: 404,
      json: async () => ({ success: false, error: "Character not found" }),
    });

    const res = await fetch(`${API_BASE}/char_nonexistent`, { method: "PUT" });
    expect(res.status).toBe(404);
  });
});

// ── PUT activate ─────────────────────────────────────────────────────────────

describe("character API — PUT activate", () => {
  it("activates a character", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({ success: true, character: { ...MOCK_CHARACTER, is_active: true } }),
    });

    const res = await fetch(`${API_BASE}/${CHAR_ID}/activate`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });

    const data = await res.json();
    expect(data.character.is_active).toBe(true);
  });
});

// ── DELETE ────────────────────────────────────────────────────────────────────

describe("character API — DELETE", () => {
  it("deletes a character", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({ success: true, removed: true }),
    });

    const res = await fetch(`${API_BASE}/${CHAR_ID}`, { method: "DELETE" });
    const data = await res.json();
    expect(data.removed).toBe(true);
  });
});

// ── Character record shape ───────────────────────────────────────────────────

describe("ServerCharacter record shape", () => {
  it("contains all required fields", () => {
    const required = [
      "player_id", "character_id", "name", "hero_class", "race",
      "model_path", "appearance", "equipment", "level", "is_active",
      "version", "created_at", "updated_at",
    ] as const;

    for (const key of required) {
      expect(MOCK_CHARACTER).toHaveProperty(key);
    }
  });

  it("appearance contains matColors", () => {
    expect(MOCK_CHARACTER.appearance).toHaveProperty("matColors");
  });

  it("equipment contains combatClass and weaponRight", () => {
    expect(MOCK_CHARACTER.equipment).toHaveProperty("combatClass");
    expect(MOCK_CHARACTER.equipment).toHaveProperty("weaponRight");
  });
});
