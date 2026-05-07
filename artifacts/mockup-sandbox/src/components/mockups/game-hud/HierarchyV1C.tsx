import React, { useState } from 'react';
import { Sword, Shield, Zap, Flame, Wind, MessageSquare, Keyboard, Map, Settings, Volume2 } from 'lucide-react';

export function HierarchyV1C() {
  const [logExpanded, setLogExpanded] = useState(false);
  const [controlsExpanded, setControlsExpanded] = useState(false);

  return (
    <div className="w-full h-full min-h-screen relative overflow-hidden select-none flex flex-col justify-between" 
         style={{ 
           backgroundColor: '#0a0705',
           fontFamily: "'Crimson Text', serif", 
           backgroundImage: 'radial-gradient(circle at 50% 50%, #2a1f1a 0%, #0a0705 100%)',
           color: '#f4f4f5'
         }}>
      
      {/* STRATEGIC INFO - Top Bar - Accessible */}
      <div className="w-full flex justify-between items-start p-4 bg-[#1a120c] border-b-[3px] border-[#c9950a] shadow-[0_4px_20px_rgba(0,0,0,0.8)]">
        {/* Top Left - Long-term info */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-4 bg-[#0a0705] border-[2px] border-[#c9950a] p-3 rounded-lg shadow-md">
            <div className="w-14 h-14 rounded-md bg-[#1a120c] border-2 border-[#c9950a] flex items-center justify-center text-2xl" aria-label="Player Avatar">
              🧙‍♂️
            </div>
            <div className="flex flex-col justify-center">
              <div className="text-[#c9950a] font-bold text-xl leading-tight uppercase tracking-wider" style={{ fontFamily: "'Cinzel', serif" }}>
                Level 42
              </div>
              <div className="w-48 mt-2">
                <div className="flex justify-between text-[14px] mb-1 font-bold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  <span>XP</span>
                  <span>14,200 / 20,000</span>
                </div>
                <div className="w-full h-3 bg-[#0a0705] rounded-sm border-[2px] border-[#c9950a] overflow-hidden">
                  <div className="h-full bg-purple-500 w-[75%]"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Top Center - Strategic Resources with Explicit Labels */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-4 bg-[#0a0705] border-[2px] border-[#c9950a] px-6 py-3 rounded-lg shadow-md">
            <div className="flex items-center gap-2 bg-[#1a120c] px-3 py-1.5 rounded border border-[#c9950a]/50">
              <span className="text-xl" aria-hidden="true">🪵</span>
              <span className="text-[15px] font-bold">Wood:</span>
              <span className="font-mono text-[16px] font-bold">450</span>
            </div>
            <div className="flex items-center gap-2 bg-[#1a120c] px-3 py-1.5 rounded border border-[#c9950a]/50">
              <span className="text-xl" aria-hidden="true">🪨</span>
              <span className="text-[15px] font-bold">Stone:</span>
              <span className="font-mono text-[16px] font-bold">210</span>
            </div>
            <div className="flex items-center gap-2 bg-[#1a120c] px-3 py-1.5 rounded border border-[#c9950a]/50">
              <span className="text-xl" aria-hidden="true">🪙</span>
              <span className="text-[15px] font-bold text-yellow-400">Gold:</span>
              <span className="font-mono text-[16px] font-bold text-yellow-400">1,240</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4 bg-[#0a0705] border-[2px] border-[#c9950a] px-6 py-2 rounded-lg shadow-md text-[15px] font-bold">
            <div className="flex gap-2"><span className="text-zinc-400">Score:</span> <span className="text-white font-mono">15,400</span></div>
            <div className="w-px h-4 bg-[#c9950a]"></div>
            <div className="flex gap-2"><span className="text-zinc-400">Kills:</span> <span className="text-white font-mono">342</span></div>
            <div className="w-px h-4 bg-[#c9950a]"></div>
            <div className="flex gap-2"><span className="text-zinc-400">Wave:</span> <span className="text-white font-mono">12</span></div>
          </div>
        </div>

        {/* Top Right - Settings & Minimap */}
        <div className="flex items-start gap-4">
          <div className="flex gap-2">
            {[
              { icon: Settings, label: "Settings" }, 
              { icon: Volume2, label: "Audio" }, 
              { icon: Map, label: "Map" }
            ].map((btn, i) => (
              <button key={i} className="w-12 h-12 rounded-lg bg-[#0a0705] border-[2px] border-[#c9950a] flex items-center justify-center text-zinc-300 hover:bg-[#1a120c] hover:text-white transition-colors" aria-label={btn.label} title={btn.label}>
                <btn.icon size={24} />
              </button>
            ))}
          </div>
          <div className="w-40 h-40 rounded-lg border-[3px] border-[#c9950a] bg-[#0a0705] overflow-hidden relative shadow-[0_0_20px_rgba(0,0,0,0.8)] flex flex-col">
            <div className="bg-[#1a120c] border-b-[2px] border-[#c9950a] text-center text-[14px] font-bold py-1 tracking-widest uppercase" style={{ fontFamily: "'Cinzel', serif" }}>
              Minimap
            </div>
            <div className="flex-1 relative bg-[#2a2a2a]">
              <div className="absolute inset-0 opacity-40 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+PGNpcmNsZSBjeD0iMTAiIGN5PSIxMCIgcj0iMSIgZmlsbD0iI2ZmZiIvPjwvc3ZnPg==')]"></div>
              <div className="w-3 h-3 rounded-full bg-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 shadow-[0_0_8px_#fff] border border-black"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 absolute top-1/3 left-2/3 border border-black"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 absolute top-2/3 left-1/4 border border-black"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Status Effects with explicit labels */}
      <div className="absolute top-48 left-6 flex flex-col gap-3">
        <div className="flex items-center gap-3 bg-[#0a0705] border-[2px] border-green-600/80 px-4 py-2 rounded-lg">
          <div className="w-8 h-8 rounded bg-green-900/50 border border-green-500 flex items-center justify-center text-green-400">
            ▲
          </div>
          <div>
            <div className="text-[14px] font-bold text-green-400 uppercase tracking-wide">Regeneration</div>
            <div className="text-[14px] font-mono">0:45</div>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-[#0a0705] border-[2px] border-amber-600/80 px-4 py-2 rounded-lg">
          <div className="w-8 h-8 rounded bg-amber-900/50 border border-amber-500 flex items-center justify-center text-amber-400">
            🛡️
          </div>
          <div>
            <div className="text-[14px] font-bold text-amber-400 uppercase tracking-wide">Armor Up</div>
            <div className="text-[14px] font-mono">2:10</div>
          </div>
        </div>
      </div>

      {/* BOTTOM AREA - Action & Combat */}
      <div className="relative w-full pb-6 pt-10 flex justify-center items-end bg-[#0a0705]/80 border-t-[3px] border-[#c9950a] backdrop-blur-md">
        
        {/* Progressive Disclosure: Combat Log (Bottom Left) */}
        <div 
          className="absolute left-6 bottom-6 flex flex-col justify-end"
          onMouseEnter={() => setLogExpanded(true)}
          onMouseLeave={() => setLogExpanded(false)}
        >
          <div className={`
            bg-[#0a0705] border-[2px] border-[#c9950a] rounded-lg overflow-hidden transition-all duration-300 ease-in-out shadow-lg
            ${logExpanded ? 'w-96 h-56 opacity-100 mb-4' : 'w-16 h-0 opacity-0 mb-0'}
          `}>
            <div className="bg-[#1a120c] border-b-[2px] border-[#c9950a] text-white text-[15px] px-4 py-2 font-bold uppercase tracking-wider flex items-center gap-2">
              <MessageSquare size={16} /> Combat Log
            </div>
            <div className="p-4 text-[15px] space-y-2 overflow-y-auto h-full pb-10 font-sans font-bold bg-[#0a0705]">
              <div className="text-zinc-300 bg-[#1a120c] p-2 rounded border border-zinc-800">[System]: Area cleared.</div>
              <div className="text-green-400 bg-green-950/30 p-2 rounded border border-green-900">[Loot]: Found +15 Gold.</div>
              <div className="text-amber-400 bg-amber-950/30 p-2 rounded border border-amber-900">[Combat]: Critical Hit! 450 damage.</div>
              <div className="text-red-400 bg-red-950/30 p-2 rounded border border-red-900">[Combat]: Took 32 damage.</div>
            </div>
          </div>
          <button className={`w-16 h-16 rounded-lg border-[2px] flex items-center justify-center bg-[#0a0705] transition-all shadow-md ${logExpanded ? 'border-white text-white' : 'border-[#c9950a] text-[#c9950a] hover:bg-[#1a120c]'}`}>
            <MessageSquare size={28} />
            <span className="sr-only">Toggle Combat Log</span>
          </button>
        </div>

        {/* Progressive Disclosure: Controls (Bottom Right) */}
        <div 
          className="absolute right-6 bottom-6 flex flex-col items-end justify-end"
          onMouseEnter={() => setControlsExpanded(true)}
          onMouseLeave={() => setControlsExpanded(false)}
        >
          <div className={`
            bg-[#0a0705] border-[2px] border-[#c9950a] rounded-lg overflow-hidden transition-all duration-300 ease-in-out shadow-lg
            ${controlsExpanded ? 'w-72 h-auto opacity-100 mb-4' : 'w-16 h-0 opacity-0 mb-0'}
          `}>
            <div className="bg-[#1a120c] border-b-[2px] border-[#c9950a] text-white text-[15px] px-4 py-2 font-bold uppercase tracking-wider flex items-center gap-2">
              <Keyboard size={16} /> Controls
            </div>
            <div className="p-4 text-[15px] space-y-3 font-sans font-bold bg-[#0a0705]">
              <div className="flex justify-between items-center bg-[#1a120c] p-2 rounded border border-zinc-800"><span className="text-zinc-300">Move</span><span className="font-mono bg-black border border-zinc-700 px-2 py-1 rounded text-white text-[14px]">W A S D</span></div>
              <div className="flex justify-between items-center bg-[#1a120c] p-2 rounded border border-zinc-800"><span className="text-zinc-300">Attack</span><span className="font-mono bg-black border border-zinc-700 px-2 py-1 rounded text-white text-[14px]">L-Click</span></div>
              <div className="flex justify-between items-center bg-[#1a120c] p-2 rounded border border-zinc-800"><span className="text-zinc-300">Dodge</span><span className="font-mono bg-black border border-zinc-700 px-2 py-1 rounded text-white text-[14px]">Space</span></div>
              <div className="flex justify-between items-center bg-[#1a120c] p-2 rounded border border-zinc-800"><span className="text-zinc-300">Interact</span><span className="font-mono bg-black border border-zinc-700 px-2 py-1 rounded text-white text-[14px]">F</span></div>
            </div>
          </div>
          <button className={`w-16 h-16 rounded-lg border-[2px] flex items-center justify-center bg-[#0a0705] transition-all shadow-md ${controlsExpanded ? 'border-white text-white' : 'border-[#c9950a] text-[#c9950a] hover:bg-[#1a120c]'}`}>
            <Keyboard size={28} />
            <span className="sr-only">Toggle Controls</span>
          </button>
        </div>

        {/* COMBAT CLUSTER - Bottom Center - Accessible */}
        <div className="flex flex-col items-center relative w-[800px]">
          
          {/* Active Weapon / Target */}
          <div className="absolute -top-36 flex flex-col items-center">
            <div className="bg-[#0a0705] border-[2px] border-[#c9950a] px-6 py-2 rounded-lg shadow-lg flex flex-col items-center">
              <span className="text-zinc-400 text-[14px] uppercase tracking-widest font-bold mb-1" style={{ fontFamily: "'Cinzel', serif" }}>Active Weapon</span>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-[#1a120c] rounded border border-zinc-700 flex items-center justify-center">
                  <Sword size={20} className="text-white" />
                </div>
                <span className="text-lg font-bold text-white tracking-wide">Greatsword of Flame</span>
              </div>
            </div>
          </div>

          {/* Skill Cooldowns (Larger, explicitly labeled) */}
          <div className="flex gap-4 mb-6 relative z-10">
            {[
              { key: '1', name: 'Fireball', icon: <Flame />, cd: 0 },
              { key: '2', name: 'Lightning', icon: <Zap />, cd: 2.5 },
              { key: '3', name: 'Whirlwind', icon: <Wind />, cd: 0 },
              { key: '4', name: 'Block', icon: <Shield />, cd: 8.2 },
              { key: '5', name: 'Strike', icon: <Sword />, cd: 0 },
            ].map((skill, i) => (
              <div key={i} className="flex flex-col items-center gap-2 group">
                <div className="bg-[#0a0705] border-[2px] border-zinc-700 px-2 py-1 rounded text-[14px] font-mono font-bold text-white shadow-md">
                  KEY: {skill.key}
                </div>
                <div className={`
                  w-16 h-16 rounded-lg border-[3px] ${skill.cd > 0 ? 'border-zinc-600 bg-[#1a120c]' : 'border-[#c9950a] bg-[#0a0705]'} 
                  flex items-center justify-center relative overflow-hidden shadow-lg
                `}>
                  {skill.cd > 0 ? (
                    <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-10">
                      <span className="font-mono font-bold text-white text-xl">{skill.cd}s</span>
                    </div>
                  ) : null}
                  <div className={`text-white ${skill.cd > 0 ? 'opacity-20' : 'opacity-100'}`}>
                    {React.cloneElement(skill.icon as React.ReactElement, { size: 32 })}
                  </div>
                </div>
                <div className="bg-[#0a0705] px-3 py-1 rounded border border-zinc-800 text-[14px] font-bold text-zinc-300">
                  {skill.name}
                </div>
              </div>
            ))}
          </div>

          {/* CENTRAL VITAL CLUSTER - Explicit and Accessible */}
          <div className="w-full flex flex-col items-center gap-4 z-20 bg-[#0a0705] p-6 rounded-xl border-[3px] border-[#1a120c] shadow-2xl">
            
            {/* HP Bar - Contrast-based, explicit labels */}
            <div className="w-full flex items-center gap-4">
              <div className="w-20 flex items-center justify-between bg-[#1a120c] px-3 py-2 rounded border-[2px] border-zinc-700">
                <span className="text-red-500 text-xl">♥</span>
                <span className="font-bold text-[16px] tracking-wider">HP</span>
              </div>
              
              <div className="flex-1 h-12 bg-[#1a120c] border-[3px] border-zinc-700 rounded relative overflow-hidden">
                {/* Bright white/light gray fill for high contrast against dark bg */}
                <div className="h-full w-[82%] bg-[#f4f4f5] relative border-r-4 border-white shadow-[0_0_15px_rgba(255,255,255,0.5)]"></div>
                
                {/* Explicit Text Overlay with solid background for guaranteed contrast */}
                <div className="absolute inset-0 flex items-center justify-center z-20">
                  <div className="bg-[#0a0705] px-4 py-1 rounded-full border-[2px] border-zinc-700 shadow-lg">
                    <span className="text-white font-bold font-mono text-[16px] tracking-wider">
                      820 / 1000 (82%)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Secondary Vitals - Mana & Stamina */}
            <div className="w-full flex gap-6">
              {/* Mana */}
              <div className="flex-1 flex items-center gap-3">
                <div className="w-20 flex items-center justify-between bg-[#1a120c] px-3 py-2 rounded border-[2px] border-zinc-700">
                  <span className="text-[#00ffff] text-xl">♦</span>
                  <span className="font-bold text-[16px] tracking-wider">MP</span>
                </div>
                <div className="flex-1 h-10 bg-[#1a120c] border-[3px] border-zinc-700 rounded relative overflow-hidden">
                  <div className="h-full w-[60%] bg-[#00ffff] relative"></div>
                  <div className="absolute inset-0 flex items-center justify-center z-20">
                    <div className="bg-[#0a0705] px-3 py-0.5 rounded-full border-[2px] border-zinc-700 shadow-md">
                      <span className="text-white font-bold font-mono text-[15px]">180 / 300</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Stamina */}
              <div className="flex-1 flex items-center gap-3">
                <div className="w-20 flex items-center justify-between bg-[#1a120c] px-3 py-2 rounded border-[2px] border-zinc-700">
                  <span className="text-[#ffd700] text-xl">★</span>
                  <span className="font-bold text-[16px] tracking-wider">SP</span>
                </div>
                <div className="flex-1 h-10 bg-[#1a120c] border-[3px] border-zinc-700 rounded relative overflow-hidden">
                  <div className="h-full w-[90%] bg-[#ffd700] relative"></div>
                  <div className="absolute inset-0 flex items-center justify-center z-20">
                    <div className="bg-[#0a0705] px-3 py-0.5 rounded-full border-[2px] border-zinc-700 shadow-md">
                      <span className="text-white font-bold font-mono text-[15px]">270 / 300</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tertiary Vital - Hunger */}
            <div className="w-full flex justify-center mt-2">
              <div className="w-1/2 flex items-center gap-3">
                <div className="w-24 flex items-center justify-between bg-[#1a120c] px-3 py-1.5 rounded border-[2px] border-zinc-700">
                  <span className="text-[#ff8c00] text-lg">●</span>
                  <span className="font-bold text-[15px]">Hunger</span>
                </div>
                <div className="flex-1 h-8 bg-[#1a120c] border-[2px] border-zinc-700 rounded relative overflow-hidden">
                  <div className="h-full w-[45%] bg-[#ff8c00] relative"></div>
                  <div className="absolute inset-0 flex items-center justify-center z-20">
                    <div className="bg-[#0a0705] px-2 py-0.5 rounded border border-zinc-700">
                      <span className="text-white font-bold font-mono text-[14px]">45%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* HOTBAR - Flat layout, large targets, explicit text */}
          <div className="flex justify-center mt-8 gap-3">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => {
              const isSelected = i === 4;
              
              // Fake items
              const item = i === 4 ? '🗡️' : i === 3 ? '🧪' : i === 5 ? '🏹' : i === 1 ? '🍎' : null;
              const name = i === 4 ? 'Greatsword' : i === 3 ? 'HP Potion' : i === 5 ? 'Longbow' : i === 1 ? 'Apple' : 'Empty';
              const count = i === 3 ? 5 : i === 1 ? 12 : null;

              return (
                <div key={i} className="flex flex-col items-center gap-2">
                  <div className={`
                    w-16 h-16 rounded-lg bg-[#1a120c] flex items-center justify-center relative
                    ${isSelected ? 'border-[4px] border-white shadow-[0_0_15px_rgba(255,255,255,0.5)]' : 'border-[2px] border-zinc-600'}
                  `}>
                    {/* Slot Number - Explicit background */}
                    <div className="absolute -top-3 -left-3 bg-[#0a0705] border-[2px] border-zinc-600 w-7 h-7 rounded-full flex items-center justify-center z-20 shadow-md">
                      <span className={`font-mono font-bold text-[14px] ${isSelected ? 'text-white' : 'text-zinc-300'}`}>
                        {i + 1}
                      </span>
                    </div>
                    
                    {/* Content */}
                    <div className="relative z-10 flex items-center justify-center w-full h-full">
                      {item && <span className="text-3xl">{item}</span>}
                    </div>
                    
                    {/* Quantity - Explicit background */}
                    {count && (
                      <div className="absolute -bottom-2 -right-2 bg-[#0a0705] border-[2px] border-zinc-600 px-2 rounded-full z-20 shadow-md">
                        <span className="font-mono font-bold text-[14px] text-white">
                          x{count}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {/* Item Name below slot */}
                  <div className={`text-[14px] font-bold px-2 py-1 rounded max-w-[80px] text-center truncate ${isSelected ? 'bg-white text-black' : 'bg-[#1a120c] text-zinc-400 border border-zinc-800'}`}>
                    {name}
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </div>
  );
}
