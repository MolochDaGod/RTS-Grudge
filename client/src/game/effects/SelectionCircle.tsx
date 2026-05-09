/**
 * SelectionCircle — animated ring drawn under a selected unit.
 *
 *   friendly → green (#44ff44)
 *   enemy    → red (#ff4444)
 *   neutral  → yellow (#ffcc44)
 *
 * The ring animates with a dashed rotation and gentle scale pulse.
 * Integrates with the existing `useTargeting` store for tab-target.
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

type SelectionTeam = "friendly" | "enemy" | "neutral";

const TEAM_COLORS: Record<SelectionTeam, string> = {
  friendly: "#44ff44",
  enemy:    "#ff4444",
  neutral:  "#ffcc44",
};

interface SelectionCircleProps {
  team?: SelectionTeam;
  /** Override color */
  color?: string;
  radius?: number;
  visible?: boolean;
  /** Thick ring for primary target, thin for secondary */
  primary?: boolean;
}

export function SelectionCircle({
  team = "friendly",
  color,
  radius = 1.0,
  visible = true,
  primary = true,
}: SelectionCircleProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const resolvedColor = color ?? TEAM_COLORS[team];
  const thickness = primary ? 0.08 : 0.04;

  useFrame(() => {
    if (!meshRef.current) return;
    meshRef.current.visible = visible;
    if (!visible) return;

    // Slow rotation
    meshRef.current.rotation.z += 0.01;

    // Pulse
    const t = performance.now() * 0.001;
    const pulse = 1.0 + Math.sin(t * 2.5) * 0.04;
    meshRef.current.scale.setScalar(pulse);
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
      <ringGeometry args={[radius - thickness, radius, 48]} />
      <meshBasicMaterial
        color={resolvedColor}
        transparent
        opacity={primary ? 0.65 : 0.35}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

/**
 * TargetReticle — pulsing reticle projected under the tab-target enemy.
 * Renders a double-ring with rotating inner + fixed outer.
 */
export function TargetReticle({
  visible = true,
  radius = 1.2,
}: {
  visible?: boolean;
  radius?: number;
}) {
  const outerRef = useRef<THREE.Mesh>(null);
  const innerRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (outerRef.current) outerRef.current.visible = visible;
    if (innerRef.current) {
      innerRef.current.visible = visible;
      innerRef.current.rotation.z -= 0.02;
    }
  });

  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
      {/* Outer static ring */}
      <mesh ref={outerRef}>
        <ringGeometry args={[radius - 0.06, radius, 48]} />
        <meshBasicMaterial color="#ff4444" transparent opacity={0.5} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* Inner spinning ring */}
      <mesh ref={innerRef}>
        <ringGeometry args={[radius * 0.5 - 0.04, radius * 0.5, 6]} />
        <meshBasicMaterial color="#ff6666" transparent opacity={0.4} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}
