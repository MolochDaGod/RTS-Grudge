/**
 * ZoneTerrainMesh — Renders a single zone island as a heightfield mesh.
 *
 * Takes a ZoneTerrainData (from generateZoneTerrain) and produces:
 *   1. A THREE.PlaneGeometry with vertex heights set from the heightfield
 *   2. Per-vertex coloring based on elevation bands (beach=sand, forest=green, etc.)
 *   3. A Rapier HeightfieldCollider for physics (player walks on the terrain)
 *
 * The mesh is positioned at the zone's worldOffset so multiple zones
 * can coexist in the same scene at their correct world positions.
 *
 * Usage:
 *   <ZoneTerrainMesh zoneId="plains" terrainData={data} />
 */

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { RigidBody, HeightfieldCollider } from "@react-three/rapier";
import {
  type ZoneTerrainData,
  ELEVATION_BANDS,
  WATER_LEVEL,
} from "./ZoneHeightmapSystem";
import { getZone, type ZoneId } from "./WorldGridRegistry";

// ── Elevation band colors ────────────────────────────────────────────────────
// These are vertex colors — the terrain shader will blend PBR textures using
// these as a splatmap. For now, flat vertex colors give immediate visual
// feedback on the elevation bands.

const BAND_COLORS: Record<string, THREE.Color> = {
  DEEP_OCEAN:  new THREE.Color(0x0a1a3a),  // dark navy
  ISLAND_BASE: new THREE.Color(0x3a2a1a),  // underground dirt
  BEACH:       new THREE.Color(0xd4b896),  // sandy tan
  FLAT_LAND:   new THREE.Color(0x6aaa4a),  // meadow green
  FOREST:      new THREE.Color(0x2d5a27),  // dark forest green
  MINES:       new THREE.Color(0x6a6060),  // rocky grey
  MOUNTAIN:    new THREE.Color(0x888888),  // mountain stone
  PEAK:        new THREE.Color(0xcccccc),  // light peak (snow/ice)
};

function getColorForHeight(h: number): THREE.Color {
  if (h < ELEVATION_BANDS.DEEP_OCEAN.max) return BAND_COLORS.DEEP_OCEAN;
  if (h < ELEVATION_BANDS.ISLAND_BASE.max) return BAND_COLORS.ISLAND_BASE;
  if (h < ELEVATION_BANDS.BEACH.max) return BAND_COLORS.BEACH;
  if (h < ELEVATION_BANDS.FLAT_LAND.max) return BAND_COLORS.FLAT_LAND;
  if (h < ELEVATION_BANDS.FOREST.max) return BAND_COLORS.FOREST;
  if (h < ELEVATION_BANDS.MINES.max) return BAND_COLORS.MINES;
  if (h < ELEVATION_BANDS.MOUNTAIN.max) return BAND_COLORS.MOUNTAIN;
  return BAND_COLORS.PEAK;
}

// ── Component ────────────────────────────────────────────────────────────────

interface ZoneTerrainMeshProps {
  zoneId: ZoneId;
  terrainData: ZoneTerrainData;
  /** Show wireframe overlay for debugging */
  wireframe?: boolean;
}

export default function ZoneTerrainMesh({
  zoneId,
  terrainData,
  wireframe = false,
}: ZoneTerrainMeshProps) {
  const zone = getZone(zoneId);
  if (!zone) return null;

  const { heightData, resolution, worldSize } = terrainData;
  const segments = resolution; // 1024 segments = 1025 vertices per axis

  // Build the geometry with correct vertex heights and colors
  const { geometry, heightArray } = useMemo(() => {
    const geo = new THREE.PlaneGeometry(worldSize, worldSize, segments, segments);
    geo.rotateX(-Math.PI / 2); // lay flat (XZ plane)

    const positions = geo.attributes.position;
    const colors = new Float32Array(positions.count * 3);
    const stride = resolution + 1;

    for (let i = 0; i < positions.count; i++) {
      // PlaneGeometry after rotateX(-PI/2): x=right, y=up, z=forward
      // Vertices are laid out row-by-row in the original XY plane,
      // which after rotation becomes XZ with Y as height.
      const col = i % (segments + 1);
      const row = Math.floor(i / (segments + 1));

      // Map geometry vertex to heightfield cell
      const hx = col;
      const hz = row;
      const h = heightData[hz * stride + hx] ?? 0;

      // Set Y (height)
      positions.setY(i, h);

      // Set vertex color based on elevation band
      const color = getColorForHeight(h);
      colors[i * 3]     = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    // Build the Rapier heightfield array (row-major, Z-outer)
    // Rapier expects heights in a specific layout: nRows × nCols
    const heightArray = new Float32Array((segments + 1) * (segments + 1));
    for (let z = 0; z <= segments; z++) {
      for (let x = 0; x <= segments; x++) {
        heightArray[z * (segments + 1) + x] = heightData[z * stride + x] ?? 0;
      }
    }

    return { geometry: geo, heightArray };
  }, [heightData, resolution, worldSize, segments]);

  return (
    <group position={[zone.worldOffset.x, 0, zone.worldOffset.z]}>
      {/* Visual mesh */}
      <mesh
        geometry={geometry}
        receiveShadow
        castShadow={false}
      >
        <meshStandardMaterial
          vertexColors
          roughness={0.85}
          metalness={0.05}
          wireframe={wireframe}
          flatShading={false}
        />
      </mesh>

      {/* Physics collider */}
      <RigidBody type="fixed" colliders={false}>
        <HeightfieldCollider
          args={[
            segments,      // nRows (Z)
            segments,      // nCols (X)
            heightArray,
            { x: worldSize, y: 1, z: worldSize },
          ]}
        />
      </RigidBody>
    </group>
  );
}

/**
 * Renders a simple water plane at y=0 for a zone.
 * The water extends across the full zone size.
 */
export function ZoneWaterPlane({ zoneId }: { zoneId: ZoneId }) {
  const zone = getZone(zoneId);
  if (!zone) return null;

  return (
    <mesh
      position={[zone.worldOffset.x, WATER_LEVEL - 0.05, zone.worldOffset.z]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
    >
      <planeGeometry args={[zone.size * 1.2, zone.size * 1.2]} />
      <meshStandardMaterial
        color="#1a5a8a"
        transparent
        opacity={0.7}
        roughness={0.1}
        metalness={0.3}
      />
    </mesh>
  );
}
