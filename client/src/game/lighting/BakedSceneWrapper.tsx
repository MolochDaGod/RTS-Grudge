import { Suspense, useMemo, type ReactNode } from "react";
import {
  Lightmap,
  LightmapIgnore as RawLightmapIgnore,
  LightmapReadOnly as RawLightmapReadOnly,
} from "@react-three/lightmap";
import type { LightmapProps } from "@react-three/lightmap";

/**
 * The upstream `LightmapIgnore` / `LightmapReadOnly` are typed as
 * `React.FC` with no props (predates React 18's "children are not
 * implicit" change), so passing JSX children to them fails strict
 * type-checking. They DO accept children at runtime — the lib renders
 * `<group>{children}</group>` internally — so we just retype them
 * here without changing their behaviour.
 */
type ChildrenOnly = { children?: ReactNode };
export const LightmapIgnore =
  RawLightmapIgnore as unknown as React.FC<ChildrenOnly>;
export const LightmapReadOnly =
  RawLightmapReadOnly as unknown as React.FC<ChildrenOnly>;
export type { LightmapProps };

/**
 * Read once at module load. Lightmap baking happens at scene mount so a
 * runtime toggle would not take effect — flipping the flag mid-game would
 * just be ignored by the already-mounted bake. Opt in with the URL param
 *   ?bakeLightmap=1
 * and reload to bake. Default is off so production sessions never pay the
 * multi-second blocking GPU cost on the title→tutorial transition.
 */
function readBakeFlag(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const sp = new URLSearchParams(window.location.search);
    const v = sp.get("bakeLightmap");
    if (v === null) return false;
    if (v === "" || v === "1" || v === "true" || v === "yes") return true;
    return false;
  } catch {
    return false;
  }
}

const BAKE_ENABLED = readBakeFlag();

export function isLightmapBakingEnabled(): boolean {
  return BAKE_ENABLED;
}

/**
 * Tuned defaults for Grudge Survival's island-scale scenes.
 *
 * - `ao: true`             — bake ambient occlusion alongside irradiance.
 *                            Cheap visual win even when only one directional
 *                            light contributes.
 * - `aoDistance: 4`        — meters of falloff. Tuned for a 30–50 m island
 *                            so palms / shipwreck / fort cast contact
 *                            shadows without bleeding across the whole bay.
 * - `texelsPerUnit: 4`     — 4 texels / world meter. Coarse-but-cheap for
 *                            our ~30–50 m island bake. Bumping to 8 doubles
 *                            VRAM and bake time for ~no visible gain at
 *                            our typical viewing distance.
 * - `lightMapSize: 1024`   — single-page atlas. Anything bigger triggers a
 *                            second WebGL texture upload per mesh and on a
 *                            laptop iGPU pushes bake time past 8 s.
 * - `bounceMultiplier: 1`  — one indirect bounce. The lib actually does
 *                            multi-bounce internally; this scales how much
 *                            of that bounced light shows up in the final
 *                            irradiance. 1 looks "right" for outdoor sun,
 *                            drop to ~0.4 if a scene reads too "lifted".
 * - `workPerFrame: 8`      — 8 ray batches per frame. Default is 2 which
 *                            stretches the bake out across many seconds of
 *                            black screen; 8 cuts the wall-clock roughly
 *                            in half on a mid-range laptop without dropping
 *                            below 30 fps for the bake-progress UI.
 */
export const DEFAULT_BAKE_SETTINGS: Omit<LightmapProps, "children"> = {
  ao: true,
  aoDistance: 4,
  emissiveMultiplier: 1,
  bounceMultiplier: 1,
  lightMapSize: 1024,
  texelsPerUnit: 4,
  workPerFrame: 8,
};

export interface BakedSceneWrapperProps {
  children: ReactNode;
  settings?: Omit<LightmapProps, "children" | "disabled">;
  /**
   * Force the wrapper on/off independent of the URL flag. Useful for
   * scenes that should *never* bake (overworld with dynamic time-of-day)
   * or for tests that always want the bake regardless of URL.
   */
  enabled?: boolean;
}

/**
 * Drop-in opt-in lightmap baker for an r3f scene tree.
 *
 * Usage:
 *   <BakedSceneWrapper>
 *     <StaticGeometryGoesHere />
 *     <LightmapIgnore>
 *       <Player />          // skinned, must be ignored
 *       <ParticleSystem />  // dynamic, must be ignored
 *     </LightmapIgnore>
 *   </BakedSceneWrapper>
 *
 * When the URL flag `?bakeLightmap=1` is absent and `enabled` isn't set,
 * children render as-is with zero overhead — the `<Lightmap>` wrapper is
 * not mounted at all. This means real-time lighting / shadows from the
 * existing `<directionalLight castShadow />` continue to work as before.
 *
 * When the flag IS set, `<Lightmap>` mounts, walks the subtree once at
 * init, packs every static mesh's UV2 into an atlas, ray-traces the
 * scene against itself, and replaces each material's `lightMap` slot
 * with the baked result. After the bake the scene renders cheaply with
 * static shadows and the directional light's runtime shadow pass can be
 * disabled by the caller for additional perf.
 *
 * Constraints (from the lib itself, not us):
 * - Skinned meshes are skipped (the bake walker checks `mesh.isSkinnedMesh`).
 * - Meshes need a `MeshStandardMaterial`-derived material — `MeshBasicMaterial`
 *   and shader materials are ignored.
 * - Geometry needs `uv2` for the lightmap channel; if absent the lib
 *   auto-generates from `uv` via potpack.
 * - Only `directionalLight`, `pointLight`, `spotLight`, `ambientLight`,
 *   and emissive materials contribute to the bake. Custom shader skies
 *   (e.g. our IntroStormDome) do NOT contribute and should be wrapped
 *   in `<LightmapIgnore>` so they aren't sampled as occluders either.
 * - The bake mounts inside `<Suspense>` and finishes after a few seconds.
 *   The caller's existing `<Suspense>` boundary will keep waiting; pass
 *   a meaningful loading UI to the boundary above this wrapper.
 */
export function BakedSceneWrapper({
  children,
  settings,
  enabled,
}: BakedSceneWrapperProps) {
  const active = enabled ?? BAKE_ENABLED;

  const merged = useMemo<Omit<LightmapProps, "children">>(
    () => ({ ...DEFAULT_BAKE_SETTINGS, ...(settings ?? {}) }),
    [settings],
  );

  if (!active) {
    // Zero overhead bypass — children render directly into the parent
    // scene graph just like before this wrapper existed.
    return <>{children}</>;
  }

  return (
    <Suspense fallback={null}>
      <Lightmap {...merged}>{children}</Lightmap>
    </Suspense>
  );
}

export default BakedSceneWrapper;
