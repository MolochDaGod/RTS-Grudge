import { Play, Settings, Accessibility, Keyboard, MousePointer2 } from "lucide-react";
import './_group.css';

const FONTS = {
  title: "'MorkDungeon', 'Cinzel', serif",
  header: "'Cinzel', serif",
  body: "'Crimson Text', serif",
  mono: "'JetBrains Mono', monospace",
};

const noop = () => {};

export function AccessibilityFirst() {
  return (
    <div
      className="min-h-screen w-screen relative flex flex-col items-center justify-center overflow-hidden"
      style={{
        backgroundColor: "#0a0502",
        backgroundImage: "url('/__mockup/images/menu_bg.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        fontFamily: FONTS.body,
      }}
    >
      {/* Background scrim for predictable contrast (a11y) */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md z-0 pointer-events-none" aria-hidden="true" />

      {/* Accessibility surface — toggle is a visual mockup stub (no-op) so the
          a11y story is visibly part of the UI surface, not buried in settings */}
      <div className="absolute top-6 right-6 z-20 flex gap-4">
        <button
          onClick={noop}
          type="button"
          className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border-2 border-zinc-700 rounded-md text-zinc-100 hover:bg-zinc-800 hover:border-zinc-500 focus:outline-none focus:ring-4 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-black transition-colors"
          aria-pressed={false}
          aria-label="Toggle High Contrast Mode"
        >
          <Accessibility className="w-5 h-5" />
          <span className="text-sm font-bold tracking-wide">High Contrast</span>
        </button>
      </div>

      <main className="relative z-10 flex flex-col items-center w-full max-w-4xl px-6">
        
        {/* High contrast, legible branding block */}
        <header className="text-center mb-12 bg-black/40 p-8 rounded-xl border border-zinc-800/50 backdrop-blur-sm w-full max-w-2xl">
          <h1 
            className="text-6xl md:text-8xl font-normal text-amber-400 mb-2 drop-shadow-lg"
            style={{ fontFamily: FONTS.title, letterSpacing: '4px' }}
          >
            GRUDGE
          </h1>
          <h2 
            className="text-3xl md:text-4xl text-amber-500 mb-6 drop-shadow-md"
            style={{ fontFamily: FONTS.title, letterSpacing: '6px' }}
          >
            SURVIVAL
          </h2>
          
          {/* Increased font size and tame letter spacing for readability */}
          <p className="text-xl text-zinc-200 font-bold tracking-wide uppercase" style={{ fontFamily: FONTS.body }}>
            Fight. Gather. Survive.
          </p>
        </header>

        {/* Distinct CTA shapes & high-contrast styles */}
        <div className="flex flex-col sm:flex-row w-full max-w-2xl gap-6 mb-16">
          <button 
            className="flex-1 group relative flex flex-col items-center justify-center p-6 bg-amber-500 text-black border-4 border-amber-600 rounded-lg hover:bg-amber-400 focus:outline-none focus:ring-4 focus:ring-white focus:ring-offset-4 focus:ring-offset-black transition-all"
            aria-label="Start Game Campaign"
          >
            <div className="flex items-center gap-3 mb-2">
              <Play className="w-8 h-8 fill-black" />
              <span className="text-3xl font-black tracking-widest" style={{ fontFamily: FONTS.header }}>PLAY</span>
            </div>
            <span className="text-lg font-bold opacity-90" style={{ fontFamily: FONTS.body }}>Forge hero, enter the campaign</span>
          </button>

          <button 
            className="flex-1 group relative flex flex-col items-center justify-center p-6 bg-zinc-900 text-purple-300 border-4 border-purple-900/50 rounded-lg hover:bg-zinc-800 hover:border-purple-500 focus:outline-none focus:ring-4 focus:ring-white focus:ring-offset-4 focus:ring-offset-black transition-all"
            aria-label="Open Level Editor"
          >
            <div className="flex items-center gap-3 mb-2">
              <Settings className="w-6 h-6" />
              <span className="text-2xl font-bold tracking-widest" style={{ fontFamily: FONTS.header }}>EDITOR</span>
            </div>
            <span className="text-base text-zinc-400" style={{ fontFamily: FONTS.body }}>Scenes, terrain, enemies, physics</span>
          </button>
        </div>

        {/* High contrast, large font cheat sheet with semantic sections */}
        <section 
          className="w-full bg-black/80 border border-zinc-700 rounded-xl p-8"
          aria-label="Controls Cheat Sheet"
        >
          <h3 className="sr-only">Controls</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-zinc-200 text-lg" style={{ fontFamily: FONTS.mono }}>
            
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-amber-400 mb-2 border-b border-zinc-800 pb-2">
                <Keyboard className="w-5 h-5" />
                <span className="font-bold">Movement</span>
              </div>
              <div className="flex justify-between"><span>WASD</span> <span className="text-zinc-400">Move</span></div>
              <div className="flex justify-between"><span>Shift</span> <span className="text-zinc-400">Sprint</span></div>
              <div className="flex justify-between"><span>Space</span> <span className="text-zinc-400">Jump</span></div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-amber-400 mb-2 border-b border-zinc-800 pb-2">
                <MousePointer2 className="w-5 h-5" />
                <span className="font-bold">Action</span>
              </div>
              <div className="flex justify-between"><span>Click</span> <span className="text-zinc-400">Attack</span></div>
              <div className="flex justify-between"><span>E</span> <span className="text-zinc-400">Block</span></div>
              <div className="flex justify-between"><span>C</span> <span className="text-zinc-400">Crafting</span></div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-amber-400 mb-2 border-b border-zinc-800 pb-2">
                <Settings className="w-5 h-5" />
                <span className="font-bold">System</span>
              </div>
              <div className="flex justify-between"><span>1-5</span> <span className="text-zinc-400">Special</span></div>
              <div className="flex justify-between"><span>ESC</span> <span className="text-zinc-400">Pause</span></div>
            </div>

          </div>
        </section>

      </main>
    </div>
  );
}
