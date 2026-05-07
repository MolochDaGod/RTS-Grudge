import React, { useState, useEffect } from 'react';
import { Sword, Shield, Zap, Flame, Wind, MessageSquare, Keyboard, Map, Settings, Volume2, Drumstick } from 'lucide-react';

export function HierarchyV1A() {
  const [logExpanded, setLogExpanded] = useState(false);
  const [controlsExpanded, setControlsExpanded] = useState(false);
  const [hpFlash, setHpFlash] = useState(false);
  const [secondaryHovered, setSecondaryHovered] = useState(false);

  // Simulate damage flash every few seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setHpFlash(true);
      setTimeout(() => setHpFlash(false), 300);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full h-full min-h-screen bg-[#0a0705] relative overflow-hidden text-zinc-200 select-none flex flex-col justify-between" style={{ fontFamily: "'Crimson Text', serif", backgroundImage: 'radial-gradient(circle at 50% 50%, #1a120c 0%, #0a0705 100%)' }}>
      <style>{`
        @keyframes hpGlow {
          0% { box-shadow: 0 0 15px rgba(220, 38, 38, 0.5), inset 0 0 10px rgba(220, 38, 38, 0.3); }
          50% { box-shadow: 0 0 35px rgba(220, 38, 38, 0.9), inset 0 0 20px rgba(220, 38, 38, 0.5); }
          100% { box-shadow: 0 0 15px rgba(220, 38, 38, 0.5), inset 0 0 10px rgba(220, 38, 38, 0.3); }
        }
        .hp-glow-critical {
          animation: hpGlow 1.5s infinite;
        }
      `}</style>
      
      {/* STRATEGIC INFO - Top Bar - Subdued to 0.3 opacity, brightens on hover */}
      <div className="w-full flex justify-between items-start p-4 group">
        {/* Top Left - Avatar/Level */}
        <div className="opacity-30 hover:opacity-100 transition-opacity duration-300 flex items-center gap-4">
          <div className="flex items-center gap-3 bg-zinc-900/40 border border-[#c9950a]/20 p-2 rounded-r-full pl-6 -ml-4">
            <div className="w-10 h-10 rounded-full bg-zinc-800 border border-[#c9950a]/50 flex items-center justify-center text-lg">
              🧙‍♂️
            </div>
            <div className="pr-4 flex flex-col justify-center">
              <div className="text-[#c9950a] font-bold text-base leading-tight" style={{ fontFamily: "'Cinzel', serif" }}>Level 42</div>
              <div className="w-24 h-1 bg-zinc-950 rounded-full overflow-hidden mt-1">
                <div className="h-full bg-purple-600 w-[75%]"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Top Center - Strategic Resources & Score */}
        <div className="opacity-30 hover:opacity-100 transition-opacity duration-300 flex items-center gap-8 bg-zinc-900/40 border border-[#c9950a]/20 px-6 py-1.5 rounded-b-xl -mt-4">
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-1.5"><span className="text-amber-700 text-xs">🪵</span><span className="font-mono text-xs">450</span></div>
            <div className="flex items-center gap-1.5"><span className="text-zinc-400 text-xs">🪨</span><span className="font-mono text-xs">210</span></div>
            <div className="flex items-center gap-1.5"><span className="text-yellow-500 text-xs">🪙</span><span className="font-mono text-xs text-yellow-500">1,240</span></div>
          </div>
          <div className="w-px h-4 bg-zinc-700/50"></div>
          <div className="flex items-center gap-5 text-xs">
            <div>Score: <span className="text-amber-500 font-mono">15,400</span></div>
            <div>Kills: <span className="text-red-400 font-mono">342</span></div>
            <div className="text-amber-200">Wave <span className="font-bold font-mono">12</span></div>
          </div>
        </div>

        {/* Top Right - Settings & Minimap */}
        <div className="opacity-30 hover:opacity-100 transition-opacity duration-300 flex items-start gap-3">
          <div className="flex gap-1.5">
            {[Settings, Volume2].map((Icon, i) => (
              <button key={i} className="w-6 h-6 rounded bg-zinc-900/40 border border-zinc-800 flex items-center justify-center text-zinc-500 hover:text-[#c9950a] hover:border-[#c9950a]/50 transition-colors">
                <Icon size={12} />
              </button>
            ))}
          </div>
          {/* Shrunk Minimap */}
          <div className="w-20 h-20 rounded-full border border-[#c9950a]/30 bg-zinc-900/60 overflow-hidden relative flex items-center justify-center">
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #4a5568 10%, transparent 80%)' }}></div>
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"></div>
            <div className="w-1 h-1 rounded-full bg-red-500 absolute top-1/3 left-2/3"></div>
            <div className="text-[9px] absolute bottom-1 font-bold text-amber-500 opacity-50">N</div>
          </div>
        </div>
      </div>

      {/* BOTTOM AREA - Highly Focused Action & Combat */}
      <div className="relative w-full pb-6 pt-20 flex justify-center items-end bg-gradient-to-t from-black to-transparent">
        
        {/* Extreme Minimal Combat Log */}
        <div 
          className="absolute left-6 bottom-6 flex flex-col justify-end"
          onMouseEnter={() => setLogExpanded(true)}
          onMouseLeave={() => setLogExpanded(false)}
        >
          <div className={`
            bg-[#1a120c]/90 border border-[#c9950a]/30 rounded-lg backdrop-blur-md overflow-hidden transition-all duration-200 ease-in-out origin-bottom-left
            ${logExpanded ? 'w-80 h-48 opacity-100 mb-2 scale-100' : 'w-2 h-2 opacity-0 mb-0 scale-0'}
          `}>
            <div className="p-3 text-xs space-y-1 overflow-y-auto h-full font-sans">
              <div className="text-zinc-400">[System]: Area cleared.</div>
              <div className="text-[#c9950a]">[Loot]: Found +15 Gold.</div>
              <div className="text-amber-300">[Combat]: Critical Hit! 450 damage.</div>
              <div className="text-red-400">[Combat]: Took 32 damage.</div>
            </div>
          </div>
          <div className={`w-3 h-3 rounded-full bg-zinc-600 transition-all cursor-pointer ${logExpanded ? 'bg-[#c9950a] shadow-[0_0_8px_#c9950a]' : 'hover:bg-zinc-400'}`}></div>
        </div>

        {/* Extreme Minimal Controls */}
        <div 
          className="absolute right-6 bottom-6 flex flex-col items-end justify-end"
          onMouseEnter={() => setControlsExpanded(true)}
          onMouseLeave={() => setControlsExpanded(false)}
        >
          <div className={`
            bg-[#1a120c]/90 border border-[#c9950a]/30 rounded-lg backdrop-blur-md overflow-hidden transition-all duration-200 ease-in-out origin-bottom-right
            ${controlsExpanded ? 'w-48 h-auto opacity-100 mb-2 scale-100' : 'w-2 h-2 opacity-0 mb-0 scale-0'}
          `}>
            <div className="p-3 text-xs space-y-2 font-sans">
              <div className="flex justify-between"><span className="text-zinc-400">Move</span><span className="font-mono text-zinc-300">WASD</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">Attack</span><span className="font-mono text-zinc-300">L-Click</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">Dodge</span><span className="font-mono text-zinc-300">Space</span></div>
            </div>
          </div>
          <div className={`w-3 h-3 rounded-full bg-zinc-600 transition-all cursor-pointer ${controlsExpanded ? 'bg-[#c9950a] shadow-[0_0_8px_#c9950a]' : 'hover:bg-zinc-400'}`}></div>
        </div>

        {/* PRIMARY COMBAT FOCUS - Center */}
        <div className="flex flex-col items-center relative w-full max-w-2xl">
          
          {/* Active Weapon */}
          <div className="absolute -top-16 flex items-center gap-2 opacity-60">
            <Sword size={14} className="text-[#c9950a]" />
            <span className="text-xs tracking-wider text-zinc-400 uppercase" style={{ fontFamily: "'Cinzel', serif" }}>Greatsword</span>
          </div>

          {/* Huge Numeric HP Readout */}
          <div className="mb-2 flex items-baseline gap-2 text-white drop-shadow-[0_2px_10px_rgba(220,38,38,0.8)]">
            <span className="text-5xl font-black font-mono tracking-tighter">182</span>
            <span className="text-xl text-red-500/80 font-mono font-bold">/ 1000</span>
          </div>

          {/* Subdued Skills (Only cooldowns draw attention) */}
          <div className="flex gap-1.5 mb-6 relative z-10">
            {[
              { key: '1', icon: <Flame />, cd: 0 },
              { key: '2', icon: <Zap />, cd: 2.5 },
              { key: '3', icon: <Wind />, cd: 0 },
              { key: '4', icon: <Shield />, cd: 8.2 },
              { key: '5', icon: <Sword />, cd: 0 },
            ].map((skill, i) => (
              <div key={i} className="relative group">
                <div className={`
                  w-8 h-8 rounded-sm border flex items-center justify-center relative overflow-hidden transition-all
                  ${skill.cd > 0 ? 'border-red-900/80 bg-red-950/40 shadow-[0_0_10px_rgba(220,38,38,0.3)]' : 'border-zinc-800 bg-transparent opacity-40'} 
                `}>
                  {skill.cd > 0 && (
                    <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-10 backdrop-blur-[1px]">
                      <span className="font-mono font-bold text-red-400 text-sm drop-shadow-md">{skill.cd}</span>
                    </div>
                  )}
                  <div className={`text-zinc-400 ${skill.cd > 0 ? 'opacity-20' : 'opacity-100'}`}>
                    {React.cloneElement(skill.icon as React.ReactElement, { size: 14 })}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* OVERWHELMING HP BAR */}
          <div className="relative z-20 flex flex-col items-center w-full">
            <div className={`w-[560px] h-10 bg-black border-2 border-[#1a120c] relative rounded-sm ${hpFlash ? 'bg-white' : ''}`}>
              {/* Animated Glow Border indicating critical health */}
              <div className="absolute -inset-1 rounded border border-red-500 hp-glow-critical pointer-events-none"></div>
              
              {/* Flash overlay */}
              {hpFlash && <div className="absolute inset-0 bg-white/40 z-30 pointer-events-none mix-blend-overlay"></div>}

              {/* Health fill */}
              <div className="h-full w-[18.2%] bg-gradient-to-b from-red-600 to-red-900 relative transition-all duration-200">
                <div className="absolute top-0 left-0 right-0 h-1/4 bg-white/10"></div>
                <div className="absolute right-0 top-0 bottom-0 w-1 bg-red-400"></div>
              </div>
            </div>

            {/* Secondary Vitals - Shrunk to lines */}
            <div 
              className="flex w-[560px] justify-between gap-1 mt-1.5"
              onMouseEnter={() => setSecondaryHovered(true)}
              onMouseLeave={() => setSecondaryHovered(false)}
            >
              <div className={`flex-1 bg-zinc-900 transition-all duration-200 ${secondaryHovered ? 'h-3' : 'h-1'}`}>
                <div className="h-full w-[60%] bg-blue-600 relative">
                  {secondaryHovered && <span className="absolute right-1 text-[8px] font-mono text-white leading-3">60%</span>}
                </div>
              </div>
              <div className={`flex-1 bg-zinc-900 transition-all duration-200 ${secondaryHovered ? 'h-3' : 'h-1'}`}>
                <div className="h-full w-[90%] bg-green-600 relative">
                  {secondaryHovered && <span className="absolute right-1 text-[8px] font-mono text-white leading-3">90%</span>}
                </div>
              </div>
            </div>

            {/* Tertiary: Hunger - Icon only, urgency based */}
            <div className="absolute -right-6 top-1/2 -translate-y-1/2 text-orange-500 animate-bounce">
              {/* Only shows if critical (simulated here as always showing since we are designing the state) */}
              <Drumstick size={16} className="drop-shadow-[0_0_5px_rgba(249,115,22,0.8)]" />
            </div>
          </div>

          {/* HOTBAR - Flattened, all slots same size except selected */}
          <div className="flex items-end justify-center mt-6 gap-1 h-14">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => {
              const isSelected = i === 4;
              
              const item = i === 4 ? '🗡️' : i === 3 ? '🧪' : i === 5 ? '🏹' : i === 1 ? '🍎' : null;
              const count = i === 3 ? 5 : i === 1 ? 12 : null;

              return (
                <div 
                  key={i} 
                  className={`
                    rounded bg-[#1a120c] flex items-center justify-center relative transition-all duration-200
                    ${isSelected ? 'w-14 h-14 border border-[#c9950a] shadow-[0_0_15px_rgba(201,149,10,0.6)] z-10 -translate-y-1' : 'w-10 h-10 border border-zinc-800/50 opacity-60 hover:opacity-100'}
                  `}
                >
                  {/* Selected Glow internal */}
                  {isSelected && <div className="absolute inset-0 bg-[#c9950a]/10"></div>}
                  
                  <div className="relative z-10 flex items-center justify-center w-full h-full">
                    {item && <span className={`${isSelected ? 'text-2xl drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]' : 'text-lg grayscale opacity-70'} filter`}>{item}</span>}
                  </div>
                  
                  <span className={`absolute top-0.5 left-1 font-mono font-bold z-20 ${isSelected ? 'text-[10px] text-[#c9950a]' : 'text-[8px] text-zinc-600'}`}>
                    {i + 1}
                  </span>
                  
                  {count && (
                    <span className={`absolute bottom-0 right-1 font-mono font-bold z-20 ${isSelected ? 'text-[10px] text-white' : 'text-[8px] text-zinc-500'}`}>
                      {count}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </div>
  );
}
