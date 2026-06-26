/**
 * PlayHud — overlay while walking the island in third-person.
 */
import { usePlay, useEditor } from './store';
import { PLAYER_CHARACTERS, PLAY_RACE_IDS } from '../library/PlayerCharacterRegistry';

export function PlayHud() {
  const { playMode, playerCharacterId, player } = usePlay();
  const togglePlay = useEditor((s) => s.togglePlay);
  const setPlayerCharacter = useEditor((s) => s.setPlayerCharacter);

  if (!playMode) return null;

  const spec = PLAYER_CHARACTERS[playerCharacterId as keyof typeof PLAYER_CHARACTERS];

  return (
    <div className="absolute left-2 top-2 z-20 flex flex-col gap-1.5 text-xs max-w-[min(100%,28rem)]">
      <div className="flex flex-wrap items-center gap-2 bg-card/90 border border-border rounded-lg px-3 py-2 backdrop-blur shadow-lg">
        <button
          type="button"
          onClick={togglePlay}
          className="px-2.5 py-1 rounded bg-destructive text-destructive-foreground border border-destructive font-semibold shrink-0"
        >
          ■ Exit Play
        </button>
        <label className="flex items-center gap-1.5 text-muted-foreground shrink-0">
          Race
          <select
            value={playerCharacterId}
            onChange={(e) => setPlayerCharacter(e.target.value)}
            className="bg-input border border-border rounded px-2 py-1 text-foreground font-medium"
          >
            {PLAY_RACE_IDS.map((id) => (
              <option key={id} value={id}>{PLAYER_CHARACTERS[id].label}</option>
            ))}
          </select>
        </label>
        <span className="text-muted-foreground hidden sm:inline">
          <kbd className="font-mono">WASD</kbd> move ·{' '}
          <kbd className="font-mono">Shift</kbd> sprint ·{' '}
          <kbd className="font-mono">RMB</kbd> camera
        </span>
      </div>
      <div className="bg-card/75 border border-border rounded-md px-3 py-1.5 backdrop-blur text-muted-foreground">
        <span className="text-foreground font-semibold">{spec?.label ?? playerCharacterId}</span>
        {' · '}
        <span className="font-mono">{player.locomotion}</span>
        {player.sprinting && <span className="text-amber-400"> sprint</span>}
        <span className="opacity-60"> · grass & creatures active</span>
      </div>
    </div>
  );
}