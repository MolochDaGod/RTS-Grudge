import { useEffect } from "react";
import {
  Play,
  Settings,
  Accessibility,
  Keyboard,
  MousePointer2,
} from "lucide-react";
import { useGame } from "@/lib/stores/useGame";
import { useCampaign } from "@/lib/stores/useCampaign";
import { kickoffHeroForgePreload } from "./heroForge/preload";
import { kickoffIntroAnimPreload } from "./intro/preload";
import { AccountPanel } from "./AccountPanel";

const FONTS = {
  title: "'MorkDungeon', 'Cinzel', serif",
  header: "'Cinzel', serif",
  body: "'Crimson Text', serif",
  mono: "'JetBrains Mono', monospace",
};

const noop = () => {};

export default function MenuScreen() {
  const { goToGGE, goToController, goToCharacterSelect, enterTutorialIsland } = useGame();
  const startCampaign = useCampaign((s) => s.startCampaign);

  // SHIPWRECK — direct drop onto the tutorial island GLB without character
  // select or intro. This is now the PRIMARY fast-start path recommended
  // for all players, not just QA. Character customisation can happen from
  // within the game.
  const handleShipwreck = () => {
    enterTutorialIsland(null);
  };

  // OPEN WORLD — admin / dev access to the procedural GameScene.
  // Should only be exposed in dev builds or to admin users.
  const handleOpenWorld = () => {
    // Go directly to playing WITHOUT setting inTutorialIsland so
    // App.tsx routes to GameScene (the procedural open world admin area).
    useGame.setState({ inTutorialIsland: false, phase: "playing" as any });
  };

  // Warm the Hero Forge model cache while the user is reading the menu so the
  // character preview shows up instantly instead of as a wireframe placeholder.
  // Same idea for the intro cutscene's animation pack: ~19 separate Mixamo
  // clip files used to download serially when the cutscene mounted, leaving
  // the user staring at a blank loading screen. Warming them here on the
  // menu (and again on character select for safety) hides that latency
  // behind the time the user spends picking a hero.
  useEffect(() => {
    kickoffHeroForgePreload();
    kickoffIntroAnimPreload();
  }, []);

  // PLAY — full campaign flow.
  //   Starts the campaign, sets inTutorialIsland: true so the shipwreck
  //   scene loads after character select + intro. This is the "proper"
  //   story flow; for an immediate jump use SHIPWRECK.
  const handlePlay = () => {
    startCampaign();
    useGame.setState({ inTutorialIsland: true });
    goToCharacterSelect();
  };

  return (
    <div
      className="min-h-screen w-screen relative flex flex-col items-center"
      style={{
        backgroundColor: "#0a0502",
        backgroundImage: "url('/textures/menu_bg.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
        fontFamily: FONTS.body,
      }}
    >
      {/* Background scrim for predictable contrast (a11y). Fixed so it
          covers the viewport on a long page that scrolls. */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-md z-0 pointer-events-none"
        aria-hidden="true"
      />

      {/* Account / wallet surface — Puter sign-in + Crossmint Solana
          wallet status. Hidden when the Puter SDK isn't reachable. */}
      <AccountPanel />

      {/* Accessibility surface — toggle is a visible stub (no-op for now) so
          the a11y story sits on the surface, not buried in settings */}
      <div className="fixed top-3 right-3 z-20">
        <button
          onClick={noop}
          type="button"
          className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border-2 border-zinc-700 rounded-md text-zinc-100 hover:bg-zinc-800 hover:border-zinc-500 focus:outline-none focus:ring-4 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-black transition-colors"
          aria-pressed={false}
          aria-label="Toggle High Contrast Mode"
        >
          <Accessibility className="w-4 h-4" />
          <span className="text-xs font-bold tracking-wide">High Contrast</span>
        </button>
      </div>

      <main className="relative z-10 flex flex-col items-center w-full max-w-3xl px-4 py-6">
        {/* Compact branding block — title + subtitle + tagline on one card. */}
        <header className="text-center mb-4 bg-black/40 px-6 py-3 rounded-xl border border-zinc-800/50 backdrop-blur-sm w-full max-w-xl">
          <h1
            className="text-4xl md:text-5xl font-normal text-amber-400 leading-none drop-shadow-lg"
            style={{ fontFamily: FONTS.title, letterSpacing: "4px" }}
          >
            GRUDGE
          </h1>
          <h2
            className="text-xl md:text-2xl text-amber-500 leading-none mt-1 drop-shadow-md"
            style={{ fontFamily: FONTS.title, letterSpacing: "6px" }}
          >
            SURVIVAL
          </h2>
          <p
            className="text-xs md:text-sm text-zinc-200 font-bold tracking-widest uppercase mt-2"
            style={{ fontFamily: FONTS.body }}
          >
            Fight. Gather. Survive.
          </p>
        </header>

        {/* Primary CTA — full-width, prominent. */}
        <button
          onClick={handlePlay}
          type="button"
          className="w-full max-w-xl flex items-center justify-center gap-3 py-3 px-6 bg-amber-500 text-black border-4 border-amber-600 rounded-lg hover:bg-amber-400 focus:outline-none focus:ring-4 focus:ring-white focus:ring-offset-2 focus:ring-offset-black transition-all"
          aria-label="Start Game Campaign"
        >
          <Play className="w-6 h-6 fill-black" />
          <span
            className="text-2xl font-black tracking-widest"
            style={{ fontFamily: FONTS.header }}
          >
            PLAY
          </span>
          <span
            className="text-sm font-bold opacity-80 ml-2 hidden sm:inline"
            style={{ fontFamily: FONTS.body }}
          >
            — Forge hero, enter the campaign
          </span>
        </button>

        {/* Secondary debug actions — three side-by-side compact tiles. */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-xl mt-3 mb-4">
          <button
          onClick={handleShipwreck}
            type="button"
            className="flex items-center justify-center gap-2 py-2 px-3 bg-zinc-900 text-cyan-300 border-2 border-cyan-900/60 rounded-md hover:bg-zinc-800 hover:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-all"
            aria-label="Start on Shipwreck Island"
            title="Spawn on the shipwreck — harvesting, combat, full resource nodes"
          >
            <Play className="w-4 h-4" />
            <span
              className="text-sm font-bold tracking-wider"
              style={{ fontFamily: FONTS.header }}
            >
              SHIPWRECK
            </span>
          </button>

          <button
            onClick={goToGGE}
            type="button"
            className="flex items-center justify-center gap-2 py-2 px-3 bg-zinc-900 text-purple-300 border-2 border-purple-900/60 rounded-md hover:bg-zinc-800 hover:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-400 transition-all"
            aria-label="Open Level Editor"
            title="Scenes, terrain, enemies, physics"
          >
            <Settings className="w-4 h-4" />
            <span
              className="text-sm font-bold tracking-wider"
              style={{ fontFamily: FONTS.header }}
            >
              EDITOR
            </span>
          </button>

          <button
            onClick={goToController}
            type="button"
            className="flex items-center justify-center gap-2 py-2 px-3 bg-zinc-900 text-emerald-300 border-2 border-emerald-900/60 rounded-md hover:bg-zinc-800 hover:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-all"
            aria-label="Open Controller Lab"
            title="Animations, controller config, live preview"
          >
            <Settings className="w-4 h-4" />
            <span
              className="text-sm font-bold tracking-wider"
              style={{ fontFamily: FONTS.header }}
            >
              CONTROLLER
            </span>
          </button>
        </div>

        {/* Compact controls cheat sheet — three columns, smaller text. */}
        <section
          className="w-full max-w-xl bg-black/80 border border-zinc-700 rounded-xl px-4 py-3"
          aria-label="Controls Cheat Sheet"
        >
          <h3 className="sr-only">Controls</h3>
          <div
            className="grid grid-cols-3 gap-4 text-zinc-200 text-xs"
            style={{ fontFamily: FONTS.mono }}
          >
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-amber-400 border-b border-zinc-800 pb-1 mb-1">
                <Keyboard className="w-3.5 h-3.5" />
                <span className="font-bold">Move</span>
              </div>
              <div className="flex justify-between"><span>WASD</span><span className="text-zinc-400">Move</span></div>
              <div className="flex justify-between"><span>Shift</span><span className="text-zinc-400">Sprint</span></div>
              <div className="flex justify-between"><span>Space</span><span className="text-zinc-400">Jump</span></div>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-amber-400 border-b border-zinc-800 pb-1 mb-1">
                <MousePointer2 className="w-3.5 h-3.5" />
                <span className="font-bold">Action</span>
              </div>
              <div className="flex justify-between"><span>Click</span><span className="text-zinc-400">Attack</span></div>
              <div className="flex justify-between"><span>RMB</span><span className="text-zinc-400">Block</span></div>
              <div className="flex justify-between"><span>C</span><span className="text-zinc-400">Craft</span></div>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-amber-400 border-b border-zinc-800 pb-1 mb-1">
                <Settings className="w-3.5 h-3.5" />
                <span className="font-bold">System</span>
              </div>
              <div className="flex justify-between"><span>E/R/X</span><span className="text-zinc-400">Skills</span></div>
              <div className="flex justify-between"><span>1-0</span><span className="text-zinc-400">Hotbar</span></div>
              <div className="flex justify-between"><span>ESC</span><span className="text-zinc-400">Pause</span></div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
