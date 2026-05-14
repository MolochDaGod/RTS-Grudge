/**
 * Single source of truth for the world-space Y of the ocean surface,
 * the visible seabed (the depth the underwater shader paints terrain
 * peaks toward), and the lower bound of the swim band.
 *
 * 20 ft below the surface ≈ 6.1 m. We use 6 m as the visible seabed.
 * The swim band extends 1 m below that so the player can stand on the
 * seabed collider and still be in swim mode (otherwise the moment they
 * touch bottom they'd snap out of swimming).
 *
 * KNOWN LIMITATION — these are GLOBAL constants. Today only the
 * tutorial island wires up an underwater volume + seabed collider, so
 * a single shared threshold works. Once a second scene grows its own
 * water (a deeper sea, a lake at a different elevation, an underground
 * cavern) this should be promoted to a per-scene "water volumes"
 * registry that `isInWater(pos)` queries. Keep this file as the seam.
 */

export const WATER_SURFACE_Y = 0;
export const SEABED_VISUAL_Y = -6;
export const SWIM_BAND_BOTTOM_Y = -7;

export function isInWater(y: number): boolean {
  return y < WATER_SURFACE_Y && y > SWIM_BAND_BOTTOM_Y;
}
