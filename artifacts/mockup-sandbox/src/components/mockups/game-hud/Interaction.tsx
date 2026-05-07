import React, { useState } from "react";

// Dummy data for mockup
const stats = {
  health: 450,
  maxHealth: 500,
  mana: 220,
  maxMana: 300,
  stamina: 80,
  maxStamina: 100,
  hunger: 90,
  maxHunger: 100,
  xp: 1250,
  xpToNext: 2000,
  level: 12,
  score: 14500,
  kills: 128,
  resources: { wood: 45, stone: 12, gold: 250 },
};

const skillCooldowns = [
  { key: "skill1", label: "1", name: "Fireball", icon: "🔥", cd: 0, max: 3.0 },
  { key: "skill2", label: "2", name: "Heal", icon: "✨", cd: 2.5, max: 4.0 },
  { key: "skill3", label: "3", name: "Shield", icon: "🛡️", cd: 0, max: 5.0 },
  { key: "skill4", label: "4", name: "Dash", icon: "💨", cd: 0, max: 3.0 },
  { key: "skill5", label: "5", name: "Ultimate", icon: "☄️", cd: 15.0, max: 60.0 },
];

const hotbarItems = [
  { icon: "🗡️", name: "Iron Sword", qty: 1 },
  { icon: "🧪", name: "Health Potion", qty: 5 },
  { icon: "💧", name: "Mana Potion", qty: 3 },
  { icon: "🥖", name: "Bread", qty: 10 },
  { icon: "🏹", name: "Bow", qty: 1 },
  { icon: "🪵", name: "Wood", qty: 45 },
  { icon: "🪨", name: "Stone", qty: 12 },
  null,
  null,
];

const logMessages = [
  { color: "#c5a059", text: "[System]: Welcome back, warrior." },
  { color: "#66ff66", text: "[System]: You have gained 50 XP." },
  { color: "#ff6b6b", text: "[Combat]: Slain Goblin for 10 XP." },
  { color: "#fff", text: "[Action]: Crafted Iron Sword." },
];

