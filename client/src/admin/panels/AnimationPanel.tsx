import { useGameConfig } from "@/lib/stores/useGameConfig";
import { SliderField, Section } from "./ConfigEditor";
import { ANIMATION_PACKS } from "@/game/systems/ModelRegistry";

export default function AnimationPanel() {
  const animation = useGameConfig((s) => s.config.animation);
  const update = useGameConfig((s) => s.updateAnimation);

  return (
    <div style={{ padding: 12 }}>
      <Section title="Blend Timing">
        <SliderField label="Default Blend" value={animation.blendDuration} onChange={(v) => update({ blendDuration: v })} min={0.05} max={1.0} step={0.05} suffix="s" />
        <SliderField label="Idle->Walk" value={animation.idleToWalkBlend} onChange={(v) => update({ idleToWalkBlend: v })} min={0.05} max={0.5} step={0.05} suffix="s" />
        <SliderField label="Walk->Run" value={animation.walkToRunBlend} onChange={(v) => update({ walkToRunBlend: v })} min={0.05} max={0.5} step={0.05} suffix="s" />
      </Section>

      <Section title="Combat Animation">
        <SliderField label="Attack Blend In" value={animation.attackBlendIn} onChange={(v) => update({ attackBlendIn: v })} min={0.02} max={0.5} step={0.02} suffix="s" />
        <SliderField label="Attack Blend Out" value={animation.attackBlendOut} onChange={(v) => update({ attackBlendOut: v })} min={0.05} max={0.5} step={0.05} suffix="s" />
        <SliderField label="Hit React" value={animation.hitReactDuration} onChange={(v) => update({ hitReactDuration: v })} min={0.1} max={1.0} step={0.05} suffix="s" />
        <SliderField label="Death Duration" value={animation.deathDuration} onChange={(v) => update({ deathDuration: v })} min={0.5} max={3.0} step={0.1} suffix="s" />
      </Section>

      <Section title="Root Motion">
        <SliderField label="Root Motion Scale" value={animation.rootMotionScale} onChange={(v) => update({ rootMotionScale: v })} min={0} max={2.0} step={0.1} suffix="x" />
      </Section>

      <Section title="Animation Packs Library">
        <div style={{ padding: 8 }}>
          {ANIMATION_PACKS.map((pack) => (
            <div key={pack.id} style={{ marginBottom: 12, padding: 10, background: "#0a0705", borderRadius: 8, border: "1px solid rgba(201,149,10,0.15)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <span style={{ color: "#f0d68a", fontSize: 13, fontWeight: 600, fontFamily: "'Cinzel', serif" }}>{pack.name}</span>
                <span style={{ color: "#7a6a50", fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>{pack.animations.length} clips</span>
              </div>
              <div style={{ color: "#7a6a50", fontSize: 11, marginBottom: 6, fontFamily: "'Crimson Text', serif" }}>Style: {pack.combatStyle}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {pack.animations.slice(0, 8).map((anim) => (
                  <span key={anim.name} style={{ padding: "2px 6px", background: "#130e08", borderRadius: 3, color: "#c9a86c", fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}>
                    {anim.name}
                  </span>
                ))}
                {pack.animations.length > 8 && (
                  <span style={{ padding: "2px 6px", color: "#7a6a50", fontSize: 10 }}>+{pack.animations.length - 8} more</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
