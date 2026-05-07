import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useEquipment } from "@/lib/stores/useEquipment";
import { useGame } from "@/lib/stores/useGame";
import {
  WORLD_SIZE,
  editTerrainBrush,
  getTerrainHeight,
  type BrushMode,
} from "./TerrainHeightField";
import { TERRAIN_MESH_NAME } from "./Terrain";

// Shovel-driven heightfield editor.
//
// Activation: equip an item with `weaponType: "shovel"` in `mainHand`.
// Controls (only while a shovel is equipped):
//   • LMB drag             — raise terrain under brush
//   • Shift + LMB drag     — lower terrain
//   • F (hold while LMB)   — flatten to the height the brush is hovering
//   • G (hold while LMB)   — smooth (3x3 average)
//   • Mouse wheel          — adjust brush radius (1m..15m)
//   • [ / ]                — adjust brush strength
//
// We deliberately don't grab pointer-down events through React's three-
// fiber pointer system — those only fire when the pointer is over a mesh
// that has its own onPointerDown handler. Native window listeners give us
// reliable input no matter what's painted on top of the terrain.

const MIN_RADIUS = 1.0;
const MAX_RADIUS = 15.0;
const DEFAULT_RADIUS = 4.5;
const DEFAULT_STRENGTH = 0.18; // metres per tick at 60fps; full radius ≈ 11 m/s

interface BrushSettings {
  radius: number;
  strength: number;
}

function isShovelEquipped(): boolean {
  const main = useEquipment.getState().equipped.mainHand;
  return main?.weaponType === "shovel";
}

