/**
 * Composable slices for the editor's Zustand store.
 *
 * Why slices instead of one big object?
 *   - Concerns separate cleanly (a tool change doesn't invalidate env subs).
 *   - New surfaces (PlaySlice for the third-person runtime) bolt on without
 *     touching unrelated reducers.
 *   - Tests can build a slice in isolation.
 *
 * Each slice is a `StateCreator<Combined, ...>` so any slice can read or
 * dispatch into any other slice via `get()`. The exported `useEditor` in
 * `store.ts` is the single combined hook so existing consumers don't churn.
 */
import type { StateCreator } from 'zustand';
import type { MapProject, PlacedEntity, EditorTool, Vec3, EntityKind } from '../types';
import { createBlankProject, projectToJSON } from './project';

/** Weather / biome preset — drives island generator + visual env. */
export type WeatherBiome = 'forest' | 'beach' | 'volcano' | 'winter';

// ── Project slice ────────────────────────────────────────────────────

export interface ProjectSlice {
  project: MapProject;
  /** Counter bumped whenever terrain heights/biome are mutated in place */
  terrainRev: number;
  /** Counter bumped whenever entity transforms are mutated in place */
  entityRev: number;
  loadProject: (p: MapProject) => void;
  newProject: (name?: string) => void;
  exportJSON: () => string;
  /** Replace project terrain + entities (used by island generator) */
  applyGeneratedIsland: (entities: PlacedEntity[], seed: number) => void;
  /** Bump terrainRev so subscribers re-render after in-place height edits */
  bumpTerrain: () => void;
  /** Mutate map rules (gameplay tuning saved with the project) */
  setRules: (patch: Partial<MapProject['rules']>) => void;
}

export const createProjectSlice: StateCreator<
  Combined, [], [], ProjectSlice
> = (set, get) => ({
  project: createBlankProject(),
  terrainRev: 0,
  entityRev: 0,

  loadProject: (p) =>
    set({
      project: p,
      selectedId: null,
      terrainRev: 0,
      entityRev: 0,
      playMode: false,
    } as Partial<Combined>),

  newProject: (name) =>
    set({
      project: createBlankProject(name),
      selectedId: null,
      terrainRev: 0,
      entityRev: 0,
      playMode: false,
    } as Partial<Combined>),

  exportJSON: () => projectToJSON(get().project),

  applyGeneratedIsland: (entities, seed) =>
    set((s) => {
      s.project.entities = entities;
      s.project.seed = seed;
      s.project.updatedAt = new Date().toISOString();
      return {
        terrainRev: s.terrainRev + 1,
        entityRev: s.entityRev + 1,
        selectedId: null,
      } as Partial<Combined>;
    }),

  bumpTerrain: () => set((s) => ({ terrainRev: s.terrainRev + 1 })),

  setRules: (patch) =>
    set((s) => {
      s.project.rules = { ...s.project.rules, ...patch };
      s.project.updatedAt = new Date().toISOString();
      return {} as Partial<Combined>;
    }),
});

// ── Selection slice ──────────────────────────────────────────────────

export interface SelectionSlice {
  selectedId: string | null;
  selectEntity: (id: string | null) => void;
}

export const createSelectionSlice: StateCreator<
  Combined, [], [], SelectionSlice
> = (set) => ({
  selectedId: null,
  selectEntity: (id) => set({ selectedId: id }),
});

// ── Tool slice ───────────────────────────────────────────────────────

export interface ToolSlice {
  tool: EditorTool;
  brushRadius: number;
  brushStrength: number;
  /**
   * Asset id (from ASSET_LIBRARY) currently armed for placement.
   * When non-null, the PlacementHandler uses this asset's spec to
   * stamp new entities; clicking the same tile again clears it.
   * Auto-switches the tool to `place_entity` for one-click flow.
   */
  armedAssetId: string | null;
  /** Hex color tint applied to the next placed entity (e.g. '#d4650a' for autumn). */
  placementTint: string | null;
  /** Scale multiplier stacked on top of the asset's defaultScale at placement. */
  placementScale: number;
  setTool: (t: EditorTool) => void;
  setBrushRadius: (n: number) => void;
  setBrushStrength: (n: number) => void;
  armAsset: (id: string | null) => void;
  setPlacementTint: (tint: string | null) => void;
  setPlacementScale: (s: number) => void;
}

