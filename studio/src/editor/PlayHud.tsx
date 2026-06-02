/**
 * PlayHud — minimal heads-up display shown only while in play mode.
 *
 * Lives in the editor DOM (not the Canvas) so it doesn't have to be a
 * Three.js sprite. It surfaces:
 *   - A "Stop" pill that toggles play off (mirrors the toolbar button so
 *     the user doesn't have to scroll back up if the toolbar is offscreen).
 *   - The current control hints — these match the actual bindings in
 *     `runtime/Player.tsx` so they stay accurate.
 *   - Live locomotion + character readout so we can see at a glance whether
 *     the player slice is updating.
 */
import { usePlay, useEditor } from './store';

export function PlayHud() {
  const { playMode, playerCharacterId, player } = usePlay();
  const togglePlay = useEditor((s) => s.togglePlay);
  if (!playMode) return null;

  return (
    <div className="absolute left-2 top-2 z-20 flex flex-col gap-1 text-xs">
      <div className="flex items-center gap-2 bg-card/85 border border-border rounded-md px-3 py-1.5 backdrop-blur">
        <button
          onClick={togglePlay}
          className="px-2 py-0.5 rounded bg-destructive text-destructive-foreground border border-destructive font-semibold"
        >
          ■ Stop
        </button>
        <span className="text-muted-foreground">
          <kbd className="font-mono">WASD</kbd> move ·{' '}
          <kbd className="font-mono">Shift</kbd> sprint ·{' '}
          <kbd className="font-mono">RMB drag</kbd> camera ·{' '}
          <kbd className="font-mono">Wheel</kbd> zoom
        </span>
      </div>
      <div className="bg-card/70 border border-border rounded-md px-3 py-1 backdrop-blur text-muted-foreground">
        playing as <span className="text-foreground font-semibold">{playerCharacterId}</span>
        {' · '}
        <span className="font-mono">{player.locomotion}</span>
        {player.sprinting && <span className="text-amber-400"> [sprint]</span>}
      </div>
    </div>
  );
}
