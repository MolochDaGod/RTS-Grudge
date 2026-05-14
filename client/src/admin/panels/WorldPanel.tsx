import { useGameConfig } from "@/lib/stores/useGameConfig";
import { NumberField, SliderField, ColorField, Section } from "./ConfigEditor";

export default function WorldPanel() {
  const world = useGameConfig((s) => s.config.world);
  const update = useGameConfig((s) => s.updateWorld);

  return (
    <div style={{ padding: 12 }}>
      <Section title="Day/Night Cycle">
        <NumberField label="Day Duration" value={world.dayDuration} onChange={(v) => update({ dayDuration: v })} min={30} max={600} suffix="s" />
        <NumberField label="Night Duration" value={world.nightDuration} onChange={(v) => update({ nightDuration: v })} min={30} max={600} suffix="s" />
      </Section>

      <Section title="Lighting">
        <SliderField label="Day Ambient" value={world.ambientLightDay} onChange={(v) => update({ ambientLightDay: v })} min={0} max={1.0} step={0.05} />
        <SliderField label="Night Ambient" value={world.ambientLightNight} onChange={(v) => update({ ambientLightNight: v })} min={0} max={0.5} step={0.01} />
        <SliderField label="Sun Intensity" value={world.sunIntensity} onChange={(v) => update({ sunIntensity: v })} min={0} max={3.0} step={0.1} />
        <SliderField label="Moon Intensity" value={world.moonIntensity} onChange={(v) => update({ moonIntensity: v })} min={0} max={1.0} step={0.05} />
      </Section>

      <Section title="Atmosphere">
        <SliderField label="Fog Density" value={world.fogDensity} onChange={(v) => update({ fogDensity: v })} min={0} max={0.02} step={0.001} />
        <ColorField label="Fog Color" value={world.fogColor} onChange={(v) => update({ fogColor: v })} />
        <ColorField label="Sky Color" value={world.skyColor} onChange={(v) => update({ skyColor: v })} />
      </Section>

      <Section title="World Objects">
        <NumberField label="Tree Count" value={world.treeCount} onChange={(v) => update({ treeCount: v })} min={0} max={500} />
        <NumberField label="Rock Count" value={world.rockCount} onChange={(v) => update({ rockCount: v })} min={0} max={300} />
        <SliderField label="Grass Density" value={world.grassDensity} onChange={(v) => update({ grassDensity: v })} min={0} max={1.0} step={0.1} />
        <NumberField label="Building Count" value={world.buildingCount} onChange={(v) => update({ buildingCount: v })} min={0} max={50} />
      </Section>
    </div>
  );
}
