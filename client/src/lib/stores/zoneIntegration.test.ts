import { describe, it, expect, beforeEach } from "vitest";
import { useGameFlow } from "./useGameFlow";
import { ZoneManager } from "../../../../server/zoneManager";
import { getZone, getDockDestinations, getAdjacentZones, getZoneAtWorldPos, WORLD_ZONES } from "@/game/world/WorldGridRegistry";
import { isValidTransition, getTargetContext } from "@/game/world/GameFlowStateMachine";
import { generateZoneTerrain, getZoneTerrainHeight, getElevationBand, OCEAN_FLOOR, ISLAND_GROUND_FLOOR } from "@/game/world/ZoneHeightmapSystem";

// ── Mock Socket ──────────────────────────────────────────────────────────────

function mockSocket(id: string) {
  const rooms = new Set<string>();
  return {
    id,
    join(room: string) { rooms.add(room); },
    leave(room: string) { rooms.delete(room); },
    to() { return { emit() {} }; },
    rooms,
  } as any;
}

// ── Full player lifecycle ────────────────────────────────────────────────────

describe("Integration: socket join → zone travel → dungeon → death", () => {
  let zm: ZoneManager;

  beforeEach(() => {
    zm = new ZoneManager();
    useGameFlow.getState().setContext({
      context: "zone_overworld",
      zoneId: "coast",
      playerPos: { x: 0, z: 0 },
      channelId: null,
    });
  });

  const PLAYER = {
    playerId: "player_smoke",
    characterName: "SmokeHero",
    heroClass: "warrior",
    modelPath: "/models/characters/assassin-male.glb",
    level: 5,
    position: [0, 1, 0] as [number, number, number],
    rotation: 0,
    animation: "idle",
    health: 200,
    maxHealth: 200,
    faction: "pirate",
  };

  it("1 → player joins coast zone, gets channel + player list", () => {
    const sock = mockSocket("s1");
    const res = zm.join(sock, "coast", PLAYER);

    expect(res.channelId).toMatch(/^coast-\d+$/);
    expect(res.players).toHaveLength(1);
    expect(res.players[0].playerId).toBe("player_smoke");
    expect(res.players[0].channelId).toBe(res.channelId);

    expect(zm.getStats().totalPlayers).toBe(1);
    expect(zm.getStats().perZone.coast).toBe(1);
  });

  it("2 → second player joins same channel, both visible", () => {
    const s1 = mockSocket("s1");
    const s2 = mockSocket("s2");

    zm.join(s1, "coast", { ...PLAYER, playerId: "p1" });
    const res = zm.join(s2, "coast", { ...PLAYER, playerId: "p2", position: [10, 1, 10] });

    expect(res.players).toHaveLength(2);
    expect(zm.getStats().totalPlayers).toBe(2);
  });

  it("3 → position update stored in channel", () => {
    const sock = mockSocket("s1");
    zm.join(sock, "coast", PLAYER);
    zm.updatePosition(sock, [50, 2, 30], 1.57, "run");

    // Join a second player so the returned players array includes player 1's updated state
    const sock2 = mockSocket("s2");
    const res = zm.join(sock2, "coast", { ...PLAYER, playerId: "observer" });
    const moved = res.players.find(p => p.playerId === "player_smoke")!;

    expect(moved.position).toEqual([50, 2, 30]);
    expect(moved.rotation).toBeCloseTo(1.57);
    expect(moved.animation).toBe("run");
    expect(zm.getStats().totalPlayers).toBe(2);
  });

  it("4 → game flow: coast → open_water (dock travel to plains)", () => {
    // Verify coast has dock to plains
    const dests = getDockDestinations("coast");
    const toPlains = dests.find(d => d.zone.id === "plains");
    expect(toPlains).toBeDefined();

    // Validate transition
    expect(isValidTransition("zone_overworld", "dock_travel")).toBe(true);
    expect(getTargetContext({ type: "dock_travel", from: "coast", to: "plains" })).toBe("open_water");

    // Leave zone channel
    const sock = mockSocket("s1");
    zm.join(sock, "coast", PLAYER);
    zm.leave(sock);
    expect(zm.getStats().totalPlayers).toBe(0);

    // Switch game flow
    useGameFlow.getState().setContext({
      context: "open_water",
      originZone: "coast",
      destinationZone: "plains",
      shipType: "sloop",
      voyageProgress: 0,
    });

    expect(useGameFlow.getState().context).toBe("open_water");
    expect(useGameFlow.getState().layers.water).toBe("ocean_shader");
    expect(useGameFlow.getState().getCurrentZoneId()).toBeNull();
  });

  it("5 → arrive at plains, join plains channel", () => {
    useGameFlow.getState().setContext({
      context: "zone_overworld",
      zoneId: "plains",
      playerPos: { x: 0, z: 180 },
      channelId: null,
    });

    const sock = mockSocket("s1");
    const res = zm.join(sock, "plains", { ...PLAYER, position: [0, 1, 180] });

    expect(res.channelId).toMatch(/^plains-\d+$/);
    expect(useGameFlow.getState().getCurrentZoneId()).toBe("plains");
    expect(zm.getStats().perZone.plains).toBe(1);
  });

  it("6 → enter dungeon from plains", () => {
    const plains = getZone("plains")!;
    expect(plains.dungeons.length).toBeGreaterThanOrEqual(1);

    expect(isValidTransition("zone_overworld", "enter_dungeon")).toBe(true);

    // Leave zone channel before entering dungeon
    const sock = mockSocket("s1");
    zm.join(sock, "plains", PLAYER);
    zm.leave(sock);

    useGameFlow.getState().setContext({
      context: "dungeon",
      zoneId: "plains",
      dungeonName: plains.dungeons[0].name,
      tier: plains.dungeons[0].tier,
      seed: 12345,
      theme: "crypt",
      returnPos: { x: 80, z: -80 },
    });

    expect(useGameFlow.getState().context).toBe("dungeon");
    expect(useGameFlow.getState().layers.terrain).toBe("dungeon_modular");
    expect(useGameFlow.getState().layers.atmosphere).toBe("cave");
    expect(useGameFlow.getState().getCurrentZoneId()).toBe("plains");
  });

  it("7 → exit dungeon, rejoin plains channel", () => {
    expect(isValidTransition("dungeon", "exit_dungeon")).toBe(true);

    useGameFlow.getState().setContext({
      context: "zone_overworld",
      zoneId: "plains",
      playerPos: { x: 80, z: -80 },
      channelId: null,
    });

    const sock = mockSocket("s1");
    const res = zm.join(sock, "plains", { ...PLAYER, position: [80, 1, -80] });

    expect(useGameFlow.getState().context).toBe("zone_overworld");
    expect(res.channelId).toMatch(/^plains-/);
  });

  it("8 → die in boss arena, respawn at coast", () => {
    useGameFlow.getState().setContext({
      context: "boss_arena",
      zoneId: "lava",
      bossName: "Moloch",
      bossType: "demon",
      arenaCenter: { x: 0, z: -1300 },
      arenaRadius: 40,
    });

    expect(isValidTransition("boss_arena", "die_respawn")).toBe(true);

    useGameFlow.getState().setContext({
      context: "zone_overworld",
      zoneId: "coast",
      playerPos: { x: 0, z: 0 },
      channelId: null,
    });

    const sock = mockSocket("s1");
    const res = zm.join(sock, "coast", { ...PLAYER, health: 200 });

    expect(useGameFlow.getState().getCurrentZoneId()).toBe("coast");
    expect(res.channelId).toMatch(/^coast-/);
  });
});

