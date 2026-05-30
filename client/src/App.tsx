import { useEffect, lazy, Suspense } from "react";
import { useLocation } from "wouter";
import { useGame, type GamePhase } from "./lib/stores/useGame";
import { useGameFlow } from "./lib/stores/useGameFlow";
import { useAudio } from "./lib/stores/useAudio";
import GameScene from "./game/GameScene";
import BakedDungeonScene from "./game/dungeon/BakedDungeonScene";
import HousingScene from "./game/housing/HousingScene";
import TutorialIslandScene from "./game/islands/TutorialIslandScene";
import MenuScreen from "./game/MenuScreen";
import CharacterSelectScreen from "./game/CharacterSelectScreen";
import LoadingScreen from "./game/LoadingScreen";
import IntroCutscene from "./game/IntroCutscene";
import DeathScreen from "./game/DeathScreen";
import PauseMenu from "./game/PauseMenu";
import AdminPanel from "./admin/AdminPanel";
import { AutoSaveController } from "./lib/save/useAutoSave";
import WeaponOffsetTuner from "./game/WeaponOffsetTuner";
import CheatsHUD from "./game/cheats/CheatsHUD";
import { TerrainDebugHUD } from "./game/cheats/TerrainDebugHUD";
import { StreamedColliderStatsHUD } from "./game/cheats/StreamedColliderDebugOverlay";
import "@fontsource/inter";

const GGEEditor = lazy(() => import("./game/editor/GGEEditor"));
const ControllerPage = lazy(() => import("./game/controller/ControllerPage"));
const HomePage = lazy(() => import("./pages/HomePage"));
const Combat2DPage = lazy(() => import("./pages/Combat2DPage"));
const IslandV2Page = lazy(() => import("./pages/IslandV2Page"));
const WalletPage = lazy(() => import("./pages/WalletPage"));

// ── URL ↔ Phase map ──────────────────────────────────────────────────────────
// Phases that have a canonical URL. Transient phases (loading, intro, dead,
// paused) are intentionally absent — they should never appear in the address
// bar or browser history.
const PHASE_TO_PATH: Partial<Record<GamePhase, string>> = {
  menu:            "/",
  home:            "/home",
  characterSelect: "/character",
  playing:         "/play",
  admin:           "/admin",
  gge:             "/gge",
  controller:      "/controller",
  combat2d:        "/combat",
  islandV2:        "/island-v2",
  wallet:          "/wallet",
};

