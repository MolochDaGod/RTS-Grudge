import { lazy, Suspense, useState } from 'react';
import { Switch, Route, Router as WouterRouter, Link, useLocation } from 'wouter';
import { LibraryPage } from './library/LibraryPage';
import { EditorPage } from './editor/EditorPage';
import { ModelConverter } from './converter/ModelConverter';
import {
  FLEET_GAMES,
  FORGE_TOOLCHAIN,
  getActiveFleetTarget,
  setActiveFleetTarget,
  type FleetGameId,
} from './lib/fleetTargets';

// Lazy-loaded so PlayCanvas (which adds EntityLayer + TerrainMesh + ORC GLB
// to the bundle) is code-split into its own chunk, keeping the editor chunk
// from ballooning and preventing Rollup circular-ref memory spikes.
const PlayCanvasLazy = lazy(() =>
  import('./runtime/PlayCanvas').then((m) => ({ default: m.PlayCanvas }))
);

function PlayPage() {
  return (
    <Suspense fallback={<div style={{ color: '#667788', padding: 32, fontFamily: 'monospace' }}>Loading play mode…</div>}>
      <div style={{ width: '100%', height: '100%' }}><PlayCanvasLazy /></div>
    </Suspense>
  );
}

function NavBar() {
  const [loc] = useLocation();
  const [target, setTarget] = useState(getActiveFleetTarget);

  const onTargetChange = (id: FleetGameId) => {
    setTarget(setActiveFleetTarget(id));
  };

  const link = (to: string, label: string) => (
    <Link
      href={to}
      className={`px-3 py-1.5 text-sm rounded ${
        loc === to
          ? 'bg-secondary text-foreground'
          : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
      }`}
    >
      {label}
    </Link>
  );
  return (
    <nav className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card/60 backdrop-blur flex-wrap">
      <Link href="/" className="text-sm font-semibold tracking-tight mr-2 shrink-0">
        <span className="text-primary">Grudge Studio Forge</span>
      </Link>
      <select
        value={target.id}
        onChange={(e) => onTargetChange(e.target.value as FleetGameId)}
        className="text-xs bg-secondary border border-border rounded px-2 py-1 text-foreground mr-2"
        title="Deploy target game"
      >
        {FLEET_GAMES.map((g) => (
          <option key={g.id} value={g.id}>
            {g.shortLabel} — {g.stack.render}
          </option>
        ))}
      </select>
      <span
        className="hidden lg:inline text-[10px] text-muted-foreground font-mono truncate max-w-[280px]"
        title={`${FORGE_TOOLCHAIN.render} · ${FORGE_TOOLCHAIN.physics}`}
      >
        {target.stack.physics}
      </span>
      {link('/', 'Library')}
      {link('/editor', 'Map Editor')}
      {link('/play', '▶ Play')}
      {link('/converter', 'Model Converter')}
      <a
        href={target.liveUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="ml-auto text-xs text-muted-foreground hover:text-primary px-2 py-1"
      >
        Open {target.shortLabel} ↗
      </a>
    </nav>
  );
}

function NotFound() {
  return (
    <div className="p-10 text-center text-muted-foreground">
      Page not found. <Link href="/" className="text-primary underline">Back to Library</Link>
    </div>
  );
}

function App() {
  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <div className="flex flex-col h-screen">
        <NavBar />
        <main className="flex-1 min-h-0 overflow-hidden">
          <Switch>
            <Route path="/"          component={LibraryPage} />
            <Route path="/editor"    component={EditorPage} />
            <Route path="/play"      component={PlayPage} />
            <Route path="/converter" component={ModelConverter} />
            <Route component={NotFound} />
          </Switch>
        </main>
      </div>
    </WouterRouter>
  );
}

export default App;