export default function Interaction() {
  const [hoveredSkill, setHoveredSkill] = useState<number | null>(null);
  const [hoveredItem, setHoveredItem] = useState<number | null>(null);

  // Interaction Hypothesis design tokens
  const colors = {
    bgDark: "#0a0705",
    panelBg: "rgba(26, 18, 12, 0.85)",
    panelBgInteractive: "rgba(45, 30, 20, 0.95)", // Lighter for interactive zones
    borderGold: "#c5a059",
    borderGoldDim: "rgba(197, 160, 89, 0.4)",
    textBody: "#e0d8c8",
    textHighlight: "#ffd700",
    affordanceGlow: "0 0 8px rgba(197, 160, 89, 0.6)",
    btnInnerShadow: "inset 0 2px 4px rgba(255,255,255,0.1), inset 0 -2px 4px rgba(0,0,0,0.5)",
  };

  const fonts = {
    header: "'Cinzel', serif",
    body: "'Crimson Text', serif",
    mono: "'JetBrains Mono', monospace",
  };

  return (
    <div
      className="w-full h-screen overflow-hidden relative select-none"
      style={{
        backgroundColor: colors.bgDark,
        backgroundImage: "radial-gradient(circle at center, #1a1510 0%, #050302 100%)", // Fake 3D game bg
        fontFamily: fonts.body,
        color: colors.textBody,
      }}
    >
      {/* HUD OVERLAY */}

      {/* --- TOP LEFT: Unit Frame --- */}
      <div className="absolute top-4 left-4 flex gap-4 pointer-events-none">
        {/* Avatar */}
        <div 
          className="relative rounded-full border-2 bg-black flex items-center justify-center pointer-events-auto cursor-pointer hover:scale-105 transition-transform"
          style={{
            width: 80, height: 80,
            borderColor: colors.borderGold,
            boxShadow: "0 4px 10px rgba(0,0,0,0.8)",
            background: colors.panelBgInteractive, // Interactive panel bg
          }}
          title="Character Profile [P]"
        >
          <span className="text-4xl filter drop-shadow-md">🧙‍♂️</span>
          {/* Level Badge */}
          <div 
            className="absolute -bottom-2 right-[-5px] rounded-full border flex items-center justify-center font-bold"
            style={{
              width: 30, height: 30,
              backgroundColor: "#4a0000",
              borderColor: colors.borderGold,
              fontFamily: fonts.header,
              fontSize: 14,
              boxShadow: colors.affordanceGlow,
            }}
          >
            {stats.level}
          </div>
        </div>

        {/* Bars */}
        <div className="flex flex-col gap-2 justify-center w-64">
          <ProgressBar color="linear-gradient(90deg, #8e2020, #c0392b)" value={stats.health} max={stats.maxHealth} label="HP" />
          <ProgressBar color="linear-gradient(90deg, #1a5276, #2980b9)" value={stats.stamina} max={stats.maxStamina} label="SP" height={16} fontSize={10} />
          <ProgressBar color="linear-gradient(90deg, #935116, #d68910)" value={stats.hunger} max={stats.maxHunger} label="FD" height={14} fontSize={9} />
          <ProgressBar color="linear-gradient(90deg, #6c3483, #8e44ad)" value={stats.xp} max={stats.xpToNext} label="XP" height={10} fontSize={8} showValue={false} />
        </div>
      </div>

      {/* --- TOP RIGHT: Minimap & Options --- */}
      <div className="absolute top-4 right-4 flex flex-col items-end gap-3">
        {/* Minimap */}
        <div 
          className="rounded-full border-4 overflow-hidden relative pointer-events-auto cursor-pointer hover:border-white transition-colors duration-200"
          style={{
            width: 150, height: 150,
            borderColor: colors.borderGold,
            background: "url('https://images.unsplash.com/photo-1524661135-423995f22d0b?ixlib=rb-1.2.1&auto=format&fit=crop&w=300&q=80') center/cover", // fake map texture
            boxShadow: "0 5px 15px rgba(0,0,0,0.8), " + colors.affordanceGlow,
          }}
          title="Open World Map [M]"
        >
          {/* Player marker */}
          <div className="absolute top-1/2 left-1/2 w-3 h-3 bg-red-500 rounded-full border border-white transform -translate-x-1/2 -translate-y-1/2 shadow-[0_0_8px_red]" />
          
          {/* Day/Night info overlay */}
          <div className="absolute bottom-0 w-full bg-black/60 text-center py-1 backdrop-blur-sm border-t border-white/20 text-xs font-bold font-['Cinzel'] tracking-wider text-yellow-400">
            ☀️ DAY • W-5
          </div>
        </div>

        {/* Interaction Group: Clearly labeled buttons instead of vague icons */}
        <div 
          className="flex flex-col gap-2 p-2 rounded border pointer-events-auto"
          style={{ 
            backgroundColor: colors.panelBgInteractive,
            borderColor: colors.borderGoldDim,
            borderStyle: "dashed", // Hinting interactivity zone
          }}
        >
          <MenuButton icon="🎒" label="Inventory" hotkey="I" />
          <MenuButton icon="✨" label="Skills" hotkey="K" />
          <MenuButton icon="⚙️" label="Settings" hotkey="ESC" />
        </div>
        
        {/* Stats Panel */}
        <div 
          className="p-3 rounded border w-48 pointer-events-none"
          style={{
            backgroundColor: colors.panelBg,
            borderColor: colors.borderGoldDim,
            boxShadow: "0 4px 10px rgba(0,0,0,0.5)",
          }}
        >
          <div className="flex justify-between font-['Cinzel'] text-sm border-b border-white/10 pb-1 mb-1">
            <span>Score:</span> <span style={{ color: colors.textHighlight }}>{stats.score}</span>
          </div>
          <div className="flex justify-between font-['Cinzel'] text-sm border-b border-white/10 pb-1 mb-2">
            <span>Kills:</span> <span className="text-red-400">{stats.kills}</span>
          </div>
          <div className="grid grid-cols-3 gap-1 text-xs text-center font-['JetBrains_Mono']">
            <div className="flex flex-col items-center bg-black/40 rounded p-1"><span>🪵</span>{stats.resources.wood}</div>
            <div className="flex flex-col items-center bg-black/40 rounded p-1"><span>🪨</span>{stats.resources.stone}</div>
            <div className="flex flex-col items-center bg-black/40 rounded p-1"><span>🪙</span>{stats.resources.gold}</div>
          </div>
        </div>
      </div>

      {/* --- BOTTOM LEFT: Combat Log --- */}
      <div 
        className="absolute bottom-4 left-4 w-72 rounded border p-2 text-xs flex flex-col pointer-events-auto group"
        style={{
          height: 140,
          backgroundColor: colors.panelBg,
          borderColor: colors.borderGoldDim,
        }}
      >
        <div 
          className="text-center font-['Cinzel'] text-sm border-b pb-1 mb-1 flex justify-between items-center group-hover:text-white transition-colors"
          style={{ borderColor: colors.borderGoldDim, color: colors.borderGold }}
        >
          <span>Combat Log</span>
          <span className="opacity-0 group-hover:opacity-100 text-[10px] bg-white/10 px-1 rounded cursor-pointer">Scroll ↕</span>
        </div>
        <div className="flex-1 overflow-y-auto flex flex-col justify-end space-y-1 font-['JetBrains_Mono'] pr-1 custom-scrollbar">
          {logMessages.map((msg, i) => (
            <div key={i} style={{ color: msg.color }}>{msg.text}</div>
          ))}
        </div>
      </div>

      {/* --- BOTTOM RIGHT: Controls Hint --- */}
      <div 
        className="absolute bottom-4 right-4 w-64 rounded border p-3 text-xs pointer-events-none opacity-80"
        style={{
          backgroundColor: colors.panelBg,
          borderColor: colors.borderGoldDim,
        }}
      >
        <div className="text-center font-['Cinzel'] text-sm border-b pb-1 mb-2" style={{ borderColor: colors.borderGoldDim, color: colors.borderGold }}>
          Controls Overview
        </div>
        <div className="grid grid-cols-2 gap-y-1">
          <div className="flex justify-between pr-2 border-r border-white/10"><span className="text-gray-400">Move</span> <span className="font-bold">WASD</span></div>
          <div className="flex justify-between pl-2"><span className="text-gray-400">Attack</span> <span className="font-bold">LMB</span></div>
          <div className="flex justify-between pr-2 border-r border-white/10"><span className="text-gray-400">Block</span> <span className="font-bold">RMB</span></div>
          <div className="flex justify-between pl-2"><span className="text-gray-400">Dodge</span> <span className="font-bold">SPACE</span></div>
          <div className="flex justify-between pr-2 border-r border-white/10"><span className="text-gray-400">Interact</span> <span className="font-bold">F</span></div>
          <div className="flex justify-between pl-2"><span className="text-gray-400">Map</span> <span className="font-bold">M</span></div>
        </div>
      </div>

      {/* --- BOTTOM CENTER: Action Bar Area --- */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-auto">
        
        {/* Top row: Skill Cooldowns (Clear labels) */}
        <div 
          className="flex gap-3 p-2 rounded-lg border border-dashed"
          style={{ 
            backgroundColor: colors.panelBgInteractive,
            borderColor: "rgba(255,255,255,0.2)"
          }}
        >
          {skillCooldowns.map((skill, i) => {
            const onCd = skill.cd > 0;
            return (
              <div 
                key={skill.key}
                className="relative flex flex-col items-center cursor-pointer group"
                onMouseEnter={() => setHoveredSkill(i)}
                onMouseLeave={() => setHoveredSkill(null)}
              >
                {/* Persistent Mini-Tooltip for skills */}
                <div className={`absolute -top-6 whitespace-nowrap text-[10px] px-2 py-0.5 rounded bg-black border border-gray-600 transition-opacity ${hoveredSkill === i ? 'opacity-100 z-10' : 'opacity-0'}`}>
                  {skill.name} {onCd ? `(${skill.cd}s)` : ''}
                </div>

                <div 
                  className={`w-12 h-12 rounded border flex items-center justify-center text-xl relative overflow-hidden transition-transform ${onCd ? 'opacity-50' : 'hover:-translate-y-1 hover:shadow-lg'}`}
                  style={{
                    backgroundColor: "#2a2a2a",
                    borderColor: onCd ? "#555" : colors.borderGold,
                    boxShadow: !onCd ? colors.btnInnerShadow : "none",
                  }}
                >
                  {skill.icon}
                  {onCd && (
                    <div className="absolute bottom-0 left-0 w-full bg-black/70 flex items-center justify-center" style={{ height: `${(skill.cd / skill.max) * 100}%` }}>
                      <span className="text-white text-xs font-bold drop-shadow-md z-10">{skill.cd}s</span>
                    </div>
                  )}
                </div>
                {/* Always visible keybind label */}
                <div className="mt-1 bg-white/10 px-2 py-0.5 rounded text-[10px] font-bold text-center w-full shadow-inner border border-white/5">
                  {skill.label}
                </div>
              </div>
            )
          })}
        </div>

        {/* Main Bar: Globes + Hotbar */}
        <div className="flex items-center gap-4">
          
          {/* HP Globe */}
          <div className="relative cursor-help" title={`Health: ${stats.health}/${stats.maxHealth}`}>
            <div className="w-24 h-24 rounded-full border-4 flex items-end justify-center overflow-hidden bg-black shadow-[0_0_20px_rgba(200,0,0,0.5)]" style={{ borderColor: colors.borderGold }}>
              <div className="w-full bg-gradient-to-t from-red-900 to-red-600 transition-all duration-300" style={{ height: `${(stats.health / stats.maxHealth) * 100}%`, boxShadow: "inset 0 10px 20px rgba(255,0,0,0.5)" }} />
              {/* Always visible values */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white drop-shadow-[0_2px_2px_rgba(0,0,0,1)]">
                <span className="font-['Cinzel'] font-bold text-lg leading-none">{stats.health}</span>
                <span className="text-[9px] uppercase tracking-widest text-red-200">Health</span>
              </div>
            </div>
          </div>

          {/* Hotbar Container with interactive styling */}
          <div 
            className="flex gap-1 p-2 rounded-xl border"
            style={{ 
              backgroundColor: colors.panelBgInteractive,
              borderColor: colors.borderGold,
              boxShadow: "0 10px 30px rgba(0,0,0,0.8), " + colors.btnInnerShadow
            }}
          >
            {hotbarItems.map((item, i) => (
              <div 
                key={i}
                className="relative cursor-pointer group"
                onMouseEnter={() => setHoveredItem(i)}
                onMouseLeave={() => setHoveredItem(null)}
              >
                {/* Keybind top left */}
                <div className="absolute -top-2 -left-2 z-10 bg-[#3a2a18] border border-[#c5a059] text-[#c5a059] text-[10px] font-bold w-5 h-5 rounded flex items-center justify-center shadow-md">
                  {i === 8 ? 0 : i + 1}
                </div>

                {/* Slot Box */}
                <div 
                  className={`w-14 h-14 rounded border flex flex-col items-center justify-center transition-all ${item ? 'hover:bg-[#3a2a18] hover:border-white' : 'hover:bg-white/5'}`}
                  style={{
                    backgroundColor: "#1a1a1a",
                    borderColor: "#444",
                    boxShadow: "inset 0 0 10px rgba(0,0,0,1)",
                  }}
                >
                  {item ? (
                    <>
                      <span className="text-2xl filter drop-shadow-md group-hover:scale-110 transition-transform">{item.icon}</span>
                      {/* Name below icon always visible */}
                      <span className="text-[8px] leading-tight text-gray-300 text-center px-1 truncate w-full mt-0.5">{item.name}</span>
                      {item.qty > 1 && (
                        <span className="absolute bottom-0 right-1 text-[10px] font-bold text-white drop-shadow-[0_1px_2px_black]">{item.qty}</span>
                      )}
                    </>
                  ) : (
                    <span className="opacity-20 text-xs">Empty</span>
                  )}
                </div>

                {/* Contextual full tooltip on hover */}
                {item && hoveredItem === i && (
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-black border border-[#c5a059] p-2 rounded shadow-xl min-w-[120px] z-20 pointer-events-none">
                    <div className="font-bold text-[#c5a059] border-b border-white/20 pb-1 mb-1">{item.name}</div>
                    <div className="text-xs text-gray-300 flex justify-between"><span>Quantity:</span> <span>{item.qty}</span></div>
                    <div className="text-[10px] text-gray-500 mt-1 text-center italic">Click or press {i === 8 ? 0 : i + 1} to use</div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* MP Globe */}
          <div className="relative cursor-help" title={`Mana: ${stats.mana}/${stats.maxMana}`}>
            <div className="w-24 h-24 rounded-full border-4 flex items-end justify-center overflow-hidden bg-black shadow-[0_0_20px_rgba(0,100,200,0.5)]" style={{ borderColor: colors.borderGold }}>
              <div className="w-full bg-gradient-to-t from-blue-900 to-blue-500 transition-all duration-300" style={{ height: `${(stats.mana / stats.maxMana) * 100}%`, boxShadow: "inset 0 10px 20px rgba(0,100,255,0.5)" }} />
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white drop-shadow-[0_2px_2px_rgba(0,0,0,1)]">
                <span className="font-['Cinzel'] font-bold text-lg leading-none">{stats.mana}</span>
                <span className="text-[9px] uppercase tracking-widest text-blue-200">Mana</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Crimson+Text:ital,wght@0,400;0,600;1,400&family=JetBrains+Mono:wght@400;700&display=swap');
        
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0,0,0,0.2);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #c5a059;
          border-radius: 2px;
        }
      `}} />
    </div>
  );
}

// Helpers

function ProgressBar({ color, value, max, label, height = 20, fontSize = 12, showValue = true }: { color: string, value: number, max: number, label: string, height?: number, fontSize?: number, showValue?: boolean }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="relative w-full bg-black/80 rounded border border-white/10 overflow-hidden shadow-inner" style={{ height }}>
      {/* Background track pattern */}
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,255,255,0.1) 5px, rgba(255,255,255,0.1) 10px)' }} />
      
      {/* Fill */}
      <div 
        className="absolute top-0 left-0 h-full transition-all duration-300"
        style={{ width: `${pct}%`, background: color, boxShadow: "inset 0 0 10px rgba(255,255,255,0.3)" }}
      />
      
      {/* Text */}
      <div className="absolute inset-0 flex justify-between items-center px-2 pointer-events-none drop-shadow-md text-white font-bold" style={{ fontSize }}>
        <span>{label}</span>
        {showValue && <span>{value} / {max}</span>}
      </div>
    </div>
  );
}

function MenuButton({ icon, label, hotkey }: { icon: string, label: string, hotkey: string }) {
  return (
    <button 
      className="flex items-center gap-3 px-3 py-1.5 rounded transition-all hover:translate-x-1 group"
      style={{
        background: "linear-gradient(180deg, #3a2a18 0%, #1a120c 100%)",
        border: "1px solid #c5a059",
        boxShadow: "0 2px 5px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.2)",
      }}
    >
      <span className="text-lg group-hover:scale-110 transition-transform">{icon}</span>
      <span className="font-['Cinzel'] text-sm text-[#e0d8c8] flex-1 text-left">{label}</span>
      <span className="text-[10px] bg-black/50 px-1.5 py-0.5 rounded border border-white/20 text-gray-400 font-['JetBrains_Mono']">
        {hotkey}
      </span>
    </button>
  );
}
