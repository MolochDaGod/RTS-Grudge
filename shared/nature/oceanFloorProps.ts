/**
 * Ocean-floor prop scatter — whispering crown coral, sequoia vents, lazulight coral.
 *
 * Used across world surfaces:
 *   - all 9 biome sectors (incl. volcanic / lava bottom-right)
 *   - lobby ocean ring
 *   - home-islands shallows / channel
 *   - instances & events (reef beds)
 *
 * Design:
 *   - Dense but varied: high density near reefs, vents more sparse
 *   - Seeded PRNG per surface so placement is stable per sector/island
 *   - Y sits on ocean floor (negative relative to sea level 0)
 */

import type { SectorBiome } from "../worldSectors";

export const WARLORDS_CDN = "https://assets.grudge-studio.com";

// ── Asset registry ───────────────────────────────────────────────────────────

export type OceanFloorPropKind = "whispering_crown" | "sequoia_vent" | "lazulight_coral";

export interface OceanFloorPropDef {
  kind: OceanFloorPropKind;
  /** Short id for seeds / harvest tags */
  id: string;
  label: string;
  /** Path under client/public */
  local: string;
  r2Key: string;
  cdn: string;
  /** Base world height (m) before random scale */
  baseHeightM: number;
  /** Uniform scale range [min, max] applied to baseHeightM */
  scaleRange: [number, number];
  /** Relative spawn weight in mixed beds (higher = more common) */
  weight: number;
  /** Prefer deeper ocean floor (more negative y) */
  deepBias: number;
  roles: string[];
}

export const OCEAN_FLOOR_PROPS: Record<OceanFloorPropKind, OceanFloorPropDef> = {
  whispering_crown: {
    kind: "whispering_crown",
    id: "whispering_crown_coral",
    label: "Whispering Crown Coral",
    local: "/models/nature/stylized/underwater/ocean_floor/whispering_crown_coral.glb",
    r2Key: "models/nature/stylized/underwater/ocean_floor/whispering_crown_coral.glb",
    cdn: `${WARLORDS_CDN}/models/nature/stylized/underwater/ocean_floor/whispering_crown_coral.glb`,
    baseHeightM: 2.4,
    scaleRange: [0.55, 1.45],
    weight: 3,
    deepBias: 0.35,
    roles: ["ocean_floor", "coral", "reef", "sector", "lobby", "home_island", "instance", "event"],
  },
  sequoia_vent: {
    kind: "sequoia_vent",
    id: "sequoia_vent",
    label: "Sequoia Hydrothermal Vent",
    local: "/models/nature/stylized/underwater/ocean_floor/sequoia_vent.glb",
    r2Key: "models/nature/stylized/underwater/ocean_floor/sequoia_vent.glb",
    cdn: `${WARLORDS_CDN}/models/nature/stylized/underwater/ocean_floor/sequoia_vent.glb`,
    baseHeightM: 4.2,
    scaleRange: [0.7, 1.8],
    weight: 1.4,
    deepBias: 0.75,
    roles: ["ocean_floor", "vent", "hydrothermal", "sector", "lobby", "home_island", "instance", "volcanic"],
  },
  lazulight_coral: {
    kind: "lazulight_coral",
    id: "lazulight_coral",
    label: "Lazulight Coral",
    local: "/models/nature/stylized/underwater/ocean_floor/lazulight_coral.glb",
    r2Key: "models/nature/stylized/underwater/ocean_floor/lazulight_coral.glb",
    cdn: `${WARLORDS_CDN}/models/nature/stylized/underwater/ocean_floor/lazulight_coral.glb`,
    baseHeightM: 1.6,
    scaleRange: [0.45, 1.25],
    weight: 2.6,
    deepBias: 0.25,
    roles: ["ocean_floor", "coral", "reef", "sector", "lobby", "home_island", "instance", "event"],
  },
};

