/**
 * Third-person Player runtime — input + locomotion + camera follow.
 *
 * Control scheme:
 *   W / S / A / D  → move (camera-relative) / climb up-down / shimmy
 *   Shift          → sprint (land only)
 *   Space          → swim up · climb up · mount steep wall
 *   Alt            → dive · climb down · drop off wall
 *   RMB + drag     → orbit camera
 *   Wheel          → shoulder distance
 *
 * Water (SEA_LEVEL = 0): free Y between seafloor and surface.
 * Climb: free Y on steep terrain faces; stick to heightfield gradient.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useEditor } from '../editor/store';
import { sampleHeight } from '../editor/terrain-utils';
import {
  FLOOR_CLEARANCE,
  SEA_LEVEL,
  SURFACE_MARGIN,
} from '../editor/IslandGenerator';
import { getPlayerCharacterSpec } from '../library/PlayerCharacterRegistry';
import { PlayerCharacter } from './PlayerCharacter';
import type { LocomotionState } from '../editor/store';
import type { TerrainData } from '../types';

// ── Water tunables ────────────────────────────────────────────────────
const SWIM_DEPTH = 0.75;
const SWIM_SPEED = 2.2;
const SWIM_VERT_SPEED = 2.6;
const SURFACE_BUOYANCY = 1.8;
const EDGE_FLOOR_Y = SEA_LEVEL - 1.15;

// ── Climb tunables ────────────────────────────────────────────────────
/** Min |∇h| (rise per metre) to count as a climbable face (~42°+). */
const CLIMB_GRAD_MIN = 0.9;
/** Vertical climb speed (m/s). */
const CLIMB_VERT_SPEED = 1.7;
/** Lateral shimmy speed (m/s). */
const CLIMB_SHIMMY_SPEED = 1.3;
/** Stick force toward wall (m/s). */
const CLIMB_STICK = 1.1;
/** How close climb Y must be to ledge floor for topout. */
const TOPOUT_CLEARANCE = 0.55;
/** Drop-off when Alt held near ground while climbing. */
const DROP_FLOOR_SLACK = 0.85;

interface ClimbProbe {
  /** True when local heightfield is steep enough. */
  steep: boolean;
  /** Outward wall normal in XZ (points from high ground toward low). */
  nx: number;
  nz: number;
  /** Gradient magnitude. */
  mag: number;
  /** Terrain height under the probe point. */
  floorY: number;
}

/** Central difference height gradient → climbability + wall normal. */
function probeClimb(
  px: number,
  pz: number,
  terrain: TerrainData,
  eps = 0.35,
): ClimbProbe {
  const hL = sampleHeight(px - eps, pz, terrain);
  const hR = sampleHeight(px + eps, pz, terrain);
  const hD = sampleHeight(px, pz - eps, terrain);
  const hU = sampleHeight(px, pz + eps, terrain);
  const hx = (hR - hL) / (2 * eps);
  const hz = (hU - hD) / (2 * eps);
  const mag = Math.hypot(hx, hz);
  // Outward normal = downhill direction (away from high ground)
  let nx = 0, nz = 0;
  if (mag > 1e-4) {
    nx = -hx / mag;
    nz = -hz / mag;
  }
  return {
    steep: mag >= CLIMB_GRAD_MIN,
    nx, nz, mag,
    floorY: sampleHeight(px, pz, terrain),
  };
}

interface PlayerXform {
  pos: THREE.Vector3;
  yaw: number;
  cameraYaw: number;
  cameraPitch: number;
  shoulder: number;
  loco: LocomotionState;
  sprinting: boolean;
  vy: number;
  inWater: boolean;
  climbing: boolean;
  /** Wall outward normal while climbing. */
  wallNx: number;
  wallNz: number;
  /** Brief topout timer so the pull-up clip can finish. */
  topoutT: number;
}

interface InputState {
  forward: number;
  strafe: number;
  shift: boolean;
  space: boolean;
  alt: boolean;
  mouseDX: number;
  mouseDY: number;
  wheelDelta: number;
  rmbDown: boolean;
}

function makeInputState(): InputState {
  return {
    forward: 0, strafe: 0, shift: false,
    space: false, alt: false,
    mouseDX: 0, mouseDY: 0, wheelDelta: 0, rmbDown: false,
  };
}

