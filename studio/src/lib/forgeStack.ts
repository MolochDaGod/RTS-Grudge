/**
 * Canonical render/physics stacks for fleet games and the Forge editor toolchain.
 * Babylon was retired — all targets are Three.js family.
 */

export interface GameStack {
  /** Short label shown in the Forge navbar */
  label: string;
  render: string;
  physics: string;
  backend: string;
  assets: string;
}

/** Shared Forge editor toolchain (all deploy targets export through this). */
export const FORGE_TOOLCHAIN: GameStack = {
  label: "Forge",
  render: "React 18 · R3F · drei · Three.js",
  physics: "Rapier (@react-three/rapier)",
  backend: "api.grudge-studio.com · id.grudge-studio.com",
  assets: "objectstore.grudge-studio.com · assets.grudge-studio.com",
};

export const FLEET_STACKS = {
  warlords: {
    label: "Warlords",
    render: "R3F · Three.js · Phaser 2D",
    physics: "Cannon-ES (island) · Arcade (2D)",
    backend: "GrudgeBuilder API (Railway) · Puter KV",
    assets: "assets.grudge-studio.com · local sprites",
  },
  "rts-grudge": {
    label: "RTS",
    render: "R3F · drei · Three.js",
    physics: "Rapier 3D · mesh-bvh raycast",
    backend: "api.grudge-studio.com · ws.grudge-studio.com",
    assets: "assets.grudge-studio.com · asset-api Worker",
  },
  dcq: {
    label: "DCQ",
    render: "Three.js · Voxel meshing",
    physics: "Rapier 3D · voxel AABB",
    backend: "api.grudge-studio.com",
    assets: "objectstore.grudge-studio.com · assets CDN",
  },
} as const satisfies Record<string, GameStack>;