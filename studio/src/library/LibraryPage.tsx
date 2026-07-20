/**
 * Game Library — entry point. Lists local projects, lets the user open
 * the editor or model converter, and shows a placeholder card for an
 * eventual published-game gallery.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { useEditor } from '../editor/store';
import {
  listSavedProjects,
  loadProjectLocal,
  deleteProjectLocal,
  projectFromJSON,
  saveProjectLocal,
} from '../editor/project';
// Background image shipped in the artifact's public/ folder.
const libraryBg = `${import.meta.env.BASE_URL}library/library-bg.png`;
import { STARTER_MAPS, buildStarterProject, type StarterMap } from './starterMaps';
import { MapThumbnail } from './MapThumbnail';
import type { MapProject } from '../types';

interface UnityMapCatalogEntry {
  id: string;
  name: string;
  projectUrl: string;
  glbUrl?: string | null;
  markerCount?: number;
  updatedAt?: string;
}

export function LibraryPage() {
  const [items, setItems] = useState(() => listSavedProjects());
  const [unityMaps, setUnityMaps] = useState<UnityMapCatalogEntry[]>([]);
  const newProject = useEditor((s) => s.newProject);
  const loadProject = useEditor((s) => s.loadProject);
  const refresh = () => setItems(listSavedProjects());

  useEffect(() => {
    const url = `${import.meta.env.BASE_URL}library/unity-maps/catalog.json`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { maps?: UnityMapCatalogEntry[] } | null) => {
        if (data?.maps?.length) setUnityMaps(data.maps);
      })
      .catch(() => {
        /* catalog optional until first export */
      });
  }, []);

  return (
    <div
      className="h-full overflow-auto"
      style={{
        backgroundImage: `linear-gradient(rgba(8,12,18,0.78), rgba(8,12,18,0.92)), url(${libraryBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
    <div className="max-w-6xl mx-auto p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Grudge Studio</h1>
        <p className="text-muted-foreground mt-2">
          Map editor · model converter · ECS runtime · save your worlds.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <Tool to="/editor" icon="🌊" title="Map Editor"
          description="Sculpt terrain, paint biomes, place animals & buildings, generate islands." />
        <Tool to="/converter" icon="🔧" title="Model Converter"
          description="Drop GLTF/GLB/FBX/OBJ — inspect the scene graph and re-export as binary GLB." />
        <Tool to="/play" icon="▶️" title="Play Mode"
          description="Enter your island in third-person — WASD to move, drag to orbit camera." />
      </div>

      <section className="mb-10">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-semibold">Starter maps</h2>
            <p className="text-xs text-muted-foreground">
              Ready-to-edit islands. Open one to jump straight in — your changes
              are saved as a new map and never overwrite the original.
            </p>
          </div>
        </div>
        <ul className="grid grid-cols-2 gap-4">
          {STARTER_MAPS.map((m) => (
            <StarterCard key={m.id} preset={m} onOpened={refresh} />
          ))}
        </ul>
      </section>

      <section className="mb-10">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-semibold">Unity maps (FBX → Forge)</h2>
            <p className="text-xs text-muted-foreground">
              Exported from FRESH GRUDGE via <code className="text-amber-300/90">Grudge → Export Active Map for Forge (FBX)</code>,
              then <code className="text-amber-300/90">node scripts/unity-map-to-forge.mjs</code>.
              Full mesh + towns/harbors as entities.
            </p>
          </div>
        </div>
        {unityMaps.length === 0 ? (
          <div className="border border-dashed border-border rounded-md p-6 text-sm text-muted-foreground">
            No Unity exports yet. In Unity open <strong>Towns</strong>, <strong>The Island 1</strong>, or{' '}
            <strong>Dojo</strong>, run the export menu, then convert with the RTS-Grudge script.
            Converter path: Library → Model Converter also accepts the .fbx drop.
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-4">
            {unityMaps.map((m) => (
              <UnityMapCard key={m.id} entry={m} onOpened={refresh} />
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Your maps</h2>
          <Link
            href="/editor"
            onClick={() => newProject()}
            className="px-3 py-1.5 rounded bg-primary text-primary-foreground text-sm font-medium"
          >
            + New Map
          </Link>
        </div>

        {items.length === 0 ? (
          <div className="border border-dashed border-border rounded-md p-10 text-center text-muted-foreground">
            No saved maps yet. Click "New Map" to start.
          </div>
        ) : (
          <ul className="grid grid-cols-3 gap-3">
            {items.map((it) => (
              <li key={it.id} className="border border-border rounded-md p-4 bg-card hover:border-primary/60 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-medium">{it.name}</h3>
                  <button
                    className="text-xs text-destructive hover:underline"
                    onClick={() => { deleteProjectLocal(it.id); refresh(); }}
                  >
                    delete
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Updated {new Date(it.updatedAt).toLocaleString()}
                </p>
                <Link
                  href="/editor"
                  className="inline-block text-sm text-primary hover:underline"
                  onClick={() => {
                    const p = loadProjectLocal(it.id);
                    if (p) loadProject(p);
                  }}
                >
                  Open in editor →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

    </div>
    </div>
  );
}

function resolvePublicUrl(rel: string): string {
  if (/^https?:\/\//i.test(rel)) return rel;
  const base = import.meta.env.BASE_URL || '/';
  const clean = rel.replace(/^\//, '');
  return `${base}${clean}`;
}

function UnityMapCard({
  entry,
  onOpened,
}: {
  entry: UnityMapCatalogEntry;
  onOpened: () => void;
}) {
  const loadProject = useEditor((s) => s.loadProject);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const open = async () => {
    setBusy(true);
    setErr(null);
    try {
      const url = resolvePublicUrl(entry.projectUrl);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} loading ${url}`);
      const raw = await res.text();
      const project = projectFromJSON(raw) as MapProject;
      // Fresh id so Save doesn't stomp catalog copy
      project.id = Math.random().toString(36).slice(2, 10);
      project.name = entry.name;
      // Rewrite relative GLB assets to absolute public URLs
      project.entities = (project.entities || []).map((e) => {
        if (e.asset && e.asset.startsWith('/')) {
          return { ...e, asset: resolvePublicUrl(e.asset) };
        }
        return e;
      });
      project.updatedAt = new Date().toISOString();
      saveProjectLocal(project);
      loadProject(project);
      onOpened();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="border border-border rounded-md overflow-hidden bg-card hover:border-primary/60 transition-colors flex flex-col">
      <div className="bg-black/40 h-[140px] flex items-center justify-center text-4xl">
        🏰
      </div>
      <div className="p-4 flex-1 flex flex-col">
        <h3 className="font-semibold text-base mb-1">{entry.name}</h3>
        <p className="text-xs text-muted-foreground mb-2">
          Unity export · {entry.markerCount ?? 0} markers
          {entry.glbUrl ? ' · mesh GLB' : ' · markers only'}
        </p>
        {err && <p className="text-xs text-red-400 mb-2">{err}</p>}
        <Link
          href="/editor"
          onClick={(e) => {
            e.preventDefault();
            void open();
          }}
          className={`mt-auto inline-block text-sm text-primary hover:underline ${busy ? 'opacity-50 pointer-events-none' : ''}`}
        >
          {busy ? 'Loading…' : 'Open in editor →'}
        </Link>
      </div>
    </li>
  );
}

