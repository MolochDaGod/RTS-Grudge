/**
 * Shared Rapier physics root for Forge play mode.
 * Terrain locomotion still samples height maps; Rapier is wired for
 * props/creature grounding and future collision work aligned with RTS-Grudge.
 */
import { Suspense, type ReactNode } from 'react';
import { Physics, RigidBody, CuboidCollider } from '@react-three/rapier';

export function ForgePhysics({ children }: { children: ReactNode }) {
  return (
    <Physics gravity={[0, -9.81, 0]} timeStep="vary" paused={false}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[512, 0.5, 512]} position={[0, -0.5, 0]} />
      </RigidBody>
      <Suspense fallback={null}>{children}</Suspense>
    </Physics>
  );
}