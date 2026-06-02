/**
 * Editor store — composes the slices defined in `store-slices.ts` into a
 * single Zustand hook. Existing call sites can keep using `useEditor`
 * exactly as before (one slab of state); new code should prefer the
 * narrow selector hooks below so re-renders stay scoped.
 *
 * Layout:
 *   useEditor              — combined hook for legacy and shared call sites
 *   useTool / useEnv /     — narrow hooks: subscribe only to one slice
 *   useSelection / usePlay
 *   useEditorActions       — pulls every action out without subscribing to data
 */
import { create } from 'zustand';
import {
  createProjectSlice,
  createSelectionSlice,
  createToolSlice,
  createEntitySlice,
  createEnvSlice,
  createPlaySlice,
  type Combined,
  type EnvSettings,
  type GrassSettings,
  type PlayerRuntime,
  type LocomotionState,
  type WeatherBiome,
} from './store-slices';

export type {
  EnvSettings,
  GrassSettings,
  PlayerRuntime,
  LocomotionState,
  WeatherBiome,
};

export const useEditor = create<Combined>()((...a) => ({
  ...createProjectSlice(...a),
  ...createSelectionSlice(...a),
  ...createToolSlice(...a),
  ...createEntitySlice(...a),
  ...createEnvSlice(...a),
  ...createPlaySlice(...a),
}));

// ── Narrow selector hooks ────────────────────────────────────────────
// Prefer these over `useEditor((s) => s.someField)` when you only need
// one slice; subscribers re-render only when their slice changes.

export const useTool = () =>
  useEditor((s) => ({
    tool: s.tool,
    brushRadius: s.brushRadius,
    brushStrength: s.brushStrength,
    armedAssetId: s.armedAssetId,
    placementTint: s.placementTint,
    placementScale: s.placementScale,
  }));

export const useEnv = () => useEditor((s) => s.env);

export const useSelection = () =>
  useEditor((s) => ({ selectedId: s.selectedId, selectEntity: s.selectEntity }));

export const usePlay = () =>
  useEditor((s) => ({
    playMode: s.playMode,
    playerCharacterId: s.playerCharacterId,
    player: s.player,
  }));

/**
 * All of the editor's *actions* in one bag, with no data subscriptions.
 * Components can call `const a = useEditorActions()` and never re-render
 * when state changes — useful for menus / toolbars that fire-and-forget.
 */
export function useEditorActions() {
  return useEditor((s) => ({
    // project
    loadProject:        s.loadProject,
    newProject:         s.newProject,
    exportJSON:         s.exportJSON,
    applyGeneratedIsland: s.applyGeneratedIsland,
    bumpTerrain:        s.bumpTerrain,
    setRules:           s.setRules,
    // selection
    selectEntity:       s.selectEntity,
    // tool
    setTool:            s.setTool,
    setBrushRadius:     s.setBrushRadius,
    setBrushStrength:   s.setBrushStrength,
    armAsset:           s.armAsset,
    setPlacementTint:   s.setPlacementTint,
    setPlacementScale:  s.setPlacementScale,
    // entity
    addEntity:          s.addEntity,
    removeEntity:       s.removeEntity,
    updateEntityTransform: s.updateEntityTransform,
    renameEntity:       s.renameEntity,
    setEntityData:      s.setEntityData,
    setEntityKind:      s.setEntityKind,
    setEntityAsset:     s.setEntityAsset,
    // env
    setEnv:             s.setEnv,
    setGrass:           s.setGrass,
    setWeather:         s.setWeather,
    // play
    togglePlay:         s.togglePlay,
    setPlayerCharacter: s.setPlayerCharacter,
    setPlayerTransform: s.setPlayerTransform,
    setPlayerLocomotion: s.setPlayerLocomotion,
  }));
}
