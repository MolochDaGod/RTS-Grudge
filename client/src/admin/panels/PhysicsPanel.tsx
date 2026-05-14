import { useGameConfig } from "@/lib/stores/useGameConfig";
import { NumberField, SliderField, Section } from "./ConfigEditor";

export default function PhysicsPanel() {
  const physics = useGameConfig((s) => s.config.physics);
  const update = useGameConfig((s) => s.updatePhysics);

  return (
    <div style={{ padding: 12 }}>
      <Section title="Movement">
        <SliderField label="Player Speed" value={physics.playerSpeed} onChange={(v) => update({ playerSpeed: v })} min={1} max={20} step={0.5} suffix="m/s" />
        <SliderField label="Sprint Multiplier" value={physics.sprintMultiplier} onChange={(v) => update({ sprintMultiplier: v })} min={1.0} max={3.0} step={0.1} suffix="x" />
        <SliderField label="Jump Force" value={physics.jumpForce} onChange={(v) => update({ jumpForce: v })} min={1} max={20} step={0.5} />
      </Section>

      <Section title="World Physics">
        <SliderField label="Gravity" value={physics.gravity} onChange={(v) => update({ gravity: v })} min={-20} max={0} step={0.1} suffix="m/s²" />
        <SliderField label="Friction" value={physics.friction} onChange={(v) => update({ friction: v })} min={0} max={1.0} step={0.05} />
        <SliderField label="Air Resistance" value={physics.airResistance} onChange={(v) => update({ airResistance: v })} min={0} max={0.2} step={0.01} />
      </Section>

      <Section title="Slope Physics">
        <SliderField label="Uphill Penalty" value={physics.slopeUpPenalty} onChange={(v) => update({ slopeUpPenalty: v })} min={0} max={2.0} step={0.1} />
        <SliderField label="Downhill Boost" value={physics.slopeDownBoost} onChange={(v) => update({ slopeDownBoost: v })} min={0} max={2.0} step={0.1} />
        <NumberField label="Max Slope Angle" value={physics.maxSlopeAngle} onChange={(v) => update({ maxSlopeAngle: v })} min={10} max={80} suffix="°" />
      </Section>

      <Section title="Collision">
        <SliderField label="Player Radius" value={physics.playerCollisionRadius} onChange={(v) => update({ playerCollisionRadius: v })} min={0.1} max={2.0} step={0.1} suffix="m" />
        <SliderField label="Enemy Radius" value={physics.enemyCollisionRadius} onChange={(v) => update({ enemyCollisionRadius: v })} min={0.1} max={3.0} step={0.1} suffix="m" />
      </Section>
    </div>
  );
}
