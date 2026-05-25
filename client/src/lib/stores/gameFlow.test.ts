import { describe, it, expect, beforeEach } from "vitest";
import { useGameFlow } from "./useGameFlow";

// ── useGameFlow store tests ──────────────────────────────────────────────────

describe("useGameFlow — initial state", () => {
  beforeEach(() => {
    useGameFlow.getState().setContext({
      context: "zone_overworld",
      zoneId: "coast",
      playerPos: { x: 0, z: 0 },
      channelId: null,
    });
  });

  it("starts in zone_overworld context", () => {
    expect(useGameFlow.getState().context).toBe("zone_overworld");
  });

  it("starts with coast zone", () => {
    const state = useGameFlow.getState().state;
    expect("zoneId" in state && state.zoneId).toBe("coast");
  });

  it("starts with no fade", () => {
    expect(useGameFlow.getState().fadePhase).toBe("none");
    expect(useGameFlow.getState().fadeOpacity).toBe(0);
  });

  it("starts not transitioning", () => {
    expect(useGameFlow.getState().transitioning).toBe(false);
  });

  it("has correct render layers for zone_overworld", () => {
    const layers = useGameFlow.getState().layers;
    expect(layers.terrain).toBe("heightmap");
    expect(layers.water).toBe("zone_water");
    expect(layers.camera).toBe("third_person");
    expect(layers.enemies).toBe("zone_biome");
    expect(layers.players).toBe("mmo_zone");
  });
});

describe("useGameFlow — setContext (no fade)", () => {
  it("switches to dungeon context", () => {
    useGameFlow.getState().setContext({
      context: "dungeon",
      zoneId: "forest",
      dungeonName: "Hollow Oak",
      tier: 1,
      seed: 12345,
      theme: "crypt",
      returnPos: { x: 10, z: 20 },
    });

    expect(useGameFlow.getState().context).toBe("dungeon");
    expect(useGameFlow.getState().layers.terrain).toBe("dungeon_modular");
    expect(useGameFlow.getState().layers.atmosphere).toBe("cave");
    expect(useGameFlow.getState().layers.lighting).toBe("dungeon_torch");
  });

  it("switches to open_water context", () => {
    useGameFlow.getState().setContext({
      context: "open_water",
      originZone: "plains",
      destinationZone: "forest",
      shipType: "sloop",
      voyageProgress: 0,
    });

    expect(useGameFlow.getState().context).toBe("open_water");
    expect(useGameFlow.getState().layers.water).toBe("ocean_shader");
    expect(useGameFlow.getState().layers.physics).toBe("ship_procedural");
    expect(useGameFlow.getState().layers.camera).toBe("ship_follow");
  });

  it("switches to home_island context", () => {
    useGameFlow.getState().setContext({
      context: "home_island",
      ownerId: "player_123",
      islandSeed: 42,
      biome: "temperate",
      sessionCode: null,
    });

    expect(useGameFlow.getState().context).toBe("home_island");
    expect(useGameFlow.getState().layers.enemies).toBe("none");
    expect(useGameFlow.getState().layers.players).toBe("co_op_home");
  });

  it("switches to boss_arena context", () => {
    useGameFlow.getState().setContext({
      context: "boss_arena",
      zoneId: "lava",
      bossName: "Moloch",
      bossType: "demon",
      arenaCenter: { x: 0, z: -1300 },
      arenaRadius: 40,
    });

    expect(useGameFlow.getState().context).toBe("boss_arena");
    expect(useGameFlow.getState().layers.lighting).toBe("boss_dramatic");
    expect(useGameFlow.getState().layers.enemies).toBe("boss_only");
  });

  it("switches to tutorial_island context", () => {
    useGameFlow.getState().setContext({
      context: "tutorial_island",
      areaId: "shipwreck",
    });

    expect(useGameFlow.getState().context).toBe("tutorial_island");
    expect(useGameFlow.getState().layers.terrain).toBe("glb");
    expect(useGameFlow.getState().layers.physics).toBe("rapier_trimesh");
  });

  it("resets fade state on setContext", () => {
    // Simulate a mid-fade state
    useGameFlow.setState({ fadePhase: "hold", fadeOpacity: 1, transitioning: true });

    useGameFlow.getState().setContext({
      context: "zone_overworld",
      zoneId: "plains",
      playerPos: { x: 0, z: 0 },
      channelId: null,
    });

    expect(useGameFlow.getState().fadePhase).toBe("none");
    expect(useGameFlow.getState().fadeOpacity).toBe(0);
    expect(useGameFlow.getState().transitioning).toBe(false);
  });
});

describe("useGameFlow — getCurrentZoneId", () => {
  it("returns zone ID when in zone_overworld", () => {
    useGameFlow.getState().setContext({
      context: "zone_overworld",
      zoneId: "forest",
      playerPos: { x: 0, z: 0 },
      channelId: null,
    });
    expect(useGameFlow.getState().getCurrentZoneId()).toBe("forest");
  });

  it("returns zone ID when in dungeon", () => {
    useGameFlow.getState().setContext({
      context: "dungeon",
      zoneId: "lava",
      dungeonName: "Magma Core",
      tier: 3,
      seed: 999,
      theme: "mine",
      returnPos: { x: 0, z: 0 },
    });
    expect(useGameFlow.getState().getCurrentZoneId()).toBe("lava");
  });

  it("returns null when in open_water", () => {
    useGameFlow.getState().setContext({
      context: "open_water",
      originZone: "plains",
      destinationZone: "forest",
      shipType: "sloop",
      voyageProgress: 0.5,
    });
    expect(useGameFlow.getState().getCurrentZoneId()).toBeNull();
  });

  it("returns null when in home_island", () => {
    useGameFlow.getState().setContext({
      context: "home_island",
      ownerId: "p1",
      islandSeed: 1,
      biome: "temperate",
      sessionCode: null,
    });
    expect(useGameFlow.getState().getCurrentZoneId()).toBeNull();
  });
});