/** Lava sector primary environment shell (bottom-right Ember Reaches). */
export const LAVA_ZONE_ENVIRONMENT = {
  key: "free_lava_zone_environment",
  local: "/models/environment/lava/free_lava_zone_environment.glb",
  r2Key: "models/environment/lava/free_lava_zone_environment.glb",
  cdn: `${WARLORDS_CDN}/models/environment/lava/free_lava_zone_environment.glb`,
  /** Keep legacy lava surface as LOD / distant fallback */
  fallbackLocal: "/models/environment/lava/lava_surface.glb",
  roles: ["volcanic", "lava", "sector", "ember_reaches", "primary_shell"],
  targetHeightM: 80,
} as const;

// ── Scatter surfaces ─────────────────────────────────────────────────────────

export type OceanFloorSurface =
  | "sector"
  | "lobby"
  | "home_island"
  | "instance"
  | "event"
  | "practice";

export interface OceanFloorScatterOpts {
  surface: OceanFloorSurface;
  /** Sector biome when surface === "sector"; otherwise optional tint bias */
  biome?: SectorBiome | string;
  /** Unique seed string (sector id, island uuid, instance id…) */
  seed: string | number;
  /** Approximate ocean area radius (m) around origin */
  radiusM?: number;
  /** Sea level Y (props place below this) */
  seaLevelY?: number;
  /** Ocean floor base depth below sea level (positive number, meters) */
  floorDepthM?: number;
  /** Override density multiplier (1 = default for surface) */
  density?: number;
}

export interface OceanFloorInstance {
  kind: OceanFloorPropKind;
  defId: string;
  path: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  scale: number;
  heightM: number;
}

// ── Density tables ───────────────────────────────────────────────────────────

/** How many props per 1000 m² of ocean floor (before biome multipliers). */
const SURFACE_DENSITY: Record<OceanFloorSurface, number> = {
  sector: 2.8,
  lobby: 2.2,
  home_island: 3.4,
  instance: 2.6,
  event: 3.0,
  practice: 2.4,
};

/** Biome multiplies density + weights vents higher in volcanic/abyssal. */
const BIOME_DENSITY: Partial<Record<string, number>> = {
  volcanic: 1.35,
  lava: 1.35,
  abyssal: 1.25,
  tropical: 1.2,
  ethereal: 0.9,
  frozen: 0.75,
  storm: 1.05,
  desert: 0.85,
  forest: 0.95,
  nexus: 1.0,
};

const BIOME_VENT_BOOST: Partial<Record<string, number>> = {
  volcanic: 2.2,
  lava: 2.2,
  abyssal: 1.6,
  ethereal: 1.15,
};

// ── PRNG ─────────────────────────────────────────────────────────────────────

