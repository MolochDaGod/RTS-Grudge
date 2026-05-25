/**
 * clothPhysics — Verlet-integration cloth simulation for ship sails.
 *
 * Provides:
 *   ClothSimulation  — mass-spring particle grid with gaff-rig pin constraints
 *   WindForce        — typed wind input for cloth deformation
 *   createClothGeometry / updateClothGeometry — Three.js BufferGeometry bridge
 */

import * as THREE from "three";

// ── Types ────────────────────────────────────────────────────────────────────

export interface WindForce {
  direction: THREE.Vector3;
  strength: number;
  turbulence: number;
}

interface Particle {
  position: THREE.Vector3;
  previous: THREE.Vector3;
  acceleration: THREE.Vector3;
  pinned: boolean;
  mass: number;
}

// ── ClothSimulation ──────────────────────────────────────────────────────────

export class ClothSimulation {
  readonly width: number;
  readonly height: number;
  readonly segsX: number;
  readonly segsY: number;

  private particles: Particle[];
  private restDistX: number;
  private restDistY: number;
  private damping = 0.97;
  private gravity = new THREE.Vector3(0, -0.5, 0);
  private constraintIterations = 5;

  constructor(width: number, height: number, segsX: number, segsY: number) {
    this.width = width;
    this.height = height;
    this.segsX = segsX;
    this.segsY = segsY;
    this.restDistX = width / segsX;
    this.restDistY = height / segsY;
    this.particles = [];

    // Create particle grid (origin = top-left, Y goes downward)
    for (let iy = 0; iy <= segsY; iy++) {
      for (let ix = 0; ix <= segsX; ix++) {
        const x = (ix / segsX - 0.5) * width;
        const y = -(iy / segsY) * height; // hangs downward
        const z = 0;
        const pos = new THREE.Vector3(x, y, z);
        this.particles.push({
          position: pos.clone(),
          previous: pos.clone(),
          acceleration: new THREE.Vector3(),
          pinned: false,
          mass: 1,
        });
      }
    }
  }

  // ── Pin helpers ──────────────────────────────────────────────────────────

  /** Pin the top row (gaff) and bottom row (boom) for a gaff-rig sail. */
  pinForGaffRig(): void {
    const cols = this.segsX + 1;
    // Top row (gaff)
    for (let ix = 0; ix <= this.segsX; ix++) {
      this.particles[ix].pinned = true;
    }
    // Bottom row (boom)
    for (let ix = 0; ix <= this.segsX; ix++) {
      this.particles[this.segsY * cols + ix].pinned = true;
    }
  }

  /** Reposition gaff (top) and boom (bottom) pinned rows. */
  setGaffRigPositions(gaffY: number, boomY: number): void {
    const cols = this.segsX + 1;
    for (let ix = 0; ix <= this.segsX; ix++) {
      const x = (ix / this.segsX - 0.5) * this.width;
      // Top row
      const top = this.particles[ix];
      top.position.set(x, gaffY, 0);
      top.previous.copy(top.position);
      // Bottom row
      const bot = this.particles[this.segsY * cols + ix];
      bot.position.set(x, boomY, 0);
      bot.previous.copy(bot.position);
    }
    // Interpolate interior rows
    for (let iy = 1; iy < this.segsY; iy++) {
      const t = iy / this.segsY;
      const y = gaffY + (boomY - gaffY) * t;
      for (let ix = 0; ix <= this.segsX; ix++) {
        const p = this.particles[iy * cols + ix];
        if (!p.pinned) {
          p.position.set((ix / this.segsX - 0.5) * this.width, y, 0);
          p.previous.copy(p.position);
        }
      }
    }
  }

  /** Update only the boom (bottom) row Y when sail deployment changes. */
  updateBoomPosition(boomY: number): void {
    const cols = this.segsX + 1;
    for (let ix = 0; ix <= this.segsX; ix++) {
      const p = this.particles[this.segsY * cols + ix];
      p.position.y = boomY;
      p.previous.y = boomY;
    }
  }

  // ── Wind ─────────────────────────────────────────────────────────────────

