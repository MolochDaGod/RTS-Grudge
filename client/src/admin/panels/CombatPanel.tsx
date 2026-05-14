import { useGameConfig } from "@/lib/stores/useGameConfig";
import { NumberField, SliderField, Section } from "./ConfigEditor";

export default function CombatPanel() {
  const combat = useGameConfig((s) => s.config.combat);
  const update = useGameConfig((s) => s.updateCombat);

  return (
    <div style={{ padding: 12 }}>
      <Section title="Base Damage">
        <NumberField label="Melee Damage" value={combat.baseMeleeDamage} onChange={(v) => update({ baseMeleeDamage: v })} min={1} max={200} />
        <NumberField label="Caster Damage" value={combat.baseCasterDamage} onChange={(v) => update({ baseCasterDamage: v })} min={1} max={200} />
        <NumberField label="Archer Damage" value={combat.baseArcherDamage} onChange={(v) => update({ baseArcherDamage: v })} min={1} max={200} />
      </Section>

      <Section title="Attack Mechanics">
        <SliderField label="Attack Cooldown" value={combat.attackCooldown} onChange={(v) => update({ attackCooldown: v })} min={0.1} max={3.0} step={0.1} suffix="s" />
        <NumberField label="Stamina Cost" value={combat.staminaCostPerAttack} onChange={(v) => update({ staminaCostPerAttack: v })} min={0} max={50} />
        <NumberField label="Max Combo Hits" value={combat.maxComboHits} onChange={(v) => update({ maxComboHits: v })} min={1} max={10} />
        <SliderField label="Combo Window" value={combat.comboWindow} onChange={(v) => update({ comboWindow: v })} min={0.2} max={2.0} step={0.1} suffix="s" />
      </Section>

      <Section title="Critical Hits">
        <SliderField label="Crit Chance" value={combat.criticalHitChance} onChange={(v) => update({ criticalHitChance: v })} min={0} max={1.0} step={0.01} />
        <SliderField label="Crit Multiplier" value={combat.criticalHitMultiplier} onChange={(v) => update({ criticalHitMultiplier: v })} min={1.0} max={5.0} step={0.1} suffix="x" />
      </Section>

      <Section title="Defense">
        <SliderField label="Block Reduction" value={combat.blockDamageReduction} onChange={(v) => update({ blockDamageReduction: v })} min={0} max={1.0} step={0.05} />
        <SliderField label="Dodge i-Frames" value={combat.dodgeIFrames} onChange={(v) => update({ dodgeIFrames: v })} min={0.1} max={1.0} step={0.05} suffix="s" />
      </Section>
    </div>
  );
}
