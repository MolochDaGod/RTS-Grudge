// Tiny module-level snapshot bus for the local player's network state.
//
// `Player.tsx` writes `pos / rot / anim` into this bus once per frame
// (from inside its `useFrame`). The `useWorldBroadcast` hook reads the
// bus on a 100ms interval and emits it over Socket.IO (`world:move`).
//
// Using a plain mutable object instead of a Zustand store avoids re-rendering
// every component that touches the player position when we tick the
// snapshot at frame rate.

export interface BroadcastSnapshot {
  pos: { x: number; y: number; z: number };
  rot: number;
  anim: string;
  // Bumped each time setLocalPlayerNetState is called. The broadcaster
  // uses this to skip emits when nothing has changed.
  rev: number;
}

const _state: BroadcastSnapshot = {
  pos: { x: 0, y: 0, z: 0 },
  rot: 0,
  anim: "idle",
  rev: 0,
};

export function setLocalPlayerNetState(
  px: number, py: number, pz: number,
  rot: number,
  anim: string,
): void {
  _state.pos.x = px;
  _state.pos.y = py;
  _state.pos.z = pz;
  _state.rot = rot;
  _state.anim = anim;
  _state.rev++;
}

export function getLocalPlayerNetState(): BroadcastSnapshot {
  return _state;
}