function hashSeed(seed: string | number): number {
  const s = String(seed);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a: number) {
  return function rand() {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted(
  rand: () => number,
  weights: { kind: OceanFloorPropKind; w: number }[],
): OceanFloorPropKind {
  let total = 0;
  for (const e of weights) total += e.w;
  let r = rand() * total;
  for (const e of weights) {
    r -= e.w;
    if (r <= 0) return e.kind;
  }
  return weights[weights.length - 1]!.kind;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate stable ocean-floor prop instances for a surface.
 * Call from sector loaders, lobby ocean, home-island channel, instances.
 */
export function scatterOceanFloor(opts: OceanFloorScatterOpts): OceanFloorInstance[] {
  const surface = opts.surface;
  const biome = (opts.biome ?? "nexus").toString().toLowerCase();
  const radius = opts.radiusM ?? (surface === "home_island" ? 90 : surface === "lobby" ? 140 : 220);
  const seaY = opts.seaLevelY ?? 0;
  // Default floor depth (positive m below sea level). Open-ocean SSOT deepest
  // is -30 m (ZoneHeightmapSystem.OCEAN_FLOOR); sector scatter sits on that bed.
  // Home-island / lobby callers pass shallower floorDepthM explicitly.
  const floorDepth = opts.floorDepthM ?? (biome === "volcanic" || biome === "lava" || biome === "abyssal" ? 30 : 26);
  const densityBase = SURFACE_DENSITY[surface] * (BIOME_DENSITY[biome] ?? 1) * (opts.density ?? 1);

  // Area of disc (m²) / 1000 * density
  const area = Math.PI * radius * radius;
  const count = Math.max(6, Math.round((area / 1000) * densityBase));

  const ventBoost = BIOME_VENT_BOOST[biome] ?? 1;
  const weights: { kind: OceanFloorPropKind; w: number }[] = [
    { kind: "whispering_crown", w: OCEAN_FLOOR_PROPS.whispering_crown.weight },
    { kind: "sequoia_vent", w: OCEAN_FLOOR_PROPS.sequoia_vent.weight * ventBoost },
    { kind: "lazulight_coral", w: OCEAN_FLOOR_PROPS.lazulight_coral.weight },
  ];

  const rand = mulberry32(hashSeed(`${surface}:${biome}:${opts.seed}`));
  const out: OceanFloorInstance[] = [];

  for (let i = 0; i < count; i++) {
    const kind = pickWeighted(rand, weights);
    const def = OCEAN_FLOOR_PROPS[kind];

    // Disc sample (sqrt for uniform area)
    const ang = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * radius;
    // Keep a small clear hole near origin (island / hub)
    const clearR = surface === "home_island" ? 28 : surface === "lobby" ? 40 : 18;
    const rr = Math.max(r, clearR + rand() * 8);
    const x = Math.cos(ang) * rr;
    const z = Math.sin(ang) * rr;

    // Depth: deeper with deepBias + random wobble
    const depth =
      floorDepth * (0.55 + 0.45 * def.deepBias) +
      (rand() - 0.5) * 4 +
      (kind === "sequoia_vent" ? 2.5 : 0);
    const y = seaY - Math.max(3, depth);

    const sMin = def.scaleRange[0];
    const sMax = def.scaleRange[1];
    const scale = sMin + rand() * (sMax - sMin);
    const heightM = def.baseHeightM * scale;

    out.push({
      kind,
      defId: def.id,
      path: def.local,
      x,
      y,
      z,
      yaw: rand() * Math.PI * 2,
      scale,
      heightM,
    });
  }

  return out;
}

/** Convenience: scatter for one of the 9 biome sectors. */
export function scatterSectorOceanFloor(
  biome: SectorBiome | string,
  seed: string | number = biome,
  radiusM = 240,
): OceanFloorInstance[] {
  return scatterOceanFloor({
    surface: "sector",
    biome,
    seed,
    radiusM,
  });
}

/** Lobby ocean ring around warcamp. */
export function scatterLobbyOceanFloor(seed: string | number = "lobby"): OceanFloorInstance[] {
  return scatterOceanFloor({
    surface: "lobby",
    biome: "nexus",
    seed,
    radiusM: 160,
    floorDepthM: 12,
  });
}

/** Home-island channel / practice shallows. */
export function scatterHomeIslandOceanFloor(
  islandSeed: string | number = "home",
): OceanFloorInstance[] {
  return scatterOceanFloor({
    surface: "home_island",
    biome: "tropical",
    seed: islandSeed,
    radiusM: 100,
    floorDepthM: 10,
  });
}

/** Instance / dungeon approach reef bed (deep approaches → -30 m bed). */
export function scatterInstanceOceanFloor(
  instanceId: string | number,
  biome: string = "abyssal",
): OceanFloorInstance[] {
  return scatterOceanFloor({
    surface: "instance",
    biome,
    seed: instanceId,
    radiusM: 80,
    floorDepthM: 30,
  });
}

export function allOceanFloorR2Entries() {
  return [
    {
      r2Key: LAVA_ZONE_ENVIRONMENT.r2Key,
      name: LAVA_ZONE_ENVIRONMENT.key,
      layer: "lava",
      roles: [...LAVA_ZONE_ENVIRONMENT.roles],
    },
    ...Object.values(OCEAN_FLOOR_PROPS).map((p) => ({
      r2Key: p.r2Key,
      name: p.id,
      layer: "underwater",
      roles: p.roles,
    })),
  ];
}
