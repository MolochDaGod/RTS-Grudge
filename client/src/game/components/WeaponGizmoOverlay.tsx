import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { TransformControls } from "@react-three/drei";
import { TransformControls as TransformControlsImpl } from "three-stdlib";
import { useGame } from "@/lib/stores/useGame";
import { DEFAULT_WEAPON_OFFSET, getWeaponBaseUserData } from "@/game/systems/BoneAliases";
import { playerHandBones, useWeaponTuner } from "@/game/systems/playerBones";

function findWeaponGroup(bone: THREE.Object3D | null): THREE.Object3D | null {
  if (!bone) return null;
  for (const child of bone.children) {
    if (child.name && child.name.startsWith("weapon_") && getWeaponBaseUserData(child)) {
      return child;
    }
  }
  return null;
}

export default function WeaponGizmoOverlay() {
  const gizmoMode = useWeaponTuner((s) => s.gizmoMode);
  const gizmoHand = useWeaponTuner((s) => s.gizmoHand);
  const setDragging = useWeaponTuner((s) => s.setDragging);
  const phase = useGame((s) => s.phase);
  const selectedCharacter = useGame((s) => s.selectedCharacter);
  const setOffset = useGame((s) => s.setSelectedCharacterWeaponOffset);

  const [target, setTarget] = useState<THREE.Object3D | null>(null);
  const tcRef = useRef<TransformControlsImpl | null>(null);

  // Re-find the weapon group whenever the gizmo mode/hand toggles or the
  // equipped weapon changes (Player.tsx recreates the group on offset commit).
  useEffect(() => {
    if (!gizmoMode || (phase !== "playing" && phase !== "paused")) {
      setTarget(null);
      return;
    }
    let cancelled = false;
    const tryFind = (attempt: number) => {
      if (cancelled) return;
      const bone = gizmoHand === "right" ? playerHandBones.right : playerHandBones.left;
      const grp = findWeaponGroup(bone);
      if (grp) {
        setTarget(grp);
        return;
      }
      if (attempt < 20) {
        setTimeout(() => tryFind(attempt + 1), 100);
      } else {
        setTarget(null);
      }
    };
    tryFind(0);
    return () => {
      cancelled = true;
    };
  }, [
    gizmoMode,
    gizmoHand,
    phase,
    selectedCharacter.weaponRight,
    selectedCharacter.weaponLeft,
    selectedCharacter.weaponModelRight,
    selectedCharacter.weaponModelLeft,
    selectedCharacter.weaponOffset,
  ]);

  const commitFromTarget = () => {
    if (!target) return;
    const ud = getWeaponBaseUserData(target);
    if (!ud) return;
    const p = target.position;
    const r = target.rotation;
    const s = target.scale;
    const userPos: [number, number, number] = [
      p.x - ud.basePos[0],
      p.y - ud.basePos[1],
      p.z - ud.basePos[2],
    ];
    const userRot: [number, number, number] = [
      r.x - ud.baseRot[0],
      r.y - ud.baseRot[1],
      r.z - ud.baseRot[2],
    ];
    const inv = ud.boneInv > 1e-4 ? 1 / ud.boneInv : 1;
    const userScale: [number, number, number] = [s.x * inv, s.y * inv, s.z * inv];

    const cur = useGame.getState().selectedCharacter.weaponOffset ?? { ...DEFAULT_WEAPON_OFFSET };
    const next = {
      rightPos: cur.rightPos,
      rightRot: cur.rightRot,
      rightScale: cur.rightScale,
      leftPos: cur.leftPos,
      leftRot: cur.leftRot,
      leftScale: cur.leftScale,
    };
    if (ud.hand === "right") {
      next.rightPos = userPos;
      next.rightRot = userRot;
      next.rightScale = userScale;
    } else {
      next.leftPos = userPos;
      next.leftRot = userRot;
      next.leftScale = userScale;
    }
    setOffset(next);
  };

  // Wire up the dragging-changed listener so we suppress player input while
  // the gizmo is being dragged.
  useEffect(() => {
    const tc = tcRef.current;
    if (!tc || !target) return;
    const handler = (e: { value: boolean }) => {
      setDragging(e.value);
      if (!e.value) commitFromTarget();
    };
    type DraggingDispatcher = {
      addEventListener: (type: "dragging-changed", listener: (e: { value: boolean }) => void) => void;
      removeEventListener: (type: "dragging-changed", listener: (e: { value: boolean }) => void) => void;
    };
    const dispatcher = tc as unknown as DraggingDispatcher;
    dispatcher.addEventListener("dragging-changed", handler);
    return () => {
      dispatcher.removeEventListener("dragging-changed", handler);
      setDragging(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, setDragging]);

  if (!gizmoMode || !target) return null;

  return (
    <TransformControls
      ref={tcRef}
      object={target}
      mode={gizmoMode}
      size={0.6}
      space="local"
      onObjectChange={commitFromTarget}
    />
  );
}
