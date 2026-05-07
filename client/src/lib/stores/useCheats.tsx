import { create } from "zustand";

/**
 * In-game cheat / live admin store.
 *
 * Toggled with F8 while a scene is playing. Distinct from the
 * separate `AdminPanel` (`phase: "admin"`) which is the editor for
 * terrain / enemies / combat config — this store is purely for live
 * world-state cheats while the player is in the game (fly, no-clip,
 * debug overlays, etc.).
 *
 * The Player component subscribes to `flyMode` and `noClip` to
 * adjust gravity scale and collision groups in its physics frame
 * loop.
 *
 * Kept minimal on purpose: every flag is a primitive, every action
 * is a single-purpose toggle. Add new flags by extending both
 * `CheatsState` and the matching toggler — never bundle multiple
 * effects under one flag, the in-game overlay relies on per-flag
 * checkboxes mapping 1:1 to fields here.
 */
export interface CheatsState {
  /**
   * Master switch. When false, the HUD is hidden and every other
   * flag is treated as false by consumers. F8 toggles this AND the
   * panel together — turning cheats on opens the panel, turning
   * them off closes it. Individual flags persist across off/on
   * toggles so the user doesn't have to re-tick everything when
   * they pop the panel back open.
   */
  enabled: boolean;
  /** Floating HUD visible. Implies `enabled` is true. */
  panelOpen: boolean;
  /** Player gravityScale=0; vertical input via Space (up) / LCtrl (down). */
  flyMode: boolean;
  /**
   * Player capsule's collision groups dropped to 0 so it neither
   * solves nor reports contacts against any other body. Used with
   * `flyMode` to phase through walls; standalone it just means the
   * player slides off everything (probably not what you want).
   */
  noClip: boolean;
  /**
   * Mount the `<TerrainDebugHUD>` overlay. Casts a ray from camera
   * through screen-center, samples the ground beneath the player,
   * and prints world XYZ + normal + hit-mesh name + nearby collider
   * counts as live HTML text. Read-only — no physics side effects.
   */
  debugTerrain: boolean;
  /**
   * Mount the streamed-ground-collider debug overlay (tutorial
   * island). For every currently-mounted trimesh ground chunk, draws
   * a wireframe outline plus a tinted xz bbox quad — chunks of the
   * same source mesh share a color so multi-chunk splits are easy
   * to see. Also draws the stream mount/unmount radius rings around
   * the player so the streaming behaviour itself is observable.
   * Read-only; no physics side effects.
   */
  debugColliders: boolean;
  /**
   * Mount the `<PlayerColliderDebug>` overlay. Draws a wireframe of
   * the convex hull collider attached to the player rigid body so its
   * exact silhouette (relative to the visible character mesh) is
   * legible at runtime. Read-only — no physics side effects.
   */
  debugPlayerCollider: boolean;

  toggleEnabled: () => void;
  togglePanel: () => void;
  toggleFly: () => void;
  toggleNoClip: () => void;
  toggleDebugTerrain: () => void;
  toggleDebugColliders: () => void;
  toggleDebugPlayerCollider: () => void;
  reset: () => void;
}

const INITIAL: Pick<
  CheatsState,
  | "enabled"
  | "panelOpen"
  | "flyMode"
  | "noClip"
  | "debugTerrain"
  | "debugColliders"
  | "debugPlayerCollider"
> = {
  enabled: false,
  panelOpen: false,
  flyMode: false,
  noClip: false,
  debugTerrain: false,
  debugColliders: false,
  debugPlayerCollider: false,
};

export const useCheats = create<CheatsState>((set) => ({
  ...INITIAL,
  toggleEnabled: () =>
    set((s) => {
      const next = !s.enabled;
      // Close the panel when cheats turn off; turning back on
      // reopens it so F8 always lands on a visible surface.
      return { enabled: next, panelOpen: next };
    }),
  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
  toggleFly: () => set((s) => ({ flyMode: !s.flyMode })),
  toggleNoClip: () => set((s) => ({ noClip: !s.noClip })),
  toggleDebugTerrain: () =>
    set((s) => ({ debugTerrain: !s.debugTerrain })),
  toggleDebugColliders: () =>
    set((s) => ({ debugColliders: !s.debugColliders })),
  toggleDebugPlayerCollider: () =>
    set((s) => ({ debugPlayerCollider: !s.debugPlayerCollider })),
  reset: () => set({ ...INITIAL }),
}));
