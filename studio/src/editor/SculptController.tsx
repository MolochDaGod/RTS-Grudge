/**
 * Listens for pointer events on the terrain (forwarded by TerrainMesh)
 * and applies the active sculpt/paint brush. Also draws a translucent
 * brush ring at the cursor so the user sees the radius.
 */
import { useEffect, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useEditor } from './store';
import { TerrainMesh } from './TerrainMesh';
import { applyBrush, type PaintBiome, type SculptOp } from './terrain-utils';
import type { EditorTool } from '../types';

function toolToOp(t: EditorTool): SculptOp | { paint: PaintBiome } | null {
  switch (t) {
    case 'sculpt_raise':  return 'raise';
    case 'sculpt_lower':  return 'lower';
    case 'sculpt_smooth': return 'smooth';
    case 'paint_grass':   return { paint: 0 };
    case 'paint_sand':    return { paint: 1 };
    case 'paint_rock':    return { paint: 2 };
    case 'paint_snow':    return { paint: 3 };
    default:              return null;
  }
}

export function SculptController() {
  const tool         = useEditor((s) => s.tool);
  const radius       = useEditor((s) => s.brushRadius);
  const strength     = useEditor((s) => s.brushStrength);
  const project      = useEditor((s) => s.project);
  const bumpTerrain  = useEditor((s) => s.bumpTerrain);

  const draggingRef = useRef(false);
  const [cursor, setCursor] = useState<THREE.Vector3 | null>(null);
  const { gl } = useThree();

  useEffect(() => {
    const onUp = () => { draggingRef.current = false; };
    window.addEventListener('pointerup', onUp);
    return () => window.removeEventListener('pointerup', onUp);
  }, []);

  const onPointerEvent = (e: { point: THREE.Vector3; nativeEvent: PointerEvent }, type: 'down' | 'move' | 'up') => {
    const op = toolToOp(tool);
    setCursor(e.point.clone());
    if (!op) return;
    if (type === 'down') {
      draggingRef.current = true;
      // Capture pointer so we keep getting moves even if cursor leaves the mesh
      gl.domElement.setPointerCapture?.(e.nativeEvent.pointerId);
    }
    if (type === 'up') draggingRef.current = false;
    if (!draggingRef.current) return;

    const stride = typeof op === 'object' ? 1 : strength;
    const changed = applyBrush(project.terrain, e.point.x, e.point.z, radius, stride, op);
    if (changed) bumpTerrain();
  };

  const showCursor = !!toolToOp(tool) && cursor;

  return (
    <>
      <TerrainMesh onPointerEvent={onPointerEvent as never} />
      {showCursor && (
        <mesh position={[cursor!.x, cursor!.y + 0.05, cursor!.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[radius - 0.4, radius, 64]} />
          <meshBasicMaterial color="#ffd24d" transparent opacity={0.55} />
        </mesh>
      )}
    </>
  );
}
