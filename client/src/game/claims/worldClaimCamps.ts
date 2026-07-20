/** Static world claim camps — xz from World.tsx scatter; y sampled at sync. */
export interface WorldClaimCamp {
  id: string;
  x: number;
  z: number;
  radius?: number;
  seed?: number;
  fireScale?: number;
}

export const WORLD_CLAIM_CAMPS: WorldClaimCamp[] = [
  { id: "world-claim-0", x: 18, z: -18, seed: 0.12, fireScale: 0.9 },
  { id: "world-claim-1", x: -15, z: 18, seed: 0.34, fireScale: 0.85 },
  { id: "world-claim-2", x: 25, z: -25, seed: 0.56, fireScale: 1.0 },
  { id: "world-claim-3", x: -40, z: -40, seed: 0.78, fireScale: 0.8 },
  { id: "world-claim-4", x: 70, z: -30, seed: 0.91, fireScale: 0.95 },
];