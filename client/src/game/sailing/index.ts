/**
 * Sailing module — ported from Tactical-Infinity.
 *
 * Provides open-water gameplay between zone islands:
 *   - Ocean shader (6-octave Gerstner waves, Beer-Lambert water, Schlick fresnel)
 *   - Ship physics (roll/pitch/heave, capsize, keel ballast, 6 ship types)
 *   - Ship deck physics (walk on moving deck, balance/stagger, grip system)
 *   - Ship prefabs (8 GLB models, procedural textures, cannon systems)
 *   - Boat boarding (board/leave ships, swimming, deck walking)
 *   - Fish manager (20 species, schooling AI, depth preferences, flee mechanics)
 *   - Ship audio (ambient sailing sounds)
 *
 * Integration with MMO zones:
 *   - Player boards ship at dock → enters open water sailing mode
 *   - Ocean shader replaces the zone terrain between islands
 *   - FishManager populates the ocean with catchable fish
 *   - Arriving at a destination dock triggers zone transition
 *
 * Usage:
 *   import { oceanVertexShader, oceanFragmentShader } from "@/game/sailing";
 *   import { ShipPhysics } from "@/game/sailing";
 *   import { FishManager } from "@/game/sailing";
 */

export { oceanVertexShader, oceanFragmentShader } from "./OceanShader";
export { ShipPhysics } from "./ShipPhysics";
export type { ShipPhysicsState, ShipPhysicsConfig } from "./ShipPhysics";
export { ShipDeckRig } from "./ShipDeckPhysics";
export type { DeckRiderInit, DeckStaggerEvent, ShipDeckRigOpts } from "./ShipDeckPhysics";
export { BoatBoardingSystem, DECK_Y_DEFAULT } from "./BoatBoardingSystem";
export type { BoardingMode, BoardingCallbacks } from "./BoatBoardingSystem";
export { FishManager } from "./FishManager";
export { SHIP_MODEL_PATHS, SHIP_TEXTURE_PATHS } from "./ShipPrefabs";

// Types
export type {
  WeatherConfig,
  ShipClass,
  ShipTypeDefinition,
  Skittishness,
  FishBehaviorConfig,
} from "./types";
export {
  DEFAULT_WEATHER,
  SHIP_TYPES,
  FISH_BEHAVIORS,
  SKITTISHNESS_CONFIG,
  getFleeParameters,
} from "./types";
