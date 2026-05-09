/**
 * AuraEffect — animated circular aura rendered at the character's feet.
 *
 * Color is driven by class:
 *   warrior → gold (#c9950a)
 *   mage    → blue (#4488ff)
 *   ranger  → green (#44cc44)
 *   worge   → red (#cc4444)
 *
 * The ring pulses gently and fades with distance from center using an
 * additive-blended ring texture from the existing VFX_TEXTURES set.
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { VFX_TEXTURES } from "./SkillEffects";

const CLASS_COLORS: Record<string, string> = {
  melee:  "#c9950a",  // warrior gold
  caster: "#4488ff",  // mage blue
  ranger: "#44cc44",  // ranger green
  worge:  "#cc4444",  // worge red
};

interface AuraEffectProps {
  /** Combat class id — drives aura color */
  combatClass?: string;
  /** Override color (CSS hex) */
  color?: string;
  /** Radius of the aura ring in world units */
  radius?: number;
  /** Pulse speed multiplier */
  pulseSpeed?: number;
  /** Whether the aura is visible */
  visible?: boolean;
}

export function AuraEffect({
  combatClass = "melee",
  color,
  radius = 1.2,
  pulseSpeed = 1.5,
  visible = true,
}: AuraEffectProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const ringTex = useTexture(VFX_TEXTURES.ring);
  const resolvedColor = color ?? CLASS_COLORS[combatClass] ?? CLASS_COLORS.melee;

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    meshRef.current.visible = visible;
    if (!visible) return;

    // Gentle scale pulse
    const t = performance.now() * 0.001 * pulseSpeed;
    const pulse = 1.0 + Math.sin(t * Math.PI) * 0.06;
    meshRef.current.scale.setScalar(pulse);

    // Slow rotation
    meshRef.current.rotation.z += delta * 0.3;

    // Opacity breath
    const mat = meshRef.current.material as THREE.MeshBasicMaterial;
    mat.opacity = 0.25 + Math.sin(t * Math.PI * 0.7) * 0.08;
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
      <planeGeometry args={[radius * 2, radius * 2]} />
      <meshBasicMaterial
        map={ringTex}
        color={resolvedColor}
        transparent
        opacity={0.3}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
