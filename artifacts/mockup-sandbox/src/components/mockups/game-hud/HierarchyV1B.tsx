import React, { useState } from 'react';
import { Sword, Shield, Zap, Flame, Wind, MessageSquare, Keyboard, Map, Settings, Volume2 } from 'lucide-react';

export function HierarchyV1B() {
  const [logExpanded, setLogExpanded] = useState(false);
  const [controlsExpanded, setControlsExpanded] = useState(false);
  const [hoveredSkill, setHoveredSkill] = useState<number | null>(null);

  // Styling helpers
  const interactiveBase = "transition-all duration-200 ease-out cursor-pointer border border-zinc-700 bg-zinc-800";
  const interactiveHover = "hover:-translate-y-0.5 hover:scale-[1.02] hover:border-amber-500 active:translate-y-0 active:scale-[0.98]";
  
  // Custom shadows for the 3D raised and inset looks
  const raisedShadow = { boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -3px 0 rgba(0,0,0,0.6), 0 4px 6px rgba(0,0,0,0.4)' };
  const raisedHoverShadow = { boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -3px 0 rgba(0,0,0,0.6), 0 0 15px rgba(201,149,10,0.5)' };
  const flatInsetShadow = { boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.8), 0 1px 0 rgba(255,255,255,0.05)' };

  const getInteractiveShadow = (isHovered: boolean) => isHovered ? raisedHoverShadow : raisedShadow;

  return (
    <div className="w-full h-full min-h-screen bg-[#0a0705] relative overflow-hidden text-zinc-200 select-none flex flex-col justify-between" style={{ fontFamily: "'Crimson Text', serif", backgroundImage: 'radial-gradient(circle at 50% 50%, #2a1f1a 0%, #0a0705 100%)' }}>
      
      {/* STRATEGIC INFO - Top Bar */}
      <div className="w-full flex justify-between items-start p-4">
        {/* Top Left - Long-term info (Passive) */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 bg-[#1a120c]/80 border border-[#c9950a]/30 p-2 rounded-r-xl pl-6 -ml-4 backdrop-blur-sm" style={flatInsetShadow}>
            <div className="w-12 h-12 rounded-full bg-zinc-900 border border-[#c9950a]/50 flex items-center justify-center text-xl shadow-[inset_0_2px_8px_rgba(0,0,0,0.8)]">
              🧙‍♂️
            </div>
            <div className="pr-4 flex flex-col justify-center">
              <div className="text-[#c9950a] font-bold text-lg leading-tight" style={{ fontFamily: "'Cinzel', serif" }}>Level 42</div>
              <div className="w-32 h-1.5 bg-black rounded-full overflow-hidden mt-1 border border-zinc-800" style={{ boxShadow: 'inset 0 1px 3px rgba(0,0,0,1)' }}>
                <div className="h-full bg-purple-600 w-[75%]" style={{ boxShadow: '0 0 10px #9333ea' }}></div>
              </div>
              <div className="text-[10px] text-zinc-400 mt-0.5" style={{ fontFamily: "'JetBrains Mono', monospace" }}>XP: 14,200 / 20,000</div>
            </div>
          </div>
        </div>

        {/* Top Center - Strategic Resources (Passive) */}
        <div className="flex items-center gap-8 bg-[#1a120c]/80 border border-[#c9950a]/30 px-8 py-2 rounded-b-xl -mt-4 backdrop-blur-sm" style={flatInsetShadow}>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-amber-700">🪵</span>
              <span className="font-mono text-sm text-zinc-300">450</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-zinc-400">🪨</span>
              <span className="font-mono text-sm text-zinc-300">210</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-yellow-500">🪙</span>
              <span className="font-mono text-sm text-yellow-500">1,240</span>
            </div>
          </div>
          <div className="w-px h-6 bg-zinc-700/50"></div>
          <div className="flex items-center gap-6 text-sm">
            <div className="text-zinc-400">Score: <span className="text-[#c9950a] font-mono">15,400</span></div>
            <div className="text-zinc-400">Kills: <span className="text-red-400 font-mono">342</span></div>
            <div className="text-amber-200">Wave <span className="font-bold font-mono text-white">12</span></div>
          </div>
        </div>

        {/* Top Right - Settings & Minimap indicator */}
        <div className="flex items-start gap-4">
          <div className="flex gap-2">
            {[
              { icon: Settings, label: 'Options' },
              { icon: Volume2, label: 'Sound' },
              { icon: Map, label: 'Map' }
            ].map((btn, i) => (
              <button 
                key={i} 
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded ${interactiveBase} ${interactiveHover} text-zinc-300 group`}
                style={raisedShadow}
                onMouseEnter={(e) => {
                  Object.assign(e.currentTarget.style, raisedHoverShadow);
                }}
                onMouseLeave={(e) => {
                  Object.assign(e.currentTarget.style, raisedShadow);
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.6)';
                }}
                onMouseUp={(e) => {
                  Object.assign(e.currentTarget.style, raisedHoverShadow);
                }}
              >
                <btn.icon size={14} className="group-hover:text-amber-500 transition-colors" />
                <span className="text-xs font-bold font-sans tracking-wide group-hover:text-amber-500 transition-colors">{btn.label}</span>
              </button>
            ))}
          </div>
          {/* Minimap (Passive) */}
          <div className="w-32 h-32 rounded-full border-2 border-[#1a120c] bg-zinc-900/80 overflow-hidden relative shadow-[0_0_20px_rgba(0,0,0,0.8)] flex items-center justify-center" style={flatInsetShadow}>
            <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #4a5568 10%, transparent 80%)' }}></div>
            <div className="w-2 h-2 rounded-full bg-amber-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 shadow-[0_0_8px_#f59e0b]"></div>
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 absolute top-1/3 left-2/3 shadow-[0_0_5px_#ef4444]"></div>
            <div className="text-xs absolute bottom-3 font-bold text-amber-500 opacity-70">N</div>
          </div>
        </div>
      </div>

      {/* BOTTOM AREA - Action & Combat */}
      <div className="relative w-full pb-8 pt-20 flex justify-center items-end bg-gradient-to-t from-black/90 via-black/40 to-transparent">
        
        {/* Combat Log Toggle with Preview (Bottom Left) */}
        <div className="absolute left-6 bottom-8 flex flex-col justify-end">
          <div className={`
            bg-[#1a120c]/95 border border-zinc-700 rounded-lg backdrop-blur-md overflow-hidden transition-all duration-300 ease-in-out
            ${logExpanded ? 'w-80 h-48 opacity-100 mb-4' : 'w-12 h-0 opacity-0 mb-0 pointer-events-none'}
          `} style={flatInsetShadow}>
            <div className="bg-black/50 text-[#c9950a] text-xs px-3 py-1 font-bold uppercase tracking-wider border-b border-zinc-800 flex items-center gap-2">
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
          
          <div className="flex items-center gap-3">
            <button 
              className={`w-12 h-12 rounded-full flex items-center justify-center ${interactiveBase} ${interactiveHover} ${logExpanded ? 'border-amber-500 text-amber-500' : 'text-zinc-300'}`}
              style={raisedShadow}
              onMouseEnter={(e) => Object.assign(e.currentTarget.style, raisedHoverShadow)}
              onMouseLeave={(e) => Object.assign(e.currentTarget.style, raisedShadow)}
              onClick={() => setLogExpanded(!logExpanded)}
            >
              <MessageSquare size={20} />
            </button>
            {/* Mini preview */}
            {!logExpanded && (
              <div className="bg-black/60 border border-zinc-800 rounded px-3 py-1.5 text-xs font-sans text-zinc-300 flex items-center gap-2 backdrop-blur-sm pointer-events-none" style={flatInsetShadow}>
                <span className="w-2 h-2 rounded-full bg-amber-500/50 animate-pulse"></span>
                [System]: Night is approaching.
              </div>
            )}
          </div>
        </div>

        {/* Controls Toggle (Bottom Right) */}
        <div className="absolute right-6 bottom-8 flex flex-col items-end justify-end">
          <div className={`
            bg-[#1a120c]/95 border border-zinc-700 rounded-lg backdrop-blur-md overflow-hidden transition-all duration-300 ease-in-out
            ${controlsExpanded ? 'w-64 h-auto opacity-100 mb-4' : 'w-12 h-0 opacity-0 mb-0 pointer-events-none'}
          `} style={flatInsetShadow}>
            <div className="bg-black/50 text-[#c9950a] text-xs px-3 py-1 font-bold uppercase tracking-wider border-b border-zinc-800 flex items-center gap-2">
              <Keyboard size={12} /> Keybindings
            </div>
            <div className="p-3 text-xs space-y-2 font-sans">
              <div className="flex justify-between items-center"><span className="text-zinc-400">Move</span><span className="font-mono bg-zinc-900 border border-zinc-700 px-1.5 py-0.5 rounded text-zinc-300 shadow-[inset_0_-2px_0_rgba(0,0,0,0.5)]">WASD</span></div>
              <div className="flex justify-between items-center"><span className="text-zinc-400">Attack</span><span className="font-mono bg-zinc-900 border border-zinc-700 px-1.5 py-0.5 rounded text-zinc-300 shadow-[inset_0_-2px_0_rgba(0,0,0,0.5)]">L-Click</span></div>
              <div className="flex justify-between items-center"><span className="text-zinc-400">Dodge</span><span className="font-mono bg-zinc-900 border border-zinc-700 px-1.5 py-0.5 rounded text-zinc-300 shadow-[inset_0_-2px_0_rgba(0,0,0,0.5)]">Space</span></div>
              <div className="flex justify-between items-center"><span className="text-zinc-400">Interact</span><span className="font-mono bg-zinc-900 border border-zinc-700 px-1.5 py-0.5 rounded text-zinc-300 shadow-[inset_0_-2px_0_rgba(0,0,0,0.5)]">F</span></div>
            </div>
          </div>
          <button 
            className={`w-12 h-12 rounded-full flex items-center justify-center ${interactiveBase} ${interactiveHover} ${controlsExpanded ? 'border-amber-500 text-amber-500' : 'text-zinc-300'}`}
            style={raisedShadow}
            onMouseEnter={(e) => Object.assign(e.currentTarget.style, raisedHoverShadow)}
            onMouseLeave={(e) => Object.assign(e.currentTarget.style, raisedShadow)}
            onClick={() => setControlsExpanded(!controlsExpanded)}
          >
            <Keyboard size={20} />
          </button>
        </div>

        {/* COMBAT CLUSTER - Bottom Center */}
        <div className="flex flex-col items-center relative">
          
          {/* Active Weapon / Target (Passive) */}
          <div className="absolute -top-36 flex flex-col items-center pointer-events-none">
            <div className="text-[#c9950a] text-xs uppercase tracking-widest font-bold mb-1 drop-shadow-md" style={{ fontFamily: "'Cinzel', serif" }}>Active Stance</div>
            <div className="flex items-center gap-2 bg-[#1a120c]/80 border border-zinc-800 px-4 py-1.5 rounded-full shadow-lg" style={flatInsetShadow}>
              <Sword size={16} className="text-amber-400" />
              <span className="text-sm font-bold text-zinc-200">Greatsword of Flame</span>
            </div>
          </div>

          {/* Skill Cooldowns (Interactive with Keycaps & Names) */}
          <div className="flex gap-4 mb-6 relative z-10">
            {[
              { key: '1', name: 'Ignite', desc: 'Sets the target on fire for 5s', icon: <Flame />, cd: 0 },
              { key: '2', name: 'Shock', desc: 'Stuns the target briefly', icon: <Zap />, cd: 2.5 },
              { key: '3', name: 'Gust', desc: 'Pushes enemies away', icon: <Wind />, cd: 0 },
              { key: '4', name: 'Block', desc: 'Raises shield to absorb damage', icon: <Shield />, cd: 8.2 },
              { key: '5', name: 'Strike', desc: 'Heavy melee attack', icon: <Sword />, cd: 0 },
            ].map((skill, i) => (
              <div key={i} className="flex flex-col items-center group" onMouseEnter={() => setHoveredSkill(i)} onMouseLeave={() => setHoveredSkill(null)}>
                
                {/* Tooltip Popup */}
                <div className={`absolute -top-16 bg-zinc-900 border border-amber-600/50 p-2 rounded text-xs w-48 text-center transition-all duration-200 pointer-events-none z-50 shadow-xl ${hoveredSkill === i ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`} style={{ left: '50%', transform: `translateX(-50%) ${hoveredSkill === i ? 'translateY(0)' : 'translateY(8px)'}` }}>
                  <div className="font-bold text-amber-500 mb-0.5">{skill.name}</div>
                  <div className="text-zinc-300 font-sans">{skill.desc}</div>
                </div>

                {/* Keybind Cap OUTSIDE */}
                <div className="mb-2 bg-zinc-200 text-black font-mono font-bold text-[10px] w-6 h-6 rounded flex items-center justify-center shadow-[inset_0_-2px_0_rgba(0,0,0,0.3),0_2px_4px_rgba(0,0,0,0.5)] border border-white">
                  {skill.key}
                </div>
                
                {/* Skill Button (Interactive) */}
                <button 
                  className={`
                    w-12 h-12 rounded flex items-center justify-center relative overflow-hidden
                    ${interactiveBase} ${interactiveHover}
                    ${skill.cd > 0 ? 'pointer-events-none opacity-80' : ''}
                  `}
                  style={raisedShadow}
                  onMouseEnter={(e) => { if(skill.cd === 0) Object.assign(e.currentTarget.style, raisedHoverShadow); }}
                  onMouseLeave={(e) => { if(skill.cd === 0) Object.assign(e.currentTarget.style, raisedShadow); }}
                  onMouseDown={(e) => { if(skill.cd === 0) e.currentTarget.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.6)'; }}
                  onMouseUp={(e) => { if(skill.cd === 0) Object.assign(e.currentTarget.style, raisedHoverShadow); }}
                >
                  {skill.cd > 0 && (
                    <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-10">
                      <span className="font-mono font-bold text-red-400 text-sm drop-shadow-md">{skill.cd}s</span>
                    </div>
                  )}
                  <div className={`text-zinc-200 ${skill.cd > 0 ? 'opacity-30' : 'opacity-100'} group-hover:text-amber-400 transition-colors`}>
                    {React.cloneElement(skill.icon as React.ReactElement, { size: 20 })}
                  </div>
                </button>
                
                {/* Skill Name */}
                <div className="mt-1.5 text-[9px] uppercase tracking-wider text-zinc-400 font-bold group-hover:text-amber-500 transition-colors">
                  {skill.name}
                </div>
              </div>
            ))}
          </div>

          {/* CENTRAL VITAL CLUSTER (Passive / Flat Inset) */}
          <div className="relative flex flex-col items-center z-20 pointer-events-none">
            {/* HP Bar */}
            <div className="w-[450px] relative mb-1">
              <div className="h-8 w-full bg-black border-2 border-zinc-900 rounded relative overflow-hidden" style={flatInsetShadow}>
                <div className="h-full w-[82%] bg-gradient-to-r from-red-900 via-red-700 to-red-500 relative shadow-[0_0_10px_rgba(239,68,68,0.5)]">
                  <div className="absolute top-0 left-0 right-0 h-1/3 bg-white/10"></div>
                </div>
                <div className="absolute inset-0 flex items-center justify-center z-20">
                  <span className="text-white font-bold font-mono text-lg tracking-wider drop-shadow-[0_2px_2px_rgba(0,0,0,1)]">
                    820 / 1000
                  </span>
                </div>
              </div>
            </div>

            {/* Secondary Vitals */}
            <div className="flex w-[450px] justify-between px-1 gap-3">
              {/* Mana */}
              <div className="flex-1 h-3.5 bg-black border border-zinc-900 rounded relative overflow-hidden" style={flatInsetShadow}>
                <div className="h-full w-[60%] bg-gradient-to-r from-blue-900 to-blue-500 relative">
                  <div className="absolute top-0 left-0 right-0 h-1/2 bg-white/10"></div>
                </div>
              </div>
              
              {/* Stamina */}
              <div className="flex-1 h-3.5 bg-black border border-zinc-900 rounded relative overflow-hidden" style={flatInsetShadow}>
                <div className="h-full w-[90%] bg-gradient-to-r from-green-900 to-green-500 relative">
                  <div className="absolute top-0 left-0 right-0 h-1/2 bg-white/10"></div>
                </div>
              </div>
            </div>

            {/* Tertiary Vital */}
            <div className="w-32 h-1.5 mt-2 bg-black border border-zinc-900 rounded-full relative overflow-hidden opacity-70" style={flatInsetShadow}>
              <div className="h-full w-[45%] bg-gradient-to-r from-orange-900 to-orange-500"></div>
            </div>
          </div>

          {/* HOTBAR - Arc (Interactive with explicit keys and names) */}
          <div className="flex items-end justify-center mt-8 gap-2 h-24">
            {[
              { id: 0, item: null, name: '', count: null, key: 'Z' },
              { id: 1, item: '🍎', name: 'Apple', count: 12, key: 'X' },
              { id: 2, item: null, name: '', count: null, key: 'C' },
              { id: 3, item: '🧪', name: 'Potion', count: 5, key: 'Q' },
              { id: 4, item: '🗡️', name: 'G.Sword', count: null, key: 'E' },
              { id: 5, item: '🏹', name: 'Bow', count: null, key: 'R' },
              { id: 6, item: null, name: '', count: null, key: 'T' },
              { id: 7, item: null, name: '', count: null, key: 'F' },
              { id: 8, item: null, name: '', count: null, key: 'G' },
            ].map((slot, i) => {
              const dist = Math.abs(4 - i);
              const isSelected = i === 4;
              
              let width = 'w-10';
              let height = 'h-10';
              let zIndex = 10 - dist;
              let yOffset = dist * 4;
              
              if (isSelected) {
                width = 'w-16';
                height = 'h-16';
              } else if (dist === 1) {
                width = 'w-12';
                height = 'h-12';
              }

              return (
                <div key={i} className="flex flex-col items-center group relative" style={{ zIndex, transform: `translateY(${isSelected ? -12 : yOffset}px)` }}>
                  
                  {/* Keybind Cap OUTSIDE/TOP */}
                  <div className={`
                    absolute -top-6 bg-zinc-300 text-black font-mono font-bold rounded flex items-center justify-center shadow-[inset_0_-2px_0_rgba(0,0,0,0.4),0_2px_4px_rgba(0,0,0,0.5)] border border-white z-30 transition-transform
                    ${isSelected ? 'w-5 h-5 text-[10px] -translate-y-2' : 'w-4 h-4 text-[8px]'}
                  `}>
                    {slot.key}
                  </div>

                  {/* Hotbar Slot Button (Interactive) */}
                  <button 
                    className={`
                      ${width} ${height} rounded flex items-center justify-center relative
                      ${interactiveBase} ${interactiveHover}
                      ${isSelected ? 'border-amber-400 border-2 bg-zinc-800' : 'bg-zinc-900'}
                    `}
                    style={isSelected ? raisedHoverShadow : raisedShadow}
                    onMouseEnter={(e) => Object.assign(e.currentTarget.style, raisedHoverShadow)}
                    onMouseLeave={(e) => Object.assign(e.currentTarget.style, isSelected ? raisedHoverShadow : raisedShadow)}
                    onMouseDown={(e) => e.currentTarget.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.6)'}
                    onMouseUp={(e) => Object.assign(e.currentTarget.style, raisedHoverShadow)}
                  >
                    {/* Content */}
                    <div className="relative z-10 flex items-center justify-center w-full h-full group-hover:scale-110 transition-transform">
                      {slot.item && <span className={`${isSelected ? 'text-4xl' : dist === 1 ? 'text-2xl' : 'text-xl'} drop-shadow-md`}>{slot.item}</span>}
                    </div>
                    
                    {/* Quantity */}
                    {slot.count && (
                      <span className={`absolute bottom-0 right-1 font-mono font-bold text-white z-20 ${isSelected ? 'text-xs' : 'text-[10px]'} drop-shadow-[0_1px_2px_rgba(0,0,0,1)]`}>
                        {slot.count}
                      </span>
                    )}
                  </button>

                  {/* Item Name OUTSIDE/BOTTOM */}
                  {slot.item && (
                    <div className={`absolute -bottom-5 text-[9px] uppercase tracking-wider font-bold whitespace-nowrap transition-colors
                      ${isSelected ? 'text-amber-500' : 'text-zinc-400 group-hover:text-amber-400'}
                    `}>
                      {slot.name}
                    </div>
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
