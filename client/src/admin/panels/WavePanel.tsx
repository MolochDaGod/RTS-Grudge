import { useGameConfig } from "@/lib/stores/useGameConfig";
import { NumberField, SliderField, Section } from "./ConfigEditor";

export default function WavePanel() {
  const waves = useGameConfig((s) => s.config.waves);
  const update = useGameConfig((s) => s.updateWaves);

  return (
    <div style={{ padding: 12 }}>
      <Section title="Wave Scaling">
        <NumberField label="Base Enemies" value={waves.baseEnemiesPerWave} onChange={(v) => update({ baseEnemiesPerWave: v })} min={1} max={50} />
        <NumberField label="Per-Wave Multiplier" value={waves.enemiesPerWaveMultiplier} onChange={(v) => update({ enemiesPerWaveMultiplier: v })} min={1} max={10} />
        <NumberField label="Max Concurrent" value={waves.maxConcurrentEnemies} onChange={(v) => update({ maxConcurrentEnemies: v })} min={1} max={50} />
        <NumberField label="Concurrent Bonus/Wave" value={waves.concurrentPerWaveBonus} onChange={(v) => update({ concurrentPerWaveBonus: v })} min={0} max={10} />
      </Section>

      <Section title="Spawn Settings">
        <SliderField label="Spawn Interval" value={waves.spawnInterval} onChange={(v) => update({ spawnInterval: v })} min={0.5} max={10} step={0.5} suffix="s" />
        <SliderField label="Spawn Distance" value={waves.spawnDistance} onChange={(v) => update({ spawnDistance: v })} min={10} max={50} step={1} suffix="m" />
      </Section>

      <Section title="Boss Waves">
        <NumberField label="Boss Every N Waves" value={waves.bossEveryNWaves} onChange={(v) => update({ bossEveryNWaves: v })} min={2} max={20} />
        <SliderField label="Boss HP Multiplier" value={waves.bossHealthMultiplier} onChange={(v) => update({ bossHealthMultiplier: v })} min={1} max={10} step={0.5} suffix="x" />
        <SliderField label="Boss DMG Multiplier" value={waves.bossDamageMultiplier} onChange={(v) => update({ bossDamageMultiplier: v })} min={1} max={5} step={0.5} suffix="x" />
      </Section>

      <Section title="Wave Preview" defaultOpen={false}>
        <div style={{ padding: 8 }}>
          {Array.from({ length: 10 }, (_, i) => {
            const waveNum = i + 1;
            const enemies = waves.baseEnemiesPerWave + waveNum * waves.enemiesPerWaveMultiplier;
            const concurrent = waves.maxConcurrentEnemies + waveNum * waves.concurrentPerWaveBonus;
            const isBoss = waveNum % waves.bossEveryNWaves === 0;
            return (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", color: isBoss ? "#f0883e" : "#7a6a50", fontSize: 11 }}>
                <span>Wave {waveNum}{isBoss ? " (BOSS)" : ""}</span>
                <span>{enemies} enemies, max {concurrent}</span>
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}
