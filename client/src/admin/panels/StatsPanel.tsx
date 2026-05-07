import { useGameConfig } from "@/lib/stores/useGameConfig";
import { NumberField, SliderField, Section } from "./ConfigEditor";

export default function StatsPanel() {
  const stats = useGameConfig((s) => s.config.stats);
  const update = useGameConfig((s) => s.updateStats);

  return (
    <div style={{ padding: 12 }}>
      <Section title="Base Stats">
        <NumberField label="Base Health" value={stats.baseHealth} onChange={(v) => update({ baseHealth: v })} min={1} max={1000} />
        <NumberField label="Base Stamina" value={stats.baseStamina} onChange={(v) => update({ baseStamina: v })} min={1} max={500} />
        <NumberField label="Base Mana" value={stats.baseMana} onChange={(v) => update({ baseMana: v })} min={0} max={500} />
      </Section>

      <Section title="Regeneration">
        <SliderField label="Health Regen" value={stats.healthRegenRate} onChange={(v) => update({ healthRegenRate: v })} min={0} max={10} step={0.1} suffix="/s" />
        <SliderField label="Stamina Regen" value={stats.staminaRegenRate} onChange={(v) => update({ staminaRegenRate: v })} min={0} max={20} step={0.5} suffix="/s" />
        <SliderField label="Mana Regen" value={stats.manaRegenRate} onChange={(v) => update({ manaRegenRate: v })} min={0} max={10} step={0.1} suffix="/s" />
      </Section>

      <Section title="Survival">
        <SliderField label="Hunger Decay" value={stats.hungerDecayRate} onChange={(v) => update({ hungerDecayRate: v })} min={0} max={5} step={0.1} suffix="/s" />
        <SliderField label="Thirst Decay" value={stats.thirstDecayRate} onChange={(v) => update({ thirstDecayRate: v })} min={0} max={5} step={0.1} suffix="/s" />
      </Section>

      <Section title="Leveling">
        <NumberField label="XP Per Level" value={stats.xpPerLevel} onChange={(v) => update({ xpPerLevel: v })} min={10} max={10000} />
        <SliderField label="XP Scaling" value={stats.xpScalingFactor} onChange={(v) => update({ xpScalingFactor: v })} min={1.0} max={3.0} step={0.1} suffix="x" />
        <NumberField label="Max Level" value={stats.maxLevel} onChange={(v) => update({ maxLevel: v })} min={1} max={100} />
        <NumberField label="Points Per Level" value={stats.statPointsPerLevel} onChange={(v) => update({ statPointsPerLevel: v })} min={1} max={10} />
      </Section>

      <Section title="Level Curve Preview" defaultOpen={false}>
        <div style={{ padding: 8 }}>
          {Array.from({ length: 10 }, (_, i) => {
            const level = i + 1;
            const xpRequired = Math.floor(stats.xpPerLevel * Math.pow(stats.xpScalingFactor, level - 1));
            return (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", color: "#7a6a50", fontSize: 11 }}>
                <span>Level {level}</span>
                <span>{xpRequired.toLocaleString()} XP</span>
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}
