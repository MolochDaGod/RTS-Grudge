// Initial terrain generation for the main world. Lives separate from
// `TerrainHeightField` and `Terrain` so the heightfield module can call it
// without dragging Three.js / drei into a non-rendering import path
// (TerrainCollider, gameplay code, etc.).

class SimplexNoise {
  private p: Uint8Array;
  private perm: Uint8Array;
  private permMod12: Uint8Array;

  constructor(seed: number) {
    this.p = new Uint8Array(256);
    this.perm = new Uint8Array(512);
    this.permMod12 = new Uint8Array(512);

    for (let i = 0; i < 256; i++) this.p[i] = i;
    let n: number, swap: number;
    for (let i = 255; i > 0; i--) {
      seed = (seed * 16807) % 2147483647;
      n = Math.floor((seed / 2147483647) * (i + 1));
      swap = this.p[i];
      this.p[i] = this.p[n];
      this.p[n] = swap;
    }
    for (let i = 0; i < 512; i++) {
      this.perm[i] = this.p[i & 255];
      this.permMod12[i] = this.perm[i] % 12;
    }
  }

  private static grad3 = [
    [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
    [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
    [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
  ];
  private static F2 = 0.5 * (Math.sqrt(3) - 1);
  private static G2 = (3 - Math.sqrt(3)) / 6;

  noise2D(x: number, y: number): number {
    const { F2, G2, grad3 } = SimplexNoise;
    const s = (x + y) * F2;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    const t = (i + j) * G2;
    const x0 = x - (i - t);
    const y0 = y - (j - t);
    const i1 = x0 > y0 ? 1 : 0;
    const j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;
    const ii = i & 255;
    const jj = j & 255;
    const gi0 = this.permMod12[ii + this.perm[jj]];
    const gi1 = this.permMod12[ii + i1 + this.perm[jj + j1]];
    const gi2 = this.permMod12[ii + 1 + this.perm[jj + 1]];
    let n0: number, n1: number, n2: number;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    n0 = t0 < 0 ? 0 : (t0 *= t0, t0 * t0 * (grad3[gi0][0] * x0 + grad3[gi0][1] * y0));
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    n1 = t1 < 0 ? 0 : (t1 *= t1, t1 * t1 * (grad3[gi1][0] * x1 + grad3[gi1][1] * y1));
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    n2 = t2 < 0 ? 0 : (t2 *= t2, t2 * t2 * (grad3[gi2][0] * x2 + grad3[gi2][1] * y2));
    return 70 * (n0 + n1 + n2);
  }

  fbm2D(x: number, y: number, octaves: number, lacunarity: number, persistence: number): number {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;
    for (let i = 0; i < octaves; i++) {
      value += this.noise2D(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }
    return value / maxValue;
  }
}

/**
 * Generate the initial procedural heightfield for the main world. Same
 * formula that lived inside `Terrain.tsx` before the editable-terrain
 * refactor, kept byte-for-byte so existing saved positions of trees,
 * rocks, NPCs etc. don't drift.
 *
 * The shape is: FBM noise → island falloff → carve a flat ring around
 * the world centre and the survivor spawn → 2 passes of 3x3 box smooth.
 */
export function generateInitialTerrainHeights(
  worldSize: number,
  resolution: number,
  maxHeight: number,
  seed: number,
): Float32Array {
  const noise = new SimplexNoise(seed);
  const data = new Float32Array(resolution * resolution);
  const freq = 0.015;

  for (let z = 0; z < resolution; z++) {
    for (let x = 0; x < resolution; x++) {
      const nx = (x / (resolution - 1) - 0.5) * worldSize;
      const nz = (z / (resolution - 1) - 0.5) * worldSize;

      let h = noise.fbm2D(nx * freq, nz * freq, 6, 2.2, 0.45);
      h = (h + 1) / 2;
      h = Math.pow(h, 1.3);

      const edgeDist = 1 - Math.max(
        Math.abs(nx) / (worldSize * 0.5),
        Math.abs(nz) / (worldSize * 0.5),
      );
      const islandFactor = Math.pow(Math.max(0, edgeDist), 0.8);
      h *= islandFactor;

      const distFromCenter = Math.sqrt(nx * nx + nz * nz);
      if (distFromCenter < 18) {
        const t = distFromCenter / 18;
        h *= t * t;
      }

      const spawnDist = Math.sqrt(nx * nx + (nz + 5) * (nz + 5));
      if (spawnDist < 14) {
        const st = Math.max(0, spawnDist / 14);
        h *= st;
      }

      data[z * resolution + x] = h * maxHeight;
    }
  }

  for (let pass = 0; pass < 2; pass++) {
    const temp = new Float32Array(data.length);
    for (let z = 1; z < resolution - 1; z++) {
      for (let x = 1; x < resolution - 1; x++) {
        let sum = 0;
        for (let dz = -1; dz <= 1; dz++) {
          for (let dx = -1; dx <= 1; dx++) {
            sum += data[(z + dz) * resolution + (x + dx)];
          }
        }
        temp[z * resolution + x] = sum / 9;
      }
    }
    for (let i = 0; i < data.length; i++) {
      if (temp[i] > 0) data[i] = temp[i];
    }
  }

  return data;
}
