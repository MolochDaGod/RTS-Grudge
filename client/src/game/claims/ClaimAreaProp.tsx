/**
 * Static camp geometry — log ring + claim flag pole at a ClaimArea centre.
 * Volumetric flame is rendered by CampfireFireSystem (instanced).
 */
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { ClaimArea } from "@/lib/stores/useClaimArea";

const FLAG_COLORS: Record<string, string> = {
  player: "#ffb347",
  hero: "#7ec8e3",
  faction: "#c9a84c",
  crew: "#9b59b6",
  world: "#888888",
};

export function ClaimAreaProp({ claim }: { claim: ClaimArea }) {
  const lightRef = useRef<THREE.PointLight>(null);
  const t = useRef(0);
  const showFlag = claim.labels.includes("flag") || claim.labels.includes("claim");
  const flagColor = FLAG_COLORS[claim.ownerKind] ?? "#ffb347";
  const [x, y, z] = claim.position;

  useFrame((_, delta) => {
    if (!claim.lit || !lightRef.current) return;
    t.current += delta * 3;
    lightRef.current.intensity =
      2.5 + 1.5 * Math.sin(t.current) * Math.cos(t.current * 0.7);
  });

  return (
    <group position={[x, y, z]}>
      {/* Stone / log ring */}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const angle = (i / 6) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[Math.cos(angle) * 0.42, 0.08, Math.sin(angle) * 0.42]}
            rotation={[0.3, angle, 0.2]}
            castShadow
          >
            <boxGeometry args={[0.14, 0.35, 0.1]} />
            <meshStandardMaterial color="#5C4033" roughness={0.95} />
          </mesh>
        );
      })}

      {/* Crossed logs */}
      <mesh position={[0, 0.06, 0]} rotation={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.05, 0.07, 0.75, 6]} />
        <meshStandardMaterial color="#5C3317" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.06, 0]} rotation={[0, -0.35, 0]}>
        <cylinderGeometry args={[0.05, 0.07, 0.75, 6]} />
        <meshStandardMaterial color="#5C3317" roughness={0.9} />
      </mesh>

      {/* Claim flag — camp / base / flag are the same anchor */}
      {showFlag && (
        <group position={[0, 0, 0.55]}>
          <mesh position={[0, 0.55, 0]} castShadow>
            <cylinderGeometry args={[0.03, 0.04, 1.1, 6]} />
            <meshStandardMaterial color="#4a3728" roughness={0.85} />
          </mesh>
          <mesh position={[0.22, 0.95, 0]} rotation={[0, 0, -0.08]}>
            <planeGeometry args={[0.42, 0.28]} />
            <meshStandardMaterial
              color={flagColor}
              emissive={flagColor}
              emissiveIntensity={0.15}
              side={THREE.DoubleSide}
              roughness={0.7}
            />
          </mesh>
        </group>
      )}

      {/* Footprint hint (subtle) */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[claim.radius * 0.85, claim.radius, 48]} />
        <meshBasicMaterial
          color={flagColor}
          transparent
          opacity={0.06}
          depthWrite={false}
        />
      </mesh>

      {claim.lit && (
        <pointLight
          ref={lightRef}
          position={[0, 0.6, 0]}
          color="#ff6600"
          intensity={3}
          distance={Math.min(claim.radius, 14)}
          decay={2}
        />
      )}
    </group>
  );
}