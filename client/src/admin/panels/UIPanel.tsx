import { useGameConfig } from "@/lib/stores/useGameConfig";
import { NumberField, SliderField, BoolField, SelectField, Section } from "./ConfigEditor";

export default function UIPanel() {
  const ui = useGameConfig((s) => s.config.ui);
  const update = useGameConfig((s) => s.updateUI);

  return (
    <div style={{ padding: 12 }}>
      <Section title="HUD">
        <SliderField label="HUD Opacity" value={ui.hudOpacity} onChange={(v) => update({ hudOpacity: v })} min={0} max={1.0} step={0.05} />
        <BoolField label="Show FPS" value={ui.showFPS} onChange={(v) => update({ showFPS: v })} />
        <BoolField label="Show Coordinates" value={ui.showCoordinates} onChange={(v) => update({ showCoordinates: v })} />
      </Section>

      <Section title="Minimap">
        <BoolField label="Show Minimap" value={ui.showMinimap} onChange={(v) => update({ showMinimap: v })} />
        <NumberField label="Minimap Size" value={ui.minimapSize} onChange={(v) => update({ minimapSize: v })} min={80} max={300} suffix="px" />
      </Section>

      <Section title="Combat UI">
        <BoolField label="Damage Numbers" value={ui.showDamageNumbers} onChange={(v) => update({ showDamageNumbers: v })} />
        <BoolField label="Health Bars" value={ui.showHealthBars} onChange={(v) => update({ showHealthBars: v })} />
        <SliderField label="Health Bar Distance" value={ui.healthBarDistance} onChange={(v) => update({ healthBarDistance: v })} min={5} max={50} step={1} suffix="m" />
        <SelectField label="Crosshair" value={ui.crosshairStyle} options={[
          { value: "dot", label: "Dot" },
          { value: "cross", label: "Cross" },
          { value: "circle", label: "Circle" },
          { value: "none", label: "None" },
        ]} onChange={(v) => update({ crosshairStyle: v })} />
      </Section>

      <Section title="Text">
        <NumberField label="Chat Font Size" value={ui.chatFontSize} onChange={(v) => update({ chatFontSize: v })} min={8} max={24} suffix="px" />
      </Section>
    </div>
  );
}
