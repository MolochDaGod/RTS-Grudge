/**
 * ModularCharacter — Runtime scene container for modular toon RTS characters.
 *
 * Implements CharacterLike so Player / Enemy can use it directly as a drop-in
 * replacement for ToonCharacter without any conditional checks in the game loop.
 *
 * Additional APIs (beyond CharacterLike):
 *   setSkin(index: 0–8)     — atlas UV strip switch (offset/repeat) with palette fallback
 *   swapPart(slot, idx)     — hot-swap a single slot without disrupting animation
 *   isModular               — always true
 */

import * as THREE from 'three';
import { AnimationSystem } from './AnimationSystem';
import { CharacterFSM, FSMStateName } from './CharacterFSM';
import type { CharacterLike } from './CharacterLike';
import {
  ModularCharacterData,
  ModularLoadout,
  SlotName,
  swapPart as loaderSwapPart,
  buildCharacter,
  loadManifest,
  getManifest,
  updateSkin as loaderUpdateSkin,
  SKIN_PALETTES,
} from './ModularCharacterLoader';

const SKIN_STRIP_COUNT = 9;

const SINGLE_CLIP_SPEEDS: Partial<Record<FSMStateName, number>> = {
  idle:          0.5,
  walk:          1.5,
  run:           2.2,
  attack:        3.0,
  attack_heavy:  2.2,
  shoot:         2.8,
  ranged_attack: 1.8,
  dodge:         2.6,
  hit:           4.0,
  death:         0.4,
  phase_out:     2.0,
  phase_in:      2.0,
  rifle_idle:    0.45,
};

// ── Procedural fallback mesh (never shown when real GLBs are available) ────────
function buildFallbackMesh(color: number): THREE.Group {
  const g    = new THREE.Group();
  const mat  = new THREE.MeshToonMaterial({ color });
  const dark = new THREE.MeshToonMaterial({ color: new THREE.Color(color).multiplyScalar(0.55).getHex() });
  const skin = new THREE.MeshToonMaterial({ color: 0xd4a070 });
  const box  = (w: number, h: number, d: number, px: number, py: number, pz: number, m = mat) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(px, py, pz);
    mesh.castShadow = true;
    g.add(mesh);
  };
  box(0.32, 0.32, 0.32, 0,     1.60, 0,     skin);
  box(0.40, 0.44, 0.28, 0,     1.20, 0);
  box(0.36, 0.20, 0.26, 0,     0.90, 0);
  box(0.14, 0.30, 0.14, -0.28, 1.20, 0);
  box(0.12, 0.28, 0.12, -0.28, 0.90, 0);
  box(0.16, 0.34, 0.16, -0.10, 0.63, 0, dark);
  box(0.14, 0.30, 0.14, -0.10, 0.30, 0, dark);
  box(0.14, 0.30, 0.14,  0.28, 1.20, 0);
  box(0.12, 0.28, 0.12,  0.28, 0.90, 0);
  box(0.16, 0.34, 0.16,  0.10, 0.63, 0, dark);
  box(0.14, 0.30, 0.14,  0.10, 0.30, 0, dark);
  return g;
}

function normaliseMesh(scene: THREE.Object3D) {
  scene.traverse(obj => {
    if ((obj as THREE.SkinnedMesh).isSkinnedMesh) {
      (obj as THREE.SkinnedMesh).normalizeSkinWeights();
      (obj as THREE.SkinnedMesh).castShadow = true;
    }
  });
  // Scale by HEIGHT (Y) only — see ToonCharacter._normaliseMesh for rationale.
  const box = new THREE.Box3().setFromObject(scene);
  const sz  = box.getSize(new THREE.Vector3());
  const TARGET_H = 1.8;
  if (sz.y > 0.001) scene.scale.setScalar(TARGET_H / sz.y);
  const box2 = new THREE.Box3().setFromObject(scene);
  const c    = box2.getCenter(new THREE.Vector3());
  scene.position.x -= c.x;
  scene.position.z -= c.z;
  scene.position.y -= box2.min.y;
}

