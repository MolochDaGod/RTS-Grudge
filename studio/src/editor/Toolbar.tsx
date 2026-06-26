/**
 * Top toolbar: tool selection, brush size/strength, save/load/export.
 */
import { useEditor } from './store';
import type { WeatherBiome } from './store';
import {
  saveProjectLocal,
  loadProjectLocal,
  listSavedProjects,
  downloadJSON,
  projectFromJSON,
} from './project';
import type { EditorTool } from '../types';
import { useState, useRef, useEffect } from 'react';
import { generateIsland } from './IslandGenerator';
import {
  PLAYER_CHARACTERS,
  PLAYER_CHARACTER_IDS,
} from '../library/PlayerCharacterRegistry';

const WEATHER_OPTS: { id: WeatherBiome; icon: string; label: string }[] = [
  { id: 'forest',  icon: '🌲', label: 'Forest'  },
  { id: 'beach',   icon: '🏖️', label: 'Beach'   },
  { id: 'volcano', icon: '🌋', label: 'Volcano' },
  { id: 'winter',  icon: '❄️', label: 'Winter'  },
];

const TOOL_GROUPS: { label: string; tools: { id: EditorTool; label: string; icon: string }[] }[] = [
  {
    label: 'Transform',
    tools: [
      { id: 'select',    label: 'Select (V)',  icon: '🔄' },
      { id: 'translate', label: 'Move (G)',    icon: '↕️'  },
      { id: 'rotate',    label: 'Rotate (R)',  icon: '↺'  },
      { id: 'scale',     label: 'Scale (S)',   icon: '⤢'  },
    ],
  },
  {
    label: 'Sculpt',
    tools: [
      { id: 'sculpt_raise',  label: 'Raise',  icon: '▲' },
      { id: 'sculpt_lower',  label: 'Lower',  icon: '▼' },
      { id: 'sculpt_smooth', label: 'Smooth', icon: '∼' },
    ],
  },
  {
    label: 'Paint',
    tools: [
      { id: 'paint_grass', label: 'Grass 🌿', icon: '🌿' },
      { id: 'paint_sand',  label: 'Sand 🏖️',  icon: '🏖️' },
      { id: 'paint_rock',  label: 'Rock 🪨',  icon: '🪨' },
      { id: 'paint_snow',  label: 'Snow ❄️',  icon: '❄️' },
    ],
  },
  {
    label: 'Place',
    tools: [{ id: 'place_entity', label: 'Place', icon: '✛' }],
  },
];

// ── Lightweight toast ─────────────────────────────────────────────────────────────
let _toast: ((msg: string, ok?: boolean) => void) | null = null;
function useToast() {
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  useEffect(() => { _toast = (text, ok = true) => setMsg({ text, ok }); return () => { _toast = null; }; }, []);
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(null), 2400); return () => clearTimeout(t); }, [msg]);
  return msg;
}
export function toast(text: string, ok = true) { _toast?.(text, ok); }