function bindKeyboard(input: InputState): () => void {
  const onKey = (e: KeyboardEvent, down: boolean) => {
    const code = e.code;
    if (code === 'KeyW' || code === 'ArrowUp') {
      input.forward = down ? 1 : (input.forward > 0 ? 0 : input.forward);
    } else if (code === 'KeyS' || code === 'ArrowDown') {
      input.forward = down ? -1 : (input.forward < 0 ? 0 : input.forward);
    } else if (code === 'KeyA' || code === 'ArrowLeft') {
      input.strafe = down ? -1 : (input.strafe < 0 ? 0 : input.strafe);
    } else if (code === 'KeyD' || code === 'ArrowRight') {
      input.strafe = down ? 1 : (input.strafe > 0 ? 0 : input.strafe);
    } else if (code === 'ShiftLeft' || code === 'ShiftRight') {
      input.shift = down;
    } else if (code === 'Space') {
      input.space = down;
      if (down) e.preventDefault();
    } else if (code === 'AltLeft' || code === 'AltRight') {
      input.alt = down;
      if (down) e.preventDefault();
    }
  };
  const onDown = (e: KeyboardEvent) => onKey(e, true);
  const onUp   = (e: KeyboardEvent) => onKey(e, false);
  window.addEventListener('keydown', onDown, { capture: true });
  window.addEventListener('keyup',   onUp,   { capture: true });
  const onAltMenu = (e: KeyboardEvent) => {
    if (e.key === 'Alt') e.preventDefault();
  };
  window.addEventListener('keyup', onAltMenu);
  return () => {
    window.removeEventListener('keydown', onDown, { capture: true } as EventListenerOptions);
    window.removeEventListener('keyup',   onUp,   { capture: true } as EventListenerOptions);
    window.removeEventListener('keyup', onAltMenu);
  };
}

function bindMouse(canvas: HTMLCanvasElement, input: InputState): () => void {
  const onContext = (e: MouseEvent) => e.preventDefault();
  const onDown = (e: MouseEvent) => {
    if (e.button === 2) {
      input.rmbDown = true;
      canvas.requestPointerLock?.();
    }
  };
  const onUp = (e: MouseEvent) => {
    if (e.button === 2) {
      input.rmbDown = false;
      if (document.pointerLockElement === canvas) document.exitPointerLock?.();
    }
  };
  const onMove = (e: MouseEvent) => {
    if (!input.rmbDown) return;
    input.mouseDX += e.movementX;
    input.mouseDY += e.movementY;
  };
  const onWheel = (e: WheelEvent) => {
    input.wheelDelta += e.deltaY;
    e.preventDefault();
  };
  canvas.addEventListener('contextmenu', onContext);
  canvas.addEventListener('mousedown', onDown);
  window.addEventListener('mouseup', onUp);
  window.addEventListener('mousemove', onMove);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  return () => {
    canvas.removeEventListener('contextmenu', onContext);
    canvas.removeEventListener('mousedown', onDown);
    window.removeEventListener('mouseup', onUp);
    window.removeEventListener('mousemove', onMove);
    canvas.removeEventListener('wheel', onWheel);
  };
}

function findSpawnPoint(): { x: number; y: number; z: number; yaw: number } | null {
  const { project } = useEditor.getState();
  const sp = project.entities.find((e) => e.kind === 'spawn_point');
  if (!sp) return null;
  return {
    x: sp.position[0],
    y: sp.position[1],
    z: sp.position[2],
    yaw: sp.rotation[1] ?? 0,
  };
}

const STORE_PUSH_INTERVAL = 1 / 30;

