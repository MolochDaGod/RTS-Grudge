/**
 * Game Library — entry point. Lists local projects, lets the user open
 * the editor or model converter, and shows a placeholder card for an
 * eventual published-game gallery.
 */
import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { useEditor } from '../editor/store';
import {
  listSavedProjects,
  loadProjectLocal,
  deleteProjectLocal,
} from '../editor/project';
// Background image shipped in the artifact's public/ folder.
const libraryBg = `${import.meta.env.BASE_URL}library/library-bg.png`;
import { STARTER_MAPS, buildStarterProject, type StarterMap } from './starterMaps';
import { MapThumbnail } from './MapThumbnail';
import { FLEET_GAMES, FORGE_TOOLCHAIN } from '../lib/fleetTargets';

export function LibraryPage() {
  const [items, setItems] = useState(() => listSavedProjects());
  const newProject = useEditor((s) => s.newProject);
  const loadProject = useEditor((s) => s.loadProject);
  const refresh = () => setItems(listSavedProjects());

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
        <h1 className="text-3xl font-semibold tracking-tight">Grudge Studio Forge</h1>
        <p className="text-muted-foreground mt-2">
          Fleet map editor for Warlords, RTS, and DCQ — R3F, Rapier, ObjectStore, GLB export.
        </p>
        <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono text-muted-foreground">
          <div><dt className="inline text-primary">Render </dt><dd className="inline">{FORGE_TOOLCHAIN.render}</dd></div>
          <div><dt className="inline text-primary">Physics </dt><dd className="inline">{FORGE_TOOLCHAIN.physics}</dd></div>
          <div><dt className="inline text-primary">API </dt><dd className="inline">{FORGE_TOOLCHAIN.backend}</dd></div>
          <div><dt className="inline text-primary">Assets </dt><dd className="inline">{FORGE_TOOLCHAIN.assets}</dd></div>
        </dl>
      </header>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Deploy targets</h2>
        <ul className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {FLEET_GAMES.map((g) => (
            <li key={g.id} className="rounded-lg border border-border bg-card/80 p-4">
              <div className="font-medium">{g.label}</div>
              <div className="text-xs text-muted-foreground mt-1">{g.stack.render}</div>
              <div className="text-xs text-muted-foreground">{g.stack.physics}</div>
              <a
                href={g.liveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline mt-2 inline-block"
              >
                {g.liveUrl.replace('https://', '')} ↗
              </a>
            </li>
          ))}
        </ul>
      </section>

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