export function Toolbar() {
  const tool = useEditor((s) => s.tool);
  const setTool = useEditor((s) => s.setTool);
  const radius = useEditor((s) => s.brushRadius);
  const setBrushRadius = useEditor((s) => s.setBrushRadius);
  const strength = useEditor((s) => s.brushStrength);
  const setBrushStrength = useEditor((s) => s.setBrushStrength);
  const project = useEditor((s) => s.project);
  const entityCount = useEditor((s) => s.project.entities.length);
  const newProject = useEditor((s) => s.newProject);
  const loadProject = useEditor((s) => s.loadProject);
  const exportJSON = useEditor((s) => s.exportJSON);
  const playMode  = useEditor((s) => s.playMode);
  const togglePlay = useEditor((s) => s.togglePlay);
  const playerCharacterId = useEditor((s) => s.playerCharacterId);
  const setPlayerCharacter = useEditor((s) => s.setPlayerCharacter);
  const applyGeneratedIsland = useEditor((s) => s.applyGeneratedIsland);
  const weather    = useEditor((s) => s.env.weather);
  const setWeather = useEditor((s) => s.setWeather);
  const setGrass = useEditor((s) => s.setGrass);

  const toastMsg = useToast();
  const [showLoad, setShowLoad] = useState(false);
  const [seedInput, setSeedInput] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const onGenerate = () => {
    const seed = seedInput.trim() ? Number(seedInput) || hashString(seedInput) : Math.floor(Math.random() * 1e9);
    const result = generateIsland(project, { seed, weather });
    applyGeneratedIsland(result.entities, result.seed);
    setGrass({ enabled: true, density: 22, height: 1.15, windStrength: 1.3 });
    setSeedInput(String(result.seed));
    toast(`🌊 Island generated — seed ${result.seed}`);
  };

  const onSave = () => {
    saveProjectLocal(project);
    toast(`✓ Saved “${project.name}”`);
  };
  const onExport = () =>
    downloadJSON(`${project.name.replace(/\s+/g, '_')}.studio.json`, exportJSON());
  const onImport = () => fileInput.current?.click();
  const onImportFile = async (f: File) => {
    const text = await f.text();
    try { loadProject(projectFromJSON(text)); } catch (e) { alert(`Import failed: ${(e as Error).message}`); }
  };

  return (
    <div className="relative flex items-center gap-2 border-b border-border bg-card/60 backdrop-blur px-3 py-2 text-xs flex-wrap">
      {/* Toast notification */}
      {toastMsg && (
        <div className={`absolute left-1/2 -translate-x-1/2 top-10 z-50 px-4 py-2 rounded-md shadow-xl text-sm font-medium pointer-events-none
          ${ toastMsg.ok ? 'bg-emerald-800 text-emerald-100 border border-emerald-600'
                         : 'bg-red-900 text-red-100 border border-red-600' }`}
        >
          {toastMsg.text}
        </div>
      )}

      {TOOL_GROUPS.map((g) => (
        <div key={g.label} className="flex items-center gap-1 border-r border-border pr-2 mr-1 last:border-r-0">
          <span className="text-muted-foreground uppercase tracking-wider mr-1 hidden sm:block">{g.label}</span>
          {g.tools.map((t) => (
            <button
              key={t.id}
              onClick={() => setTool(t.id)}
              title={t.label}
              className={`px-2 py-1 rounded border text-sm ${
                tool === t.id
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-secondary text-secondary-foreground border-border hover:bg-secondary/80'
              }`}
            >
              {t.icon}
            </button>
          ))}
        </div>
      ))}

      {(tool.startsWith('sculpt_') || tool.startsWith('paint_')) && (
        <div className="flex items-center gap-3 border-r border-border pr-2 mr-1">
          <label className="flex items-center gap-1">
            <span className="text-muted-foreground">Size</span>
            <input type="range" min={1} max={32} step={0.5} value={radius}
              onChange={(e) => setBrushRadius(Number(e.target.value))} className="w-24" />
            <span className="font-mono w-8 text-right">{radius.toFixed(1)}</span>
          </label>
          {tool.startsWith('sculpt_') && (
            <label className="flex items-center gap-1">
              <span className="text-muted-foreground">Strength</span>
              <input type="range" min={0.05} max={2} step={0.05} value={strength}
                onChange={(e) => setBrushStrength(Number(e.target.value))} className="w-24" />
              <span className="font-mono w-8 text-right">{strength.toFixed(2)}</span>
            </label>
          )}
        </div>
      )}

      {/* ── Weather / Biome ─────────────────────────────────── */}
      <div className="flex items-center gap-1 border-r border-border pr-2 mr-1">
        <span className="text-muted-foreground uppercase tracking-wider mr-1">Biome</span>
        {WEATHER_OPTS.map((w) => (
          <button
            key={w.id}
            onClick={() => setWeather(w.id)}
            title={w.label}
            className={`px-1.5 py-0.5 rounded border text-sm ${
              weather === w.id
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-secondary text-secondary-foreground border-border hover:bg-secondary/80'
            }`}
          >
            {w.icon}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1 border-r border-border pr-2 mr-1">
        <span className="text-muted-foreground uppercase tracking-wider mr-1">Island</span>
        <input
          type="text"
          placeholder="seed"
          value={seedInput}
          onChange={(e) => setSeedInput(e.target.value)}
          className="w-24 bg-input border border-border rounded px-2 py-1 font-mono"
        />
        <button onClick={onGenerate}
          className="px-2 py-1 rounded bg-amber-500 text-black border border-amber-600 font-semibold hover:bg-amber-400">
          Generate
        </button>
      </div>

      {/* Entity count badge */}
      <span className="text-muted-foreground border border-border/60 rounded px-2 py-0.5 font-mono">
        📦 {entityCount}
      </span>

      <div className="flex items-center gap-1 border-r border-border pr-2 mr-1">
        <span className="text-muted-foreground uppercase tracking-wider mr-1">Play</span>
        <select
          value={playerCharacterId}
          onChange={(e) => setPlayerCharacter(e.target.value)}
          className="bg-input border border-border rounded px-2 py-1 font-mono"
          title="Character used in third-person play"
        >
          {PLAYER_CHARACTER_IDS.map((id) => (
            <option key={id} value={id}>{PLAYER_CHARACTERS[id].label}</option>
          ))}
        </select>
        <button
          onClick={togglePlay}
          title={playMode ? 'Stop creature preview' : 'Preview creatures in-editor'}
          className={`px-2 py-1 rounded border font-semibold ${
            playMode
              ? 'bg-emerald-500 text-black border-emerald-600 hover:bg-emerald-400'
              : 'bg-secondary text-secondary-foreground border-border hover:bg-secondary/80'
          }`}
        >
          {playMode ? '■ Stop' : '👁️ Preview'}
        </button>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <button onClick={() => { newProject(); toast('➕ New project'); }} title="New map" className="px-2 py-1 rounded bg-secondary border border-border">📄 New</button>
        <button onClick={onSave}    title="Save to browser" className="px-2 py-1 rounded bg-secondary border border-border">💾 Save</button>
        <button onClick={() => setShowLoad((v) => !v)} title="Load a saved map" className="px-2 py-1 rounded bg-secondary border border-border">📂 Load</button>
        <button onClick={onExport}  title="Export as JSON file" className="px-2 py-1 rounded bg-secondary border border-border">📤 Export</button>
        <button onClick={onImport}  title="Import JSON file" className="px-2 py-1 rounded bg-secondary border border-border">📥 Import</button>
        <input ref={fileInput} type="file" accept=".json" hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onImportFile(f); e.currentTarget.value = ''; }} />
      </div>

      {showLoad && <LoadDropdown onClose={() => setShowLoad(false)} onPick={loadProject} />}
    </div>
  );
}

function hashString(s: string): number {
  // Simple deterministic 32-bit hash so users can type "village" and get
  // a reproducible seed instead of a random one.
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  }
  return h;
}

function LoadDropdown({ onClose, onPick }: { onClose: () => void; onPick: (p: ReturnType<typeof useEditor.getState>['project']) => void }) {
  const [items] = useState(() => listSavedProjects());
  if (items.length === 0) {
    return (
      <div className="absolute right-3 top-12 z-30 w-72 bg-popover border border-border rounded shadow-lg p-3 text-xs">
        No saved projects yet.
        <button className="ml-2 underline" onClick={onClose}>close</button>
      </div>
    );
  }
  return (
    <div className="absolute right-3 top-12 z-30 w-72 bg-popover border border-border rounded shadow-lg p-2 text-xs max-h-80 overflow-y-auto">
      {items.map((it) => (
        <button
          key={it.id}
          onClick={() => { const p = loadProjectLocal(it.id); if (p) { onPick(p); onClose(); } }}
          className="w-full text-left px-2 py-1.5 hover:bg-secondary rounded flex justify-between"
        >
          <span>{it.name}</span>
          <span className="text-muted-foreground">{new Date(it.updatedAt).toLocaleString()}</span>
        </button>
      ))}
    </div>
  );
}
