export { VFXSystem, vfx } from "./VFXSystem";
export type { ParticleSpec, BurstSpec } from "./VFXManager";
export * as VFXPresets from "./VFXPresets";
// Flame combat FX (threejs-games Flame particles)
// https://threejs-games.github.io/examples/20-particles/flame/
export {
  FlameTrail,
  FlameBeam,
  FlameAoeBurst,
  acquireFlameFx,
  releaseFlameFx,
  setFlameFxParent,
  spawnFlameTrail,
  spawnFlameBeam,
  spawnFlameAoe,
  tickFlameFxPool,
  disposeFlameFxPool,
} from "../effects/FlameCombatFx";
export {
  Flame,
  FlameFxController,
  createWeaponTrailFlame,
  createBeamFlame,
  createAoeFlame,
} from "../effects/FlameParticles";