export default function TerrainEditor() {
  const mainHand = useEquipment(s => s.equipped.mainHand);
  const phase = useGame(s => s.phase);
  const interactionMode = useGame(s => s.interactionMode);
  const { camera } = useThree();

  // The editor only runs when:
  //   • The player is in the "playing" phase (not in menus / cutscenes).
  //   • A shovel is equipped.
  //   • We're not in build mode (which already owns LMB for placing).
  const active =
    phase === "playing" &&
    mainHand?.weaponType === "shovel" &&
    interactionMode !== "build";

  const settings = useRef<BrushSettings>({
    radius: DEFAULT_RADIUS,
    strength: DEFAULT_STRENGTH,
  });
  const [, forceTick] = useState(0);

  // Input state. We track raw key/mouse rather than React state so the
  // useFrame loop can poll without re-rendering.
  const inputRef = useRef({
    leftDown: false,
    shiftDown: false,
    flattenHeld: false,
    smoothHeld: false,
    flattenAnchor: null as number | null,
  });

  useEffect(() => {
    if (!active) return;
    const onDown = (e: MouseEvent) => {
      if (e.button === 0) {
        inputRef.current.leftDown = true;
        inputRef.current.flattenAnchor = null; // capture fresh on next tick
      }
    };
    const onUp = (e: MouseEvent) => {
      if (e.button === 0) {
        inputRef.current.leftDown = false;
        inputRef.current.flattenAnchor = null;
      }
    };
    const onKey = (e: KeyboardEvent, isDown: boolean) => {
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
        inputRef.current.shiftDown = isDown;
      } else if (e.code === "KeyF") {
        inputRef.current.flattenHeld = isDown;
      } else if (e.code === "KeyG") {
        inputRef.current.smoothHeld = isDown;
      } else if (isDown) {
        if (e.code === "BracketLeft") {
          settings.current.strength = Math.max(0.02, settings.current.strength - 0.04);
          forceTick(t => t + 1);
        } else if (e.code === "BracketRight") {
          settings.current.strength = Math.min(0.6, settings.current.strength + 0.04);
          forceTick(t => t + 1);
        }
      }
    };
    const onKeyDown = (e: KeyboardEvent) => onKey(e, true);
    const onKeyUp = (e: KeyboardEvent) => onKey(e, false);
    const onWheel = (e: WheelEvent) => {
      // Shovel radius scroll only takes over the wheel when shift is also
      // held; bare scroll keeps its normal camera-zoom behaviour.
      if (!e.shiftKey) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.5 : 0.5;
      settings.current.radius = Math.min(
        MAX_RADIUS,
        Math.max(MIN_RADIUS, settings.current.radius + delta),
      );
      forceTick(t => t + 1);
    };
    const onContext = (e: MouseEvent) => {
      // Right-click is reserved by other systems; just don't let the
      // browser context menu pop up while a shovel is out.
      e.preventDefault();
    };

    window.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("contextmenu", onContext);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("contextmenu", onContext);
      // Reset input state so equipping the shovel again starts clean.
      inputRef.current.leftDown = false;
      inputRef.current.shiftDown = false;
      inputRef.current.flattenHeld = false;
      inputRef.current.smoothHeld = false;
      inputRef.current.flattenAnchor = null;
    };
  }, [active]);

  // Ray + terrain-mesh intersection. We prefer raycasting the actual
  // editable mesh (architect callout) so the cursor lands where the
  // player visually points even on tall hills/cliffs. We keep a y=0
  // plane raycast as a fallback for the rare frame where the mesh
  // isn't yet in the scene graph (e.g. first paint).
  const rayRef = useRef(new THREE.Raycaster());
  const planeRef = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const cursorRef = useRef(new THREE.Vector3());
  const cursorValid = useRef(false);
  const { scene } = useThree();
  const terrainMeshRef = useRef<THREE.Mesh | null>(null);

  useFrame(({ mouse }) => {
    if (!active) {
      cursorValid.current = false;
      return;
    }
    rayRef.current.setFromCamera(mouse, camera);

    // Resolve the terrain mesh lazily — `scene.getObjectByName` is O(n)
    // but the result is cached for the lifetime of the editor. The
    // mesh ref is invalidated on Terrain remounts via the userData
    // sentinel check below.
    let terrainMesh = terrainMeshRef.current;
    if (!terrainMesh || !terrainMesh.userData?.terrainEditable) {
      terrainMesh = (scene.getObjectByName(TERRAIN_MESH_NAME) as THREE.Mesh | undefined) ?? null;
      terrainMeshRef.current = terrainMesh;
    }

    let hitPoint: THREE.Vector3 | null = null;
    if (terrainMesh) {
      const hits = rayRef.current.intersectObject(terrainMesh, false);
      if (hits.length > 0) hitPoint = hits[0].point;
    }
    if (!hitPoint) {
      // Fallback: raycast the ground plane. Inaccurate on slopes but
      // better than nothing on the first frame.
      const fallback = rayRef.current.ray.intersectPlane(planeRef.current, cursorRef.current);
      if (!fallback) {
        cursorValid.current = false;
        return;
      }
      cursorRef.current.y = getTerrainHeight(cursorRef.current.x, cursorRef.current.z) + 0.05;
    } else {
      cursorRef.current.copy(hitPoint);
      // Lift slightly so the brush ring decal doesn't z-fight the terrain.
      cursorRef.current.y += 0.05;
    }
    cursorValid.current = true;

    // Bail out if the cursor is outside the heightfield — happens when
    // the player aims at the sky or off the edge of the world.
    const half = WORLD_SIZE * 0.5;
    if (
      cursorRef.current.x < -half ||
      cursorRef.current.x > half ||
      cursorRef.current.z < -half ||
      cursorRef.current.z > half
    ) {
      cursorValid.current = false;
      return;
    }

    if (!inputRef.current.leftDown) return;

    let mode: BrushMode = "raise";
    let targetY: number | undefined;
    if (inputRef.current.smoothHeld) {
      mode = "smooth";
    } else if (inputRef.current.flattenHeld) {
      mode = "flatten";
      // Anchor the flatten target the moment LMB went down so dragging
      // levels a slope to the start point instead of chasing the cursor.
      if (inputRef.current.flattenAnchor === null) {
        inputRef.current.flattenAnchor = cursorRef.current.y - 0.05;
      }
      targetY = inputRef.current.flattenAnchor;
    } else if (inputRef.current.shiftDown) {
      mode = "lower";
    } else {
      mode = "raise";
    }

    editTerrainBrush({
      worldX: cursorRef.current.x,
      worldZ: cursorRef.current.z,
      radius: settings.current.radius,
      mode,
      strength: mode === "flatten" || mode === "smooth"
        ? Math.min(1, settings.current.strength * 1.6) // these are 0..1 lerps
        : settings.current.strength,
      targetY,
    });
  });

  // Brush ring decal — a thin disc above the terrain that pulses gently
  // when the brush is firing. Cheaper than threading a ring uniform
  // through the terrain shader (which we already do in
  // `SandTerrainMaterial`); this overlay is the player-facing affordance.
  const ringRef = useRef<THREE.Mesh>(null);
  const ringMat = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: "#ffd470",
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
    });
  }, []);

  useFrame((_, dt) => {
    if (!ringRef.current) return;
    if (!active || !cursorValid.current) {
      ringRef.current.visible = false;
      return;
    }
    ringRef.current.visible = true;
    const r = settings.current.radius;
    ringRef.current.position.set(
      cursorRef.current.x,
      cursorRef.current.y + 0.02,
      cursorRef.current.z,
    );
    ringRef.current.scale.set(r, r, r);

    // Tint by mode and pulse when active.
    let target = "#ffd470";
    if (inputRef.current.smoothHeld) target = "#9bd0ff";
    else if (inputRef.current.flattenHeld) target = "#bdf0a0";
    else if (inputRef.current.shiftDown) target = "#ff8a6a";
    (ringMat.color as THREE.Color).set(target);
    const pulse = inputRef.current.leftDown
      ? 0.85 + 0.15 * Math.sin(performance.now() * 0.015)
      : 0.55;
    ringMat.opacity = pulse;
    void dt;
  });

  if (!active) return null;
  return (
    <>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} renderOrder={999}>
        <ringGeometry args={[0.92, 1.0, 64]} />
        <primitive object={ringMat} attach="material" />
      </mesh>
      <ShovelHud
        radius={settings.current.radius}
        strength={settings.current.strength}
      />
    </>
  );
}

