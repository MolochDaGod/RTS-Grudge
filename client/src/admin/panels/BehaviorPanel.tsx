import { useGameConfig } from "@/lib/stores/useGameConfig";
import { SliderField, Section } from "./ConfigEditor";

export default function BehaviorPanel() {
  const behavior = useGameConfig((s) => s.config.behavior);
  const update = useGameConfig((s) => s.updateBehavior);

  return (
    <div style={{ padding: 12 }}>
      <Section title="Aggro System">
        <SliderField label="Flee HP Threshold" value={behavior.fleeHealthThreshold} onChange={(v) => update({ fleeHealthThreshold: v })} min={0} max={1.0} step={0.05} />
        <SliderField label="Aggro Memory" value={behavior.aggroMemoryDuration} onChange={(v) => update({ aggroMemoryDuration: v })} min={1} max={30} step={1} suffix="s" />
        <SliderField label="Group Aggro Range" value={behavior.groupAggroRange} onChange={(v) => update({ groupAggroRange: v })} min={0} max={30} step={1} suffix="m" />
        <SliderField label="Alert Others Range" value={behavior.alertOthersRange} onChange={(v) => update({ alertOthersRange: v })} min={0} max={25} step={1} suffix="m" />
        <SliderField label="Deaggro Distance" value={behavior.deaggroDistance} onChange={(v) => update({ deaggroDistance: v })} min={10} max={60} step={2} suffix="m" />
      </Section>

      <Section title="Movement Behaviors">
        <SliderField label="Wander Interval" value={behavior.wanderChangeInterval} onChange={(v) => update({ wanderChangeInterval: v })} min={1} max={15} step={0.5} suffix="s" />
        <SliderField label="Patrol Speed" value={behavior.patrolSpeed} onChange={(v) => update({ patrolSpeed: v })} min={0.1} max={2.0} step={0.1} suffix="x" />
        <SliderField label="Chase Speed" value={behavior.chaseSpeedMultiplier} onChange={(v) => update({ chaseSpeedMultiplier: v })} min={1.0} max={3.0} step={0.1} suffix="x" />
        <SliderField label="Retreat Distance" value={behavior.retreatDistance} onChange={(v) => update({ retreatDistance: v })} min={5} max={40} step={1} suffix="m" />
      </Section>

      <Section title="Idle Behavior">
        <SliderField label="Idle Anim Chance" value={behavior.idleAnimationChance} onChange={(v) => update({ idleAnimationChance: v })} min={0} max={1.0} step={0.05} />
      </Section>

      <Section title="Behavior Tree Overview">
        <div style={{ padding: 8, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#7a6a50", lineHeight: 1.8 }}>
          <div style={{ color: "#c9950a" }}>Selector (Root)</div>
          <div style={{ marginLeft: 16, color: "#7ed88a" }}>Sequence: Flee</div>
          <div style={{ marginLeft: 32, color: "#c9a86c" }}>- Check HP {"<"} {(behavior.fleeHealthThreshold * 100).toFixed(0)}%</div>
          <div style={{ marginLeft: 32, color: "#c9a86c" }}>- Move away {behavior.retreatDistance}m</div>
          <div style={{ marginLeft: 16, color: "#7ed88a" }}>Sequence: Attack</div>
          <div style={{ marginLeft: 32, color: "#c9a86c" }}>- Detect player within range</div>
          <div style={{ marginLeft: 32, color: "#c9a86c" }}>- Chase at {behavior.chaseSpeedMultiplier}x speed</div>
          <div style={{ marginLeft: 32, color: "#c9a86c" }}>- Attack in range</div>
          <div style={{ marginLeft: 16, color: "#7ed88a" }}>Sequence: Wander</div>
          <div style={{ marginLeft: 32, color: "#c9a86c" }}>- Pick random point</div>
          <div style={{ marginLeft: 32, color: "#c9a86c" }}>- Move at {behavior.patrolSpeed}x speed</div>
          <div style={{ marginLeft: 32, color: "#c9a86c" }}>- Wait {behavior.wanderChangeInterval}s</div>
        </div>
      </Section>
    </div>
  );
}
