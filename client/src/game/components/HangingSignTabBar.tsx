/**
 * HangingSignTabBar — RPG shop signs on chains for Hero Forge section tabs.
 */

import type { CSSProperties, ReactNode } from "react";

export interface HangingSignTab {
  key: string;
  label: string;
  /** Painted lettering accent when active. */
  accent?: string;
}

interface HangingSignTabBarProps {
  tabs: HangingSignTab[];
  activeKey: string;
  onSelect: (key: string) => void;
  /** Optional trailing control (e.g. Dev toggle). */
  trailing?: ReactNode;
}

const TAB_PAINT: Record<string, string> = {
  class: "#f6c945",
  equip: "#8ec8ff",
  weapons: "#ff7a62",
  colors: "#d4a0ff",
  body: "#7dcea0",
  anims: "#5ddeb8",
  edit: "#ff9a6a",
  studio: "#c9a86c",
  info: "#a8b4d4",
  debug: "#e88a7a",
};

const HANGING_SIGN_CSS = `
@keyframes cs-sign-sway{
  0%,100%{transform:rotate(-1.2deg) translateY(0)}
  50%{transform:rotate(1.2deg) translateY(2px)}
}
@keyframes cs-chain-sway{
  0%,100%{transform:rotate(-.8deg)}
  50%{transform:rotate(.8deg)}
}
@keyframes cs-paint-shimmer{
  0%{background-position:0% 50%}
  50%{background-position:100% 50%}
  100%{background-position:0% 50%}
}
@keyframes cs-wood-glint{
  0%,100%{opacity:.35}
  50%{opacity:.55}
}
.cs-sign-rail{
  display:flex;
  align-items:flex-start;
  gap:6px;
  padding:10px 8px 4px;
  background:
    linear-gradient(180deg,rgba(18,12,8,.95) 0%,rgba(8,6,10,.6) 100%);
  border-bottom:1px solid rgba(80,55,30,.45);
  overflow-x:auto;
  overflow-y:visible;
  scrollbar-width:thin;
}
.cs-sign-rail::-webkit-scrollbar{height:4px}
.cs-sign-rail::-webkit-scrollbar-thumb{background:rgba(120,85,45,.5);border-radius:2px}
.cs-sign-mount{
  flex:1 1 0;
  min-width:58px;
  display:flex;
  flex-direction:column;
  align-items:center;
  padding-top:2px;
  transform-origin:50% 0;
  animation:cs-sign-sway 4.2s ease-in-out infinite;
}
.cs-sign-mount:nth-child(2){animation-delay:-.6s}
.cs-sign-mount:nth-child(3){animation-delay:-1.2s}
.cs-sign-mount:nth-child(4){animation-delay:-1.8s}
.cs-sign-mount:nth-child(5){animation-delay:-2.4s}
.cs-sign-mount:nth-child(6){animation-delay:-3s}
.cs-sign-mount:nth-child(7){animation-delay:-3.6s}
.cs-sign-mount:nth-child(8){animation-delay:-4.2s}
.cs-sign-mount:nth-child(9){animation-delay:-4.8s}
.cs-sign-mount:hover{animation-play-state:paused}
.cs-sign-chains{
  display:flex;
  gap:10px;
  margin-bottom:2px;
  animation:cs-chain-sway 3.6s ease-in-out infinite;
}
.cs-sign-link{
  display:block;
  width:3px;
  height:14px;
  border-radius:2px;
  background:linear-gradient(180deg,#8a8a95 0%,#4a4a55 35%,#6e6e78 65%,#3a3a42 100%);
  box-shadow:0 1px 2px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.25);
  position:relative;
}
.cs-sign-link::before{
  content:"";
  position:absolute;
  top:-3px;left:50%;
  transform:translateX(-50%);
  width:7px;height:5px;
  border-radius:50%;
  background:radial-gradient(circle at 35% 30%,#b8b8c4,#5a5a64);
  box-shadow:0 1px 2px rgba(0,0,0,.5);
}
.cs-sign-board{
  position:relative;
  width:100%;
  padding:7px 4px 8px;
  border:none;
  cursor:pointer;
  font-family:'Cinzel',serif;
  font-size:8px;
  font-weight:700;
  letter-spacing:.8px;
  text-transform:uppercase;
  line-height:1.2;
  color:#c4a882;
  text-shadow:0 1px 2px rgba(0,0,0,.8);
  border-radius:3px 3px 5px 5px;
  background:
    linear-gradient(180deg,rgba(255,255,255,.06) 0%,transparent 18%,rgba(0,0,0,.22) 100%),
    repeating-linear-gradient(
      92deg,
      transparent 0px,transparent 5px,
      rgba(0,0,0,.07) 5px,rgba(0,0,0,.07) 6px
    ),
    repeating-linear-gradient(
      0deg,
      #5a3d28 0px,#6b4a32 2px,#4a3020 4px,#5c3f2a 6px,#6e5038 8px
    );
  box-shadow:
    inset 0 1px 0 rgba(255,220,160,.12),
    inset 0 -2px 4px rgba(0,0,0,.35),
    0 4px 10px rgba(0,0,0,.45),
    0 0 0 1px rgba(30,18,8,.9),
    0 0 0 2px rgba(90,60,35,.55);
  transition:transform .2s ease,box-shadow .2s ease;
}
.cs-sign-board::before{
  content:"";
  position:absolute;
  inset:3px 4px auto;
  height:2px;
  border-radius:1px;
  background:linear-gradient(90deg,transparent,rgba(255,230,180,.25),transparent);
  animation:cs-wood-glint 3s ease-in-out infinite;
  pointer-events:none;
}
.cs-sign-board::after{
  content:"";
  position:absolute;
  left:5px;right:5px;bottom:3px;
  height:3px;
  border-radius:0 0 2px 2px;
  background:linear-gradient(180deg,transparent,rgba(0,0,0,.4));
  pointer-events:none;
}
.cs-sign-board:hover{
  transform:translateY(-1px);
  box-shadow:
    inset 0 1px 0 rgba(255,220,160,.18),
    inset 0 -2px 4px rgba(0,0,0,.35),
    0 6px 14px rgba(0,0,0,.5),
    0 0 0 1px rgba(30,18,8,.9),
    0 0 0 2px rgba(110,75,45,.65);
}
.cs-sign-board.active{
  transform:translateY(1px) scale(1.02);
  box-shadow:
    inset 0 1px 0 rgba(255,240,200,.2),
    inset 0 -3px 6px rgba(0,0,0,.4),
    0 2px 6px rgba(0,0,0,.5),
    0 0 0 1px rgba(30,18,8,.9),
    0 0 0 2px var(--sign-accent,#c9950a),
    0 0 18px -4px var(--sign-accent,#c9950a);
}
.cs-sign-board.active .cs-sign-label{
  background:linear-gradient(
    105deg,
    var(--sign-accent,#f6c945) 0%,
    #fff8dc 25%,
    var(--sign-accent,#f6c945) 50%,
    #fff3c2 75%,
    var(--sign-accent,#f6c945) 100%
  );
  background-size:220% auto;
  -webkit-background-clip:text;
  background-clip:text;
  -webkit-text-fill-color:transparent;
  color:transparent;
  animation:cs-paint-shimmer 2.8s ease-in-out infinite;
  filter:drop-shadow(0 0 6px color-mix(in srgb,var(--sign-accent,#f6c945) 55%,transparent));
}
.cs-sign-label{
  position:relative;
  z-index:1;
  display:block;
}
.cs-sign-trailing{
  flex:0 0 auto;
  align-self:flex-start;
  margin-top:16px;
  margin-left:2px;
}
/* Compact section header signs (left sidebar labels) */
.cs-section-sign{
  display:flex;
  flex-direction:column;
  align-items:center;
  margin-bottom:8px;
  transform-origin:50% 0;
  animation:cs-sign-sway 5s ease-in-out infinite;
}
.cs-section-sign .cs-sign-chains{gap:6px;margin-bottom:1px}
.cs-section-sign .cs-sign-link{height:10px}
.cs-section-sign-board{
  padding:4px 10px 5px;
  font-size:7px;
  letter-spacing:1.8px;
  min-width:72px;
  text-align:center;
}
.cs-section-sign-board .cs-sign-label{
  background:linear-gradient(105deg,var(--sign-accent,#c9a86c),#fff3c2 40%,var(--sign-accent,#c9a86c) 80%);
  background-size:180% auto;
  -webkit-background-clip:text;
  background-clip:text;
  -webkit-text-fill-color:transparent;
  color:transparent;
  animation:cs-paint-shimmer 3.5s ease-in-out infinite;
}
`;