// ── Zone channel scaling ─────────────────────────────────────────────────────

describe("Integration: channel auto-scaling", () => {
  it("creates second channel when first fills to 50", () => {
    const zm = new ZoneManager();

    for (let i = 0; i < 51; i++) {
      const s = mockSocket(`s${i}`);
      zm.join(s, "coast", {
        playerId: `p${i}`,
        characterName: `Hero${i}`,
        heroClass: "warrior",
        modelPath: "",
        level: 1,
        position: [i, 0, 0],
        rotation: 0,
        animation: "idle",
        health: 100,
        maxHealth: 100,
        faction: "pirate",
      });
    }

    const stats = zm.getStats();
    expect(stats.totalPlayers).toBe(51);
    expect(stats.channels).toBe(2);  // overflow created a second channel
    expect(stats.perZone.coast).toBe(51);
  });
});

// ── Terrain + world grid integration ─────────────────────────────────────────

describe("Integration: terrain generation + world grid", () => {
  it("plains terrain center is walkable (above water)", () => {
    const plains = getZone("plains")!;
    const terrain = generateZoneTerrain(plains)!;
    const h = getZoneTerrainHeight(terrain, 0, 0);

    expect(h).toBeGreaterThan(0);
    const band = getElevationBand(h);
    expect(["BEACH", "FLAT_LAND", "FOREST"]).toContain(band);
  });

  it("plains terrain edge is ocean", () => {
    const plains = getZone("plains")!;
    const terrain = generateZoneTerrain(plains)!;
    const h = getZoneTerrainHeight(terrain, 1950, 1950);

    expect(h).toBeLessThanOrEqual(0);
    expect(h).toBeGreaterThanOrEqual(OCEAN_FLOOR);
  });

  it("island base floor is -5m", () => {
    expect(ISLAND_GROUND_FLOOR).toBe(-5);
  });

  it("world center (0,0) resolves to plains", () => {
    expect(getZoneAtWorldPos(0, 0)?.id).toBe("plains");
  });

  it("ocean gap between zones returns null", () => {
    expect(getZoneAtWorldPos(0, 2250)).toBeNull();
  });

  it("plains has 4 adjacent zones", () => {
    const adj = getAdjacentZones("plains").map(z => z.id).sort();
    expect(adj).toEqual(["coast", "desert", "forest", "mountains"]);
  });

  it("all 9 zones produce non-null terrain (except GLB coast)", { timeout: 15000 }, () => {
    expect(WORLD_ZONES).toHaveLength(9);

    for (const zone of WORLD_ZONES) {
      const terrain = generateZoneTerrain(zone);
      if (zone.terrain.type === "glb") {
        expect(terrain).toBeNull();
      } else {
        expect(terrain).not.toBeNull();
        expect(terrain!.heightData.length).toBe((terrain!.resolution + 1) ** 2);
      }
    }
  });
});