  applyWind(wind: WindForce): void {
    const cols = this.segsX + 1;
    for (let iy = 0; iy <= this.segsY; iy++) {
      for (let ix = 0; ix <= this.segsX; ix++) {
        const p = this.particles[iy * cols + ix];
        if (p.pinned) continue;

        // Turbulence adds per-particle random variation
        const turb = wind.turbulence * ((Math.random() - 0.5) * 2);
        const force = wind.direction
          .clone()
          .multiplyScalar(wind.strength * (1 + turb) * 0.002);
        p.acceleration.add(force);
      }
    }
  }

  // ── Step ─────────────────────────────────────────────────────────────────

  update(delta: number): void {
    const dt = Math.min(delta, 0.033); // cap at ~30fps equiv

    // Verlet integration
    for (const p of this.particles) {
      if (p.pinned) continue;
      p.acceleration.add(this.gravity);
      const vel = p.position.clone().sub(p.previous).multiplyScalar(this.damping);
      p.previous.copy(p.position);
      p.position.add(vel).add(p.acceleration.multiplyScalar(dt * dt));
      p.acceleration.set(0, 0, 0);
    }

    // Distance constraints (structural springs)
    const cols = this.segsX + 1;
    for (let iter = 0; iter < this.constraintIterations; iter++) {
      for (let iy = 0; iy <= this.segsY; iy++) {
        for (let ix = 0; ix <= this.segsX; ix++) {
          const idx = iy * cols + ix;
          // Horizontal
          if (ix < this.segsX) {
            this.satisfy(this.particles[idx], this.particles[idx + 1], this.restDistX);
          }
          // Vertical
          if (iy < this.segsY) {
            this.satisfy(this.particles[idx], this.particles[idx + cols], this.restDistY);
          }
        }
      }
    }
  }

  private satisfy(a: Particle, b: Particle, rest: number): void {
    const diff = b.position.clone().sub(a.position);
    const dist = diff.length();
    if (dist < 0.0001) return;
    const correction = diff.multiplyScalar((dist - rest) / dist * 0.5);
    if (!a.pinned) a.position.add(correction);
    if (!b.pinned) b.position.sub(correction);
  }

  // ── Geometry access ─────────────────────────────────────────────────────

  /** Get particle position for geometry bridge. */
  getPosition(ix: number, iy: number): THREE.Vector3 {
    return this.particles[iy * (this.segsX + 1) + ix].position;
  }
}

// ── Geometry helpers ─────────────────────────────────────────────────────────

/** Create a THREE.BufferGeometry from a ClothSimulation's current state. */
export function createClothGeometry(sim: ClothSimulation): THREE.BufferGeometry {
  const cols = sim.segsX + 1;
  const rows = sim.segsY + 1;
  const vertCount = cols * rows;
  const positions = new Float32Array(vertCount * 3);
  const normals = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);

  for (let iy = 0; iy < rows; iy++) {
    for (let ix = 0; ix < cols; ix++) {
      const i = iy * cols + ix;
      const p = sim.getPosition(ix, iy);
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;
      normals[i * 3 + 2] = 1; // face forward
      uvs[i * 2] = ix / sim.segsX;
      uvs[i * 2 + 1] = 1 - iy / sim.segsY;
    }
  }

  // Triangle indices
  const indices: number[] = [];
  for (let iy = 0; iy < sim.segsY; iy++) {
    for (let ix = 0; ix < sim.segsX; ix++) {
      const a = iy * cols + ix;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geom.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geom.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  return geom;
}

/** Update an existing geometry's position buffer from the simulation. */
export function updateClothGeometry(
  geom: THREE.BufferGeometry,
  sim: ClothSimulation,
): void {
  const posAttr = geom.getAttribute("position") as THREE.BufferAttribute;
  const cols = sim.segsX + 1;
  const rows = sim.segsY + 1;

  for (let iy = 0; iy < rows; iy++) {
    for (let ix = 0; ix < cols; ix++) {
      const i = iy * cols + ix;
      const p = sim.getPosition(ix, iy);
      posAttr.setXYZ(i, p.x, p.y, p.z);
    }
  }

  posAttr.needsUpdate = true;
  geom.computeVertexNormals();
}