function StarterCard({ preset, onOpened }: { preset: StarterMap; onOpened: () => void }) {
  const loadProject = useEditor((s) => s.loadProject);
  // Build the project once per preset so the thumbnail reflects the real terrain
  const project = useMemo(() => buildStarterProject(preset), [preset]);

  const open = () => {
    // Hand a *fresh* copy to the editor with a new id so saving never overwrites the starter
    const fresh = buildStarterProject(preset);
    fresh.id = Math.random().toString(36).slice(2, 10);
    fresh.name = preset.name;
    loadProject(fresh);
    onOpened();
  };

  const diffColor =
    preset.difficulty === 'Hard'
      ? 'bg-red-500/15 text-red-300 border-red-400/30'
      : preset.difficulty === 'Standard'
        ? 'bg-amber-500/15 text-amber-200 border-amber-400/30'
        : 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30';

  return (
    <li className="border border-border rounded-md overflow-hidden bg-card hover:border-primary/60 transition-colors flex flex-col">
      <div className="bg-black/40">
        <MapThumbnail project={project} width={480} height={260} />
      </div>
      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-semibold text-base">{preset.name}</h3>
          <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded border ${diffColor}`}>
            {preset.difficulty}
          </span>
        </div>
        <p className="text-xs text-muted-foreground italic mb-2">{preset.tagline}</p>
        <p className="text-sm text-foreground/85 mb-3 leading-snug">{preset.description}</p>
        <div className="flex items-center justify-between mt-auto pt-2 text-xs text-muted-foreground border-t border-border/60">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span>Players · <span className="text-foreground">{preset.recommendedPlayers}</span></span>
            <span>Entities · <span className="text-foreground">{project.entities.length}</span></span>
            <span>Seed · <span className="text-foreground font-mono">{preset.seed}</span></span>
          </div>
          <Link
            href="/editor"
            onClick={open}
            className="px-3 py-1.5 rounded bg-primary text-primary-foreground font-medium"
          >
            Open →
          </Link>
        </div>
      </div>
    </li>
  );
}

function Tool({ to, icon, title, description }: { to: string; icon: string; title: string; description: string }) {
  return (
    <Link
      href={to}
      className="block border border-border rounded-md p-5 bg-card hover:border-primary/60 hover:bg-card/80 transition-colors"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">{icon}</span>
        <h3 className="text-base font-semibold">{title}</h3>
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
    </Link>
  );
}
