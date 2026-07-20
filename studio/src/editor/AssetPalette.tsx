/**
 * Left-side asset palette — curated landscape library with placement
 * colour controls and scale override.
 *
 * Features:
 *   • Category navigation with per-cat asset count badge
 *   • Kind emoji on each tile (🌲 tree, 🩨 rock, 🌿 bush, 🌸 flower, 💰 resource)
 *   • Colour-tint swatches for seasonal variants / mineral recolours
 *   • Scale multiplier slider (0.5× – 3×)
 *   • Season quick-select buttons (Spring / Autumn / Winter) that wire
 *     both the tint AND set an appropriate leaf slug override on trees
 *   • Pack inspector modal (GLB sub-mesh browser)
 */
import { useEffect, useState } from 'react';
import { useEditor } from './store';
import {
  ASSET_LIBRARY, ASSET_CATEGORIES,
  isPackAsset, type AssetCategory, type AssetSpec,
} from '../library/LandscapeAssets';
import { inspectPack, type PackMeshEntry } from '../library/PackInspector';
import { getAssetById } from '../library/LandscapeAssets';
import { ObjectStorePalette } from './ObjectStorePalette';

/** Per-kind emoji shown on each tile */
const KIND_ICON: Record<string, string> = {
  tree:          '🌲',
  bush:          '🌿',
  flower:        '🌸',
  rock:          '🪨',
  resource_node: '💎',
  prop:          '📦',
  creature:      '🐾',
  unit:          '⚔️',
  building:      '🏛️',
  dock:          '⚓',
  spawn_point:   '🎯',
};

/** Accent colour for the left border of each tile by kind */
const KIND_ACCENT: Record<string, string> = {
  tree:          '#3f8c4a',
  bush:          '#4f9c5a',
  flower:        '#ff5d8f',
  rock:          '#8b8a83',
  resource_node: '#7df2ff',
  prop:          '#9aa0a8',
  creature:      '#ffd24d',
  unit:          '#ff8a3d',
  building:      '#4dd0ff',
  dock:          '#44aaff',
};

/** Tint colour swatches available in the palette. */
const TINT_PRESETS = [
  { label: 'Natural',     hex: null,      bg: '#3f8c4a' },
  { label: 'Autumn • Orange', hex: '#c86420', bg: '#c86420' },
  { label: 'Autumn • Gold',   hex: '#d4920a', bg: '#d4920a' },
  { label: 'Autumn • Red',    hex: '#a84010', bg: '#a84010' },
  { label: 'Winter • Snow',   hex: '#c0d8f0', bg: '#c0d8f0' },
  { label: 'Bare',        hex: '#5a4a30', bg: '#5a4a30' },
  { label: 'Purple',      hex: '#7a3aaa', bg: '#7a3aaa' },
  { label: 'Custom…',     hex: '__custom__', bg: 'linear-gradient(135deg,#f00,#0f0,#00f)' },
] as const;