export const createToolSlice: StateCreator<
  Combined, [], [], ToolSlice
> = (set) => ({
  tool: 'select',
  brushRadius: 8,
  brushStrength: 0.4,
  armedAssetId: null,
  placementTint: null,
  placementScale: 1.0,
  setTool: (t) => set({ tool: t }),
  setBrushRadius: (n) => set({ brushRadius: n }),
  setBrushStrength: (n) => set({ brushStrength: n }),
  armAsset: (id) =>
    set((s) => ({
      armedAssetId: id,
      // Arming an asset implicitly switches to placement mode so the very
      // next terrain click drops it. Disarming leaves the current tool alone.
      tool: id ? ('place_entity' as EditorTool) : s.tool,
    })),
  setPlacementTint: (tint) => set({ placementTint: tint }),
  setPlacementScale: (s) => set({ placementScale: s }),
});

// ── Entity slice ─────────────────────────────────────────────────────

export interface EntitySlice {
  addEntity: (e: PlacedEntity) => void;
  removeEntity: (id: string) => void;
  updateEntityTransform: (
    id: string,
    patch: { position?: Vec3; rotation?: Vec3; scale?: Vec3 },
  ) => void;
  renameEntity: (id: string, name: string) => void;
  setEntityData: (id: string, data: Record<string, unknown>) => void;
  /** Mutate a single entity's `kind` (was hand-rolled in Outliner before). */
  setEntityKind: (id: string, kind: EntityKind) => void;
  /** Mutate a single entity's `asset` URL (also previously inline in Outliner). */
  setEntityAsset: (id: string, asset: string | undefined) => void;
}

export const createEntitySlice: StateCreator<
  Combined, [], [], EntitySlice
> = (set) => ({
  addEntity: (e) =>
    set((s) => {
      s.project.entities.push(e);
      s.project.updatedAt = new Date().toISOString();
      return { entityRev: s.entityRev + 1, selectedId: e.id } as Partial<Combined>;
    }),
  removeEntity: (id) =>
    set((s) => {
      const idx = s.project.entities.findIndex((e) => e.id === id);
      if (idx >= 0) s.project.entities.splice(idx, 1);
      return {
        entityRev: s.entityRev + 1,
        selectedId: s.selectedId === id ? null : s.selectedId,
      } as Partial<Combined>;
    }),
  updateEntityTransform: (id, patch) =>
    set((s) => {
      const e = s.project.entities.find((e) => e.id === id);
      if (!e) return {} as Partial<Combined>;
      if (patch.position) e.position = patch.position;
      if (patch.rotation) e.rotation = patch.rotation;
      if (patch.scale) e.scale = patch.scale;
      s.project.updatedAt = new Date().toISOString();
      return { entityRev: s.entityRev + 1 } as Partial<Combined>;
    }),
  renameEntity: (id, name) =>
    set((s) => {
      const e = s.project.entities.find((e) => e.id === id);
      if (e) e.name = name;
      return { entityRev: s.entityRev + 1 } as Partial<Combined>;
    }),
  setEntityData: (id, data) =>
    set((s) => {
      const e = s.project.entities.find((e) => e.id === id);
      if (e) e.data = data;
      return { entityRev: s.entityRev + 1 } as Partial<Combined>;
    }),
  setEntityKind: (id, kind) =>
    set((s) => {
      const e = s.project.entities.find((e) => e.id === id);
      if (e) e.kind = kind;
      return { entityRev: s.entityRev + 1 } as Partial<Combined>;
    }),
  setEntityAsset: (id, asset) =>
    set((s) => {
      const e = s.project.entities.find((e) => e.id === id);
      if (e) e.asset = asset;
      return { entityRev: s.entityRev + 1 } as Partial<Combined>;
    }),
});

// ── Env / atmospherics slice ────────────────────────────────────────

export interface GrassSettings {
  enabled: boolean;
  density: number;
  height: number;
  noiseScale: number;
  windStrength: number;
}
export interface EnvSettings {
  shoreFoam: boolean;
  sparkles: boolean;
  rain: boolean;
  hdr: boolean;
  grass: GrassSettings;
  /**
   * Active weather / biome preset. Controls terrain texture set, sky tint,
   * and which animal species the island generator places.
   */
  weather: WeatherBiome;
}

