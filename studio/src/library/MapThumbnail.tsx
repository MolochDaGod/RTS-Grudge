/**
 * Top-down procedural minimap rendered to a <canvas>. Reads heights +
 * biome from a TerrainData and paints a shaded preview with simple
 * lambert lighting. Optionally drops dots for placed entities.
 */
import { useEffect, useRef } from 'react';
import type { MapProject, TerrainData } from '../types';
import { MAX_TERRAIN } from '../editor/IslandGenerator';

const BIOME_COLORS: Record<number, [number, number, number]> = {
  0: [88, 138, 64],   // grass
  1: [218, 196, 140], // sand
  2: [120, 116, 110], // rock
  3: [232, 234, 238], // snow
};
const WATER_DEEP: [number, number, number] = [16, 38, 64];
const WATER_SHALLOW: [number, number, number] = [62, 110, 140];

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

function paintTerrain(ctx: CanvasRenderingContext2D, t: TerrainData, w: number, h: number) {
  const img = ctx.createImageData(w, h);
  const data = img.data;
  // Light direction (top-left), used for hillshading
  const lx = -0.6, lz = -0.6, ly = 0.55;
  const llen = Math.hypot(lx, ly, lz);
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const u = px / (w - 1);
      const v = py / (h - 1);
      const xi = Math.min(t.resolution - 1, Math.floor(u * (t.resolution - 1)));
      const zi = Math.min(t.resolution - 1, Math.floor(v * (t.resolution - 1)));
      const i = zi * t.resolution + xi;
      const elev = t.heights[i] ?? 0;
      const dst = (py * w + px) * 4;

      if (elev <= 0.05) {
        // Water — lerp deep/shallow by depth
        const d = Math.max(0, Math.min(1, -elev / 2));
        const r = lerp(WATER_SHALLOW[0], WATER_DEEP[0], d);
        const g = lerp(WATER_SHALLOW[1], WATER_DEEP[1], d);
        const b = lerp(WATER_SHALLOW[2], WATER_DEEP[2], d);
        data[dst] = r; data[dst + 1] = g; data[dst + 2] = b; data[dst + 3] = 255;
        continue;
      }

      const biome = (t.biome[i] ?? 0) as 0 | 1 | 2 | 3;
      const base = BIOME_COLORS[biome] ?? BIOME_COLORS[0]!;

      // Sobel-ish gradient for hillshading
      const ix1 = Math.min(t.resolution - 1, xi + 1);
      const iz1 = Math.min(t.resolution - 1, zi + 1);
      const dx = (t.heights[zi * t.resolution + ix1] ?? elev) - elev;
      const dz = (t.heights[iz1 * t.resolution + xi] ?? elev) - elev;
      // Surface normal in tangent space — coarse approximation
      const nx = -dx, nz = -dz, ny = 1;
      const nlen = Math.hypot(nx, ny, nz);
      const dot = (nx * lx + ny * ly + nz * lz) / (nlen * llen);
      const shade = 0.55 + 0.55 * Math.max(0, dot);

      // Elevation tint — fade toward white at peaks
      const peak = Math.max(0, Math.min(1, elev / MAX_TERRAIN));
      const r = base[0] * shade + peak * 25;
      const g = base[1] * shade + peak * 20;
      const b = base[2] * shade + peak * 15;
      data[dst] = Math.min(255, r);
      data[dst + 1] = Math.min(255, g);
      data[dst + 2] = Math.min(255, b);
      data[dst + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function paintEntities(ctx: CanvasRenderingContext2D, project: MapProject, w: number, h: number) {
  const halfW = project.terrain.size / 2;
  for (const e of project.entities) {
    const [x, , z] = e.position;
    const u = (x + halfW) / project.terrain.size;
    const v = (z + halfW) / project.terrain.size;
    if (u < 0 || u > 1 || v < 0 || v > 1) continue;
    const px = u * w;
    const py = v * h;
    let color = 'rgba(255,255,255,0.0)';
    let radius = 0;
    switch (e.kind) {
      case 'tree': color = '#1e3a1f'; radius = 1.2; break;
      case 'rock': color = '#4b4844'; radius = 1.1; break;
      case 'bush': color = '#2e4a26'; radius = 0.8; break;
      case 'flower': color = '#ff8ed8'; radius = 0.5; break;
      case 'creature': color = '#f8e08a'; radius = 1; break;
      case 'resource_node': color = '#8be1ff'; radius = 1.6; break;
      case 'dock': color = '#c08040'; radius = 2; break;
      case 'spawn_point': color = '#ffd23f'; radius = 2.4; break;
      default: continue;
    }
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function MapThumbnail({
  project,
  width = 320,
  height = 200,
  className,
}: {
  project: MapProject;
  width?: number;
  height?: number;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    paintTerrain(ctx, project.terrain, width, height);
    paintEntities(ctx, project, width, height);
  }, [project, width, height]);

  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      className={className}
      style={{ display: 'block', width: '100%', height: 'auto', imageRendering: 'auto' }}
    />
  );
}
