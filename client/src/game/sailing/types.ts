/**
 * Sailing system types — ported from Tactical-Infinity.
 *
 * These types were originally in @shared/gameDefinitions/sailing and
 * @shared/gameDefinitions/fishing. Inlined here to avoid pulling the
 * entire Tactical-Infinity shared module as a dependency.
 */

// ── Weather ──────────────────────────────────────────────────────────────────

export interface WeatherConfig {
  windStrength: number;     // 0-1, drives sail speed + wave amplitude
  windDirection: number;    // radians, world-space
  waveHeight: number;       // metres, drives ship roll/pitch + ocean vert shader
  waveFrequency: number;    // Hz, wave oscillation speed
  stormIntensity: number;   // 0-1, drives lightning/rain + extreme wave overlay
  visibility: number;       // metres, fog distance
  rainIntensity: number;    // 0-1
  fogDensity: number;       // 0-1
}

export const DEFAULT_WEATHER: WeatherConfig = {
  windStrength: 0.3,
  windDirection: Math.PI * 0.25,
  waveHeight: 1.5,
  waveFrequency: 0.8,
  stormIntensity: 0,
  visibility: 500,
  rainIntensity: 0,
  fogDensity: 0.01,
};

// ── Ship types ───────────────────────────────────────────────────────────────

export type ShipClass = "sloop" | "brigantine" | "galleon" | "warship" | "frigate" | "manOWar";

export interface ShipTypeDefinition {
  id: ShipClass;
  name: string;
  maxSpeed: number;       // m/s
  turnRate: number;       // rad/s
  health: number;
  cannonSlots: number;
  crewCapacity: number;
  cargoCapacity: number;
}

export const SHIP_TYPES: Record<ShipClass, ShipTypeDefinition> = {
  sloop:      { id: "sloop",      name: "Sloop",       maxSpeed: 12, turnRate: 0.8, health: 500,  cannonSlots: 4,  crewCapacity: 4,  cargoCapacity: 20 },
  brigantine: { id: "brigantine", name: "Brigantine",   maxSpeed: 10, turnRate: 0.6, health: 800,  cannonSlots: 8,  crewCapacity: 8,  cargoCapacity: 40 },
  galleon:    { id: "galleon",    name: "Galleon",       maxSpeed: 8,  turnRate: 0.4, health: 1500, cannonSlots: 16, crewCapacity: 16, cargoCapacity: 80 },
  warship:    { id: "warship",    name: "Warship",       maxSpeed: 7,  turnRate: 0.3, health: 2500, cannonSlots: 24, crewCapacity: 24, cargoCapacity: 60 },
  frigate:    { id: "frigate",    name: "Frigate",       maxSpeed: 11, turnRate: 0.5, health: 1200, cannonSlots: 12, crewCapacity: 12, cargoCapacity: 50 },
  manOWar:    { id: "manOWar",    name: "Man O' War",    maxSpeed: 6,  turnRate: 0.25, health: 4000, cannonSlots: 32, crewCapacity: 32, cargoCapacity: 100 },
};

// ── Fishing types ────────────────────────────────────────────────────────────

export type Skittishness = "bold" | "cautious" | "skittish" | "timid";

export interface FishBehaviorConfig {
  schoolingTightness: number; // 0-1
  animationSpeedMultiplier: number;
  skittishness: Skittishness;
}

export const FISH_BEHAVIORS: Record<string, FishBehaviorConfig> = {
  Clownfish:     { schoolingTightness: 0.8, animationSpeedMultiplier: 1.0, skittishness: "cautious" },
  BlueTang:      { schoolingTightness: 0.7, animationSpeedMultiplier: 1.1, skittishness: "cautious" },
  YellowTang:    { schoolingTightness: 0.7, animationSpeedMultiplier: 1.0, skittishness: "cautious" },
  Koi:           { schoolingTightness: 0.6, animationSpeedMultiplier: 0.8, skittishness: "bold" },
  Tuna:          { schoolingTightness: 0.5, animationSpeedMultiplier: 1.4, skittishness: "skittish" },
  Shark:         { schoolingTightness: 0.2, animationSpeedMultiplier: 0.9, skittishness: "bold" },
  Goldfish:      { schoolingTightness: 0.9, animationSpeedMultiplier: 0.7, skittishness: "timid" },
  Tetra:         { schoolingTightness: 0.9, animationSpeedMultiplier: 1.0, skittishness: "skittish" },
  ButterflyFish: { schoolingTightness: 0.6, animationSpeedMultiplier: 0.9, skittishness: "cautious" },
  Piranha:       { schoolingTightness: 0.8, animationSpeedMultiplier: 1.3, skittishness: "bold" },
  Anglerfish:    { schoolingTightness: 0.1, animationSpeedMultiplier: 0.5, skittishness: "bold" },
  Lionfish:      { schoolingTightness: 0.3, animationSpeedMultiplier: 0.8, skittishness: "cautious" },
  Puffer:        { schoolingTightness: 0.4, animationSpeedMultiplier: 0.6, skittishness: "timid" },
  Swordfish:     { schoolingTightness: 0.2, animationSpeedMultiplier: 1.5, skittishness: "skittish" },
  MoorishIdol:   { schoolingTightness: 0.7, animationSpeedMultiplier: 0.9, skittishness: "cautious" },
  ParrotFish:    { schoolingTightness: 0.6, animationSpeedMultiplier: 0.8, skittishness: "cautious" },
  CoralGrouper:  { schoolingTightness: 0.3, animationSpeedMultiplier: 0.7, skittishness: "bold" },
  MandarinFish:  { schoolingTightness: 0.5, animationSpeedMultiplier: 0.6, skittishness: "timid" },
  ZebraClownFish:{ schoolingTightness: 0.8, animationSpeedMultiplier: 1.0, skittishness: "cautious" },
  Sunfish:       { schoolingTightness: 0.1, animationSpeedMultiplier: 0.5, skittishness: "bold" },
};

export const SKITTISHNESS_CONFIG: Record<Skittishness, { fleeDistance: number; fleeSpeed: number }> = {
  bold:      { fleeDistance: 3,  fleeSpeed: 1.2 },
  cautious:  { fleeDistance: 8,  fleeSpeed: 1.5 },
  skittish:  { fleeDistance: 15, fleeSpeed: 2.0 },
  timid:     { fleeDistance: 20, fleeSpeed: 2.5 },
};

export function getFleeParameters(speciesName: string): { fleeDistance: number; fleeSpeed: number } {
  const behavior = FISH_BEHAVIORS[speciesName];
  if (!behavior) return SKITTISHNESS_CONFIG.cautious;
  return SKITTISHNESS_CONFIG[behavior.skittishness];
}
