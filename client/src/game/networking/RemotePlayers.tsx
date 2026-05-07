// Renders every other player in the current zone as a placeholder
// capsule with a name label. Pulls state from the Zustand mirror
// (`useWorldNet.remotePlayers`) and lerps each remote toward its
// most-recent broadcast so the 10 Hz update cadence still looks smooth.
//
// This is intentionally minimal — once the broadcaster + server are
// proven in production we can swap the capsule for a faction-coloured
// character rig with the same animation pipeline as <Player />.

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { useWorldNet } from "@/lib/stores/useWorldNet";
import type { RemotePlayer } from "@/lib/grudge/worldClient";

const LERP_RATE = 12; // 1/s — visual smoothing toward server pos.

interface RemoteEntry {
  id: string;
  name: string;
  groupRef: React.MutableRefObject<THREE.Group | null>;
  target: THREE.Vector3;
  targetRot: number;
}

function RemotePlayerMesh({ entry, snapshot }: { entry: RemoteEntry; snapshot: RemotePlayer }) {
  // Push latest target every render — cheap, runs only when the
  // remotePlayers slice for this id actually changes (Zustand patches
  // the record in place by socketId).
  entry.target.set(snapshot.pos.x, snapshot.pos.y, snapshot.pos.z);
  entry.targetRot = snapshot.rot;

  useFrame((_, dt) => {
    const g = entry.groupRef.current;
    if (!g) return;
    const t = 1 - Math.exp(-LERP_RATE * dt);
    g.position.lerp(entry.target, t);
    // Shortest-arc rotation lerp.
    let cur = g.rotation.y;
    const tgt = entry.targetRot;
    let d = tgt - cur;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    g.rotation.y = cur + d * t;
  });

  return (
    <group ref={entry.groupRef} position={[snapshot.pos.x, snapshot.pos.y, snapshot.pos.z]}>
      <mesh castShadow position={[0, 0.9, 0]}>
        <capsuleGeometry args={[0.32, 0.9, 6, 12]} />
        <meshStandardMaterial color="#6aa9ff" roughness={0.6} metalness={0.05} />
      </mesh>
      <Html position={[0, 2.05, 0]} center distanceFactor={10} occlude={false}>
        <div
          style={{
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
            fontSize: 12,
            padding: "2px 6px",
            background: "rgba(8,12,20,0.72)",
            color: "#e6f0ff",
            border: "1px solid rgba(120,170,255,0.5)",
            borderRadius: 4,
            whiteSpace: "nowrap",
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          {snapshot.name || snapshot.id.slice(0, 6)}
        </div>
      </Html>
    </group>
  );
}

export default function RemotePlayers() {
  const remotePlayers = useWorldNet((s) => s.remotePlayers);
  const selfId = useWorldNet((s) => s.selfSocketId);

  const entries = useRef(new Map<string, RemoteEntry>());

  // Garbage-collect departed players.
  useEffect(() => {
    const live = new Set(Object.keys(remotePlayers));
    for (const id of entries.current.keys()) {
      if (!live.has(id)) entries.current.delete(id);
    }
  }, [remotePlayers]);

  const visible = useMemo(() => {
    const out: Array<{ entry: RemoteEntry; snapshot: RemotePlayer }> = [];
    for (const [sid, snap] of Object.entries(remotePlayers)) {
      if (selfId && sid === selfId) continue;
      let entry = entries.current.get(sid);
      if (!entry) {
        entry = {
          id: sid,
          name: snap.name,
          groupRef: { current: null },
          target: new THREE.Vector3(snap.pos.x, snap.pos.y, snap.pos.z),
          targetRot: snap.rot,
        };
        entries.current.set(sid, entry);
      }
      out.push({ entry, snapshot: snap });
    }
    return out;
  }, [remotePlayers, selfId]);

  return (
    <>
      {visible.map(({ entry, snapshot }) => (
        <RemotePlayerMesh key={entry.id} entry={entry} snapshot={snapshot} />
      ))}
    </>
  );
}
