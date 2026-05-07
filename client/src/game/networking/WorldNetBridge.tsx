// Mounts the Socket.IO `/world` connection for the active scene:
//   1. Subscribes the Zustand mirror (`useWorldNet.bind`)
//   2. Joins the zone with the local player's spawn position
//   3. Broadcasts position/rotation/anim at ~10 Hz via the bus
//
// Renders nothing. Mount once per world scene, alongside <Player />.

import { useEffect, useRef } from "react";
import { useWorldNet } from "@/lib/stores/useWorldNet";
import { getLocalPlayerNetState } from "@/lib/grudge/playerBroadcastBus";

export interface WorldNetBridgeProps {
  zone?: string;
  /** Send rate in Hz. Default 10 Hz (100 ms). */
  rate?: number;
  /** Initial spawn used for the join packet. */
  spawn?: [number, number, number];
}

export default function WorldNetBridge({
  zone = "tutorial",
  rate = 10,
  spawn = [0, 0.5, 0],
}: WorldNetBridgeProps): null {
  const lastRev = useRef(-1);
  const lastSent = useRef({ x: 0, y: 0, z: 0, rot: 0, anim: "" });

  useEffect(() => {
    const off = useWorldNet.getState().bind();
    useWorldNet.getState().joinZone(zone, { x: spawn[0], y: spawn[1], z: spawn[2] }, 0);

    const intervalMs = Math.max(50, Math.round(1000 / Math.max(1, rate)));
    const id = window.setInterval(() => {
      const snap = getLocalPlayerNetState();
      if (snap.rev === lastRev.current) return;
      lastRev.current = snap.rev;

      // Skip emits when the change is below threshold and the anim
      // hasn't changed. Saves bandwidth when the player is idling.
      const { pos, rot, anim } = snap;
      const last = lastSent.current;
      const dx = pos.x - last.x, dy = pos.y - last.y, dz = pos.z - last.z;
      const distSq = dx * dx + dy * dy + dz * dz;
      const dRot = Math.abs(rot - last.rot);
      const animChanged = anim !== last.anim;
      if (!animChanged && distSq < 0.0025 && dRot < 0.02) return;

      last.x = pos.x; last.y = pos.y; last.z = pos.z;
      last.rot = rot; last.anim = anim;
      useWorldNet.getState().move({ x: pos.x, y: pos.y, z: pos.z }, rot, anim);
    }, intervalMs);

    return () => {
      window.clearInterval(id);
      off();
    };
  }, [zone, rate, spawn[0], spawn[1], spawn[2]]);

  return null;
}