export const DEFAULT_ENV: EnvSettings = {
  shoreFoam: false,
  sparkles: false,
  rain: false,
  hdr: false,
  weather: 'forest',
  grass: {
    enabled: false,
    density: 20,
    height: 1.1,
    noiseScale: 0.035,
    windStrength: 1.2,
  },
};

export interface EnvSlice {
  env: EnvSettings;
  setEnv: (patch: Partial<EnvSettings>) => void;
  setGrass: (patch: Partial<GrassSettings>) => void;
  setWeather: (w: WeatherBiome) => void;
}

export const createEnvSlice: StateCreator<
  Combined, [], [], EnvSlice
> = (set) => ({
  env: DEFAULT_ENV,
  setEnv: (patch) => set((s) => ({ env: { ...s.env, ...patch } })),
  setGrass: (patch) =>
    set((s) => ({ env: { ...s.env, grass: { ...s.env.grass, ...patch } } })),
  setWeather: (w) => set((s) => ({ env: { ...s.env, weather: w } })),
});

// ── Play slice (third-person runtime state) ─────────────────────────

export type LocomotionState =
  | 'idle'
  | 'walk'
  | 'run'
  | 'attack'
  | 'swim'          // forward stroke
  | 'tread'         // treading water (surface idle)
  | 'swim_to_edge'  // climb-out transition near shore
  | 'climb'         // vertical climb up
  | 'climb_idle'    // hang / hold on wall
  | 'climb_down'    // climb down
  | 'climb_shimmy'  // lateral along wall
  | 'climb_topout';  // pull over ledge

/** Persisted across reloads so the user keeps their character pick. */
const PLAYER_CHAR_LS = 'studio.playerCharacterId';

export interface PlayerRuntime {
  /** World position of the player root (feet-on-ground). */
  position: [number, number, number];
  /** Yaw in radians (Y axis); pitch is in the camera, not the avatar. */
  yaw: number;
  locomotion: LocomotionState;
  /** Sprinting? (driven by Shift). */
  sprinting: boolean;
}

export interface PlaySlice {
  /** When true, AI ticks run, the player controller is mounted, and the
   *  third-person camera replaces orbit. */
  playMode: boolean;
  togglePlay: () => void;
  /** Selected character spec id (see PlayerCharacterRegistry). */
  playerCharacterId: string;
  setPlayerCharacter: (id: string) => void;
  /** Live runtime data the camera + creature AI can read. */
  player: PlayerRuntime;
  /** Imperative setters used by PlayerController @ 60Hz. */
  setPlayerTransform: (pos: [number, number, number], yaw: number) => void;
  setPlayerLocomotion: (loco: LocomotionState, sprinting: boolean) => void;
}

function readPersistedCharacter(): string {
  try {
    const v = localStorage.getItem(PLAYER_CHAR_LS);
    if (!v || v === 'soldier' || v === 'hero') return 'wk';
    return v;
  } catch {
    return 'wk';
  }
}

export const createPlaySlice: StateCreator<
  Combined, [], [], PlaySlice
> = (set) => ({
  playMode: false,
  togglePlay: () =>
    set((s) => {
      const entering = !s.playMode;
      return {
        playMode: entering,
        env: {
          ...s.env,
          grass: {
            ...s.env.grass,
            enabled: entering,
          },
        },
      };
    }),
  playerCharacterId: readPersistedCharacter(),
  setPlayerCharacter: (id) => {
    try { localStorage.setItem(PLAYER_CHAR_LS, id); } catch { /* ignore */ }
    set({ playerCharacterId: id });
  },
  player: {
    position: [0, 0, 0],
    yaw: 0,
    locomotion: 'idle',
    sprinting: false,
  },
  setPlayerTransform: (position, yaw) =>
    set((s) => ({ player: { ...s.player, position, yaw } })),
  setPlayerLocomotion: (locomotion, sprinting) =>
    set((s) => ({ player: { ...s.player, locomotion, sprinting } })),
});

// ── Combined state ───────────────────────────────────────────────────

export type Combined =
  & ProjectSlice
  & SelectionSlice
  & ToolSlice
  & EntitySlice
  & EnvSlice
  & PlaySlice;
