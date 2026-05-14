import { useEffect, useMemo, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useSceneInspector } from "@/lib/stores/useSceneInspector";

/**
 * Selection highlight overlay.
 *
 * When an object is selected in the Scene Inspector, draws a yellow
 * box helper around its world bounding box. The helper follows the
 * object every frame (cheap — single box update) so moving objects
 * stay highlighted.
 *
 * Lives inside the R3F scene tree (mounted by `GameScene`) so it has
 * access to `useThree`. Returns null when nothing selected or panel
 * closed.
 */
export function SelectionHighlight() {
  const { scene } = useThree();
  const visible = useSceneInspector((s) => s.visible);
  const selectedUuid = useSceneInspector((s) => s.selectedUuid);

  const helperRef = useRef<THREE.Box3Helper | null>(null);
  const groupRef = useRef<THREE.Group>(null);
  const box = useMemo(() => new THREE.Box3(), []);

  useEffect(() => {
    if (!groupRef.current) return;
    // Clear any prior helper
    if (helperRef.current) {
      groupRef.current.remove(helperRef.current);
      helperRef.current.dispose?.();
      helperRef.current = null;
    }
    if (!visible || !selectedUuid) return;
    const helper = new THREE.Box3Helper(box, new THREE.Color("#ffeb3b"));
    (helper.material as THREE.LineBasicMaterial).depthTest = false;
    (helper.material as THREE.LineBasicMaterial).transparent = true;
    helper.renderOrder = 9999;
    helperRef.current = helper;
    groupRef.current.add(helper);
  }, [visible, selectedUuid, box]);

  useFrame(() => {
    if (!visible || !selectedUuid || !helperRef.current) return;
    const target = scene.getObjectByProperty("uuid", selectedUuid);
    if (!target) {
      box.makeEmpty();
      return;
    }
    try {
      box.setFromObject(target);
    } catch {
      box.makeEmpty();
    }
    // Box3Helper derives its visual box from `box` inside its
    // `updateMatrixWorld` override (Three.js source). When the box
    // mutates we must force the helper to re-derive — otherwise it
    // stays anchored to whatever the box was on the frame the helper
    // was constructed.
    helperRef.current.updateMatrixWorld(true);
  });

  return <group ref={groupRef} />;
}
