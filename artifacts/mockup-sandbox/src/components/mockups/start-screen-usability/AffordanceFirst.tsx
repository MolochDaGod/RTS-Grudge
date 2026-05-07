import { useState } from "react";
import { Sword, Wrench, ChevronRight } from "lucide-react";
import './_group.css';

const FONTS = {
  title: "'MorkDungeon', 'Cinzel', serif",
  header: "'Cinzel', serif",
  body: "'Crimson Text', serif",
  mono: "'JetBrains Mono', monospace",
};

export function AffordanceFirst() {
  return (
    <div className="menu-bg relative w-screen h-screen min-h-screen flex flex-col items-center justify-center overflow-hidden text-white" style={{ fontFamily: FONTS.header }}>
      {/* Background gradients */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,rgba(0,0,0,0.2)_0%,rgba(0,0,0,0.7)_60%,rgba(0,0,0,0.85)_100%)] pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0a0502e6] pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center max-w-[800px] w-full px-6">
        
        {/* Title Block */}
        <div className="text-center mb-10 flex flex-col items-center drop-shadow-2xl">
          <h1 
            className="text-[clamp(72px,12vw,110px)] m-0 leading-none tracking-[6px] font-normal text-[#f0d68a]"
            style={{ 
              fontFamily: FONTS.title,
              textShadow: "0 0 60px rgba(201,149,10,0.6), 0 4px 12px rgba(0,0,0,0.9), 0 0 120px rgba(201,149,10,0.2), 2px 2px 0 rgba(100,60,10,0.5)"
            }}
          >
            GRUDGE
          </h1>
          <div 
            className="text-[clamp(28px,5vw,42px)] tracking-[8px] mb-1 text-[#c9950a]"
            style={{
              fontFamily: FONTS.title,
              textShadow: "0 0 30px rgba(201,149,10,0.4), 0 2px 6px rgba(0,0,0,0.8)"
            }}
          >
            SURVIVAL
          </div>
          <p 
            className="text-[13px] text-[#c9950a99] tracking-[10px] uppercase m-0"
            style={{ fontFamily: FONTS.body, textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}
          >
            Fight. Gather. Survive.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-4 w-full max-w-[480px] mb-12">
          <PlayButton />
          <EditorButton />
        </div>

        {/* Controls Cheat Sheet - Keycaps */}
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-3 text-xs text-[#c9950a80]">
          <ControlGroup keys={['W','A','S','D']} label="Move" />
          <ControlGroup keys={['Shift']} label="Sprint" />
          <ControlGroup keys={['Space']} label="Jump" />
          <ControlGroup keys={['Click']} label="Attack" />
          <ControlGroup keys={['E']} label="Block" />
          <ControlGroup keys={['C']} label="Crafting" />
          <ControlGroup keys={['1-5']} label="Special" />
          <ControlGroup keys={['ESC']} label="Pause" />
        </div>

      </div>
    </div>
  );
}

function PlayButton() {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  return (
    <button
      onClick={() => { /* play sound cue: click.wav */ }}
      onMouseEnter={() => { setHovered(true); /* play sound cue: hover.wav */ }}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      className={`
        relative flex items-center justify-between w-full 
        p-4 pr-6 rounded-lg 
        bg-gradient-to-b from-[#3a2a18] to-[#1a1208]
        border-2 border-t-[#e2b55b] border-b-[#8b6528] border-x-[#b3883b]
        transition-all duration-200 ease-out outline-none
        focus-visible:ring-4 focus-visible:ring-[#c9950a66]
        ${pressed ? 'scale-[0.98] translate-y-1 shadow-[0_0_0_rgba(0,0,0,0.8)]' : hovered ? 'scale-[1.02] -translate-y-1 shadow-[0_12px_30px_rgba(0,0,0,0.8),0_0_20px_rgba(201,149,10,0.4)]' : 'shadow-[0_8px_20px_rgba(0,0,0,0.8)] animate-[pulse_4s_ease-in-out_infinite]'}
      `}
      style={{
        boxShadow: pressed 
          ? 'inset 0 4px 8px rgba(0,0,0,0.8), 0 1px 2px rgba(0,0,0,0.5)' 
          : hovered 
            ? 'inset 0 1px 1px rgba(255,255,255,0.2), 0 12px 30px rgba(0,0,0,0.8), 0 0 20px rgba(201,149,10,0.4)' 
            : 'inset 0 1px 1px rgba(255,255,255,0.1), 0 8px 20px rgba(0,0,0,0.8)'
      }}
    >
      {/* Glossy top highlight */}
      <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/10 to-transparent rounded-t-md pointer-events-none" />

      <div className="flex items-center gap-5 z-10">
        <div className={`p-3 rounded-md bg-[#110c05] border border-[#c9950a40] shadow-[inset_0_2px_5px_rgba(0,0,0,0.8)] transition-colors ${hovered ? 'bg-[#1a1208]' : ''}`}>
          <Sword className={`w-8 h-8 ${hovered ? 'text-[#f0d68a]' : 'text-[#c9950a]'}`} />
        </div>
        <div className="flex flex-col items-start">
          <span className={`text-xl font-bold tracking-[4px] transition-colors ${hovered ? 'text-[#fceabb] drop-shadow-[0_0_8px_rgba(252,234,187,0.5)]' : 'text-[#f0d68a]'}`} style={{ textShadow: "0 2px 4px rgba(0,0,0,0.8)" }}>
            PLAY CAMPAIGN
          </span>
          <span className="text-sm text-[#a89984]" style={{ fontFamily: FONTS.body }}>
            Forge your hero, enter the world
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4 z-10">
        <div className="flex items-center justify-center px-2.5 py-1 min-w-[60px] rounded bg-[#0a0502] border border-[#3a2a18] shadow-[inset_0_2px_4px_rgba(0,0,0,0.8),0_1px_0_rgba(255,255,255,0.1)] text-[#8a7e6a] text-xs font-bold tracking-widest" style={{ fontFamily: FONTS.mono }}>
          ENTER
        </div>
        <ChevronRight className={`w-6 h-6 transition-transform duration-300 ${hovered ? 'translate-x-1 text-[#f0d68a]' : 'text-[#c9950a66]'}`} />
      </div>
    </button>
  );
}

