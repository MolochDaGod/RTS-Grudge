/**
 * Right-side panel: scene outliner + inspector for the selected entity,
 * plus a rules panel for the map's gameplay tuning.
 */
import { useEditor } from './store';
import { EnvironmentPanel } from './EnvironmentPanel';
import type { Vec3 } from '../types';

export function Outliner() {
  const entities      = useEditor((s) => s.project.entities);
  const selectedId    = useEditor((s) => s.selectedId);
  const select        = useEditor((s) => s.selectEntity);
  const remove        = useEditor((s) => s.removeEntity);
  const rename        = useEditor((s) => s.renameEntity);
  const setData       = useEditor((s) => s.setEntityData);
  const update        = useEditor((s) => s.updateEntityTransform);
  const setEntityKind = useEditor((s) => s.setEntityKind);
  const setEntityAsset= useEditor((s) => s.setEntityAsset);
  const project       = useEditor((s) => s.project);
  const setRules      = useEditor((s) => s.setRules);

  const selected = entities.find((e) => e.id === selectedId);

  return (
    <aside className="w-[320px] shrink-0 border-l border-border bg-card/40 flex flex-col text-xs">
      <section className="border-b border-border">
        <header className="px-3 py-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Outliner</h3>
          <span className="text-muted-foreground">{entities.length} item{entities.length === 1 ? '' : 's'}</span>
        </header>
        <ul className="max-h-64 overflow-y-auto">
          {entities.length === 0 && (
            <li className="px-3 py-2 text-muted-foreground italic">
              Switch to "Place Entity" and click the terrain to add one.
            </li>
          )}
          {entities.map((e) => (
            <li
              key={e.id}
              className={`flex items-center justify-between px-3 py-1.5 cursor-pointer ${
                selectedId === e.id ? 'bg-secondary' : 'hover:bg-secondary/60'
              }`}
              onClick={() => select(e.id)}
            >
              <span className="flex-1 min-w-0 truncate">
                <span className="text-muted-foreground mr-1.5 text-[10px] uppercase tracking-wider">{e.kind}</span>
                {e.name}
              </span>
              <button
                className="shrink-0 text-destructive/50 hover:text-destructive hover:bg-destructive/10 rounded px-1.5 transition-colors ml-1"
                title="Delete entity"
                onClick={(ev) => {
                  ev.stopPropagation();
                  if (window.confirm(`Delete “${e.name}”?`)) remove(e.id);
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      </section>

      {selected && (
        <section className="border-b border-border p-3 space-y-3">
          <h3 className="text-sm font-semibold">Inspector</h3>
          <Field label="Name">
            <input
              className="w-full bg-input border border-border rounded px-2 py-1"
              value={selected.name}
              onChange={(e) => rename(selected.id, e.target.value)}
            />
          </Field>
          <Field label="Kind">
            <select
              className="w-full bg-input border border-border rounded px-2 py-1"
              value={selected.kind}
              onChange={(e) => {
                setEntityKind(selected.id, e.target.value as typeof selected.kind);
              }}
            >
              <option value="unit">unit</option>
              <option value="building">building</option>
              <option value="prop">prop</option>
              <option value="spell_marker">spell_marker</option>
              <option value="spawn_point">spawn_point</option>
              <option value="tree">tree</option>
              <option value="rock">rock</option>
              <option value="bush">bush</option>
              <option value="flower">flower</option>
              <option value="creature">creature</option>
              <option value="resource_node">resource_node</option>
              <option value="dock">dock</option>
            </select>
          </Field>
          <Field label="Model GLB path (e.g. /assets/models/creatures/deer.glb)">
            <input
              className="w-full bg-input border border-border rounded px-2 py-1 font-mono"
              placeholder="/models/foo.glb"
              value={selected.asset ?? ''}
              onChange={(e) =>
                setEntityAsset(selected.id, e.target.value || undefined)
              }
            />
          </Field>
          <VecField label="Position" value={selected.position}
            onChange={(v) => update(selected.id, { position: v })} />
          <VecField label="Rotation" value={selected.rotation}
            onChange={(v) => update(selected.id, { rotation: v })} />
          <VecField label="Scale"    value={selected.scale}
            onChange={(v) => update(selected.id, { scale: v })} />
          <Field label="Gameplay data (JSON)">
            <textarea
              className="w-full bg-input border border-border rounded px-2 py-1 font-mono text-[11px]"
              rows={4}
              defaultValue={JSON.stringify(selected.data, null, 2)}
              onBlur={(e) => {
                try { setData(selected.id, JSON.parse(e.target.value || '{}')); }
                catch { /* ignore parse errors so user can keep typing */ }
              }}
            />
          </Field>
        </section>
      )}

      <section className="p-3 space-y-3">
        <h3 className="text-sm font-semibold">Map Rules</h3>
        <Field label="Starting Funds">
          <input type="number" className="w-full bg-input border border-border rounded px-2 py-1"
            value={project.rules.startingFunds}
            onChange={(e) => setRules({ startingFunds: Number(e.target.value) || 0 })} />
        </Field>
        <Field label="Wave Count">
          <input type="number" className="w-full bg-input border border-border rounded px-2 py-1"
            value={project.rules.waveCount}
            onChange={(e) => setRules({ waveCount: Number(e.target.value) || 0 })} />
        </Field>
        <Field label="Victory Condition">
          <select className="w-full bg-input border border-border rounded px-2 py-1"
            value={project.rules.victoryCondition}
            onChange={(e) => setRules({ victoryCondition: e.target.value as 'eliminate' | 'survive' | 'capture' })}>
            <option value="eliminate">Eliminate</option>
            <option value="survive">Survive</option>
            <option value="capture">Capture</option>
          </select>
        </Field>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={project.rules.fogOfWar}
            onChange={(e) => setRules({ fogOfWar: e.target.checked })} />
          Fog of War
        </label>
      </section>

      <EnvironmentPanel />
    </aside>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-muted-foreground mb-1">{label}</div>
      {children}
    </label>
  );
}

function VecField({ label, value, onChange }: { label: string; value: Vec3; onChange: (v: Vec3) => void }) {
  return (
    <Field label={label}>
      <div className="grid grid-cols-3 gap-1">
        {(['X', 'Y', 'Z'] as const).map((axis, i) => (
          <input
            key={axis}
            type="number"
            step={0.1}
            className="bg-input border border-border rounded px-2 py-1 font-mono"
            value={value[i]}
            onChange={(e) => {
              const next: Vec3 = [...value] as Vec3;
              next[i] = Number(e.target.value) || 0;
              onChange(next);
            }}
          />
        ))}
      </div>
    </Field>
  );
}