describe("useGameFlow — transition validation", () => {
  beforeEach(() => {
    useGameFlow.getState().setContext({
      context: "zone_overworld",
      zoneId: "coast",
      playerPos: { x: 0, z: 0 },
      channelId: null,
    });
  });

  it("rejects invalid transitions silently", () => {
    // Can't exit_dungeon from zone_overworld
    useGameFlow.getState().transition({ type: "exit_dungeon" });
    // Should still be in zone_overworld (transition was rejected)
    expect(useGameFlow.getState().context).toBe("zone_overworld");
    expect(useGameFlow.getState().transitioning).toBe(false);
  });

  it("rejects double-transitions", () => {
    // Force transitioning state
    useGameFlow.setState({ transitioning: true });

    useGameFlow.getState().transition({
      type: "dock_travel",
      from: "coast",
      to: "plains",
    });

    // Should not have changed (double-transition blocked)
    expect(useGameFlow.getState().context).toBe("zone_overworld");
  });
});

// ── Render layer completeness ────────────────────────────────────────────────

import { RENDER_LAYERS, type RenderContext } from "@/game/world/GameFlowStateMachine";

describe("RENDER_LAYERS — completeness", () => {
  const allContexts: RenderContext[] = [
    "zone_overworld", "open_water", "dungeon",
    "home_island", "boss_arena", "tutorial_island",
  ];

  const requiredKeys = [
    "terrain", "water", "sky", "lighting", "physics",
    "camera", "hud", "atmosphere", "enemies", "players",
  ];

  for (const ctx of allContexts) {
    it(`${ctx} has all 10 render layer keys`, () => {
      const layers = RENDER_LAYERS[ctx];
      expect(layers).toBeDefined();
      for (const key of requiredKeys) {
        expect(layers).toHaveProperty(key);
        expect((layers as any)[key]).toBeTruthy();
      }
    });
  }
});

// ── Transition target resolution ─────────────────────────────────────────────

import { getTargetContext, isValidTransition } from "@/game/world/GameFlowStateMachine";

describe("getTargetContext", () => {
  it("dock_travel → open_water", () => {
    expect(getTargetContext({ type: "dock_travel", from: "coast", to: "plains" })).toBe("open_water");
  });

  it("enter_dungeon → dungeon", () => {
    expect(getTargetContext({ type: "enter_dungeon", zoneId: "forest", dungeonName: "test", tier: 1, returnPos: { x: 0, z: 0 } })).toBe("dungeon");
  });

  it("exit_dungeon → zone_overworld", () => {
    expect(getTargetContext({ type: "exit_dungeon" })).toBe("zone_overworld");
  });

  it("enter_home → home_island", () => {
    expect(getTargetContext({ type: "enter_home", ownerId: "p1" })).toBe("home_island");
  });

  it("exit_home → zone_overworld", () => {
    expect(getTargetContext({ type: "exit_home", returnTo: "plains" })).toBe("zone_overworld");
  });

  it("enter_boss → boss_arena", () => {
    expect(getTargetContext({ type: "enter_boss", zoneId: "lava", bossName: "Moloch" })).toBe("boss_arena");
  });

  it("die_respawn → zone_overworld", () => {
    expect(getTargetContext({ type: "die_respawn", respawnZone: "coast", respawnPos: { x: 0, z: 0 } })).toBe("zone_overworld");
  });
});

describe("isValidTransition", () => {
  it("allows dock_travel from zone_overworld", () => {
    expect(isValidTransition("zone_overworld", "dock_travel")).toBe(true);
  });

  it("allows enter_dungeon from zone_overworld", () => {
    expect(isValidTransition("zone_overworld", "enter_dungeon")).toBe(true);
  });

  it("blocks exit_dungeon from zone_overworld", () => {
    expect(isValidTransition("zone_overworld", "exit_dungeon")).toBe(false);
  });

  it("allows exit_dungeon from dungeon", () => {
    expect(isValidTransition("dungeon", "exit_dungeon")).toBe(true);
  });

  it("blocks enter_dungeon from dungeon", () => {
    expect(isValidTransition("dungeon", "enter_dungeon")).toBe(false);
  });

  it("allows die_respawn from any context", () => {
    expect(isValidTransition("zone_overworld", "die_respawn")).toBe(true);
    expect(isValidTransition("dungeon", "die_respawn")).toBe(true);
    expect(isValidTransition("open_water", "die_respawn")).toBe(true);
    expect(isValidTransition("boss_arena", "die_respawn")).toBe(true);
    expect(isValidTransition("home_island", "die_respawn")).toBe(true);
  });

  it("blocks enter_home from dungeon", () => {
    expect(isValidTransition("dungeon", "enter_home")).toBe(false);
  });
});
