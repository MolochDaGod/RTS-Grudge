import { useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  RigidBody,
  CapsuleCollider,
  type RapierRigidBody,
} from "@react-three/rapier";
import { sizeCharacterCapsule, MATERIALS } from "@shared/physics";

interface CharacterBounds {
  height: number;
  radiusXZ: number;
}

interface KinematicCharacterBodyProps {
  positionRef: MutableRefObject<THREE.Vector3>;
  bounds: CharacterBounds | null;
  scale?: number;
  active?: boolean;
  collisionGroups?: number;
}

export function KinematicCharacterBody({
  positionRef,
  bounds,
  scale = 1,
  active = true,
  collisionGroups,
}: KinematicCharacterBodyProps) {
  const rbRef = useRef<RapierRigidBody>(null);

  const sized = useMemo(() => {
    if (!bounds) return null;
    // Shared sizing helper — same clamp envelope the rest of the stack uses.
    const { halfHeight, radius } = sizeCharacterCapsule(bounds.height, bounds.radiusXZ, scale);
    return {
      halfHeight: Math.round(halfHeight * 100) / 100,
      radius: Math.round(radius * 100) / 100,
    };
  }, [bounds, scale]);

  useFrame(() => {
    if (!rbRef.current || !sized || !active) return;
    rbRef.current.setNextKinematicTranslation({
      x: positionRef.current.x,
      y: positionRef.current.y,
      z: positionRef.current.z,
    });
  });

  if (!sized || !active) return null;

  return (
    <RigidBody
      key={`kc-${sized.halfHeight.toFixed(2)}-${sized.radius.toFixed(2)}`}
      ref={rbRef}
      type="kinematicPosition"
      colliders={false}
      position={[
        positionRef.current.x,
        positionRef.current.y,
        positionRef.current.z,
      ]}
      enabledRotations={[false, false, false]}
      collisionGroups={collisionGroups}
    >
      <CapsuleCollider
        args={[sized.halfHeight, sized.radius]}
        position={[0, sized.halfHeight + sized.radius, 0]}
        friction={MATERIALS.character.friction}
        restitution={MATERIALS.character.restitution}
      />
    </RigidBody>
  );
}