function ShovelHud({ radius, strength }: { radius: number; strength: number }) {
  // Tiny status pill shown as a billboard above the cursor's brush. Kept
  // inside the canvas with the rest of the editor so it auto-hides when
  // the shovel is unequipped.
  return null;
  // Intentionally returning null — full HUD lives in DOM space (see
  // `ShovelHudOverlay` below); the in-canvas billboard variant was
  // distracting during testing. Keeping the parameter list so a future
  // pass can opt back into a 3D label without changing the JSX shape.
  void radius; void strength;
}

/**
 * DOM overlay that shows brush radius / strength / mode. Sits next to the
 * action bar so the player can read it without breaking eye contact with
 * the cursor. Mounted by `GameScene` outside the Canvas.
 */
export function ShovelHudOverlay() {
  const mainHand = useEquipment(s => s.equipped.mainHand);
  const interactionMode = useGame(s => s.interactionMode);
  const phase = useGame(s => s.phase);
  if (
    phase !== "playing" ||
    mainHand?.weaponType !== "shovel" ||
    interactionMode === "build"
  ) {
    return null;
  }
  return (
    <div
      style={{
        position: "fixed",
        right: 16,
        bottom: 120,
        background: "rgba(20, 16, 10, 0.78)",
        border: "1px solid #d6b876",
        borderRadius: 8,
        color: "#f5e8c8",
        fontFamily: "system-ui, sans-serif",
        fontSize: 12,
        padding: "10px 14px",
        lineHeight: 1.5,
        pointerEvents: "none",
        zIndex: 50,
        maxWidth: 220,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 4, color: "#ffd470" }}>Shovel</div>
      <div>LMB — raise · Shift+LMB — lower</div>
      <div>F — flatten · G — smooth</div>
      <div>Shift+wheel — radius · [ / ] — power</div>
    </div>
  );
}

// Exported for tests / debug consoles.
export const _internal = { isShovelEquipped };
