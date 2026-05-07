import { useGameConfig } from "@/lib/stores/useGameConfig";
import { NumberField, SliderField, Section } from "./ConfigEditor";

export default function TerrainPanel() {
  const terrain = useGameConfig((s) => s.config.terrain);
  const update = useGameConfig((s) => s.updateTerrain);

  return (
    <div style={{ padding: 12 }}>
      <Section title="World Size & Resolution">
        <NumberField label="World Size" value={terrain.worldSize} onChange={(v) => update({ worldSize: v })} min={50} max={500} step={10} suffix="m" />
        <NumberField label="Resolution" value={terrain.resolution} onChange={(v) => update({ resolution: v })} min={32} max={512} step={32} />
        <NumberField label="Max Height" value={terrain.maxHeight} onChange={(v) => update({ maxHeight: v })} min={1} max={50} step={1} suffix="m" />
        <NumberField label="Seed" value={terrain.seed} onChange={(v) => update({ seed: v })} min={0} max={99999} step={1} />
      </Section>

      <Section title="Noise Parameters">
        <SliderField label="Noise Scale" value={terrain.noiseScale} onChange={(v) => update({ noiseScale: v })} min={0.001} max={0.1} step={0.001} />
        <NumberField label="Octaves" value={terrain.octaves} onChange={(v) => update({ octaves: v })} min={1} max={8} step={1} />
        <SliderField label="Persistence" value={terrain.persistence} onChange={(v) => update({ persistence: v })} min={0.1} max={1.0} step={0.05} />
        <SliderField label="Lacunarity" value={terrain.lacunarity} onChange={(v) => update({ lacunarity: v })} min={1.0} max={4.0} step={0.1} />
      </Section>

      <Section title="Biome Levels">
        <SliderField label="Water Level" value={terrain.waterLevel} onChange={(v) => update({ waterLevel: v })} min={0} max={5} step={0.1} suffix="m" />
        <SliderField label="Snow Level" value={terrain.snowLevel} onChange={(v) => update({ snowLevel: v })} min={5} max={50} step={0.5} suffix="m" />
      </Section>
    </div>
  );
}
