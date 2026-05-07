import React, { useState } from 'react';

const mockData = {
  health: { name: "Health", current: 85, max: 100, color: "#ef4444", icon: "♥" },
  mana: { name: "Mana", current: 40, max: 100, color: "#3b82f6", icon: "★" },
  stamina: { name: "Stamina", current: 60, max: 100, color: "#06b6d4", icon: "⚡" },
  hunger: { name: "Hunger", current: 90, max: 100, color: "#f97316", icon: "◆" },
  xp: { name: "Experience", current: 450, max: 1000, color: "#a855f7", icon: "⟡" },
  level: 5,
  score: 12500,
  kills: 42,
  resources: { wood: 150, stone: 85, gold: 12 },
  wave: 3,
  time: "Day",
  cooldowns: [0, 2.5, 0, 0, 12.0],
  hotbar: [
    { name: "Sword", icon: "⚔️", count: null },
    { name: "HP Pot", icon: "🧪", count: 5 },
    { name: "MP Pot", icon: "🏺", count: 2 },
    { name: "Bandage", icon: "🩹", count: 12 },
    { name: "Torch", icon: "🔥", count: 1 },
    null, null, null, null
  ],
  skills: [
    { name: "Slash", icon: "🗡️", cd: 0, maxCd: 3 },
    { name: "Block", icon: "🛡️", cd: 2.5, maxCd: 5 },
    { name: "Heal", icon: "✨", cd: 0, maxCd: 10 },
    { name: "Dash", icon: "💨", cd: 0, maxCd: 4 },
    { name: "Ult", icon: "💥", cd: 12.0, maxCd: 60 },
  ],
  log: [
    { time: "10:42", msg: "Entered the Dark Forest", type: "system", color: "#eab308" },
    { time: "10:45", msg: "Slain Goblin (x2)", type: "combat", color: "#ef4444" },
    { time: "10:46", msg: "Looted 5 Wood, 2 Gold", type: "loot", color: "#3b82f6" },
  ],
  controls: [
    { key: "W A S D", action: "Move" },
    { key: "SPACE", action: "Jump" },
    { key: "SHIFT", action: "Sprint" },
    { key: "C", action: "Character" },
    { key: "I", action: "Inventory" },
  ]
};

const BG_DARK = "#0a0705";
const PANEL_BG = "#1a120c";
const BORDER_GOLD = "#c5a059";

// Common UI Components

const Panel = ({ children, className = "", style = {} }: { children: React.ReactNode, className?: string, style?: React.CSSProperties }) => (
  <div 
    className={`border-2 rounded shadow-xl ${className}`}
    style={{
      backgroundColor: PANEL_BG,
      borderColor: BORDER_GOLD,
      boxShadow: "0 4px 12px rgba(0,0,0,0.8)",
      ...style
    }}
  >
    {children}
  </div>
);

const StatusBar = ({ data }: { data: typeof mockData.health }) => {
  const percent = Math.round((data.current / data.max) * 100);
  return (
    <div className="flex flex-col gap-1 mb-3">
      <div className="flex justify-between items-end px-1">
        <span className="font-bold text-white tracking-wide" style={{ fontSize: "14px", textShadow: "1px 1px 2px #000" }}>
          {data.icon} {data.name}
        </span>
        <span className="font-mono font-bold" style={{ fontSize: "14px", color: data.color, textShadow: "1px 1px 2px #000" }}>
          {data.current} / {data.max} ({percent}%)
        </span>
      </div>
      <div 
        className="w-full h-6 border-2 relative"
        style={{ backgroundColor: "#111", borderColor: "#333", borderRadius: "4px" }}
      >
        <div 
          className="h-full absolute left-0 top-0 transition-all duration-300"
          style={{ 
            width: `${percent}%`, 
            backgroundColor: data.color,
            boxShadow: `inset 0 0 10px rgba(255,255,255,0.3)` 
          }}
        />
      </div>
    </div>
  );
};