function setupAnimations(
  animSys:    AnimationSystem,
  clips:      Record<string, THREE.AnimationClip>,
  singleClip: boolean,
) {
  const ONE_SHOT = new Set(['attack','attack_heavy','shoot','ranged_attack','dodge','hit','death','phase_out','phase_in']);
  for (const [name, clip] of Object.entries(clips)) {
    const isOneShot = ONE_SHOT.has(name);
    const speed     = singleClip ? (SINGLE_CLIP_SPEEDS[name as FSMStateName] ?? 1.0) : 1.0;
    animSys.register(name, clip, { loop: !isOneShot, timeScale: speed });
  }
  const baseAttack = clips['attack'];
  const baseIdle   = clips['idle'];
  const defs: Array<[FSMStateName, THREE.AnimationClip | undefined, number]> = [
    ['ranged_attack', baseAttack, SINGLE_CLIP_SPEEDS.ranged_attack ?? 1.8],
    ['shoot',         baseAttack, SINGLE_CLIP_SPEEDS.shoot         ?? 2.8],
    ['phase_out',     baseAttack, SINGLE_CLIP_SPEEDS.phase_out     ?? 2.0],
    ['phase_in',      baseAttack, SINGLE_CLIP_SPEEDS.phase_in      ?? 2.0],
    ['attack_heavy',  baseAttack, SINGLE_CLIP_SPEEDS.attack_heavy  ?? 2.2],
    ['hit',           baseIdle,   SINGLE_CLIP_SPEEDS.hit           ?? 4.0],
    ['rifle_idle',    baseIdle,   SINGLE_CLIP_SPEEDS.rifle_idle    ?? 0.45],
  ];
  for (const [name, base, speed] of defs) {
    if (!animSys.has(name) && base) {
      const c = base.clone(); c.name = name;
      animSys.register(name, c, { loop: name === 'rifle_idle', timeScale: singleClip ? speed : 1.0 });
    }
  }
  if (animSys.has('idle')) animSys.play('idle');
}

// ── ModularCharacter ──────────────────────────────────────────────────────────

export class ModularCharacter implements CharacterLike {
  readonly isModular = true;

  group: THREE.Group;

  private animSys:    AnimationSystem;
  private fsm:        CharacterFSM;
  private _loaded     = false;
  private _singleClip = false;
  private _data:      ModularCharacterData | null = null;

  private _skinIndex  = 0;
  private _weaponMode: 'melee' | 'ranged' = 'melee';

  private _phaseAlpha  = 1.0;
  private _phaseTarget = 1.0;
  private _phaseEmissive = 0.0;

  private _basePath   = '';

  constructor(data: ModularCharacterData | null, fallbackColor = 0x3a6ea5, basePath = '') {
    this._basePath = basePath;
    this.group = new THREE.Group();

    if (data) {
      this._data   = data;
      this._loaded = true;
      this._skinIndex = data.skinIndex;

      normaliseMesh(data.group);
      this.group.add(data.group);

      const durations = Object.values(data.clips).map(c => c.duration);
      this._singleClip = durations.length > 0 && durations.every(d => Math.abs(d - durations[0]) < 0.05);

      this.animSys = new AnimationSystem(data.mixer);
      setupAnimations(this.animSys, data.clips, this._singleClip);

      // Apply initial skin
      if (data.skinIndex !== 0) this.setSkin(data.skinIndex);
    } else {
      const fallback = buildFallbackMesh(fallbackColor);
      this.group.add(fallback);
      const mixer  = new THREE.AnimationMixer(this.group);
      this.animSys = new AnimationSystem(mixer);
    }

    this.fsm = new CharacterFSM(this.animSys);
  }

  // ── Skin ────────────────────────────────────────────────────────────────────

