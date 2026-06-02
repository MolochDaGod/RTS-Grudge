/**
 * Third-person Player runtime — input + locomotion + camera follow.
 *
 * Three pieces in this file (kept together so they share the input & yaw
 * refs without re-publishing into the store every frame):
 *
 *   <Player />                — orchestrator. Resolves spawn, mounts the
 *                                avatar (PlayerCharacter), runs the
 *                                controller and the third-person camera.
 *   PlayerController()         — keyboard/movement system (no JSX). Updates
 *                                a shared transform ref @ frame rate and
 *                                pushes a low-frequency snapshot into the
 *                                play slice so creature AI / camera react.
 *   ThirdPersonCamera()        — orbit-around-player rig with right-mouse
 *                                yaw/pitch + scroll zoom. Feeds yaw back
 *                                to the controller via the shared ref so
 *                                W actually moves "away from the camera"
 *                                per the Fortnite-style control rule.
 *
 * Control scheme (matches the user's stated preferences):
 *   W       → forward (away from camera)
 *   S       → backward (toward camera)
 *   A / D   → strafe left / right
 *   Shift   → sprint (run)
 *   Mouse-R → drag to orbit camera
 *   Wheel   → adjust shoulder distance
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useEditor } from '../editor/store';
import { sampleHeight } from '../editor/terrain-utils';
import { getPlayerCharacterSpec } from '../library/PlayerCharacterRegistry';
import { PlayerCharacter } from './PlayerCharacter';
import type { LocomotionState } from '../editor/store';

// ── Shared mutable transform owned by Player + read by both child systems.
// Lives in a ref so we don't re-render the React tree every frame just to
// shuffle a vector. Locomotion + position get pushed into the store at a
// throttled cadence (≤30Hz) so creature AI sees a stable threat target.
interface PlayerXform {
  pos: THREE.Vector3;
  yaw: number;        // avatar yaw (matches camera yaw while moving)
  cameraYaw: number;  // camera orbit yaw (driven by mouse)
  cameraPitch: number;
  shoulder: number;   // distance from player along camera back vector
  loco: LocomotionState;
  sprinting: boolean;
}

// ── Input state — populated by global key/mouse listeners --------------

interface InputState {
  forward: number;  // -1 (S) … 0 … 1 (W)
  strafe: number;   // -1 (A) … 0 … 1 (D)
  shift: boolean;
  mouseDX: number;  // accumulated yaw delta this frame (radians/100)
  mouseDY: number;
  wheelDelta: number;
  rmbDown: boolean;
}

function makeInputState(): InputState {
  return { forward: 0, strafe: 0, shift: false, mouseDX: 0, mouseDY: 0, wheelDelta: 0, rmbDown: false };
}

function bindKeyboard(input: InputState): () => void {
  const onKey = (e: KeyboardEvent, down: boolean) => {
    const code = e.code;
    if (code === 'KeyW' || code === 'ArrowUp')   input.forward = down ? 1 : (input.forward > 0 ? 0 : input.forward);
    else if (code === 'KeyS' || code === 'ArrowDown') input.forward = down ? -1 : (input.forward < 0 ? 0 : input.forward);
    else if (code === 'KeyA' || code === 'ArrowLeft') input.strafe = down ? -1 : (input.strafe < 0 ? 0 : input.strafe);
    else if (code === 'KeyD' || code === 'ArrowRight') input.strafe = down ? 1 : (input.strafe > 0 ? 0 : input.strafe);
    else if (code === 'ShiftLeft' || code === 'ShiftRight') input.shift = down;
  };
  const onDown = (e: KeyboardEvent) => onKey(e, true);
  const onUp   = (e: KeyboardEvent) => onKey(e, false);
  window.addEventListener('keydown', onDown);
  window.addEventListener('keyup',   onUp);
  return () => {
    window.removeEventListener('keydown', onDown);
    window.removeEventListener('keyup',   onUp);
  };
}

function bindMouse(canvas: HTMLCanvasElement, input: InputState): () => void {
  const onContext = (e: MouseEvent) => e.preventDefault(); // disable RMB menu
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

// ── Spawn helpers ------------------------------------------------------

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

// ── Player composite ---------------------------------------------------

const STORE_PUSH_INTERVAL = 1 / 30; // 30Hz throttle

export function Player() {
  const playMode = useEditor((s) => s.playMode);
  const characterId = useEditor((s) => s.playerCharacterId);
  const setPlayerTransform  = useEditor((s) => s.setPlayerTransform);
  const setPlayerLocomotion = useEditor((s) => s.setPlayerLocomotion);
  const terrain = useEditor((s) => s.project.terrain);
  const { camera, gl } = useThree();

  // Shared transform + input refs, created once for the lifetime of play mode.
  const xformRef = useRef<PlayerXform | null>(null);
  const inputRef = useRef<InputState>(makeInputState());
  const groupRef = useRef<THREE.Group>(null);
  const storePushAccum = useRef(0);

  const spec = useMemo(() => getPlayerCharacterSpec(characterId), [characterId]);

  // Initialise transform on play-mode entry. We resolve the spawn from
  // `spawn_point` entity (placed by IslandGenerator on the plateau).
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
    };
    // Sync initial state into the store so creature AI starts with a real threat.
    setPlayerTransform([x, y, z], xformRef.current.yaw);
    setPlayerLocomotion('idle', false);
  }, [playMode, spec, terrain, setPlayerTransform, setPlayerLocomotion]);

  // Bind keyboard + mouse only while in play mode.
  useEffect(() => {
    if (!playMode) return;
    const offKB = bindKeyboard(inputRef.current);
    const offM  = bindMouse(gl.domElement, inputRef.current);
    return () => { offKB(); offM(); };
  }, [playMode, gl.domElement]);

  // Frame loop: input → camera yaw → movement → terrain stick → store push.
  useFrame((_, dt) => {
    if (!playMode || !xformRef.current || !spec) return;
    const x = xformRef.current;
    const input = inputRef.current;
    const dts = Math.min(dt, 0.05);

    // Camera orbit: only while RMB held — otherwise the editor's UI text
    // selection still works.
    const yawSensitivity   = 0.0028; // rad per pixel
    const pitchSensitivity = 0.0022;
    x.cameraYaw   -= input.mouseDX * yawSensitivity;
    x.cameraPitch -= input.mouseDY * pitchSensitivity;
    x.cameraPitch = Math.max(-1.2, Math.min(0.6, x.cameraPitch));
    input.mouseDX = input.mouseDY = 0;

    // Wheel adjusts shoulder distance.
    x.shoulder = Math.max(2.0, Math.min(10.0, x.shoulder + input.wheelDelta * 0.005));
    input.wheelDelta = 0;

    // Movement axes derived from camera yaw.
    const fwd  = new THREE.Vector3(-Math.sin(x.cameraYaw), 0, -Math.cos(x.cameraYaw));
    const right= new THREE.Vector3(Math.cos(x.cameraYaw), 0, -Math.sin(x.cameraYaw));
    const wishDir = new THREE.Vector3()
      .addScaledVector(fwd,  input.forward)
      .addScaledVector(right, input.strafe);
    const moving = wishDir.lengthSq() > 1e-4;
    if (moving) wishDir.normalize();

    // Speed: walk by default, run while sprinting & holding W.
    const sprinting = input.shift && moving;
    const speed = sprinting ? spec.runSpeed
                : moving    ? spec.walkSpeed
                : 0;

    // Integrate position.
    x.pos.x += wishDir.x * speed * dts;
    x.pos.z += wishDir.z * speed * dts;
    // Stick to terrain (sample at the new XZ).
    x.pos.y = sampleHeight(x.pos.x, x.pos.z, terrain);

    // Avatar yaw turns toward movement; if standing still, yaw lerps toward
    // camera yaw so the back stays facing the camera at rest.
    if (moving) {
      const wishYaw = Math.atan2(wishDir.x, wishDir.z);
      x.yaw = lerpAngle(x.yaw, wishYaw, Math.min(1, dts * 12));
    } else {
      x.yaw = lerpAngle(x.yaw, x.cameraYaw, Math.min(1, dts * 6));
    }

    // Locomotion state for the avatar's mixer.
    const newLoco: LocomotionState = !moving ? 'idle' : sprinting ? 'run' : 'walk';
    const locoChanged   = newLoco !== x.loco;
    const sprintChanged = sprinting !== x.sprinting;
    x.loco = newLoco;
    x.sprinting = sprinting;

    // Push the actual <group> transform.
    if (groupRef.current) {
      groupRef.current.position.copy(x.pos);
      groupRef.current.rotation.y = x.yaw;
    }

    // Camera follow: orbit around (player + shoulder offset).
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

    // Throttled push to the store so creature AI / outliner / debug HUD
    // get a consistent threat target without 60Hz re-renders.
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

  // PlayerLocoBridge re-renders only when locomotion changes (not the
  // parent), so the heavy <PlayerCharacter> mount + GLB cache stays warm
  // across crossfades.
  return (
    <group ref={groupRef}>
      <PlayerLocoBridge />
    </group>
  );
}

/**
 * Tiny bridge component: subscribes to `player.locomotion` so the avatar's
 * mixer crossfades when state changes, without forcing the parent
 * <Player> (which owns the input/transform refs) to re-render.
 */
function PlayerLocoBridge() {
  const characterId = useEditor((s) => s.playerCharacterId);
  const loco = useEditor((s) => s.player.locomotion);
  return <PlayerCharacter characterId={characterId} state={loco} />;
}

/** Shortest-arc lerp between two angles (radians). */
function lerpAngle(from: number, to: number, t: number): number {
  const d = ((to - from + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return from + d * t;
}
