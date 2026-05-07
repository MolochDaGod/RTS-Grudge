import { useMemo, useEffect, useRef, useState, Suspense, Component, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useGLTF, Environment } from "@react-three/drei";
import * as THREE from "three";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { useGame } from "@/lib/stores/useGame";
import {
  ANIMATION_PACKS,
  ALL_CHARACTER_MODELS,
  type AnimationPackEntry,
} from "@/game/systems/ModelRegistry";
import { resolveCharacterModelPath } from "@/game/systems/CharacterModelResolver";
import { retargetClips, captureRestPose } from "@/game/systems/BoneAliases";
import { isRestPoseClipName } from "@/game/hooks/useCharacterModel";
import {
  useControllerLab,
  DEFAULT_ANIM_OVERRIDE,
  DEFAULT_CONTROLLER_CONFIG,
  REMAPPABLE_KEYS,
  applyControllerConfigToLiveGame,
  type AnimOverride,
  type RemappableAction,
  type RemappableKey,
} from "@/game/state/useControllerLab";

/**
 * Error boundary specifically for the WebGL/R3F preview. When the GPU
 * context fails (headless screenshot tooling, blocked WebGL, broken
 * driver) the rest of the page still works — only the preview pane
 * shows a fallback so the user can still edit clip + controller props.
 */
class PreviewErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error("[ControllerPage] preview canvas crashed:", error);
  }
  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: 8,
            background: "#1a1d24",
            color: "#8b949e",
            fontSize: 13,
            padding: 24,
            textAlign: "center",
          }}
        >
          <div style={{ color: "#f85149", fontWeight: 600 }}>
            Live preview unavailable
          </div>
          <div style={{ maxWidth: 380 }}>
            {this.state.error.message ||
              "WebGL context could not be created in this browser session."}
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              marginTop: 8,
              padding: "4px 12px",
              background: "transparent",
              color: "#c9d1d9",
              border: "1px solid #30363d",
              borderRadius: 4,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

interface FlatAnim {
  /** Composite key: `${packId}::${animName}` — unique across packs. */
  key: string;
  packId: string;
  packName: string;
  animName: string;
  animFile: string;
  /** Fully-resolved fetchable path: `${pack.basePath}/${animFile}`. */
  fullPath: string;
}

function flattenAnims(packs: AnimationPackEntry[]): FlatAnim[] {
  const out: FlatAnim[] = [];
  for (const pack of packs) {
    for (const a of pack.animations) {
      // Bundled-pack entries point at a single combined GLB; per-clip
      // entries are relative to `basePath`. Either way, resolve against
      // `basePath` so PreviewRig gets a real fetchable URL (the bug
      // here was passing `a.file` directly, which 404'd because Vite
      // tried to load `/idle.glb`).
      const file = pack.bundledFile ?? a.file;
      out.push({
        key: `${pack.id}::${a.name}`,
        packId: pack.id,
        packName: pack.name,
        animName: a.name,
        animFile: a.file,
        fullPath: `${pack.basePath}/${file}`,
      });
    }
  }
  return out;
}

/**
 * Live preview canvas — loads the selected character GLB plus the
 * selected animation GLB, plays the clip on a shared mixer, and applies
 * speed/loop overrides from the lab store. Re-mounts when `runVersion`
 * changes so the user can press Run to apply controller config + clip
 * tweaks atomically.
 */
