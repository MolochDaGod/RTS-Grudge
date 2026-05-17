import { useRef, useEffect, useCallback } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useSettings } from "@/lib/stores/useSettings";
import { useWeaponTuner } from "@/game/systems/playerBones";
import { useCombatLog } from "@/lib/stores/useCombatLog";

export type CameraMode = "mmo" | "action" | "overhead";

// World bounds — camera target position is clamped to this box so the
// camera never drifts outside the playable area. Matches the spawn bounds
// used by WaveSpawner and the terrain system.
const WORLD_BOUNDS = 90;

const MMO_CONFIG = {
  minDistance: 5,
  maxDistance: 35,
  defaultDistance: 16,
  minPitch: 0.1,
  maxPitch: 1.45,
  // Lowered from 0.55 (~31°) to 0.42 (~24°). At 0.55 the camera was
  // angled steeply enough that the sky was fully cropped at shore-side
  // spawns and the water filled the frame; 0.42 reveals the horizon
  // line and lets the surrounding sea / other islands open out, so
  // the world reads as a place rather than a tight crop on the
  // player. Mid-air orbit still goes from minPitch..maxPitch on
  // RMB drag.
  defaultPitch: 0.42,
  defaultYaw: Math.PI,
  lookHeight: 1.5,
  followSmoothing: 8.0,
  orbitSmoothing: 12.0,
  zoomSmoothing: 10.0,
  zoomStep: 1.5,
  mouseSensitivity: 0.003,
};

const ACTION_CONFIG = {
  minDistance: 2.5,
  maxDistance: 12,
  defaultDistance: 5,
  minPitch: 0.15,
  maxPitch: 1.2,
  defaultPitch: 0.35,
  defaultYaw: Math.PI,
  lookHeight: 1.6,
  shoulderOffsetX: 0.8,
  followSmoothing: 12.0,
  orbitSmoothing: 14.0,
  zoomSmoothing: 12.0,
  zoomStep: 0.8,
  mouseSensitivity: 0.003,
};

// Tactical/overhead view — camera sits high and looks nearly straight down,
// reusing the same yaw/pitch/distance pipeline as MMO. Acts as the secondary
// option to the default MMO camera (toggled with V).
const OVERHEAD_CONFIG = {
  minDistance: 15,
  maxDistance: 60,
  defaultDistance: 30,
  minPitch: 1.05,
  maxPitch: 1.5,
  defaultPitch: 1.35,
  defaultYaw: Math.PI,
  lookHeight: 0.6,
  followSmoothing: 6.0,
  orbitSmoothing: 10.0,
  zoomSmoothing: 8.0,
  zoomStep: 3.0,
  mouseSensitivity: 0.003,
};

const MODE_LABELS: Record<CameraMode, string> = {
  mmo: "MMO",
  action: "Action",
  overhead: "Overhead",
};

let _screenShakeIntensity = 0;
let _screenShakeTimer = 0;

export function triggerScreenShake(duration: number, intensity: number = 1) {
  _screenShakeTimer = duration;
  _screenShakeIntensity = intensity;
}

let _currentCameraMode: CameraMode = "mmo";
let _onModeChange: ((mode: CameraMode) => void) | null = null;
let _onReset: (() => void) | null = null;
// If a scene calls `resetCamera()` before the Camera component (which
// lives inside the Canvas / R3F tree) has registered its handler, we
// stash the request and replay it as soon as the handler attaches.
let _pendingReset = false;

export function getCameraMode(): CameraMode {
  return _currentCameraMode;
}

export function setCameraMode(mode: CameraMode) {
  _currentCameraMode = mode;
  _onModeChange?.(mode);
}

/**
 * Snap the live camera back to MMO defaults — mode, distance, pitch, yaw.
 * Call this when entering a scene where the previously-toggled Overhead /
 * Action mode or a max zoom-out from a prior session would otherwise carry
 * over and frame the world poorly (e.g. the tutorial island spawn looks
 * like a tiny sandbar from 60m up in Overhead).
 */
export function resetCamera() {
  setCameraMode("mmo");
  if (_onReset) _onReset();
  else _pendingReset = true;
}

/**
 * Discard any reset that was queued but never consumed. Call this in a
 * scene-mount effect cleanup so a fast mount-then-unmount (e.g. user
 * cancels into the tutorial before the Canvas children attach) cannot
 * leak its reset into the next scene's Camera mount.
 */
export function clearPendingCameraReset() {
  _pendingReset = false;
}

export function toggleCameraMode(): CameraMode {
  // Cycle: mmo -> action -> overhead -> mmo. The default MMO view is the
  // first/primary mode; overhead is a secondary tactical option.
  const order: CameraMode[] = ["mmo", "action", "overhead"];
  const i = order.indexOf(_currentCameraMode);
  const next = order[(i + 1) % order.length];
  setCameraMode(next);
  return next;
}