  /**
   * setSkin(index: 0–8)
   *
   * When the loaded GLB parts contain a texture atlas, this selects the
   * appropriate UV strip (offset + repeat on MeshToonMaterial.map).
   * The 2048×2048 atlas has 9 equal horizontal strips; each skin variant
   * occupies 1/9 of the texture height.
   *
   * When no texture is present (placeholder / no-atlas mode), falls back to
   * tinting the material colour from the procedural SKIN_PALETTES table.
   *
   * Delegates to `updateSkin` from ModularCharacterLoader (single source of truth).
   */
  setSkin(index: number): void {
    this._skinIndex = Math.max(0, Math.min(SKIN_STRIP_COUNT - 1, index));
    if (this._data) {
      loaderUpdateSkin(this._data, this._skinIndex);
    } else {
      // Fallback: procedural mesh — palette colour tint only
      const palette = SKIN_PALETTES[this._skinIndex] ?? SKIN_PALETTES[0];
      this.group.traverse(obj => {
        if ((obj as THREE.Mesh).isMesh) {
          const mat = (obj as THREE.Mesh).material;
          if (mat instanceof THREE.MeshToonMaterial && mat.color) {
            mat.color.setHex(palette[0]);
          }
        }
      });
    }
  }

  get skinIndex(): number { return this._skinIndex; }

  // ── Part hot-swap ────────────────────────────────────────────────────────────

  async swapPart(slot: SlotName, variantIdx: number): Promise<void> {
    if (!this._data) return;
    const manifest = getManifest();
    if (!manifest) return;
    const ok = await loaderSwapPart(this._data, slot, variantIdx, this._basePath, manifest);
    if (ok) this.setSkin(this._skinIndex);
  }

  // ── CharacterLike API ─────────────────────────────────────────────────────

  setWeaponMode(mode: 'melee' | 'ranged'): void {
    this._weaponMode = mode;
  }

  startPhaseOut(): void {
    this._phaseTarget   = 0.12;
    this._phaseEmissive = 3.5;
    this.fsm.setState('phase_out');
  }

  startPhaseIn(): void {
    this._phaseTarget   = 1.0;
    this._phaseEmissive = 0.0;
    this.fsm.setState('phase_in');
  }

  playAnimation(name: string, force = false): void {
    const n = name as FSMStateName;
    if (force) this.fsm.forceState(n);
    else       this.fsm.setState(n);
  }

  isFinished(name: string): boolean {
    return this.animSys.isFinished(name, 0.9);
  }

  get currentAnimation(): string  { return this.fsm.state; }
  get hasRealModel():     boolean  { return this._loaded;   }
  get isSingleClipGltf(): boolean  { return this._singleClip; }
  get skeleton():         THREE.Skeleton | null { return this._data?.skeleton ?? null; }

  update(dt: number): void {
    this.animSys.update(dt);
    this.fsm.update(dt);
    this._updatePhase(dt);
  }

  private _updatePhase(dt: number) {
    this._phaseAlpha += (this._phaseTarget - this._phaseAlpha) * Math.min(1, dt * 8);
    if (Math.abs(this._phaseAlpha - this._phaseTarget) < 0.001) this._phaseAlpha = this._phaseTarget;

    const alpha   = this._phaseAlpha;
    const phasing = alpha < 0.98;

    this.group.traverse(obj => {
      if (!(obj as THREE.Mesh).isMesh) return;
      const mats = Array.isArray((obj as THREE.Mesh).material)
        ? (obj as THREE.Mesh).material as THREE.Material[]
        : [(obj as THREE.Mesh).material as THREE.Material];
      mats.forEach(m => {
        const ms = m as THREE.MeshToonMaterial | THREE.MeshStandardMaterial;
        ms.transparent = phasing;
        ms.opacity     = alpha;
        if ((ms as any).emissive) {
          (ms as any).emissive.setHex(phasing ? 0x6699ff : 0x000000);
          (ms as any).emissiveIntensity = phasing ? this._phaseEmissive * (1 - alpha) * 2.5 : 0;
        }
      });
    });
  }
}

// ── Factory ────────────────────────────────────────────────────────────────────

export async function createModularCharacter(
  loadout:       ModularLoadout,
  basePath:      string,
  externalAnims?: Record<string, THREE.AnimationClip>,
  fallbackColor  = 0x3a6ea5,
): Promise<ModularCharacter> {
  await loadManifest(basePath);
  const data = await buildCharacter(loadout, basePath, externalAnims);
  return new ModularCharacter(data, fallbackColor, basePath);
}