function PreviewRig({
  characterPath,
  animPath,
  idleAnimPath,
  override,
}: {
  characterPath: string;
  animPath: string | null;
  /**
   * Path to the locomotion idle clip used as the "return to idle"
   * destination when `override.autoReturn` is true. May be the same as
   * `animPath` (in which case auto-return is a no-op).
   */
  idleAnimPath: string | null;
  override: AnimOverride;
}) {
  // Route the character path through the project-wide resolver so any
  // legacy/missing GLB falls back to a real local file (matches the
  // behavior of the production game's `useCharacterModel` hook). Without
  // this, picking a character whose GLB isn't in `LOCAL_CHARACTER_FILES`
  // would 404 instead of swapping to the generic humanoid.
  const resolvedCharPath = useMemo(
    () => resolveCharacterModelPath(characterPath),
    [characterPath],
  );
  const charGLTF = useGLTF(resolvedCharPath);
  const animGLTF = useGLTF(animPath ?? resolvedCharPath);
  const idleGLTF = useGLTF(idleAnimPath ?? resolvedCharPath);

  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionRef = useRef<THREE.AnimationAction | null>(null);
  // The "finished" listener is created per-effect-run; we keep a ref so
  // we can detach the previous one when the clip selection changes.
  const finishHandlerRef = useRef<((e: { action: THREE.AnimationAction }) => void) | null>(null);

  const cloned = useMemo(() => {
    // SkeletonUtils.clone (NOT Object3D.clone) is required for skinned
    // meshes — plain clone duplicates the mesh but leaves the SkinnedMesh
    // bound to the original skeleton, so the AnimationMixer animates bones
    // that aren't connected to this rig and the character stays in T-pose.
    return SkeletonUtils.clone(charGLTF.scene);
  }, [charGLTF.scene]);

  // Retarget the chosen animation clip onto the cloned skeleton. This is
  // the same pipeline the production game uses (see useCharacterModel) and
  // is the reason the lab was previously showing a stuck bind pose: the
  // raw Mixamo clip's `mixamorigHips.*` track names bind to ZERO bones on
  // a KayKit/Quaternius character rig, so the mixer dutifully advances
  // every frame while nothing visibly moves. captureRestPose + retargetClips
  // remap track names AND apply delta-from-rest math so the clip plays
  // correctly on a rig with a different bind pose. `dropRootChain: true`
  // matches the production behavior for external packs (root motion is
  // owned by the controller, never the clip).
  const playClip = useMemo(() => {
    const src = animPath ? animGLTF : charGLTF;
    const raw = (src.animations ?? []).find(c => !isRestPoseClipName(c.name))
      ?? src.animations?.[0]
      ?? null;
    if (!raw) return null;
    const rest = src.scene ? captureRestPose(src.scene) : null;
    const out = retargetClips([raw], cloned, rest, { dropRootChain: true });
    return out[0] ?? null;
  }, [cloned, animPath, animGLTF, charGLTF]);

  // Same retargeting for the auto-return idle clip. Skip when there's no
  // distinct idle GLB (avoids redundant retarget work and keeps `idleClip
  // === playClip` so the auto-return effect can short-circuit cleanly).
  const idleClip = useMemo(() => {
    if (!idleAnimPath || idleGLTF === animGLTF) return null;
    const raw = (idleGLTF.animations ?? []).find(c => !isRestPoseClipName(c.name))
      ?? idleGLTF.animations?.[0]
      ?? null;
    if (!raw) return null;
    const rest = idleGLTF.scene ? captureRestPose(idleGLTF.scene) : null;
    const out = retargetClips([raw], cloned, rest, { dropRootChain: true });
    return out[0] ?? null;
  }, [cloned, idleAnimPath, idleGLTF, animGLTF]);

  // Mixer lifecycle is bound to the cloned rig only — we keep it alive
  // across animation switches so we can `crossFadeTo` between clips.
  useEffect(() => {
    const mixer = new THREE.AnimationMixer(cloned);
    mixerRef.current = mixer;
    return () => {
      if (finishHandlerRef.current) {
        mixer.removeEventListener("finished", finishHandlerRef.current as never);
        finishHandlerRef.current = null;
      }
      mixer.stopAllAction();
      mixer.uncacheRoot(cloned);
      mixerRef.current = null;
      actionRef.current = null;
    };
  }, [cloned]);

  // Switch the playing clip with a crossfade. We never tear down the
  // mixer here; we simply fade the current action out into the new one
  // over `override.crossfade` seconds (clamped at 0 = instant cut).
  //
  // `oneShot` overrides `loop`: it always sets LoopOnce + clamp.
  // `autoReturn` registers a "finished" listener that crossfades back
  // to the idle clip when the one-shot completes.
  useEffect(() => {
    const mixer = mixerRef.current;
    if (!mixer) return;

    // Use the retargeted clip computed above (NOT the raw gltf.animations[0]).
    // Going through retargetClips is what makes Mixamo packs animate on
    // KayKit/Quaternius character rigs — without it the mixer plays a clip
    // whose tracks bind to no bones and the character stays in bind pose.
    const clip = playClip;
    if (!clip) return;

    // Detach any previous finished-listener; we'll install a fresh one
    // below if oneShot+autoReturn is requested for the new action.
    if (finishHandlerRef.current) {
      mixer.removeEventListener("finished", finishHandlerRef.current as never);
      finishHandlerRef.current = null;
    }

    // `oneShot` is the explicit "play once" toggle and supersedes loop.
    // `loop` remains the friendly "loop forever" switch when oneShot is off.
    const playsOnce = override.oneShot || !override.loop;
    const next = mixer.clipAction(clip);
    next.reset();
    next.setLoop(
      playsOnce ? THREE.LoopOnce : THREE.LoopRepeat,
      playsOnce ? 1 : Infinity,
    );
    next.clampWhenFinished = playsOnce;
    next.timeScale = override.speed;

    const prev = actionRef.current;
    const fade = Math.max(0, override.crossfade ?? 0);
    if (prev && prev !== next && fade > 0) {
      next.enabled = true;
      next.setEffectiveTimeScale(override.speed);
      next.setEffectiveWeight(1);
      prev.crossFadeTo(next, fade, false);
      next.play();
    } else {
      if (prev && prev !== next) prev.stop();
      next.play();
    }
    actionRef.current = next;

    // Auto-return: when this one-shot finishes, fade to the idle clip.
    // Only meaningful when (a) the clip plays once and (b) we have a
    // distinct idle clip to fade to.
    if (playsOnce && override.autoReturn) {
      // Use the retargeted idle clip; falls back to the playing clip when
      // there's no distinct idle GLB (handled by `idleClip !== clip` below).
      const idleClipForReturn = idleClip;
      if (idleClipForReturn && idleClipForReturn !== clip) {
        const onFinished = (e: { action: THREE.AnimationAction }) => {
          if (e.action !== next) return;
          const m = mixerRef.current;
          if (!m) return;
          const idleAction = m.clipAction(idleClipForReturn);
          idleAction.reset();
          idleAction.setLoop(THREE.LoopRepeat, Infinity);
          idleAction.clampWhenFinished = false;
          idleAction.timeScale = 1.0;
          idleAction.enabled = true;
          idleAction.setEffectiveTimeScale(1.0);
          idleAction.setEffectiveWeight(1);
          // 0.25s feels right as an auto-return blend; the per-clip
          // `crossfade` field controls fade-IN, not fade-OUT.
          next.crossFadeTo(idleAction, 0.25, false);
          idleAction.play();
          actionRef.current = idleAction;
        };
        mixer.addEventListener("finished", onFinished as never);
        finishHandlerRef.current = onFinished;
      }
    }
  }, [
    playClip,
    idleClip,
    override.loop,
    override.oneShot,
    override.autoReturn,
    override.speed,
    override.crossfade,
  ]);

  useFrame((_, delta) => {
    mixerRef.current?.update(delta);
  });

  return <primitive object={cloned} position={[0, 0, 0]} />;
}