export function Player() {
  const playMode = useEditor((s) => s.playMode);
  const characterId = useEditor((s) => s.playerCharacterId);
  const setPlayerTransform  = useEditor((s) => s.setPlayerTransform);
  const setPlayerLocomotion = useEditor((s) => s.setPlayerLocomotion);
  const terrain = useEditor((s) => s.project.terrain);
  const { camera, gl } = useThree();

  const xformRef = useRef<PlayerXform | null>(null);
  const inputRef = useRef<InputState>(makeInputState());
  const groupRef = useRef<THREE.Group>(null);
  const storePushAccum = useRef(0);

  const spec = useMemo(() => getPlayerCharacterSpec(characterId), [characterId]);

  useEffect(() => {
    if (!playMode || !spec) {
      xformRef.current = null;
      return;
    }
    const sp = findSpawnPoint();
    const x = sp?.x ?? 0;
    const z = sp?.z ?? 0;
    const y = sampleHeight(x, z, terrain);
    xformRef.current = {
      pos: new THREE.Vector3(x, y, z),
      yaw: sp?.yaw ?? 0,
      cameraYaw: sp?.yaw ?? 0,
      cameraPitch: -0.25,
      shoulder: 4.5,
      loco: 'idle',
      sprinting: false,
      vy: 0,
      inWater: false,
      climbing: false,
      wallNx: 0,
      wallNz: 1,
      topoutT: 0,
    };
    setPlayerTransform([x, y, z], xformRef.current.yaw);
    setPlayerLocomotion('idle', false);
  }, [playMode, spec, terrain, setPlayerTransform, setPlayerLocomotion]);

  useEffect(() => {
    if (!playMode) return;
    const offKB = bindKeyboard(inputRef.current);
    const offM  = bindMouse(gl.domElement, inputRef.current);
    return () => { offKB(); offM(); };
  }, [playMode, gl.domElement]);

  useFrame((_, dt) => {
    if (!playMode || !xformRef.current || !spec) return;
    const x = xformRef.current;
    const input = inputRef.current;
    const dts = Math.min(dt, 0.05);

    // Camera orbit
    x.cameraYaw   -= input.mouseDX * 0.0028;
    x.cameraPitch -= input.mouseDY * 0.0022;
    x.cameraPitch = Math.max(-1.2, Math.min(0.6, x.cameraPitch));
    input.mouseDX = input.mouseDY = 0;
    x.shoulder = Math.max(2.0, Math.min(10.0, x.shoulder + input.wheelDelta * 0.005));
    input.wheelDelta = 0;

    const fwd  = new THREE.Vector3(-Math.sin(x.cameraYaw), 0, -Math.cos(x.cameraYaw));
    const right= new THREE.Vector3(Math.cos(x.cameraYaw), 0, -Math.sin(x.cameraYaw));
    const wishDir = new THREE.Vector3()
      .addScaledVector(fwd,  input.forward)
      .addScaledVector(right, input.strafe);
    const moving = wishDir.lengthSq() > 1e-4;
    if (moving) wishDir.normalize();

    const floorY = sampleHeight(x.pos.x, x.pos.z, terrain);
    const waterDepth = SEA_LEVEL - floorY;
    const canSwim = waterDepth > SWIM_DEPTH;

    // Face direction from avatar yaw (for climb mount checks)
    const faceX = Math.sin(x.yaw);
    const faceZ = Math.cos(x.yaw);

    let newLoco: LocomotionState;
    let sprinting = false;

    // ── TOPOUT hold (finish pull-up clip) ──────────────────────────────
    if (x.topoutT > 0) {
      x.topoutT -= dts;
      newLoco = 'climb_topout';
      // Lerp onto the ledge floor
      const ledge = sampleHeight(x.pos.x, x.pos.z, terrain);
      x.pos.y += (ledge - x.pos.y) * Math.min(1, dts * 6);
      if (x.topoutT <= 0) {
        x.climbing = false;
        x.pos.y = ledge;
        x.vy = 0;
      }
    }
    // ── CLIMBING ──────────────────────────────────────────────────────
    else if (x.climbing) {
      // Refresh wall probe under / slightly into the face
      const intoX = x.pos.x - x.wallNx * 0.25;
      const intoZ = x.pos.z - x.wallNz * 0.25;
      const probe = probeClimb(intoX, intoZ, terrain);
      if (probe.steep) {
        x.wallNx = probe.nx;
        x.wallNz = probe.nz;
      }

      // Vertical input: Space / W = up, Alt / S = down
      let vVert = 0;
      if (input.space || input.forward > 0.3) vVert += 1;
      if (input.alt   || input.forward < -0.3) vVert -= 1;

      // Lateral A/D along wall tangent (perp to outward normal in XZ)
      const tX = -x.wallNz;
      const tZ =  x.wallNx;
      // Camera-relative: press A/D, project camera-right onto wall tangent
      let vLat = 0;
      if (Math.abs(input.strafe) > 0.12) {
        const camOnTangent = right.x * tX + right.z * tZ;
        // Prefer camera-aligned direction; fall back to raw strafe sign
        vLat = (Math.abs(camOnTangent) > 0.15 ? Math.sign(camOnTangent) : 1)
          * input.strafe;
      }

      x.pos.y += vVert * CLIMB_VERT_SPEED * dts;
      x.pos.x += tX * vLat * CLIMB_SHIMMY_SPEED * dts;
      x.pos.z += tZ * vLat * CLIMB_SHIMMY_SPEED * dts;
      // Stick into wall (move opposite outward normal = into high ground)
      x.pos.x -= x.wallNx * CLIMB_STICK * dts;
      x.pos.z -= x.wallNz * CLIMB_STICK * dts;

      const floorNow = sampleHeight(x.pos.x, x.pos.z, terrain);
      // Don't sink below floor
      if (x.pos.y < floorNow + 0.15) x.pos.y = floorNow + 0.15;

      // Face the wall (look into the face = opposite outward normal)
      const wallYaw = Math.atan2(-x.wallNx, -x.wallNz);
      x.yaw = lerpAngle(x.yaw, wallYaw, Math.min(1, dts * 10));

      // Topout: ledge under us is near our climb height and we're going up
      const atLedge = x.pos.y <= floorNow + TOPOUT_CLEARANCE
        && x.pos.y >= floorNow - 0.1
        && probe.mag < CLIMB_GRAD_MIN * 0.85;
      const wantUp = vVert > 0;
      // Also: sample a bit further "over" the wall (into high ground)
      const overX = x.pos.x - x.wallNx * 0.7;
      const overZ = x.pos.z - x.wallNz * 0.7;
      const overFloor = sampleHeight(overX, overZ, terrain);
      const canTopout = wantUp && (
        atLedge
        || (overFloor > x.pos.y - 0.35 && overFloor < x.pos.y + 0.9 && probe.mag < CLIMB_GRAD_MIN * 1.2)
      );

      if (canTopout && overFloor > floorNow - 0.5) {
        // Pull onto the ledge
        x.pos.x = overX;
        x.pos.z = overZ;
        x.pos.y = overFloor;
        x.topoutT = 0.55;
        x.climbing = false;
        newLoco = 'climb_topout';
      } else if (!probe.steep && x.pos.y <= floorNow + DROP_FLOOR_SLACK) {
        // Lost the wall near ground → stand
        x.climbing = false;
        x.pos.y = floorNow;
        newLoco = 'idle';
      } else if (input.alt && x.pos.y <= floorNow + DROP_FLOOR_SLACK) {
        // Drop off at bottom
        x.climbing = false;
        x.pos.y = floorNow;
        newLoco = 'idle';
      } else if (Math.abs(vLat) > 0.25 && Math.abs(vVert) < 0.25) {
        newLoco = 'climb_shimmy';
      } else if (vVert < -0.15) {
        newLoco = 'climb_down';
      } else if (vVert > 0.15) {
        newLoco = 'climb';
      } else {
        newLoco = 'climb_idle';
      }

      // Don't swim while climbing
      x.inWater = false;
      x.vy = 0;
    }
    // ── WATER ─────────────────────────────────────────────────────────
    else if (x.inWater || canSwim) {
      if (canSwim) x.inWater = true;
      if (x.inWater && floorY >= SEA_LEVEL - 0.15 && !input.space) {
        x.inWater = false;
        x.vy = 0;
        x.pos.y = floorY;
      }

      if (x.inWater) {
        const speed = SWIM_SPEED * (input.shift ? 1.35 : 1);
        x.pos.x += wishDir.x * speed * dts;
        x.pos.z += wishDir.z * speed * dts;

        const floorNow = sampleHeight(x.pos.x, x.pos.z, terrain);
        const lo = floorNow + FLOOR_CLEARANCE;
        const hi = SEA_LEVEL - SURFACE_MARGIN;

        if (input.space && !input.alt) x.vy = SWIM_VERT_SPEED;
        else if (input.alt && !input.space) x.vy = -SWIM_VERT_SPEED;
        else {
          const surfaceY = SEA_LEVEL - 0.35;
          x.vy += (surfaceY - x.pos.y) * SURFACE_BUOYANCY * dts;
          x.vy *= 0.92;
        }

        x.pos.y += x.vy * dts;
        if (x.pos.y < lo) { x.pos.y = lo; x.vy = Math.max(0, x.vy); }
        if (x.pos.y > hi) { x.pos.y = hi; x.vy = Math.min(0, x.vy); }

        let nearEdge = floorNow > EDGE_FLOOR_Y;
        if (moving) {
          const ax = x.pos.x + wishDir.x * 1.8;
          const az = x.pos.z + wishDir.z * 1.8;
          const floorAhead = sampleHeight(ax, az, terrain);
          if (floorAhead > EDGE_FLOOR_Y || floorAhead > floorNow + 0.4) nearEdge = true;
          if (floorAhead >= SEA_LEVEL - 0.2) {
            x.inWater = false;
            x.vy = 0;
            x.pos.y = Math.max(floorAhead, SEA_LEVEL - 0.05);
          }
        }

        const diving = input.alt && x.pos.y < SEA_LEVEL - 0.8;
        const ascending = input.space && x.pos.y < SEA_LEVEL - 0.5;

        if (nearEdge && moving && x.inWater) newLoco = 'swim_to_edge';
        else if (moving || diving || ascending) newLoco = 'swim';
        else newLoco = 'tread';

        if (moving) {
          x.yaw = lerpAngle(x.yaw, Math.atan2(wishDir.x, wishDir.z), Math.min(1, dts * 10));
        } else {
          x.yaw = lerpAngle(x.yaw, x.cameraYaw, Math.min(1, dts * 5));
        }
      } else {
        // just exited water this frame
        newLoco = 'idle';
      }
    }
    // ── LAND ──────────────────────────────────────────────────────────
    else {
      x.vy = 0;
      sprinting = input.shift && moving;
      const baseSpeed = sprinting ? spec.runSpeed : moving ? spec.walkSpeed : 0;
      x.pos.x += wishDir.x * baseSpeed * dts;
      x.pos.z += wishDir.z * baseSpeed * dts;
      x.pos.y = sampleHeight(x.pos.x, x.pos.z, terrain);

      // Enter water
      const f2 = sampleHeight(x.pos.x, x.pos.z, terrain);
      if (SEA_LEVEL - f2 > SWIM_DEPTH) {
        x.inWater = true;
        x.pos.y = Math.min(
          SEA_LEVEL - SURFACE_MARGIN,
          Math.max(f2 + FLOOR_CLEARANCE, SEA_LEVEL - 0.5),
        );
        x.vy = 0;
        newLoco = 'tread';
      } else {
        // ── Mount climb: Space or walk into steep face ───────────────
        const probeAhead = probeClimb(
          x.pos.x + faceX * 0.55,
          x.pos.z + faceZ * 0.55,
          terrain,
        );
        const probeHere = probeClimb(x.pos.x, x.pos.z, terrain);
        const facingWall =
          probeAhead.steep
          && (faceX * -probeAhead.nx + faceZ * -probeAhead.nz) > 0.25; // looking into the wall
        const wantMount = input.space || (moving && input.forward > 0.4 && facingWall);

        if (wantMount && (probeAhead.steep || probeHere.steep)) {
          const p = probeAhead.steep ? probeAhead : probeHere;
          x.climbing = true;
          x.wallNx = p.nx;
          x.wallNz = p.nz;
          x.pos.y = Math.max(x.pos.y, p.floorY) + 0.2;
          // Nudge into the wall a hair
          x.pos.x -= p.nx * 0.15;
          x.pos.z -= p.nz * 0.15;
          newLoco = 'climb';
        } else {
          if (moving) {
            x.yaw = lerpAngle(x.yaw, Math.atan2(wishDir.x, wishDir.z), Math.min(1, dts * 12));
          } else {
            x.yaw = lerpAngle(x.yaw, x.cameraYaw, Math.min(1, dts * 6));
          }
          newLoco = !moving ? 'idle' : sprinting ? 'run' : 'walk';
        }
      }
    }

    const locoChanged   = newLoco !== x.loco;
    const sprintChanged = sprinting !== x.sprinting;
    x.loco = newLoco;
    x.sprinting = sprinting;

    if (groupRef.current) {
      groupRef.current.position.copy(x.pos);
      groupRef.current.rotation.y = x.yaw;
    }

    const eye = spec.eyeHeight;
    const offset = new THREE.Vector3(
      Math.sin(x.cameraYaw) * x.shoulder * Math.cos(x.cameraPitch),
      x.shoulder * -Math.sin(x.cameraPitch) + eye,
      Math.cos(x.cameraYaw) * x.shoulder * Math.cos(x.cameraPitch),
    );
    camera.position.set(
      x.pos.x + offset.x,
      x.pos.y + offset.y,
      x.pos.z + offset.z,
    );
    camera.lookAt(x.pos.x, x.pos.y + eye * 0.8, x.pos.z);

    storePushAccum.current += dts;
    if (storePushAccum.current >= STORE_PUSH_INTERVAL || locoChanged || sprintChanged) {
      storePushAccum.current = 0;
      setPlayerTransform([x.pos.x, x.pos.y, x.pos.z], x.yaw);
      if (locoChanged || sprintChanged) {
        setPlayerLocomotion(newLoco, sprinting);
      }
    }
  });

  if (!playMode || !spec) return null;

  return (
    <group ref={groupRef}>
      <PlayerLocoBridge />
    </group>
  );
}

function PlayerLocoBridge() {
  const characterId = useEditor((s) => s.playerCharacterId);
  const loco = useEditor((s) => s.player.locomotion);
  return <PlayerCharacter characterId={characterId} state={loco} />;
}

function lerpAngle(from: number, to: number, t: number): number {
  const d = ((to - from + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return from + d * t;
}
