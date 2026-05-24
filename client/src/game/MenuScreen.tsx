import { useEffect, useState } from "react";
import {
  Play,
  Settings,
  Accessibility,
} from "lucide-react";
import { useGame } from "@/lib/stores/useGame";
import { useCampaign } from "@/lib/stores/useCampaign";
import { kickoffHeroForgePreload } from "./heroForge/preload";
import { kickoffIntroAnimPreload } from "./intro/preload";
import { AccountPanel } from "./AccountPanel";

// Production class backgrounds (from Grudge Warlords class-selector reference)
const CLASS_BACKGROUNDS: Record<string, string> = {
  mage:    "https://i.imgur.com/vKQR4UT.png",
  warrior: "https://i.imgur.com/Wj2mUH2.png",
  ranger:  "https://i.imgur.com/5A6e5kL.png",
  worge:   "https://i.imgur.com/BrQH0Bx.png",
};

// Class accent colors matching the production class-selector
const CLASS_COLORS: Record<string, string> = {
  mage:    "#6aa9ff",
  warrior: "#ff6b57",
  ranger:  "#6bdc8b",
  worge:   "#c792ff",
};

// Particle count
const PARTICLE_COUNT = 60;

// CSS keyframes injected once
const MENU_CSS = `
@keyframes menu-drift{
  0%{opacity:0;transform:translateY(0) scale(.6)}
  10%{opacity:.9}
  100%{opacity:0;transform:translateY(-110vh) scale(1.3)}
}
@keyframes menu-spin{to{transform:rotate(360deg)}}
@keyframes menu-bg-fade{
  0%{opacity:0}
  100%{opacity:1}
}
.menu-stage-bg{
  position:absolute;inset:-4%;background-size:cover;background-position:center;
  filter:saturate(1.1) brightness(.45);
  transform:scale(1.06);
  transition:opacity 1.4s ease,transform 8s ease;
  opacity:0;
}
.menu-stage-bg.active{opacity:1;transform:scale(1.02)}
`;

function injectMenuCSS() {
  if (document.getElementById("grudge-menu-css")) return;
  const style = document.createElement("style");
  style.id = "grudge-menu-css";
  style.textContent = MENU_CSS;
  document.head.appendChild(style);
}

const FONTS = {
  title: "'MorkDungeon', 'Cinzel', serif",
  header: "'Cinzel', serif",
  body: "'Crimson Text', serif",
  mono: "'JetBrains Mono', monospace",
};

const noop = () => {};

// Cycling class showcase: cycles through classes to animate the background
const CLASS_CYCLE = ["warrior", "mage", "ranger", "worge"] as const;