function App() {
  const [location, navigate] = useLocation();
  const {
    phase, togglePanel, closePanel, pause, resume,
    inDungeon, inHousing, inTutorialIsland, restart,
    goToHome, goToController, goToCharacterSelect, goToAdmin, goToGGE,
    goToCombat2d, goToIslandV2, goToWallet,
  } = useGame();

  // ── URL → Phase (on first mount) ─────────────────────────────────────────
  // Handles direct visits, bookmarks, and auth-redirects (e.g. id.grudge-studio.com
  // returning the player to /character after sign-in).
  useEffect(() => {
    const p = location.replace(/\/+$/, "") || "/";
    const dispatchMap: Record<string, () => void> = {
      "/home":       goToHome,
      "/character":  goToCharacterSelect,
      "/admin":      goToAdmin,
      "/gge":        goToGGE,
      "/controller": goToController,
      "/combat":     goToCombat2d,
      "/island-v2":  goToIslandV2,
      "/wallet":     goToWallet,
    };
    dispatchMap[p]?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Phase → URL (kept in sync) ────────────────────────────────────────────
  // When Zustand flips phase (e.g. clicking "Hero Forge" on the menu) we push
  // the matching URL so back/forward work and the address bar stays meaningful.
  // Transient phases that have no entry in PHASE_TO_PATH are left alone.
  useEffect(() => {
    const canonical = PHASE_TO_PATH[phase];
    if (canonical && canonical !== location) {
      navigate(canonical, { replace: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);
  const { setBackgroundMusic, setHitSound, setSuccessSound, setHeavyImpactSound, setClimbScrapeSound } = useAudio();

  useEffect(() => {
    // Safe audio loader — missing files on disk are common (large binary
    // assets not committed to git). Creates the Audio element and wires a
    // one-shot error handler so 404s log a warning instead of crashing.
    function safeAudio(src: string, volume: number, loop = false): Audio {
      const a = new Audio(src);
      a.volume = volume;
      a.loop = loop;
      a.addEventListener("error", () => {
        console.warn(`[Audio] sound file not found: ${src}`);
      }, { once: true });
      return a;
    }

    setBackgroundMusic(safeAudio("/sounds/background.mp3", 0.2, true));
    setHitSound(safeAudio("/sounds/hit.mp3", 0.3));
    setSuccessSound(safeAudio("/sounds/success.mp3", 0.5));
    setHeavyImpactSound(safeAudio("/sounds/threejs-games/thunder.mp3", 0.55));
    setClimbScrapeSound(safeAudio("/sounds/climb-scrape.wav", 0.4));
  }, [setBackgroundMusic, setHitSound, setSuccessSound, setHeavyImpactSound, setClimbScrapeSound]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (phase !== "playing" && phase !== "paused") return;
      if (e.code === "KeyC" && phase === "playing") {
        togglePanel("combat");
      }
      if (e.code === "KeyI" && phase === "playing") {
        togglePanel("inventory");
      }
      if (e.code === "KeyK" && phase === "playing") {
        togglePanel("skills");
      }
      if (e.code === "Escape") {
        const { activePanel, showCrafting } = useGame.getState();
        if (activePanel || showCrafting) {
          closePanel();
          return;
        }
        if (phase === "playing") {
          pause();
        } else if (phase === "paused") {
          resume();
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [phase, togglePanel, closePanel, pause, resume]);

  // ── Game flow fade overlay ─────────────────────────────────────────────
  const fadeOpacity = useGameFlow((s) => s.fadeOpacity);
  const fadeColor = useGameFlow((s) => s.fadeColor);
  const fadePhase = useGameFlow((s) => s.fadePhase);

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative", overflow: "hidden" }}>
      <AutoSaveController />
      {phase === "menu" && <MenuScreen />}
      {phase === "characterSelect" && <CharacterSelectScreen />}
      {phase === "loading" && <LoadingScreen />}
      {phase === "intro" && <IntroCutscene />}
      {/* All 3D play uses GameScene — single 9-zone map. Dungeons and
          housing are sub-scenes within the same world (entered via portals). */}
      {(phase === "playing" || phase === "paused") && !inDungeon && !inHousing && <GameScene />}
      {(phase === "playing" || phase === "paused") && inDungeon && <BakedDungeonScene />}
      {(phase === "playing" || phase === "paused") && inHousing && <HousingScene />}
      {(phase === "playing" || phase === "paused") && <WeaponOffsetTuner />}
      {/*
        F8 dev panel + its terrain debug overlay are mounted at the
        very top level so they remain reachable from EVERY phase —
        menu, character select, loading screen, intro, dead, paused,
        AND the dedicated dev surfaces (admin / gge / controller).
        The HUD itself short-circuits to `null` until F8 is pressed,
        so the cost when nobody's using it is one zustand subscriber.
      */}
      <CheatsHUD />
      {(phase === "playing" || phase === "paused") && <TerrainDebugHUD />}
      {(phase === "playing" || phase === "paused") && <StreamedColliderStatsHUD />}
      {phase === "paused" && <PauseMenu />}
      {phase === "dead" && <DeathScreen />}
      {phase === "home" && (
        <Suspense fallback={null}><HomePage /></Suspense>
      )}
      {phase === "combat2d" && (
        <Suspense fallback={null}><Combat2DPage /></Suspense>
      )}
      {phase === "islandV2" && (
        <Suspense fallback={null}><IslandV2Page /></Suspense>
      )}
      {phase === "admin" && <AdminPanel onClose={restart} />}
      {phase === "gge" && (
        <Suspense fallback={
          <div style={{
            position: "fixed", inset: 0, background: "#0d1117",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#8b949e", fontSize: 14, fontFamily: "Inter, sans-serif",
          }}>
            Loading GGE Editor...
          </div>
        }>
          <GGEEditor />
        </Suspense>
      )}
      {phase === "wallet" && (
        <Suspense fallback={null}><WalletPage /></Suspense>
      )}
      {phase === "controller" && (
        <Suspense fallback={
          <div style={{
            position: "fixed", inset: 0, background: "#0d1117",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#8b949e", fontSize: 14, fontFamily: "Inter, sans-serif",
          }}>
            Loading Controller Lab...
          </div>
        }>
          <ControllerPage />
        </Suspense>
      )}
      {/* ── Game flow fade overlay ─────────────────────────────────────── */}
      {fadePhase !== "none" && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            backgroundColor: fadeColor,
            opacity: fadeOpacity,
            pointerEvents: fadePhase === "hold" ? "all" : "none",
            transition: "none",
          }}
        />
      )}
    </div>
  );
}

export default App;