let cssInjected = false;
function injectHangingSignCSS() {
  if (cssInjected || typeof document === "undefined") return;
  if (document.getElementById("grudge-hanging-sign-css")) {
    cssInjected = true;
    return;
  }
  const s = document.createElement("style");
  s.id = "grudge-hanging-sign-css";
  s.textContent = HANGING_SIGN_CSS;
  document.head.appendChild(s);
  cssInjected = true;
}

export function HangingSignTabBar({ tabs, activeKey, onSelect, trailing }: HangingSignTabBarProps) {
  injectHangingSignCSS();

  return (
    <div className="cs-sign-rail">
      {tabs.map(tab => {
        const isActive = activeKey === tab.key;
        const accent = tab.accent ?? TAB_PAINT[tab.key] ?? "#c9950a";
        return (
          <div key={tab.key} className="cs-sign-mount">
            <div className="cs-sign-chains" aria-hidden="true">
              <span className="cs-sign-link" />
              <span className="cs-sign-link" />
            </div>
            <button
              type="button"
              className={`cs-sign-board${isActive ? " active" : ""}`}
              onClick={() => onSelect(tab.key)}
              style={{ "--sign-accent": accent } as CSSProperties}
              aria-pressed={isActive}
            >
              <span className="cs-sign-label">{tab.label}</span>
            </button>
          </div>
        );
      })}
      {trailing && <div className="cs-sign-trailing">{trailing}</div>}
    </div>
  );
}

/** Small hanging sign for left-sidebar section titles. */
export function HangingSignSectionLabel({
  label,
  accent = "#c9a86c",
}: {
  label: string;
  accent?: string;
}) {
  injectHangingSignCSS();
  return (
    <div className="cs-section-sign">
      <div className="cs-sign-chains" aria-hidden="true">
        <span className="cs-sign-link" />
        <span className="cs-sign-link" />
      </div>
      <div
        className="cs-sign-board cs-section-sign-board"
        style={{ "--sign-accent": accent } as CSSProperties}
      >
        <span className="cs-sign-label">{label}</span>
      </div>
    </div>
  );
}