export default function MenuScreen() {
  const { goToGGE, goToController, goToCharacterSelect, enterTutorialIsland, goToHome } = useGame();
  const startCampaign = useCampaign((s) => s.startCampaign);
  const [activeClass, setActiveClass] = useState<string>("warrior");
  const [particles] = useState(() =>
    Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 20}s`,
      duration: `${8 + Math.random() * 18}s`,
      size: `${1 + Math.random() * 2}px`,
      opacity: 0.3 + Math.random() * 0.7,
    }))
  );

  useEffect(() => {
    injectMenuCSS();
    kickoffHeroForgePreload();
    kickoffIntroAnimPreload();
    // Slowly cycle through class backgrounds
    let idx = 0;
    const timer = setInterval(() => {
      idx = (idx + 1) % CLASS_CYCLE.length;
      setActiveClass(CLASS_CYCLE[idx]);
    }, 7000);
    return () => clearInterval(timer);
  }, []);

  const handleShipwreck = () => enterTutorialIsland(null);
  const handlePlay = () => {
    startCampaign();
    useGame.setState({ inTutorialIsland: true });
    goToCharacterSelect();
  };

  const accentColor = CLASS_COLORS[activeClass] ?? "#6ee7b7";

  return (
    <div
      style={{
        minHeight: "100vh", width: "100vw", position: "relative",
        display: "flex", flexDirection: "column", alignItems: "center",
        backgroundColor: "#05060c",
        fontFamily: FONTS.body,
        overflow: "hidden",
      }}
    >
      {/* ── Animated class stage backgrounds ── */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, overflow: "hidden" }}>
        {CLASS_CYCLE.map(cls => (
          <div
            key={cls}
            className={`menu-stage-bg${cls === activeClass ? " active" : ""}`}
            style={{ backgroundImage: `url('${CLASS_BACKGROUNDS[cls]}')` }}
          />
        ))}
        {/* Dark vignette overlay */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: [
            "radial-gradient(1200px 700px at 50% 110%,rgba(0,0,0,.78),transparent 55%)",
            "radial-gradient(900px 500px at 10% -10%,rgba(5,6,18,.65),transparent 60%)",
            "linear-gradient(180deg,rgba(5,6,12,.5),rgba(5,6,12,.88))",
          ].join(","),
        }} />
        {/* Conic gradient sheen */}
        <div style={{
          position: "absolute", inset: "-20%", pointerEvents: "none",
          background: `conic-gradient(from 0deg at 30% 40%,${accentColor}18,transparent 25%,rgba(199,146,255,.10) 55%,transparent 80%)`,
          filter: "blur(60px)",
          animation: "menu-spin 40s linear infinite",
          opacity: 0.8,
        }} />
        {/* Floating particles */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", mixBlendMode: "screen", opacity: 0.7 }}>
          {particles.map(p => (
            <span key={p.id} style={{
              position: "absolute", display: "block",
              width: p.size, height: p.size, borderRadius: "50%",
              background: "#fff", opacity: 0,
              left: p.left, bottom: "-10px",
              animation: `menu-drift ${p.duration} ${p.delay} linear infinite`,
            }} />
          ))}
        </div>
      </div>

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
        {/* Gold gradient brand block — matches production class-selector design */}
        <header style={{
          textAlign: "center", marginBottom: 20, padding: "20px 32px 16px",
          background: "linear-gradient(135deg,rgba(14,22,48,.7),rgba(20,26,43,.5))",
          border: "1px solid rgba(246,201,69,.18)", borderRadius: 18,
          backdropFilter: "blur(14px)",
          width: "100%", maxWidth: 560,
          boxShadow: "0 20px 60px -20px rgba(0,0,0,.55)",
        }}>
          <div style={{
            fontFamily: FONTS.title,
            fontWeight: 900, letterSpacing: "4px", fontSize: 40,
            background: "linear-gradient(90deg,#f6c945,#fff3c2 50%,#f6c945)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            textShadow: "none",
            filter: "drop-shadow(0 0 24px rgba(246,201,69,.2))",
          }}>GRUDGE WARLORDS</div>
          <div style={{
            fontFamily: FONTS.header, fontSize: 10, letterSpacing: "4px",
            color: "#9aa3c7", fontWeight: 600, marginTop: 4,
          }}>FORGE YOUR LEGEND</div>
          {/* Animated class indicator */}
          <div style={{
            marginTop: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>
            {CLASS_CYCLE.map(cls => (
              <div key={cls} style={{
                width: 8, height: 8, borderRadius: "50%",
                background: cls === activeClass ? CLASS_COLORS[cls] : "rgba(255,255,255,.15)",
                boxShadow: cls === activeClass ? `0 0 12px ${CLASS_COLORS[cls]}` : "none",
                transition: "all .4s ease",
              }} />
            ))}
          </div>
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

        {/* Secondary actions */}
        <button
          onClick={goToHome}
          type="button"
          className="w-full max-w-xl flex items-center justify-center gap-2 py-2 px-4 mt-2 bg-zinc-900 text-zinc-300 border-2 border-zinc-700 rounded-lg hover:bg-zinc-800 hover:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all"
          aria-label="Go to Game Hub"
        >
          <span className="text-sm font-bold tracking-wider" style={{ fontFamily: FONTS.header }}>GAME HUB</span>
          <span className="text-xs opacity-60 ml-1">— all modes & fleet games</span>
        </button>

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

        {/* Compact controls cheat sheet */}
        <section style={{
          width: "100%", maxWidth: 560,
          background: "linear-gradient(135deg,rgba(16,20,36,.75),rgba(8,10,20,.75))",
          border: "1px solid rgba(255,255,255,.08)",
          borderRadius: 14, padding: "12px 16px",
          backdropFilter: "blur(12px)",
        }} aria-label="Controls">
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16,
            color: "#dfe3f7", fontSize: 11, fontFamily: FONTS.mono,
          }}>
            {[
              { icon: "⌨️", label: "Move",   rows: [["WASD","Move"],["Shift","Sprint"],["Space","Jump"]] },
              { icon: "🖱️", label: "Action", rows: [["Click","Attack"],["RMB","Block"],["C","Craft"]] },
              { icon: "⚙️", label: "System", rows: [["E/R/X","Skills"],["1-0","Hotbar"],["ESC","Pause"]] },
            ].map(col => (
              <div key={col.label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 5,
                  color: "#f6c945", borderBottom: "1px solid rgba(255,255,255,.06)",
                  paddingBottom: 4, marginBottom: 2, fontSize: 11,
                }}>
                  <span>{col.icon}</span>
                  <span style={{ fontFamily: FONTS.header, fontWeight: "bold", letterSpacing: 1 }}>{col.label}</span>
                </div>
                {col.rows.map(([key, val]) => (
                  <div key={key} style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>{key}</span>
                    <span style={{ color: "#9aa3c7" }}>{val}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
