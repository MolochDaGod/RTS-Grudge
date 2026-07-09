import { useEditor } from './store';

export function EditorStatusBar() {
  const playMode = useEditor((s) => s.playMode);
  const tool = useEditor((s) => s.tool);
  const brushRadius = useEditor((s) => s.brushRadius);
  const entityCount = useEditor((s) => s.project.entities.length);
  const projectName = useEditor((s) => s.project.name);
  const seed = useEditor((s) => s.project.seed);

  const brushing = tool.startsWith('sculpt_') || tool.startsWith('paint_');

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 border-t border-border bg-card/70 text-[11px] text-muted-foreground shrink-0">
      <span
        className={`px-2 py-0.5 rounded font-semibold uppercase tracking-wide ${
          playMode
            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
            : 'bg-secondary text-foreground border border-border'
        }`}
      >
        {playMode ? 'Play' : 'Edit'}
      </span>
      <span className="text-foreground font-medium truncate max-w-[180px]">{projectName}</span>
      {seed != null && <span className="font-mono">seed {seed}</span>}
      <span className="font-mono">tool {tool}</span>
      {brushing && <span className="font-mono">brush {brushRadius.toFixed(1)}m</span>}
      <span className="ml-auto font-mono">{entityCount} entities</span>
      {!playMode && (
        <span className="hidden sm:inline opacity-70">edit · water y=0 · seafloor −5…−50 · no grass</span>
      )}
    </div>
  );
}