function EditorButton() {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  return (
    <button
      onClick={() => { /* play sound cue: click_secondary.wav */ }}
      onMouseEnter={() => { setHovered(true); /* play sound cue: hover_secondary.wav */ }}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      className={`
        relative flex items-center justify-between w-full 
        p-3 pr-6 rounded-lg
        bg-[#0a0502cc] backdrop-blur-md
        border border-[#8b5cf640]
        transition-all duration-200 ease-out outline-none
        focus-visible:ring-4 focus-visible:ring-[#8b5cf640]
        ${pressed ? 'scale-[0.98] translate-y-0.5' : hovered ? 'scale-[1.01] -translate-y-0.5 border-[#8b5cf680] bg-[#1a0f2ecc]' : ''}
      `}
      style={{
        boxShadow: pressed 
          ? 'inset 0 4px 8px rgba(0,0,0,0.8)' 
          : hovered 
            ? 'inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 20px rgba(0,0,0,0.6), 0 0 15px rgba(139,92,246,0.2)' 
            : '0 4px 12px rgba(0,0,0,0.5)'
      }}
    >
      <div className="flex items-center gap-4 z-10">
        <div className={`p-2.5 rounded bg-[#0a0502] border border-[#8b5cf630] shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)] transition-colors ${hovered ? 'border-[#8b5cf660]' : ''}`}>
          <Wrench className={`w-6 h-6 ${hovered ? 'text-[#c4b5fd]' : 'text-[#8b5cf6]'}`} />
        </div>
        <div className="flex flex-col items-start">
          <span className={`text-base font-bold tracking-[3px] transition-colors ${hovered ? 'text-[#ddd6fe]' : 'text-[#a78bfa]'}`}>
            WORLD EDITOR
          </span>
          <span className="text-xs text-[#8a7e6a]" style={{ fontFamily: FONTS.body }}>
            Modify scenes, terrain, and enemies
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4 z-10">
        <div className="flex items-center justify-center px-2.5 py-1 min-w-[32px] rounded bg-black/60 border border-[#2a1a4a] shadow-[inset_0_2px_4px_rgba(0,0,0,0.8),0_1px_0_rgba(255,255,255,0.05)] text-[#8a7e6a] text-xs font-bold tracking-widest" style={{ fontFamily: FONTS.mono }}>
          E
        </div>
        <ChevronRight className={`w-5 h-5 transition-transform duration-300 ${hovered ? 'translate-x-1 text-[#a78bfa]' : 'text-[#8b5cf640]'}`} />
      </div>
    </button>
  );
}

function ControlGroup({ keys, label }: { keys: string[], label: string }) {
  return (
    <div className="flex items-center gap-2 bg-[#00000066] rounded px-3 py-1.5 border border-[#ffffff05] shadow-[inset_0_1px_4px_rgba(0,0,0,0.5)]">
      <div className="flex items-center gap-1">
        {keys.map((k, i) => (
          <div 
            key={i}
            className="flex items-center justify-center min-w-[26px] h-[26px] px-2 rounded bg-gradient-to-b from-[#2a2a2a] to-[#111] border border-t-[#4a4a4a] border-b-[#000] border-x-[#2a2a2a] shadow-[0_2px_4px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.1)] text-[#d4c4a8] font-bold text-[11px]"
            style={{ fontFamily: FONTS.mono }}
          >
            {k}
          </div>
        ))}
      </div>
      <span className="text-xs uppercase tracking-wider text-[#8a7e6a] ml-1.5 font-bold" style={{ fontFamily: FONTS.body }}>{label}</span>
    </div>
  );
}
