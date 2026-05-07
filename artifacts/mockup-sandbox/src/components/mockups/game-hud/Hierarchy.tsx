import React, { useState } from 'react';
import { Sword, Shield, Zap, Flame, Wind, MessageSquare, Keyboard, Map, Settings, Volume2 } from 'lucide-react';

export function Hierarchy() {
  const [logExpanded, setLogExpanded] = useState(false);
  const [controlsExpanded, setControlsExpanded] = useState(false);

  return (
    <div className="w-full h-full min-h-screen bg-zinc-950 relative overflow-hidden text-zinc-200 select-none flex flex-col justify-between" style={{ fontFamily: "'Crimson Text', serif", backgroundImage: 'radial-gradient(circle at 50% 50%, #2a1f1a 0%, #0a0705 100%)' }}>
      
      {/* STRATEGIC INFO - Top Bar - Minimal */}
      <div className="w-full flex justify-between items-start p-4 bg-gradient-to-b from-black/80 to-transparent">
        {/* Top Left - Long-term info */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 bg-zinc-900/60 border border-amber-600/30 p-2 rounded-r-full pl-6 -ml-4 backdrop-blur-sm shadow-[0_0_15px_rgba(0,0,0,0.5)]">
            <div className="w-12 h-12 rounded-full bg-zinc-800 border-2 border-amber-500/80 flex items-center justify-center text-xl shadow-[0_0_10px_rgba(201,149,10,0.4)]">
              🧙‍♂️
            </div>
            <div className="pr-4 flex flex-col justify-center">
              <div className="text-amber-500 font-bold text-lg leading-tight" style={{ fontFamily: "'Cinzel', serif" }}>Level 42</div>
              <div className="w-32 h-1.5 bg-zinc-950 rounded-full overflow-hidden mt-1 border border-zinc-700">
                <div className="h-full bg-purple-600 w-[75%]" style={{ boxShadow: '0 0 10px #9333ea' }}></div>
              </div>
              <div className="text-[10px] text-zinc-400 mt-0.5" style={{ fontFamily: "'JetBrains Mono', monospace" }}>XP: 14,200 / 20,000</div>
            </div>
          </div>
        </div>

        {/* Top Center - Strategic Resources */}
        <div className="flex items-center gap-8 bg-zinc-900/60 border-b border-l border-r border-amber-700/30 px-8 py-2 rounded-b-xl -mt-4 shadow-lg backdrop-blur-sm">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-amber-700">🪵</span>
              <span className="font-mono text-sm">450</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-zinc-400">🪨</span>
              <span className="font-mono text-sm">210</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-yellow-500">🪙</span>
              <span className="font-mono text-sm text-yellow-500">1,240</span>
            </div>
          </div>
          <div className="w-px h-6 bg-zinc-700/50"></div>
          <div className="flex items-center gap-6 text-sm">
            <div>Score: <span className="text-amber-500 font-mono">15,400</span></div>
            <div>Kills: <span className="text-red-400 font-mono">342</span></div>
            <div className="text-amber-200">Wave <span className="font-bold font-mono">12</span></div>
          </div>
        </div>

        {/* Top Right - Settings & Minimap indicator */}
        <div className="flex items-start gap-4">
          <div className="flex gap-2">
            {[Settings, Volume2, Map].map((Icon, i) => (
              <button key={i} className="w-8 h-8 rounded bg-zinc-900/80 border border-zinc-700 flex items-center justify-center text-zinc-400 hover:text-amber-500 hover:border-amber-500/50 transition-colors">
                <Icon size={16} />
              </button>
            ))}
          </div>
          <div className="w-32 h-32 rounded-full border-2 border-amber-700/50 bg-zinc-900/80 overflow-hidden relative shadow-[0_0_20px_rgba(0,0,0,0.8)] flex items-center justify-center">
            {/* Fake minimap content */}
            <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #4a5568 10%, transparent 80%)' }}></div>
            <div className="w-2 h-2 rounded-full bg-amber-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 shadow-[0_0_8px_#f59e0b]"></div>
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 absolute top-1/3 left-2/3 shadow-[0_0_5px_#ef4444]"></div>
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 absolute top-2/3 left-1/4 shadow-[0_0_5px_#ef4444]"></div>
            <div className="text-xs absolute bottom-3 font-bold text-amber-500 opacity-70">N</div>
          </div>
        </div>
      </div>

      {/* BOTTOM AREA - Action & Combat */}
      <div className="relative w-full pb-8 pt-20 flex justify-center items-end bg-gradient-to-t from-black/90 to-transparent">
        
        {/* Progressive Disclosure: Combat Log (Bottom Left) */}
        <div 
          className="absolute left-6 bottom-8 flex flex-col justify-end"
          onMouseEnter={() => setLogExpanded(true)}
          onMouseLeave={() => setLogExpanded(false)}
        >
          <div className={`
            bg-zinc-900/90 border border-zinc-700 rounded-lg backdrop-blur-md overflow-hidden transition-all duration-300 ease-in-out
            ${logExpanded ? 'w-80 h-48 opacity-100 mb-4' : 'w-12 h-0 opacity-0 mb-0'}
          `}>
            <div className="bg-zinc-800/80 text-amber-500 text-xs px-3 py-1 font-bold uppercase tracking-wider border-b border-zinc-700 flex items-center gap-2">
              <MessageSquare size={12} /> Combat Log
            </div>
            <div className="p-3 text-xs space-y-1 overflow-y-auto h-full pb-8 font-sans">
              <div className="text-zinc-300">[System]: Area cleared.</div>
              <div className="text-green-400">[Loot]: Found +15 Gold.</div>
              <div className="text-amber-300">[Combat]: Critical Hit! 450 damage.</div>
              <div className="text-red-400">[Combat]: Took 32 damage.</div>
              <div className="text-zinc-300">[System]: Night is approaching.</div>
            </div>
          </div>
          <button className={`w-12 h-12 rounded-full border border-zinc-700 flex items-center justify-center bg-zinc-900/80 transition-all ${logExpanded ? 'text-amber-500 border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.2)]' : 'text-zinc-400 hover:text-zinc-200'}`}>
            <MessageSquare size={20} />
          </button>
        </div>

        {/* Progressive Disclosure: Controls (Bottom Right) */}
        <div 
          className="absolute right-6 bottom-8 flex flex-col items-end justify-end"
          onMouseEnter={() => setControlsExpanded(true)}
          onMouseLeave={() => setControlsExpanded(false)}
        >
          <div className={`
            bg-zinc-900/90 border border-zinc-700 rounded-lg backdrop-blur-md overflow-hidden transition-all duration-300 ease-in-out
            ${controlsExpanded ? 'w-64 h-auto opacity-100 mb-4' : 'w-12 h-0 opacity-0 mb-0'}
          `}>
            <div className="bg-zinc-800/80 text-amber-500 text-xs px-3 py-1 font-bold uppercase tracking-wider border-b border-zinc-700 flex items-center gap-2">
              <Keyboard size={12} /> Controls
            </div>
            <div className="p-3 text-xs space-y-2 font-sans">
              <div className="flex justify-between"><span className="text-zinc-400">Move</span><span className="font-mono bg-zinc-800 px-1 rounded text-zinc-300">W A S D</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">Attack</span><span className="font-mono bg-zinc-800 px-1 rounded text-zinc-300">L-Click</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">Dodge</span><span className="font-mono bg-zinc-800 px-1 rounded text-zinc-300">Space</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">Interact</span><span className="font-mono bg-zinc-800 px-1 rounded text-zinc-300">F</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">Inventory</span><span className="font-mono bg-zinc-800 px-1 rounded text-zinc-300">I</span></div>
            </div>
          </div>
          <button className={`w-12 h-12 rounded-full border border-zinc-700 flex items-center justify-center bg-zinc-900/80 transition-all ${controlsExpanded ? 'text-amber-500 border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.2)]' : 'text-zinc-400 hover:text-zinc-200'}`}>
            <Keyboard size={20} />
          </button>
        </div>

        {/* COMBAT CLUSTER - Bottom Center */}
        <div className="flex flex-col items-center relative">
          
          {/* Active Weapon / Target */}
          <div className="absolute -top-32 flex flex-col items-center">
            <div className="text-amber-500/80 text-xs uppercase tracking-widest font-bold mb-1" style={{ fontFamily: "'Cinzel', serif" }}>Active Stance</div>
            <div className="flex items-center gap-2 bg-zinc-900/80 border border-zinc-700 px-4 py-1.5 rounded-full shadow-lg">
              <Sword size={16} className="text-amber-400" />
              <span className="text-sm font-bold text-zinc-200">Greatsword of Flame</span>
            </div>
          </div>

          {/* Skill Cooldowns (Tucked closely above HP) */}
          <div className="flex gap-2 mb-4 relative z-10">
            {[
              { key: '1', icon: <Flame />, cd: 0 },
              { key: '2', icon: <Zap />, cd: 2.5 },
              { key: '3', icon: <Wind />, cd: 0 },
              { key: '4', icon: <Shield />, cd: 8.2 },
              { key: '5', icon: <Sword />, cd: 0 },
            ].map((skill, i) => (
              <div key={i} className="relative group">
                <div className={`
                  w-10 h-10 rounded border ${skill.cd > 0 ? 'border-zinc-700 bg-zinc-800/50' : 'border-amber-700/50 bg-zinc-900'} 
                  flex items-center justify-center relative overflow-hidden backdrop-blur-sm
                  shadow-[0_4px_10px_rgba(0,0,0,0.5)]
                `}>
                  {skill.cd > 0 && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
                      <span className="font-mono font-bold text-white text-xs">{skill.cd}s</span>
                    </div>
                  )}
                  <div className={`text-zinc-300 ${skill.cd > 0 ? 'opacity-30' : 'opacity-100'}`}>
                    {React.cloneElement(skill.icon as React.ReactElement, { size: 18 })}
                  </div>
                </div>
                <div className="absolute -top-2 -left-2 w-4 h-4 bg-zinc-950 border border-zinc-700 rounded-full flex items-center justify-center text-[8px] font-mono z-20">
                  {skill.key}
                </div>
              </div>
            ))}
          </div>

          {/* CENTRAL VITAL CLUSTER */}
          <div className="relative flex flex-col items-center z-20">
            {/* HP Bar - The largest, most saturated element */}
            <div className="w-[450px] relative mb-1">
              {/* Decorative flourish */}
              <div className="absolute -left-12 -right-12 top-1/2 h-0.5 bg-gradient-to-r from-transparent via-amber-700/30 to-transparent -translate-y-1/2 -z-10"></div>
              
              <div className="h-8 w-full bg-black border-[3px] border-[#2a1a15] rounded-sm relative overflow-hidden shadow-[0_0_20px_rgba(220,38,38,0.2)]">
                {/* Background texture */}
                <div className="absolute inset-0 opacity-20 bg-[repeating-linear-gradient(45deg,transparent,transparent_2px,#000_2px,#000_4px)] z-10"></div>
                
                {/* Health fill */}
                <div className="h-full w-[82%] bg-gradient-to-r from-red-800 via-red-600 to-red-500 relative">
                  {/* Highlight */}
                  <div className="absolute top-0 left-0 right-0 h-1/3 bg-white/20"></div>
                  {/* Glow */}
                  <div className="absolute right-0 top-0 bottom-0 w-4 bg-white/40 blur-[2px]"></div>
                </div>
                
                {/* Text overlay */}
                <div className="absolute inset-0 flex items-center justify-center z-20">
                  <span className="text-white font-bold font-mono text-lg tracking-wider" style={{ textShadow: '0 2px 4px black, 0 0 10px rgba(0,0,0,0.8)' }}>
                    820 / 1000
                  </span>
                </div>
              </div>
            </div>

            {/* Secondary Vitals (Mana & Stamina flanking) */}
            <div className="flex w-[450px] justify-between px-2 gap-4">
              {/* Mana */}
              <div className="flex-1 h-3 bg-black border border-zinc-800 rounded relative overflow-hidden">
                <div className="h-full w-[60%] bg-gradient-to-r from-blue-800 to-blue-500"></div>
              </div>
              
              {/* Stamina */}
              <div className="flex-1 h-3 bg-black border border-zinc-800 rounded relative overflow-hidden">
                <div className="h-full w-[90%] bg-gradient-to-r from-green-800 to-green-500"></div>
              </div>
            </div>

            {/* Tertiary Vital (Hunger, tucked away) */}
            <div className="w-32 h-1.5 mt-2 bg-black border border-zinc-800 rounded-full relative overflow-hidden opacity-80">
              <div className="h-full w-[45%] bg-gradient-to-r from-orange-800 to-orange-500"></div>
            </div>
          </div>

          {/* HOTBAR - Arching beneath the vitals, sized by distance from center */}
          <div className="flex items-end justify-center mt-6 gap-1.5 h-20">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => {
              // Calculate scale based on distance from center (index 4)
              const dist = Math.abs(4 - i);
              const isSelected = i === 4;
              
              let width = 'w-10';
              let height = 'h-10';
              let scale = 'scale-100';
              let border = 'border-zinc-700/50';
              let bg = 'bg-zinc-900/60';
              let zIndex = 10 - dist;
              let yOffset = dist * 2; // Curve downwards slightly at edges
              
              if (isSelected) {
                width = 'w-16';
                height = 'h-16';
                border = 'border-amber-400 border-2';
                bg = 'bg-zinc-800';
              } else if (dist === 1) {
                width = 'w-12';
                height = 'h-12';
                border = 'border-amber-700/80';
                bg = 'bg-zinc-800/80';
              }

              // Fake items
              const item = i === 4 ? '🗡️' : i === 3 ? '🧪' : i === 5 ? '🏹' : i === 1 ? '🍎' : null;
              const count = i === 3 ? 5 : i === 1 ? 12 : null;

              return (
                <div 
                  key={i} 
                  className={`
                    ${width} ${height} rounded bg-zinc-900 shadow-xl flex items-center justify-center relative
                    transition-all duration-300 ease-in-out backdrop-blur-sm
                    ${isSelected ? 'shadow-[0_0_20px_rgba(245,158,11,0.4)] -translate-y-4' : 'hover:border-amber-600/50'}
                  `}
                  style={{ zIndex, transform: `translateY(${isSelected ? -10 : yOffset}px)` }}
                >
                  {/* Border and gradient overlay */}
                  <div className={`absolute inset-0 border ${border} rounded`}></div>
                  <div className={`absolute inset-0 bg-gradient-to-b from-transparent to-black/60 rounded ${bg}`}></div>
                  
                  {/* Content */}
                  <div className="relative z-10 flex items-center justify-center w-full h-full">
                    {item && <span className={`${isSelected ? 'text-4xl' : dist === 1 ? 'text-2xl' : 'text-xl'} filter drop-shadow-md`}>{item}</span>}
                  </div>
                  
                  {/* Slot Number */}
                  <span className={`absolute top-1 left-1.5 font-mono font-bold text-zinc-500 z-20 ${isSelected ? 'text-xs text-amber-500' : 'text-[9px]'}`}>
                    {i + 1}
                  </span>
                  
                  {/* Quantity */}
                  {count && (
                    <span className={`absolute bottom-0 right-1 font-mono font-bold text-white z-20 ${isSelected ? 'text-xs' : 'text-[10px]'}`} style={{ textShadow: '0 1px 2px black' }}>
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
