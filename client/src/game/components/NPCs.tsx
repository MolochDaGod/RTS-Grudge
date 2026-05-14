import { useRef, useMemo, useEffect, Suspense } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { type AnimationState } from "../hooks/useCharacterModel";
import { useCharacterController } from "../controllers/useCharacterController";
import { getTerrainHeight, globalHeightData } from "./Terrain";
import { KinematicCharacterBody } from "./KinematicCharacterBody";
import { COLLISION_MASKS } from "./BuildingColliders";
import { useDialog } from "@/lib/stores/useDialog";
import { useGame } from "@/lib/stores/useGame";
import { playVoice } from "@/lib/dialog/playVoice";
import type { VoicePackKey } from "@/lib/dialog/voicePacks";
import { getDialogueScript } from "@/lib/dialog/dialogueData";

const TALK_RADIUS = 4.0;
const TALK_RADIUS_LEAVE = 5.5;
const HELLO_COOLDOWN_MS = 45000;

function createLabelTexture(label: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.roundRect(0, 0, 256, 64, 8);
  ctx.fill();
  ctx.fillStyle = "#66ff66";
  ctx.font = "bold 28px Arial";
  ctx.textAlign = "center";
  ctx.fillText(label, 128, 42);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function createPromptTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "rgba(12, 8, 5, 0.92)";
  ctx.roundRect(0, 0, 256, 64, 10);
  ctx.fill();
  ctx.strokeStyle = "rgba(232, 200, 104, 0.85)";
  ctx.lineWidth = 2;
  ctx.roundRect(1, 1, 254, 62, 10);
  ctx.stroke();
  ctx.fillStyle = "#e8c868";
  ctx.font = "bold 26px 'Cinzel', Georgia, serif";
  ctx.textAlign = "center";
  ctx.fillText("[T] Talk", 128, 42);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

interface NPCConfig {
  id: string;
  modelPath: string;
  startPos: [number, number, number];
  targetHeight: number;
  wanderRadius: number;
  speed: number;
  label: string;
  voicePack: VoicePackKey;
}

const NPC_CONFIGS: NPCConfig[] = [
  { id: "guard1", modelPath: "/models/characters/undead_grave_knight-male.glb", startPos: [5, 0, -8], targetHeight: 1.9, wanderRadius: 6, speed: 1.5, label: "Grave Knight", voicePack: "warrior" },
  { id: "guard2", modelPath: "/models/characters/undead_grave_knight-male.glb", startPos: [-8, 0, 5], targetHeight: 1.9, wanderRadius: 6, speed: 1.5, label: "Grave Knight", voicePack: "warrior" },
  { id: "worker1", modelPath: "/models/characters/human_battle_mage-male.glb", startPos: [22, 0, -28], targetHeight: 1.85, wanderRadius: 8, speed: 1.2, label: "Battle Mage", voicePack: "mage" },
  { id: "worker2", modelPath: "/models/characters/human_battle_mage-female.glb", startPos: [-24, 0, 27], targetHeight: 1.8, wanderRadius: 8, speed: 1.2, label: "Battle Mage", voicePack: "female" },
  { id: "cowboy", modelPath: "/models/characters/night_stalker-male.glb", startPos: [40, 0, 15], targetHeight: 2.0, wanderRadius: 10, speed: 1.8, label: "Night Stalker", voicePack: "male" },
  { id: "golden_knight", modelPath: "/models/characters/orc_scout-male.glb", startPos: [0, 0, -18], targetHeight: 1.9, wanderRadius: 4, speed: 1.0, label: "Orc Scout", voicePack: "warrior" },
  { id: "elf", modelPath: "/models/characters/elf-male.glb", startPos: [-15, 0, -10], targetHeight: 1.85, wanderRadius: 12, speed: 2.0, label: "Elf", voicePack: "male" },
  { id: "wizard", modelPath: "/models/characters/dwarf-male.glb", startPos: [30, 0, -15], targetHeight: 1.4, wanderRadius: 5, speed: 0.8, label: "Dwarf", voicePack: "mage" },
];

function NPCModel({ config }: { config: NPCConfig }) {
  const groupRef = useRef<THREE.Group>(null);
  const promptRef = useRef<THREE.Sprite>(null);
  const labelTexture = useMemo(() => createLabelTexture(config.label), [config.label]);
  const promptTexture = useMemo(() => createPromptTexture(), []);
  const terrainY = getTerrainHeight(config.startPos[0], config.startPos[2], globalHeightData);
  const localPos = useRef(new THREE.Vector3(config.startPos[0], terrainY, config.startPos[2]));
  const wanderTarget = useRef(new THREE.Vector3(
    config.startPos[0] + (Math.random() - 0.5) * config.wanderRadius,
    0,
    config.startPos[2] + (Math.random() - 0.5) * config.wanderRadius
  ));
  const wanderTimer = useRef(Math.random() * 5 + 2);
  const isIdle = useRef(false);
  const idleTimer = useRef(0);
  const prevAnim = useRef<AnimationState>("idle");
  const wasInRange = useRef(false);
  const lastHelloAt = useRef<number>(-Infinity);

  const { scene, playAnimation, update, setMovementSpeed, bounds } = useCharacterController({
    modelPath: config.modelPath,
    targetHeight: config.targetHeight,
    disableCombatLayer: true,
  });

  // Clear nearby flag if this NPC unmounts while it owned the slot.
  useEffect(() => {
    return () => {
      useDialog.getState().clearNearby(config.id);
    };
  }, [config.id]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    update(delta);

    let movedSpeed = 0;

    if (!isIdle.current) {
      const dir = new THREE.Vector3().subVectors(wanderTarget.current, localPos.current);
      dir.y = 0;
      const dist = dir.length();

      if (dist < 0.5) {
        isIdle.current = true;
        idleTimer.current = 2 + Math.random() * 4;
        if (prevAnim.current !== "idle") {
          playAnimation("idle");
          prevAnim.current = "idle";
        }
        setMovementSpeed(0);
      } else {
        dir.normalize();
        localPos.current.add(dir.clone().multiplyScalar(config.speed * delta));
        const ty = getTerrainHeight(localPos.current.x, localPos.current.z, globalHeightData);
        localPos.current.y = ty;
        const angle = Math.atan2(dir.x, dir.z);
        groupRef.current.rotation.y = angle;
        groupRef.current.position.copy(localPos.current);
        movedSpeed = config.speed;
        if (prevAnim.current !== "walk") {
          playAnimation("walk");
          prevAnim.current = "walk";
        }
        setMovementSpeed(movedSpeed);
      }
    } else {
      idleTimer.current -= delta;
      if (idleTimer.current <= 0) {
        isIdle.current = false;
        wanderTarget.current.set(
          config.startPos[0] + (Math.random() - 0.5) * config.wanderRadius * 2,
          0,
          config.startPos[2] + (Math.random() - 0.5) * config.wanderRadius * 2
        );
        const bounds = 90;
        wanderTarget.current.x = Math.max(-bounds, Math.min(bounds, wanderTarget.current.x));
        wanderTarget.current.z = Math.max(-bounds, Math.min(bounds, wanderTarget.current.z));
      }
      setMovementSpeed(0);
    }

    // --- Proximity / dialogue logic ---
    const player = useGame.getState().playerPosition;
    let inRange = false;
    if (player) {
      const dx = player.x - localPos.current.x;
      const dz = player.z - localPos.current.z;
      const planar = Math.sqrt(dx * dx + dz * dz);
      const enterR = wasInRange.current ? TALK_RADIUS_LEAVE : TALK_RADIUS;
      inRange = planar <= enterR;

      if (inRange) {
        useDialog.getState().setNearby(config.id, planar);
      } else {
        useDialog.getState().clearNearby(config.id);
      }

      // Hello bark on entering proximity (cooldown).
      if (inRange && !wasInRange.current) {
        const now = performance.now();
        const dialogActive = useDialog.getState().active;
        if (!dialogActive && now - lastHelloAt.current > HELLO_COOLDOWN_MS) {
          lastHelloAt.current = now;
          playVoice(config.voicePack, "hello", {
            cooldownKey: `hello-global`,
            cooldownMs: 1200,
          });
        }
      }
      wasInRange.current = inRange;
    }

    if (promptRef.current) {
      const nearby = useDialog.getState().nearby;
      const dialogActive = useDialog.getState().active;
      const showPrompt = inRange && !dialogActive && nearby?.npcId === config.id;
      promptRef.current.visible = showPrompt;
    }
  });

  const labelY = config.targetHeight + 0.5;
  const promptY = config.targetHeight + 1.15;

  return (
    <>
    <KinematicCharacterBody
      positionRef={localPos}
      bounds={bounds}
      collisionGroups={COLLISION_MASKS.NPC}
    />
    <group ref={groupRef} position={localPos.current.toArray()}>
      <primitive object={scene} />
      <sprite position={[0, labelY, 0]} scale={[2, 0.5, 1]}>
        <spriteMaterial map={labelTexture} transparent opacity={0.9} />
      </sprite>
      <sprite ref={promptRef} position={[0, promptY, 0]} scale={[1.6, 0.42, 1]} visible={false}>
        <spriteMaterial map={promptTexture} transparent opacity={1} depthTest={false} />
      </sprite>
    </group>
    </>
  );
}

export default function NPCs() {
  // Sanity check at mount: warn if any NPC config is missing a dialogue script.
  useEffect(() => {
    NPC_CONFIGS.forEach((c) => {
      if (!getDialogueScript(c.id)) {
        // eslint-disable-next-line no-console
        console.warn(`[NPCs] No dialogue script registered for npc id "${c.id}"`);
      }
    });
  }, []);

  return (
    <>
      {NPC_CONFIGS.map((config) => (
        <Suspense key={config.id} fallback={null}>
          <NPCModel config={config} />
        </Suspense>
      ))}
    </>
  );
}