export function AssetPalette() {
  const armedAssetId     = useEditor((s) => s.armedAssetId);
  const armAsset         = useEditor((s) => s.armAsset);
  const placementTint    = useEditor((s) => s.placementTint);
  const setPlacementTint = useEditor((s) => s.setPlacementTint);
  const placementScale   = useEditor((s) => s.placementScale);
  const setPlacementScale = useEditor((s) => s.setPlacementScale);

  const [open, setOpen]           = useState(true);
  const [active, setActive]       = useState<AssetCategory>('Trees');
  const [inspecting, setInspecting] = useState<AssetSpec | null>(null);
  const [customTint, setCustomTint] = useState('#44aa44');
  const [showCustom, setShowCustom] = useState(false);

  const tiles = ASSET_LIBRARY.filter((a) => a.category === active);
  const catCount = (cat: AssetCategory) =>
    cat === 'ObjectStore' ? 'CDN' : ASSET_LIBRARY.filter(a => a.category === cat).length;

  /** Determine if current armed asset is a tree kind (shows season presets) */
  const armedSpec = armedAssetId ? getAssetById(armedAssetId) : undefined;
  const showTintControls = !!armedAssetId;

  return (
    <div className="absolute left-14 top-2 z-20 flex flex-col gap-0
                    bg-card/92 backdrop-blur-sm border border-border rounded-lg
                    shadow-2xl text-xs max-w-[290px]" style={{ maxHeight: '94vh', overflowY: 'auto' }}>

      {/* ── Header ── */}
      <header className="flex items-center justify-between px-3 py-2 border-b border-border bg-card rounded-t-lg">
        <h3 className="font-bold tracking-wide text-sm">Asset Library</h3>
        <button
          onClick={() => setOpen((v) => !v)}
          className="text-muted-foreground hover:text-foreground text-base leading-none"
          aria-label={open ? 'Collapse' : 'Expand'}
        >{open ? '−' : '+'}</button>
      </header>

      {open && (
        <>
          {/* ── Category tabs ── */}
          <nav className="flex flex-wrap gap-1 px-2 pt-2 pb-1.5 border-b border-border">
            {ASSET_CATEGORIES.map((cat) => {
              const count = catCount(cat);
              return (
                <button
                  key={cat}
                  onClick={() => setActive(cat)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] font-medium transition-colors ${
                    active === cat
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {cat}
                  <span className={`rounded-full px-1 text-[9px] ${
                    active === cat ? 'bg-white/20' : 'bg-border'
                  }`}>{count}</span>
                </button>
              );
            })}
          </nav>

          {/* ── ObjectStore CDN browser ── */}
          {active === 'ObjectStore' ? (
            <div className="p-2">
              <ObjectStorePalette />
            </div>
          ) : (
          <ul className="grid grid-cols-2 gap-1.5 p-2">
            {tiles.length === 0 && (
              <li className="col-span-2 text-muted-foreground italic px-1 py-2 text-center">
                No assets in this category.
              </li>
            )}
            {tiles.map((a) => {
              const isArmed = armedAssetId === a.id;
              const pack    = isPackAsset(a);
              const icon    = KIND_ICON[a.kind] ?? '📦';
              const isGlb   = !!a.assetUrl;
              return (
                <li key={a.id}>
                  <div
                    className={`relative w-full rounded-md border transition-all ${
                      isArmed
                        ? 'border-primary bg-primary/20 shadow-md shadow-primary/20'
                        : 'border-border bg-secondary/30 hover:bg-secondary/60 hover:border-primary/40'
                    }`}
                    style={{
                      borderLeft: `3px solid ${KIND_ACCENT[a.kind] ?? '#9aa0a8'}`,
                    }}
                  >
                    <button
                      onClick={() => armAsset(isArmed ? null : a.id)}
                      title={a.hint ?? a.label}
                      className="w-full text-left px-2 py-2"
                    >
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-base leading-none">{icon}</span>
                        <span className="font-semibold leading-tight truncate">{a.label}</span>
                      </div>
                      <div className="text-muted-foreground text-[10px] flex items-center gap-1">
                        <span className={isGlb ? 'text-green-400' : 'text-amber-400'}>
                          {isGlb ? (pack ? '▣ pack' : '■ GLB') : '◆ tex'}
                        </span>
                        <span>·</span>
                        <span>{a.kind}</span>
                      </div>
                    </button>
                    {pack && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setInspecting(a); }}
                        title="Inspect meshes in this pack"
                        className="absolute top-1.5 right-1.5 w-4 h-4 flex items-center justify-center
                                   rounded bg-background/70 border border-border text-[9px]
                                   hover:bg-background text-muted-foreground hover:text-foreground"
                      >ⓘ</button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          )}

          {/* ── Placement options (shown when any asset is armed) ── */}
          {showTintControls && (
            <div className="border-t border-border px-2 py-2 space-y-2 bg-secondary/10">
              <div className="font-semibold text-[10px] text-muted-foreground uppercase tracking-wider">
                Placement options — {armedSpec?.label}
              </div>

              {/* Scale slider */}
              <label className="block">
                <div className="flex items-center justify-between text-muted-foreground mb-1">
                  <span>Scale</span>
                  <span className="font-mono">{placementScale.toFixed(2)}×</span>
                </div>
                <input
                  type="range" className="w-full accent-primary"
                  min={0.3} max={3.0} step={0.05}
                  value={placementScale}
                  onChange={(e) => setPlacementScale(Number(e.target.value))}
                />
              </label>

              {/* Colour tint swatches */}
              <div>
                <div className="text-muted-foreground mb-1">Colour tint</div>
                <div className="flex flex-wrap gap-1">
                  {TINT_PRESETS.map((p) => {
                    const isActive =
                      p.hex === null ? placementTint === null :
                      p.hex === '__custom__' ? false :
                      placementTint === p.hex;
                    return (
                      <button
                        key={p.label}
                        title={p.label}
                        onClick={() => {
                          if (p.hex === '__custom__') { setShowCustom(v => !v); return; }
                          setPlacementTint(p.hex);
                          setShowCustom(false);
                        }}
                        className={`w-5 h-5 rounded-full border-2 transition-transform ${
                          isActive ? 'border-primary scale-125' : 'border-border hover:scale-110'
                        }`}
                        style={{ background: p.bg }}
                      />
                    );
                  })}
                </div>
                {showCustom && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <input
                      type="color" value={customTint}
                      onChange={(e) => { setCustomTint(e.target.value); setPlacementTint(e.target.value); }}
                      className="w-8 h-6 rounded cursor-pointer border border-border"
                    />
                    <span className="font-mono text-muted-foreground">{customTint}</span>
                  </div>
                )}
              </div>

              {/* Season quick-select (trees only) */}
              {(armedSpec?.kind === 'tree' || armedSpec?.kind === 'bush') && (
                <div>
                  <div className="text-muted-foreground mb-1">Season preset</div>
                  <div className="flex gap-1">
                    {([
                      { label: '🌱 Spring', tint: null },
                      { label: '🍂 Autumn', tint: '#c86420' },
                      { label: '❄️ Winter', tint: '#c0d8f0' },
                      { label: '🪵 Bare',   tint: '#5a4a30' },
                    ] as const).map((s) => (
                      <button
                        key={s.label}
                        onClick={() => setPlacementTint(s.tint)}
                        className={`flex-1 py-0.5 rounded text-[10px] border transition-colors ${
                          placementTint === s.tint
                            ? 'border-primary bg-primary/20 font-bold'
                            : 'border-border hover:border-primary/50 text-muted-foreground'
                        }`}
                      >{s.label}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* Disarm + hint */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-muted-foreground text-[10px]">
                  Click terrain to place · hold ⇧ to keep armed
                </span>
                <button
                  onClick={() => armAsset(null)}
                  className="text-destructive hover:underline text-[10px]"
                >disarm</button>
              </div>
            </div>
          )}
        </>
      )}

      {inspecting && (
        <PackInspectorModal
          spec={inspecting}
          onClose={() => setInspecting(null)}
        />
      )}
    </div>
  );
}

/**
 * Modal listing every mesh in a pack. Triggered from the ⓘ button on a
 * pack tile. UUIDs are deterministic — same pack + same mesh path always
 * yield the same id, so the user can copy a UUID and reference a single
 * sub-mesh from saved data.
 */
function PackInspectorModal({ spec, onClose }: { spec: AssetSpec; onClose: () => void }) {
  const [entries, setEntries] = useState<PackMeshEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setEntries(null);
    setError(null);
    inspectPack(spec.assetUrl!, spec.id)
      .then((es) => { if (live) setEntries(es); })
      .catch((e) => { if (live) setError(String(e?.message ?? e)); });
    return () => { live = false; };
  }, [spec.assetUrl, spec.id]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-md shadow-xl w-[640px]
                   max-h-[80vh] flex flex-col text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-3 py-2 border-b border-border">
          <div>
            <h4 className="font-semibold text-sm">{spec.label} — Mesh Inspector</h4>
            <div className="text-muted-foreground">
              {entries ? `${entries.length} meshes · stable UUIDs derived from "${spec.id}|<meshPath>"` : 'inspecting…'}
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground px-2">
            ✕
          </button>
        </header>

        <div className="overflow-y-auto flex-1">
          {error && (
            <div className="p-3 text-destructive">Failed to inspect: {error}</div>
          )}
          {!entries && !error && (
            <div className="p-3 text-muted-foreground italic">Loading & traversing…</div>
          )}
          {entries && entries.length === 0 && (
            <div className="p-3 text-muted-foreground italic">No meshes found.</div>
          )}
          {entries && entries.length > 0 && (
            <table className="w-full">
              <thead className="bg-secondary/40 sticky top-0">
                <tr className="text-left">
                  <th className="px-2 py-1 font-medium">Name</th>
                  <th className="px-2 py-1 font-medium">UUID</th>
                  <th className="px-2 py-1 font-medium text-right">Tris</th>
                  <th className="px-2 py-1 font-medium">Size (m)</th>
                  <th className="px-2 py-1 font-medium">Material</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.uuid} className="border-t border-border/50 hover:bg-secondary/30">
                    <td className="px-2 py-1 font-medium">
                      {e.rigged && <span className="text-primary mr-1" title="SkinnedMesh">◆</span>}
                      {e.name}
                      <div className="text-[10px] text-muted-foreground">{e.meshPath}</div>
                    </td>
                    <td className="px-2 py-1 font-mono text-[10px] text-muted-foreground">
                      <button
                        onClick={() => navigator.clipboard?.writeText(e.uuid)}
                        title="Click to copy"
                        className="hover:text-foreground"
                      >
                        {e.uuid}
                      </button>
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums">{e.triangles.toLocaleString()}</td>
                    <td className="px-2 py-1 tabular-nums">
                      {e.size[0]}×{e.size[1]}×{e.size[2]}
                    </td>
                    <td className="px-2 py-1 text-muted-foreground">{e.materialName ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
