import { useState } from "react";
import { useGameConfig, type EnemyTypeConfig } from "@/lib/stores/useGameConfig";
import { NumberField, TextField, BoolField, Section, SliderField } from "./ConfigEditor";

export default function EnemyPanel() {
  const enemies = useGameConfig((s) => s.config.enemyTypes);
  const updateEnemy = useGameConfig((s) => s.updateEnemyType);
  const addEnemy = useGameConfig((s) => s.addEnemyType);
  const removeEnemy = useGameConfig((s) => s.removeEnemyType);
  const [selected, setSelected] = useState<string>(enemies[0]?.id || "");
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");

  const selectedEnemy = enemies.find((e) => e.id === selected);

  const handleAdd = () => {
    if (!newName.trim()) return;
    const id = newName.toLowerCase().replace(/\s+/g, "_");
    const newEnemy: EnemyTypeConfig = {
      id,
      name: newName,
      modelPath: "/models/characters/undead_grave_knight-male.glb",
      health: 50,
      damage: 10,
      speed: 3.0,
      detectionRange: 15,
      attackRange: 2.0,
      attackCooldown: 1.5,
      xpReward: 10,
      lootTable: [],
      scale: 1.0,
      tint: null,
      spawnWeight: 2,
      minWave: 1,
      nightOnly: false,
    };
    addEnemy(newEnemy);
    setSelected(id);
    setNewName("");
    setShowAdd(false);
  };

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {enemies.map((e) => (
          <button
            key={e.id}
            onClick={() => setSelected(e.id)}
            style={{
              padding: "4px 10px",
              borderRadius: 4,
              border: selected === e.id ? "1px solid #c9950a" : "1px solid rgba(201,149,10,0.15)",
              background: selected === e.id ? "rgba(201,149,10,0.1)" : "#130e08",
              color: selected === e.id ? "#f0d68a" : "#c9a86c",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            {e.name}
          </button>
        ))}
        <button
          onClick={() => setShowAdd(!showAdd)}
          style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid #c9950a", background: "linear-gradient(135deg, #c9950a, #9b7520)", color: "#0a0705", cursor: "pointer", fontSize: 12, fontWeight: 700 }}
        >
          + Add
        </button>
      </div>

      {showAdd && (
        <div style={{ marginBottom: 12, padding: 8, background: "#0f0a06", borderRadius: 6, border: "1px solid rgba(201,149,10,0.15)" }}>
          <TextField label="Enemy Name" value={newName} onChange={setNewName} placeholder="e.g. Dragon" />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={handleAdd} style={{ padding: "4px 12px", background: "linear-gradient(135deg, #c9950a, #9b7520)", border: "none", borderRadius: 4, color: "#0a0705", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>Create</button>
            <button onClick={() => setShowAdd(false)} style={{ padding: "4px 12px", background: "#130e08", border: "1px solid rgba(201,149,10,0.15)", borderRadius: 4, color: "#c9a86c", cursor: "pointer", fontSize: 12 }}>Cancel</button>
          </div>
        </div>
      )}

      {selectedEnemy && (
        <>
          <Section title="Identity">
            <TextField label="Name" value={selectedEnemy.name} onChange={(v) => updateEnemy(selected, { name: v })} />
            <TextField label="Model Path" value={selectedEnemy.modelPath} onChange={(v) => updateEnemy(selected, { modelPath: v })} />
            <SliderField label="Scale" value={selectedEnemy.scale} onChange={(v) => updateEnemy(selected, { scale: v })} min={0.2} max={3.0} step={0.1} suffix="x" />
          </Section>

          <Section title="Stats">
            <NumberField label="Health" value={selectedEnemy.health} onChange={(v) => updateEnemy(selected, { health: v })} min={1} max={10000} />
            <NumberField label="Damage" value={selectedEnemy.damage} onChange={(v) => updateEnemy(selected, { damage: v })} min={1} max={500} />
            <SliderField label="Speed" value={selectedEnemy.speed} onChange={(v) => updateEnemy(selected, { speed: v })} min={0.5} max={10} step={0.5} />
            <NumberField label="XP Reward" value={selectedEnemy.xpReward} onChange={(v) => updateEnemy(selected, { xpReward: v })} min={0} max={1000} />
          </Section>

          <Section title="Behavior">
            <SliderField label="Detection Range" value={selectedEnemy.detectionRange} onChange={(v) => updateEnemy(selected, { detectionRange: v })} min={5} max={50} step={1} suffix="m" />
            <SliderField label="Attack Range" value={selectedEnemy.attackRange} onChange={(v) => updateEnemy(selected, { attackRange: v })} min={1} max={20} step={0.5} suffix="m" />
            <SliderField label="Attack Cooldown" value={selectedEnemy.attackCooldown} onChange={(v) => updateEnemy(selected, { attackCooldown: v })} min={0.1} max={5.0} step={0.1} suffix="s" />
          </Section>

          <Section title="Spawning">
            <NumberField label="Spawn Weight" value={selectedEnemy.spawnWeight} onChange={(v) => updateEnemy(selected, { spawnWeight: v })} min={0} max={10} />
            <NumberField label="Min Wave" value={selectedEnemy.minWave} onChange={(v) => updateEnemy(selected, { minWave: v })} min={1} max={20} />
            <BoolField label="Night Only" value={selectedEnemy.nightOnly} onChange={(v) => updateEnemy(selected, { nightOnly: v })} />
          </Section>

          <div style={{ marginTop: 8 }}>
            <button
              onClick={() => {
                if (confirm(`Delete ${selectedEnemy.name}?`)) {
                  removeEnemy(selected);
                  setSelected(enemies.find((e) => e.id !== selected)?.id || "");
                }
              }}
              style={{ padding: "6px 16px", background: "#b54a3a", border: "none", borderRadius: 4, color: "#f0e6d0", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
            >
              Delete Enemy
            </button>
          </div>
        </>
      )}
    </div>
  );
}