let _cameraOrbiting = false;
let _orbitMovedPixels = 0;
let _rmbWasDrag = false;
let _currentYaw = 0;
const ORBIT_THRESHOLD = 4;

export function isCameraOrbiting(): boolean {
  return _cameraOrbiting || _rmbWasDrag;
}

export function getCameraYaw(): number {
  return _currentYaw;
}

interface CameraProps {
  playerPosition: THREE.Vector3;
}

export default function Camera({ playerPosition }: CameraProps) {
  const { camera, gl } = useThree();

  const yawRef = useRef(MMO_CONFIG.defaultYaw);
  const pitchRef = useRef(MMO_CONFIG.defaultPitch);
  // Start zoomed in tight on the command center — the intro lerp below
  // will smoothly pull out to the normal play distance over ~2 seconds.
  const distRef = useRef(8);

  const targetYawRef = useRef(MMO_CONFIG.defaultYaw);
  const targetPitchRef = useRef(MMO_CONFIG.defaultPitch);
  const targetDistRef = useRef(MMO_CONFIG.defaultDistance);

  const smoothPosRef = useRef(new THREE.Vector3(0, 6, 2));
  const smoothLookRef = useRef(new THREE.Vector3());
  const smoothShoulderRef = useRef(0);

  // Intro zoom-out: on first mount the camera sits close to the command
  // center then eases out to the default MMO distance. The timer counts
  // down from 1.0 → 0.0 over ~2s; while > 0 the zoom-smoothing is
  // slowed so the pull-back reads as a cinematic reveal rather than a
  // snap.
  const introTimerRef = useRef(1.0);

  const isDraggingRef = useRef(false);
  const modeRef = useRef<CameraMode>("mmo");
  const modeTransitionRef = useRef(0);

  const getConfig = useCallback(() => {
    if (modeRef.current === "action") return ACTION_CONFIG;
    if (modeRef.current === "overhead") return OVERHEAD_CONFIG;
    return MMO_CONFIG;
  }, []);

  useEffect(() => {
    _onModeChange = (mode: CameraMode) => {
      const prev = modeRef.current;
      modeRef.current = mode;
      if (prev !== mode) {
        modeTransitionRef.current = 1.0;
        const cfg = mode === "action"
          ? ACTION_CONFIG
          : mode === "overhead"
            ? OVERHEAD_CONFIG
            : MMO_CONFIG;
        targetDistRef.current = cfg.defaultDistance;
        targetPitchRef.current = cfg.defaultPitch;

        // Lightweight on-screen confirmation so the player knows which
        // camera they just switched to.
        try {
          useCombatLog.getState().addEntry(
            `Camera: ${MODE_LABELS[mode]}`,
            "#9be7ff"
          );
        } catch {}
      }
    };
    _onReset = () => {
      // Hard-snap (not lerp) every camera ref back to MMO defaults so the
      // next frame is already framed correctly — no visible swing from a
      // far overhead state down to the shoulder view.
      targetYawRef.current = MMO_CONFIG.defaultYaw;
      targetPitchRef.current = MMO_CONFIG.defaultPitch;
      targetDistRef.current = MMO_CONFIG.defaultDistance;
      yawRef.current = MMO_CONFIG.defaultYaw;
      pitchRef.current = MMO_CONFIG.defaultPitch;
      distRef.current = MMO_CONFIG.defaultDistance;
      modeTransitionRef.current = 0;
      // Make sure mode itself is MMO too — `resetCamera()` already calls
      // `setCameraMode("mmo")`, but if reset was queued before this
      // handler existed, replay leaves modeRef untouched otherwise.
      modeRef.current = "mmo";
    };
    // Replay any reset that came in before this component mounted.
    if (_pendingReset) {
      _pendingReset = false;
      _onReset();
    }
    return () => {
      _onModeChange = null;
      _onReset = null;
    };
  }, []);

  useEffect(() => {
    const canvas = gl.domElement;

    const onMouseDown = (e: MouseEvent) => {
      // Don't start a camera orbit while the weapon gizmo is being dragged.
      if (useWeaponTuner.getState().dragging) return;
      if (e.button === 2) {
        isDraggingRef.current = true;
        _cameraOrbiting = true;
        _orbitMovedPixels = 0;
        _rmbWasDrag = false;
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 2) {
        _rmbWasDrag = _orbitMovedPixels > ORBIT_THRESHOLD;
        isDraggingRef.current = false;
        _cameraOrbiting = false;
        _orbitMovedPixels = 0;
        setTimeout(() => { _rmbWasDrag = false; }, 50);
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      if (useWeaponTuner.getState().dragging) {
        // Cancel any in-flight orbit if the user starts dragging the gizmo.
        isDraggingRef.current = false;
        _cameraOrbiting = false;
        return;
      }
      _orbitMovedPixels += Math.abs(e.movementX) + Math.abs(e.movementY);
      const sens = useSettings.getState().gameplay.cameraSensitivity;
      const cfg = getConfig();
      const mx = cfg.mouseSensitivity * sens;

      targetYawRef.current -= e.movementX * mx;
      targetPitchRef.current = Math.max(
        cfg.minPitch,
        Math.min(cfg.maxPitch, targetPitchRef.current - e.movementY * mx)
      );
    };

    const onWheel = (e: WheelEvent) => {
      if (useWeaponTuner.getState().dragging) return;
      e.preventDefault();
      const cfg = getConfig();
      const delta = e.deltaY > 0 ? cfg.zoomStep : -cfg.zoomStep;
      const dist = useSettings.getState().gameplay.cameraDistance;
      const minD = cfg.minDistance;
      const maxD = Math.min(cfg.maxDistance, dist + 10);
      targetDistRef.current = Math.max(minD, Math.min(maxD, targetDistRef.current + delta));
    };

    const onContextMenu = (e: Event) => e.preventDefault();

    const onKeyDown = (e: KeyboardEvent) => {
      if (useWeaponTuner.getState().dragging) return;
      if (e.code === "KeyV" && !e.repeat) {
        toggleCameraMode();
      }
    };

    canvas.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      canvas.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [gl, getConfig]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const cfg = getConfig();

    if (modeTransitionRef.current > 0) {
      modeTransitionRef.current = Math.max(0, modeTransitionRef.current - dt * 3);
    }

    // Intro zoom-out — slow the zoom lerp while the intro is active so
    // the camera eases out cinematically instead of snapping.
    if (introTimerRef.current > 0) {
      introTimerRef.current = Math.max(0, introTimerRef.current - dt * 0.5);
    }

    const orbitT = 1 - Math.exp(-cfg.orbitSmoothing * dt);
    yawRef.current += (targetYawRef.current - yawRef.current) * orbitT;
    pitchRef.current += (targetPitchRef.current - pitchRef.current) * orbitT;

    // During the intro, use a slower zoom factor for the cinematic pull-back.
    const introFactor = introTimerRef.current > 0 ? 0.35 : 1.0;
    const zoomT = 1 - Math.exp(-cfg.zoomSmoothing * introFactor * dt);
    distRef.current += (targetDistRef.current - distRef.current) * zoomT;

    const dist = distRef.current;
    const pitch = pitchRef.current;
    const yaw = yawRef.current;
    _currentYaw = yaw;

    const cosPitch = Math.cos(pitch);
    const sinPitch = Math.sin(pitch);
    const cosYaw = Math.cos(yaw);
    const sinYaw = Math.sin(yaw);

    const camOffsetX = dist * cosPitch * sinYaw;
    const camOffsetY = dist * sinPitch;
    const camOffsetZ = dist * cosPitch * cosYaw;

    const lookH = cfg.lookHeight;

    const targetCamPos = new THREE.Vector3(
      playerPosition.x + camOffsetX,
      playerPosition.y + lookH + camOffsetY,
      playerPosition.z + camOffsetZ
    );

    // Clamp camera to world bounds so it never drifts outside the
    // playable zone — the skybox / terrain edge stays hidden.
    targetCamPos.x = Math.max(-WORLD_BOUNDS, Math.min(WORLD_BOUNDS, targetCamPos.x));
    targetCamPos.z = Math.max(-WORLD_BOUNDS, Math.min(WORLD_BOUNDS, targetCamPos.z));

    let shoulderX = 0;
    if (modeRef.current === "action") {
      shoulderX = ACTION_CONFIG.shoulderOffsetX;
      const rightDir = new THREE.Vector3(-cosYaw, 0, sinYaw);
      targetCamPos.addScaledVector(rightDir, shoulderX);
    }

    const followT = 1 - Math.exp(-cfg.followSmoothing * dt);
    smoothPosRef.current.lerp(targetCamPos, followT);

    camera.position.copy(smoothPosRef.current);

    if (_screenShakeTimer > 0) {
      _screenShakeTimer -= dt;
      const screenShakeEnabled = useSettings.getState().gameplay.screenShake;
      if (screenShakeEnabled) {
        const shake = _screenShakeIntensity * Math.max(0, _screenShakeTimer / 0.2);
        camera.position.x += (Math.random() - 0.5) * shake * 0.3;
        camera.position.y += (Math.random() - 0.5) * shake * 0.2;
        camera.position.z += (Math.random() - 0.5) * shake * 0.3;
      }
    }

    const lookPos = new THREE.Vector3(
      playerPosition.x,
      playerPosition.y + lookH,
      playerPosition.z
    );

    if (modeRef.current === "action") {
      const rightDir = new THREE.Vector3(-cosYaw, 0, sinYaw);
      lookPos.addScaledVector(rightDir, shoulderX * 0.3);
    }

    smoothLookRef.current.lerp(lookPos, followT);
    camera.lookAt(smoothLookRef.current);
  });

  return null;
}
