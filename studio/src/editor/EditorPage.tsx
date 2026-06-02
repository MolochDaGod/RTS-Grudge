import { Toolbar } from './Toolbar';
import { Outliner } from './Outliner';
import { EditorCanvas } from './EditorCanvas';
import { AssetPalette } from './AssetPalette';
import { LoadScreen } from '../components/LoadScreen';
import { useProgress } from '@react-three/drei';
import { useEditor } from './store';
import { PlayHud } from './PlayHud';

function CanvasLoadOverlay() {
  const { active, progress } = useProgress();
  if (!active) return null;
  return <LoadScreen label={`Charting the realm… ${Math.round(progress)}%`} />;
}

export function EditorPage() {
  // Subscribing once at the top means the inner panels don't all need to
  // poll the store individually for the play-mode flag.
  const playMode = useEditor((s) => s.playMode);
  return (
    <div className="flex flex-col h-full">
      <Toolbar />
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 relative bg-background">
          <EditorCanvas />
          {/* Edit-only chrome: palette is meaningless while the player is
              walking around — clicks would otherwise plant trees on shoot. */}
          {!playMode && <AssetPalette />}
          {playMode && <PlayHud />}
          <CanvasLoadOverlay />
        </div>
        {/* Outliner stays mounted so the user can keep tweaking rules /
            inspector without flipping out of play, but it's harmless either
            way — keep it visible for now. */}
        <Outliner />
      </div>
    </div>
  );
}