export default function AccessibleHUD() {
  return (
    <div className="w-full h-screen overflow-hidden relative font-sans select-none" style={{ backgroundColor: BG_DARK }}>
      {/* Simulated 3D Background - Dark vignette */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(circle at center, transparent 30%, rgba(10, 7, 5, 0.85) 100%)"
      }} />

      {/* TOP LEFT: Unit Frame */}
      <div className="absolute top-4 left-4 flex flex-col gap-4 w-[380px]">
        <Panel className="p-4 flex gap-4 items-center">
          <div 
            className="w-20 h-20 border-4 flex items-center justify-center bg-black relative"
            style={{ borderColor: BORDER_GOLD, borderRadius: "8px" }}
          >
            <span className="text-4xl" role="img" aria-label="Player Avatar">🧙‍♂️</span>
            <div 
              className="absolute -bottom-4 -right-4 w-10 h-10 border-2 rounded-full flex items-center justify-center bg-black font-bold text-lg font-mono text-white"
              style={{ borderColor: BORDER_GOLD, boxShadow: "0 2px 4px rgba(0,0,0,0.5)" }}
            >
              {mockData.level}
            </div>
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold uppercase tracking-wider mb-1" style={{ color: BORDER_GOLD, fontFamily: "'Cinzel', serif" }}>
              Player Name
            </h1>
            <div className="text-sm text-gray-300 font-bold tracking-wide">
              Level {mockData.level} Wizard
            </div>
          </div>
        </Panel>

        <Panel className="p-4 py-5">
          <StatusBar data={mockData.health} />
          <StatusBar data={mockData.mana} />
          <StatusBar data={mockData.stamina} />
          <StatusBar data={mockData.hunger} />
          <StatusBar data={mockData.xp} />
        </Panel>
      </div>

      {/* TOP RIGHT: Minimap & Stats */}
      <div className="absolute top-4 right-4 flex flex-col gap-4 items-end w-[320px]">
        <Panel className="w-full flex flex-col">
          <div 
            className="h-48 w-full border-b-2 flex items-center justify-center relative overflow-hidden"
            style={{ borderColor: BORDER_GOLD, backgroundColor: "#1a2e1a" }}
          >
            <div className="absolute inset-0 opacity-30" style={{
              backgroundImage: "radial-gradient(#4ade80 1px, transparent 1px)",
              backgroundSize: "20px 20px"
            }} />
            <span className="text-3xl relative z-10" role="img" aria-label="Player Position">📍</span>
            
            <div className="absolute top-2 left-2 bg-black/80 px-3 py-1 rounded border border-gray-600">
              <span className="text-yellow-400 font-bold text-sm tracking-wide">☀️ {mockData.time}</span>
            </div>
            <div className="absolute top-2 right-2 bg-black/80 px-3 py-1 rounded border border-gray-600">
              <span className="text-white font-bold text-sm tracking-wide">Wave {mockData.wave}</span>
            </div>
          </div>
          <div className="flex justify-between p-3 bg-black/50">
            <button className="min-w-[44px] min-h-[44px] border-2 rounded font-bold text-white hover:bg-white/10 focus:ring-2 focus:ring-white transition-colors" style={{ borderColor: BORDER_GOLD }}>
              Character (C)
            </button>
            <button className="min-w-[44px] min-h-[44px] border-2 rounded font-bold text-white hover:bg-white/10 focus:ring-2 focus:ring-white transition-colors" style={{ borderColor: BORDER_GOLD }}>
              Inventory (I)
            </button>
            <button className="min-w-[44px] min-h-[44px] border-2 rounded font-bold text-white hover:bg-white/10 focus:ring-2 focus:ring-white transition-colors" style={{ borderColor: BORDER_GOLD }}>
              Skills (K)
            </button>
          </div>
        </Panel>

        <Panel className="w-full p-4">
          <h2 className="text-lg font-bold mb-3 border-b pb-2 uppercase tracking-widest" style={{ color: BORDER_GOLD, borderColor: BORDER_GOLD, fontFamily: "'Cinzel', serif" }}>
            Statistics
          </h2>
          <div className="space-y-3 font-mono text-base">
            <div className="flex justify-between items-center bg-black/40 p-2 rounded">
              <span className="text-gray-300 font-bold">Score:</span>
              <span className="text-yellow-400 font-bold text-lg">{mockData.score.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center bg-black/40 p-2 rounded">
              <span className="text-gray-300 font-bold">Kills:</span>
              <span className="text-red-400 font-bold text-lg">{mockData.kills}</span>
            </div>
          </div>

          <h2 className="text-lg font-bold mt-5 mb-3 border-b pb-2 uppercase tracking-widest" style={{ color: BORDER_GOLD, borderColor: BORDER_GOLD, fontFamily: "'Cinzel', serif" }}>
            Resources
          </h2>
          <div className="space-y-2 font-mono text-base">
            <div className="flex justify-between items-center bg-black/40 p-2 rounded">
              <span className="text-amber-700 font-bold flex items-center gap-2"><span role="img" aria-label="Wood">🪵</span> Wood:</span>
              <span className="text-white font-bold text-lg">{mockData.resources.wood}</span>
            </div>
            <div className="flex justify-between items-center bg-black/40 p-2 rounded">
              <span className="text-gray-400 font-bold flex items-center gap-2"><span role="img" aria-label="Stone">🪨</span> Stone:</span>
              <span className="text-white font-bold text-lg">{mockData.resources.stone}</span>
            </div>
            <div className="flex justify-between items-center bg-black/40 p-2 rounded">
              <span className="text-yellow-500 font-bold flex items-center gap-2"><span role="img" aria-label="Gold">🪙</span> Gold:</span>
              <span className="text-white font-bold text-lg">{mockData.resources.gold}</span>
            </div>
          </div>
        </Panel>
      </div>

      {/* BOTTOM LEFT: Combat Log */}
      <div className="absolute bottom-4 left-4 w-[400px]">
        <Panel className="flex flex-col h-[200px]">
          <div className="px-4 py-2 border-b-2 bg-black/40" style={{ borderColor: BORDER_GOLD }}>
            <h2 className="font-bold text-base uppercase tracking-widest" style={{ color: BORDER_GOLD, fontFamily: "'Cinzel', serif" }}>Combat Log</h2>
          </div>
          <div className="flex-1 p-3 overflow-hidden flex flex-col justify-end gap-2 bg-black/20">
            {mockData.log.map((entry, idx) => (
              <div key={idx} className="flex gap-3 text-[14px] p-2 rounded bg-black/60 border border-gray-800">
                <span className="text-gray-400 font-mono font-bold shrink-0">[{entry.time}]</span>
                <span className="font-bold tracking-wide" style={{ color: entry.color }}>{entry.msg}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* BOTTOM RIGHT: Controls */}
      <div className="absolute bottom-4 right-4 w-[280px]">
        <Panel className="p-4">
          <h2 className="text-base font-bold mb-3 border-b pb-2 uppercase tracking-widest text-center" style={{ color: BORDER_GOLD, borderColor: BORDER_GOLD, fontFamily: "'Cinzel', serif" }}>
            Controls
          </h2>
          <div className="grid grid-cols-1 gap-2">
            {mockData.controls.map((ctrl, idx) => (
              <div key={idx} className="flex justify-between items-center bg-black/40 p-2 rounded">
                <span className="text-white font-bold text-sm tracking-wide">{ctrl.action}</span>
                <div className="bg-gray-800 px-2 py-1 rounded border border-gray-600 min-w-[44px] text-center">
                  <span className="text-yellow-400 font-mono font-bold text-[14px]">{ctrl.key}</span>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* BOTTOM CENTER: Main Action Bar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4">
        
        {/* Skill Cooldowns */}
        <div className="flex gap-4">
          {mockData.skills.map((skill, idx) => {
            const onCd = skill.cd > 0;
            return (
              <div key={idx} className="flex flex-col items-center gap-1">
                <div 
                  className="w-[60px] h-[60px] border-2 bg-black rounded flex items-center justify-center relative overflow-hidden"
                  style={{ borderColor: onCd ? "#555" : BORDER_GOLD }}
                >
                  <span className="text-2xl" style={{ opacity: onCd ? 0.3 : 1 }}>{skill.icon}</span>
                  
                  {onCd && (
                    <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                      <span className="text-white font-mono font-bold text-lg text-shadow-md">
                        {skill.cd.toFixed(1)}s
                      </span>
                    </div>
                  )}
                  
                  <div className="absolute top-1 left-1 bg-black/80 w-5 h-5 rounded flex items-center justify-center border border-gray-600">
                    <span className="text-white font-mono font-bold text-[11px]">{idx + 1}</span>
                  </div>
                </div>
                <div className="bg-black/80 px-2 py-1 rounded border border-gray-800">
                  <span className="text-white font-bold text-[12px] tracking-wider uppercase">
                    {skill.name}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Hotbar */}
        <Panel className="flex gap-2 p-3 bg-black/90">
          {mockData.hotbar.map((item, idx) => (
            <div 
              key={idx}
              className="w-[64px] h-[64px] border-2 bg-gray-900 rounded flex flex-col items-center justify-center relative cursor-pointer hover:bg-gray-800 transition-colors"
              style={{ borderColor: idx === 0 ? BORDER_GOLD : "#444" }}
            >
              <div className="absolute top-1 left-1 bg-black/80 w-6 h-6 rounded flex items-center justify-center border border-gray-600 z-10">
                <span className="text-yellow-400 font-mono font-bold text-[14px]">
                  {idx === 8 ? 9 : (idx + 1) % 10}
                </span>
              </div>
              
              {item && (
                <>
                  <span className="text-3xl mb-1 mt-2">{item.icon}</span>
                  {item.count !== null && (
                    <div className="absolute bottom-1 right-1 bg-black/90 px-1.5 rounded border border-gray-600">
                      <span className="text-white font-mono font-bold text-[14px]">{item.count}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </Panel>
      </div>

    </div>
  );
}