function PreviewCanvas() {
  const selectedAnimKey = useControllerLab((s) => s.selectedAnimKey);
  const selectedCharId = useControllerLab((s) => s.selectedCharacterId);
  const animOverrides = useControllerLab((s) => s.animOverrides);
  const runVersion = useControllerLab((s) => s.runVersion);

  const character = useMemo(
    () =>
      ALL_CHARACTER_MODELS.find((m) => m.id === selectedCharId) ??
      ALL_CHARACTER_MODELS[0],
    [selectedCharId],
  );

  const flat = useMemo(() => flattenAnims(ANIMATION_PACKS), []);

  const anim = useMemo(() => {
    if (!selectedAnimKey) return null;
    return flat.find((a) => a.key === selectedAnimKey) ?? null;
  }, [flat, selectedAnimKey]);

  // Pre-resolve the locomotion idle clip so PreviewRig can fade back to
  // it when `autoReturn` is enabled on a one-shot.
  const idleAnimPath = useMemo(() => {
    const idle = flat.find((a) => a.animName === "idle") ?? null;
    return idle?.fullPath ?? null;
  }, [flat]);

  const override =
    (selectedAnimKey ? animOverrides[selectedAnimKey] : null) ??
    DEFAULT_ANIM_OVERRIDE;

  return (
    <Canvas
      key={runVersion}
      camera={{ position: [2.5, 1.8, 3.5], fov: 45 }}
      shadows
      dpr={[1, 1.5]}
      style={{ background: "#1a1d24" }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[5, 8, 4]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <Suspense fallback={null}>
        <Environment preset="sunset" />
        <PreviewRig
          characterPath={character.path}
          animPath={anim?.fullPath ?? null}
          idleAnimPath={idleAnimPath}
          override={override}
        />
      </Suspense>
      <gridHelper args={[10, 20, "#444", "#2a2d34"]} position={[0, 0, 0]} />
      <OrbitControls
        target={[0, 1.0, 0]}
        enablePan={false}
        minDistance={1.5}
        maxDistance={8}
      />
    </Canvas>
  );
}

function AnimList({
  flat,
  selectedKey,
  onSelect,
}: {
  flat: FlatAnim[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
}) {
  const [filter, setFilter] = useState("");
  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return flat;
    return flat.filter(
      (a) =>
        a.animName.toLowerCase().includes(f) ||
        a.packName.toLowerCase().includes(f),
    );
  }, [flat, filter]);

  // Group by pack for readable scrolling.
  const byPack = useMemo(() => {
    const map = new Map<string, FlatAnim[]>();
    for (const a of filtered) {
      const arr = map.get(a.packName) ?? [];
      arr.push(a);
      map.set(a.packName, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder={`Filter ${flat.length} animations…`}
        style={{
          padding: "8px 10px",
          background: "#1c2028",
          color: "#e6edf3",
          border: "1px solid #30363d",
          borderRadius: 6,
          fontSize: 13,
          marginBottom: 8,
        }}
      />
      <div style={{ flex: 1, overflowY: "auto", paddingRight: 4 }}>
        {byPack.map(([packName, anims]) => (
          <div key={packName} style={{ marginBottom: 12 }}>
            <div
              style={{
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: 0.6,
                color: "#8b949e",
                padding: "4px 6px",
                borderBottom: "1px solid #30363d",
                marginBottom: 4,
              }}
            >
              {packName} · {anims.length}
            </div>
            {anims.map((a) => {
              const selected = a.key === selectedKey;
              return (
                <button
                  key={a.key}
                  onClick={() => onSelect(a.key)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "6px 10px",
                    background: selected ? "#1f6feb33" : "transparent",
                    color: selected ? "#79c0ff" : "#c9d1d9",
                    border: selected
                      ? "1px solid #1f6feb"
                      : "1px solid transparent",
                    borderRadius: 4,
                    fontSize: 12,
                    fontFamily: "monospace",
                    cursor: "pointer",
                    marginBottom: 2,
                  }}
                >
                  {a.animName}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function AnimEditor({ animKey }: { animKey: string | null }) {
  const overrides = useControllerLab((s) => s.animOverrides);
  const setAnimOverride = useControllerLab((s) => s.setAnimOverride);
  const resetAnimOverride = useControllerLab((s) => s.resetAnimOverride);

  if (!animKey) {
    return (
      <div style={{ color: "#8b949e", fontSize: 13, padding: "12px 4px" }}>
        Select an animation from the list to edit its playback properties.
      </div>
    );
  }

  const o = overrides[animKey] ?? DEFAULT_ANIM_OVERRIDE;

  return (
    <div style={{ padding: "8px 4px" }}>
      <div
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: 0.6,
          color: "#8b949e",
          marginBottom: 8,
        }}
      >
        Animation properties
      </div>

      <Field label={`Speed: ${o.speed.toFixed(2)}×`}>
        <input
          type="range"
          min={0.1}
          max={3.0}
          step={0.05}
          value={o.speed}
          onChange={(e) =>
            setAnimOverride(animKey, { speed: parseFloat(e.target.value) })
          }
          style={{ width: "100%" }}
        />
      </Field>

      <Field
        label={
          <label
            style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
          >
            <input
              type="checkbox"
              checked={o.loop}
              onChange={(e) =>
                setAnimOverride(animKey, { loop: e.target.checked })
              }
            />
            Loop (off = play once + clamp)
          </label>
        }
      >
        {null}
      </Field>

      <Field
        label={
          <label
            style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
          >
            <input
              type="checkbox"
              checked={o.oneShot}
              onChange={(e) =>
                setAnimOverride(animKey, { oneShot: e.target.checked })
              }
            />
            One-shot (force a single play, override loop)
          </label>
        }
      >
        {null}
      </Field>

      <Field
        label={
          <label
            style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
          >
            <input
              type="checkbox"
              checked={o.autoReturn}
              onChange={(e) =>
                setAnimOverride(animKey, { autoReturn: e.target.checked })
              }
            />
            Auto-return to idle when finished
          </label>
        }
      >
        {null}
      </Field>

      <Field label={`Crossfade in: ${o.crossfade.toFixed(2)}s`}>
        <input
          type="range"
          min={0}
          max={1.0}
          step={0.05}
          value={o.crossfade}
          onChange={(e) =>
            setAnimOverride(animKey, { crossfade: parseFloat(e.target.value) })
          }
          style={{ width: "100%" }}
        />
      </Field>

      <button
        onClick={() => resetAnimOverride(animKey)}
        style={{
          marginTop: 8,
          padding: "4px 10px",
          background: "transparent",
          color: "#8b949e",
          border: "1px solid #30363d",
          borderRadius: 4,
          fontSize: 11,
          cursor: "pointer",
        }}
      >
        Reset to defaults
      </button>
    </div>
  );
}

function ControllerConfigPanel() {
  const cfg = useControllerLab((s) => s.controllerConfig);
  const setControllerConfig = useControllerLab((s) => s.setControllerConfig);
  const resetControllerConfig = useControllerLab((s) => s.resetControllerConfig);

  return (
    <div>
      <div
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: 0.6,
          color: "#8b949e",
          marginBottom: 10,
        }}
      >
        Controller config
      </div>

      <Field label={`Walk speed: ${cfg.walkSpeed.toFixed(2)} m/s`}>
        <input
          type="range"
          min={0.5}
          max={6.0}
          step={0.1}
          value={cfg.walkSpeed}
          onChange={(e) =>
            setControllerConfig({ walkSpeed: parseFloat(e.target.value) })
          }
          style={{ width: "100%" }}
        />
      </Field>

      <Field label={`Run speed: ${cfg.runSpeed.toFixed(2)} m/s`}>
        <input
          type="range"
          min={1.0}
          max={10.0}
          step={0.1}
          value={cfg.runSpeed}
          onChange={(e) =>
            setControllerConfig({ runSpeed: parseFloat(e.target.value) })
          }
          style={{ width: "100%" }}
        />
      </Field>

      <Field label={`Sprint speed: ${cfg.sprintSpeed.toFixed(2)} m/s`}>
        <input
          type="range"
          min={2.0}
          max={16.0}
          step={0.1}
          value={cfg.sprintSpeed}
          onChange={(e) =>
            setControllerConfig({ sprintSpeed: parseFloat(e.target.value) })
          }
          style={{ width: "100%" }}
        />
      </Field>

      <Field label={`Jump height: ${cfg.jumpHeight.toFixed(2)} m`}>
        <input
          type="range"
          min={0.3}
          max={4.0}
          step={0.05}
          value={cfg.jumpHeight}
          onChange={(e) =>
            setControllerConfig({ jumpHeight: parseFloat(e.target.value) })
          }
          style={{ width: "100%" }}
        />
      </Field>

      <Field label={`Dodge i-frames: ${cfg.dodgeIFramesMs} ms`}>
        <input
          type="range"
          min={0}
          max={1000}
          step={25}
          value={cfg.dodgeIFramesMs}
          onChange={(e) =>
            setControllerConfig({ dodgeIFramesMs: parseInt(e.target.value, 10) })
          }
          style={{ width: "100%" }}
        />
      </Field>

      <Field label={`Dodge distance: ${cfg.dodgeDistance.toFixed(2)} m`}>
        <input
          type="range"
          min={1.0}
          max={10.0}
          step={0.1}
          value={cfg.dodgeDistance}
          onChange={(e) =>
            setControllerConfig({ dodgeDistance: parseFloat(e.target.value) })
          }
          style={{ width: "100%" }}
        />
      </Field>

      <KeymapPanel />

      <button
        onClick={resetControllerConfig}
        style={{
          marginTop: 8,
          padding: "4px 10px",
          background: "transparent",
          color: "#8b949e",
          border: "1px solid #30363d",
          borderRadius: 4,
          fontSize: 11,
          cursor: "pointer",
        }}
      >
        Reset to defaults
      </button>

      <div style={{ marginTop: 10, fontSize: 10, color: "#6e7681", lineHeight: 1.5 }}>
        Defaults: walk {DEFAULT_CONTROLLER_CONFIG.walkSpeed} m/s,
        run {DEFAULT_CONTROLLER_CONFIG.runSpeed} m/s,
        sprint {DEFAULT_CONTROLLER_CONFIG.sprintSpeed} m/s,
        jump {DEFAULT_CONTROLLER_CONFIG.jumpHeight} m,
        i-frames {DEFAULT_CONTROLLER_CONFIG.dodgeIFramesMs} ms,
        dodge {DEFAULT_CONTROLLER_CONFIG.dodgeDistance} m.
        "Run" applies these to the live game (run/sprint/jump/i-frames).
      </div>
    </div>
  );
}

const KEYMAP_ACTIONS: { id: RemappableAction; label: string }[] = [
  { id: "forward", label: "Forward" },
  { id: "back", label: "Back" },
  { id: "left", label: "Strafe left" },
  { id: "right", label: "Strafe right" },
  { id: "jump", label: "Jump" },
  { id: "sprint", label: "Sprint" },
  { id: "dodge", label: "Dodge" },
  { id: "interact", label: "Interact" },
];

function KeymapPanel() {
  const keymap = useControllerLab((s) => s.controllerConfig.keymap);
  const setKeymapBinding = useControllerLab((s) => s.setKeymapBinding);

  return (
    <div style={{ marginTop: 14, marginBottom: 4 }}>
      <div
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: 0.6,
          color: "#8b949e",
          marginBottom: 8,
        }}
      >
        Key bindings
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 6,
        }}
      >
        {KEYMAP_ACTIONS.map((a) => (
          <label
            key={a.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              color: "#c9d1d9",
            }}
          >
            <span style={{ flex: 1 }}>{a.label}</span>
            <select
              value={keymap[a.id]}
              onChange={(e) =>
                setKeymapBinding(a.id, e.target.value as RemappableKey)
              }
              style={{
                padding: "2px 6px",
                background: "#0d1117",
                color: "#e6edf3",
                border: "1px solid #30363d",
                borderRadius: 3,
                fontSize: 11,
                fontFamily: "monospace",
              }}
            >
              {REMAPPABLE_KEYS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: "#c9d1d9", marginBottom: 4 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

export default function ControllerPage() {
  const goBack = useGame((s) => s.goToCharacterSelect);
  const goMenu = () => {
    // Push the URL back so refresh/share doesn't re-enter /controller.
    if (typeof window !== "undefined") {
      window.history.pushState({}, "", "/");
    }
    useGame.getState().restart();
  };

  const selectedAnimKey = useControllerLab((s) => s.selectedAnimKey);
  const setSelectedAnim = useControllerLab((s) => s.setSelectedAnim);
  const bumpRun = useControllerLab((s) => s.bumpRun);
  const selectedCharId = useControllerLab((s) => s.selectedCharacterId);
  const setSelectedCharacter = useControllerLab((s) => s.setSelectedCharacter);

  // "Run" both refreshes the preview canvas and pushes the lab's
  // controller-config values into the live game store, so changes the
  // designer just made take effect for actual gameplay.
  const handleRun = () => {
    const cfg = useControllerLab.getState().controllerConfig;
    applyControllerConfigToLiveGame(cfg);
    bumpRun();
  };

  const flat = useMemo(() => flattenAnims(ANIMATION_PACKS), []);
  const playableChars = useMemo(
    () => ALL_CHARACTER_MODELS.filter((m) => m.isPlayable),
    [],
  );

  // Default-select the first locomotion clip (`idle`) so the rig isn't
  // standing in T-pose when the page first opens.
  useEffect(() => {
    if (selectedAnimKey) return;
    const idle = flat.find((a) => a.animName === "idle") ?? flat[0];
    if (idle) setSelectedAnim(idle.key);
  }, [flat, selectedAnimKey, setSelectedAnim]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#0d1117",
        color: "#e6edf3",
        fontFamily: "Inter, sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 16px",
          borderBottom: "1px solid #30363d",
          background: "#161b22",
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600 }}>Controller Lab</div>
        <div style={{ fontSize: 11, color: "#8b949e" }}>
          {flat.length} animations · {playableChars.length} characters
        </div>

        <div style={{ flex: 1 }} />

        <select
          value={selectedCharId}
          onChange={(e) => setSelectedCharacter(e.target.value)}
          style={{
            padding: "4px 8px",
            background: "#0d1117",
            color: "#e6edf3",
            border: "1px solid #30363d",
            borderRadius: 4,
            fontSize: 12,
          }}
        >
          {playableChars.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <button
          onClick={handleRun}
          style={{
            padding: "6px 16px",
            background: "#238636",
            color: "white",
            border: "1px solid #2ea043",
            borderRadius: 4,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          ▶ Run
        </button>

        <button
          onClick={goBack}
          style={{
            padding: "6px 12px",
            background: "transparent",
            color: "#c9d1d9",
            border: "1px solid #30363d",
            borderRadius: 4,
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          Character Select
        </button>

        <button
          onClick={goMenu}
          style={{
            padding: "6px 12px",
            background: "transparent",
            color: "#c9d1d9",
            border: "1px solid #30363d",
            borderRadius: 4,
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          Main menu
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Left: animation list + per-clip editor */}
        <div
          style={{
            width: 320,
            borderRight: "1px solid #30363d",
            padding: 12,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div style={{ flex: "1 1 60%", minHeight: 0 }}>
            <AnimList
              flat={flat}
              selectedKey={selectedAnimKey}
              onSelect={setSelectedAnim}
            />
          </div>
          <div
            style={{
              borderTop: "1px solid #30363d",
              paddingTop: 8,
              flex: "1 1 40%",
              overflowY: "auto",
            }}
          >
            <AnimEditor animKey={selectedAnimKey} />
          </div>
        </div>

        {/* Right: preview + controller config */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div
            style={{
              flex: "1 1 65%",
              minHeight: 0,
              borderBottom: "1px solid #30363d",
              position: "relative",
            }}
          >
            <PreviewErrorBoundary>
              <PreviewCanvas />
            </PreviewErrorBoundary>
            {selectedAnimKey && (
              <div
                style={{
                  position: "absolute",
                  top: 12,
                  left: 12,
                  background: "#0d1117cc",
                  border: "1px solid #30363d",
                  borderRadius: 4,
                  padding: "4px 8px",
                  fontSize: 11,
                  fontFamily: "monospace",
                  color: "#79c0ff",
                  pointerEvents: "none",
                }}
              >
                {selectedAnimKey}
              </div>
            )}
          </div>
          <div
            style={{
              flex: "1 1 35%",
              padding: "12px 16px",
              overflowY: "auto",
              background: "#0d1117",
            }}
          >
            <ControllerConfigPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
