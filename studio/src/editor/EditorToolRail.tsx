/**
 * Vertical tool rail docked on the left edge of the viewport.
 * Keeps transform / sculpt / paint tools one click away without crowding the top bar.
 */
import { useEditor } from './store';
import type { EditorTool } from '../types';

const RAIL: { id: EditorTool; label: string; icon: string; group: string }[] = [
  { id: 'select', label: 'Select (V)', icon: '◎', group: 'transform' },
  { id: 'translate', label: 'Move (G)', icon: '✥', group: 'transform' },
  { id: 'rotate', label: 'Rotate (R)', icon: '↻', group: 'transform' },
  { id: 'scale', label: 'Scale (S)', icon: '⤢', group: 'transform' },
  { id: 'sculpt_raise', label: 'Raise terrain', icon: '▲', group: 'sculpt' },
  { id: 'sculpt_lower', label: 'Lower terrain', icon: '▼', group: 'sculpt' },
  { id: 'sculpt_smooth', label: 'Smooth terrain', icon: '≈', group: 'sculpt' },
  { id: 'paint_grass', label: 'Paint grass', icon: '🌿', group: 'paint' },
  { id: 'paint_sand', label: 'Paint sand', icon: '🏖', group: 'paint' },
  { id: 'paint_rock', label: 'Paint rock', icon: '🪨', group: 'paint' },
  { id: 'paint_snow', label: 'Paint snow', icon: '❄', group: 'paint' },
  { id: 'place_entity', label: 'Place asset', icon: '✛', group: 'place' },
];

export function EditorToolRail() {
  const playMode = useEditor((s) => s.playMode);
  const tool = useEditor((s) => s.tool);
  const setTool = useEditor((s) => s.setTool);

  if (playMode) return null;

  let lastGroup = '';
  return (
    <div
      className="absolute left-3 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-0.5 p-1.5 rounded-lg border border-border/80 bg-card/90 backdrop-blur shadow-lg"
      aria-label="Editor tools"
    >
      {RAIL.map((t) => {
        const showSep = lastGroup && lastGroup !== t.group;
        lastGroup = t.group;
        return (
          <div key={t.id}>
            {showSep && <div className="h-px bg-border/70 my-1" />}
            <button
              type="button"
              title={t.label}
              onClick={() => setTool(t.id)}
              className={`w-9 h-9 rounded-md text-base leading-none border transition-colors ${
                tool === t.id
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-secondary/60 text-foreground border-border hover:bg-secondary'
              }`}
            >
              {t.icon}
            </button>
          </div>
        );
      })}
    </div>
  );
}