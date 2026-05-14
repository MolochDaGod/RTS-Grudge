import { useState } from "react";
import { useGameConfig, type NPCConfig } from "@/lib/stores/useGameConfig";
import { NumberField, TextField, BoolField, Section, SliderField } from "./ConfigEditor";

export default function NPCPanel() {
  const npcs = useGameConfig((s) => s.config.npcs);
  const updateNPC = useGameConfig((s) => s.updateNPC);
  const addNPC = useGameConfig((s) => s.addNPC);
  const removeNPC = useGameConfig((s) => s.removeNPC);
  const [selected, setSelected] = useState<string>(npcs[0]?.id || "");
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");

  const selectedNPC = npcs.find((n) => n.id === selected);

  const handleAdd = () => {
    if (!newName.trim()) return;
    const id = newName.toLowerCase().replace(/\s+/g, "_");
    const newNPC: NPCConfig = {
      id,
      name: newName,
      label: newName,
      modelPath: "/models/characters/human_battle_mage-male.glb",
      position: [0, 0, 0],
      targetHeight: 1.8,
      wanderRadius: 6,
      speed: 1.5,
      dialogue: ["Hello, traveler."],
      role: "civilian",
      isVendor: false,
      vendorItems: [],
    };
    addNPC(newNPC);
    setSelected(id);
    setNewName("");
    setShowAdd(false);
  };

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {npcs.map((n) => (
          <button
            key={n.id}
            onClick={() => setSelected(n.id)}
            style={{
              padding: "4px 10px",
              borderRadius: 4,
              border: selected === n.id ? "1px solid #c9950a" : "1px solid rgba(201,149,10,0.15)",
              background: selected === n.id ? "rgba(201,149,10,0.1)" : "#130e08",
              color: selected === n.id ? "#f0d68a" : "#c9a86c",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            {n.name}
          </button>
        ))}
        <button onClick={() => setShowAdd(!showAdd)} style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid #c9950a", background: "linear-gradient(135deg, #c9950a, #9b7520)", color: "#0a0705", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>+ Add</button>
      </div>

      {showAdd && (
        <div style={{ marginBottom: 12, padding: 8, background: "#0f0a06", borderRadius: 6, border: "1px solid rgba(201,149,10,0.15)" }}>
          <TextField label="NPC Name" value={newName} onChange={setNewName} placeholder="e.g. Blacksmith" />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={handleAdd} style={{ padding: "4px 12px", background: "linear-gradient(135deg, #c9950a, #9b7520)", border: "none", borderRadius: 4, color: "#0a0705", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>Create</button>
            <button onClick={() => setShowAdd(false)} style={{ padding: "4px 12px", background: "#130e08", border: "1px solid rgba(201,149,10,0.15)", borderRadius: 4, color: "#c9a86c", cursor: "pointer", fontSize: 12 }}>Cancel</button>
          </div>
        </div>
      )}

      {selectedNPC && (
        <>
          <Section title="Identity">
            <TextField label="Name" value={selectedNPC.name} onChange={(v) => updateNPC(selected, { name: v })} />
            <TextField label="Label" value={selectedNPC.label} onChange={(v) => updateNPC(selected, { label: v })} />
            <TextField label="Model Path" value={selectedNPC.modelPath} onChange={(v) => updateNPC(selected, { modelPath: v })} />
            <TextField label="Role" value={selectedNPC.role} onChange={(v) => updateNPC(selected, { role: v })} />
          </Section>

          <Section title="Position & Movement">
            <NumberField label="X" value={selectedNPC.position[0]} onChange={(v) => updateNPC(selected, { position: [v, selectedNPC.position[1], selectedNPC.position[2]] })} min={-100} max={100} />
            <NumberField label="Y" value={selectedNPC.position[1]} onChange={(v) => updateNPC(selected, { position: [selectedNPC.position[0], v, selectedNPC.position[2]] })} min={-50} max={50} />
            <NumberField label="Z" value={selectedNPC.position[2]} onChange={(v) => updateNPC(selected, { position: [selectedNPC.position[0], selectedNPC.position[1], v] })} min={-100} max={100} />
            <SliderField label="Wander Radius" value={selectedNPC.wanderRadius} onChange={(v) => updateNPC(selected, { wanderRadius: v })} min={0} max={30} step={1} suffix="m" />
            <SliderField label="Speed" value={selectedNPC.speed} onChange={(v) => updateNPC(selected, { speed: v })} min={0.1} max={5} step={0.1} suffix="m/s" />
          </Section>

          <Section title="Vendor">
            <BoolField label="Is Vendor" value={selectedNPC.isVendor} onChange={(v) => updateNPC(selected, { isVendor: v })} />
          </Section>

          <div style={{ marginTop: 8 }}>
            <button
              onClick={() => {
                if (confirm(`Delete ${selectedNPC.name}?`)) {
                  removeNPC(selected);
                  setSelected(npcs.find((n) => n.id !== selected)?.id || "");
                }
              }}
              style={{ padding: "6px 16px", background: "#b54a3a", border: "none", borderRadius: 4, color: "#f0e6d0", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
            >
              Delete NPC
            </button>
          </div>
        </>
      )}
    </div>
  );
}
