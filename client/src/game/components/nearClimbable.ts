/**
 * Singleton "what climbable surface is the player currently inside the
 * sensor of" state. Written by the wall / ladder sensor `onIntersection*`
 * callbacks, read by the climb controller in Player.tsx on each frame.
 *
 * Kept as a plain module-level ref (not Zustand / React state) so updates
 * don't trigger re-renders — the consumer is `useFrame`. We also stash a
 * mirror on `window.__nearClimbable` to match the existing dock-prompt
 * pattern (`window.__nearDock`) and ease debugging from the dev console.
 */

import { useClimbPrompt } from "@/lib/stores/useClimbPrompt";

export type NearClimbableKind = "wall" | "ladder";

export interface NearClimbableInfo {
  /** Stable id for the source collider so enter/exit can pair up. */
  id: string;
  kind: NearClimbableKind;
  /** Outward-facing wall normal in world space (front of the climb face). */
  normal: [number, number, number];
  /** World-space anchor point on the climb face (centre of the sensor). */
  anchor: [number, number, number];
  /** World y of the topout edge — controller uses this to fire TOPOUT. */
  topY: number;
  /** Right vector along the climb face (used for ladder side-stepping). */
  right: [number, number, number];
  /** True while the player's chest is inside the topout sub-sensor. */
  atTop: boolean;
}

let current: NearClimbableInfo | null = null;
const stack: NearClimbableInfo[] = [];

function publish() {
  current = stack.length > 0 ? stack[stack.length - 1] : null;
  try {
    (window as any).__nearClimbable = current;
  } catch {}
  // Mirror the proximity flag into the React store so the HUD prompt
  // can react without polling each frame.
  useClimbPrompt.getState().setNear(!!current);
}

export function pushNearClimbable(info: NearClimbableInfo): void {
  // Replace any existing entry with the same id (re-entry / sensor flicker).
  const idx = stack.findIndex((s) => s.id === info.id);
  if (idx >= 0) stack[idx] = info;
  else stack.push(info);
  publish();
}

export function popNearClimbable(id: string): void {
  const idx = stack.findIndex((s) => s.id === id);
  if (idx >= 0) {
    stack.splice(idx, 1);
    publish();
  }
}

export function setAtTop(id: string, atTop: boolean): void {
  const entry = stack.find((s) => s.id === id);
  if (entry && entry.atTop !== atTop) {
    entry.atTop = atTop;
    publish();
  }
}

export function getNearClimbable(): NearClimbableInfo | null {
  return current;
}

export function clearAllNearClimbable(): void {
  stack.length = 0;
  publish();
}
