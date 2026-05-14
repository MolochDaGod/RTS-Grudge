import * as THREE from "three";
import { create } from "zustand";

/**
 * Mutable, module-scoped registry of bones from the player's currently
 * mounted character rig. Other systems read from this without prop-drilling
 * (camera anchor, head IK / look-at, helm/hat cosmetic attach, weapon
 * gizmo overlay, debug overlays).
 *
 * Exactly one rig is active at a time — the in-game player or the
 * character-select preview — and whichever is mounted publishes via
 * `setPlayerBones`. Unmount / model-swap publishes nulls.
 *
 * Slots:
 *   - right / left : the hand bones that weapons attach to.
 *   - head         : the head bone (resolved via HEAD_ALIASES) used for
 *                    cosmetic helmet attach, head-tracking look-at, and
 *                    camera-anchor offsets. Was previously missing, which
 *                    caused downstream consumers to fall back to model
 *                    origin and snap on every retarget.
 */
export const playerBones: {
  right: THREE.Object3D | null;
  left: THREE.Object3D | null;
  head: THREE.Object3D | null;
} = {
  right: null,
  left: null,
  head: null,
};

export function setPlayerBones(
  right: THREE.Object3D | null,
  left: THREE.Object3D | null,
  head: THREE.Object3D | null,
): void {
  playerBones.right = right;
  playerBones.left = left;
  playerBones.head = head;
}

/**
 * Back-compat alias for the prior 2-arg setter. Existing callers that only
 * know about hands keep working — they just leave `head` untouched. New
 * callers should prefer `setPlayerBones(right, left, head)` so the head
 * slot stays in sync with the active rig.
 */
export function setPlayerHandBones(
  right: THREE.Object3D | null,
  left: THREE.Object3D | null,
): void {
  playerBones.right = right;
  playerBones.left = left;
}

/**
 * Back-compat alias for the prior `playerHandBones` named export. Reads the
 * same underlying object so any consumer that destructured `right` / `left`
 * keeps observing live updates.
 */
export const playerHandBones = playerBones;

export type GizmoMode = "translate" | "rotate" | "scale" | null;

interface WeaponTunerState {
  gizmoMode: GizmoMode;
  gizmoHand: "right" | "left";
  dragging: boolean;
  setGizmoMode: (m: GizmoMode) => void;
  setGizmoHand: (h: "right" | "left") => void;
  setDragging: (d: boolean) => void;
}

export const useWeaponTuner = create<WeaponTunerState>((set) => ({
  gizmoMode: null,
  gizmoHand: "right",
  dragging: false,
  setGizmoMode: (gizmoMode) => set({ gizmoMode }),
  setGizmoHand: (gizmoHand) => set({ gizmoHand }),
  setDragging: (dragging) => set({ dragging }),
}));
