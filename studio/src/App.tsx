import { lazy, Suspense } from 'react';
import { Switch, Route, Router as WouterRouter, Link, useLocation } from 'wouter';
import { LibraryPage } from './library/LibraryPage';
import { EditorPage } from './editor/EditorPage';
import { ModelConverter } from './converter/ModelConverter';

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
    <nav className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card/60 backdrop-blur">
      <Link href="/" className="text-sm font-semibold tracking-tight mr-3">
        Grudge Studio
      </Link>
      {link('/', 'Library')}
      {link('/editor', 'Map Editor')}
      {link('/play', '▶ Play')}
      {link('/converter', 'Model Converter')}
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
