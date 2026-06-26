import { Toolbar } from './Toolbar';
import { Outliner } from './Outliner';
import { EditorCanvas } from './EditorCanvas';
import { AssetPalette } from './AssetPalette';
import { LoadScreen } from '../components/LoadScreen';
import { useProgress } from '@react-three/drei';
import { useEditor } from './store';
import { PlayHud } from './PlayHud';
import { EditorToolRail } from './EditorToolRail';
import { EditorStatusBar } from './EditorStatusBar';

function CanvasLoadOverlay() {
  const { active, progress } = useProgress();
  if (!active) return null;
  return <LoadScreen label={`Charting the realm… ${Math.round(progress)}%`} />;
}

export function EditorPage() {
  const playMode = useEditor((s) => s.playMode);
  return (
    <div className="flex flex-col h-full min-h-0">
      <Toolbar />
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 flex flex-col min-w-0 min-h-0 p-2 gap-2 bg-background">
          <div className="editor-viewport-frame relative flex-1 min-h-0 rounded-xl border border-border/80 bg-[#080b10] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)] overflow-hidden">
            <EditorCanvas />
            {!playMode && <EditorToolRail />}
            {!playMode && <AssetPalette />}
            {playMode && <PlayHud />}
            <CanvasLoadOverlay />
          </div>
          <EditorStatusBar />
        </div>
        <aside className="w-72 shrink-0 border-l border-border bg-card/40 flex flex-col min-h-0">
          <div className="px-3 py-2 border-b border-border text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Inspector
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            <Outliner />
          </div>
        </aside>
      </div>
    </div>
  );
}