/**
 * Environment panel — collapsible section appended to the Outliner.
 *
 * Exposes the env-side toggles the user keeps asking for:
 *   - hide / show the white shoreline ring (the "grey circle"),
 *   - rain on/off,
 *   - pollen sparkles on/off,
 *   - HDR image-based lighting on/off,
 *   - grass field with density / height / clumpiness / wind sliders.
 *
 * Tuning ranges below were picked from eyeballing the editor:
 *   density 0…40 blades/m²   — beyond ~40 fps tanks on integrated GPUs
 *   height  0.1…1.5 m        — anything taller looks like wheat
 *   noise   0.005…0.15       — low = sparse big patches, high = grain
 *   wind    0…3              — past 3 the blades look frantic
 */
import { useEditor } from './store';

export function EnvironmentPanel() {
  const env = useEditor((s) => s.env);
  const setEnv = useEditor((s) => s.setEnv);
  const setGrass = useEditor((s) => s.setGrass);

  return (
    <section className="border-t border-border p-3 space-y-3">
      <h3 className="text-sm font-semibold">Environment</h3>

      <div className="space-y-1.5">
        <Toggle
          label="Shoreline ring"
          checked={env.shoreFoam}
          onChange={(v) => setEnv({ shoreFoam: v })}
        />
        <Toggle
          label="Rain"
          checked={env.rain}
          onChange={(v) => setEnv({ rain: v })}
        />
        <Toggle
          label="Pollen sparkles"
          checked={env.sparkles}
          onChange={(v) => setEnv({ sparkles: v })}
        />
        <Toggle
          label="HDR sky lighting"
          checked={env.hdr}
          onChange={(v) => setEnv({ hdr: v })}
        />
      </div>

      <div className="border-t border-border/60 pt-3 space-y-2">
        <Toggle
          label="Grass field"
          checked={env.grass.enabled}
          onChange={(v) => setGrass({ enabled: v })}
        />
        {env.grass.enabled && (
          <>
            <Slider
              label="Density (blades / m²)"
              value={env.grass.density}
              min={1} max={40} step={1}
              onChange={(v) => setGrass({ density: v })}
            />
            <Slider
              label="Height (m)"
              value={env.grass.height}
              min={0.1} max={1.5} step={0.05}
              onChange={(v) => setGrass({ height: v })}
            />
            <Slider
              label="Clumpiness"
              value={env.grass.noiseScale}
              min={0.005} max={0.15} step={0.005}
              onChange={(v) => setGrass({ noiseScale: v })}
            />
            <Slider
              label="Wind"
              value={env.grass.windStrength}
              min={0} max={3} step={0.1}
              onChange={(v) => setGrass({ windStrength: v })}
            />
          </>
        )}
      </div>
    </section>
  );
}

function Toggle({
  label, checked, onChange,
}: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-2 cursor-pointer select-none">
      <span className="text-foreground/90">{label}</span>
      {/* Pill toggle switch */}
      <div
        onClick={() => onChange(!checked)}
        className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${
          checked ? 'bg-primary' : 'bg-border'
        }`}
      >
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${
          checked ? 'left-[18px]' : 'left-0.5'
        }`} />
      </div>
    </label>
  );
}

function Slider({
  label, value, min, max, step, onChange,
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <div className="flex items-center justify-between text-muted-foreground mb-1">
        <span>{label}</span>
        <span className="font-mono">{value.toFixed(step < 0.1 ? 3 : 2)}</span>
      </div>
      <input
        type="range"
        className="w-full"
        value={value}
        min={min} max={max} step={step}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
