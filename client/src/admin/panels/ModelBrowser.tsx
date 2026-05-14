import { useState } from "react";
import { ALL_CHARACTER_MODELS, ALL_WEAPON_MODELS, ANIMATION_PACKS } from "@/game/systems/ModelRegistry";
import { Section } from "./ConfigEditor";

type BrowseTab = "characters" | "weapons" | "animations";

export default function ModelBrowser() {
  const [tab, setTab] = useState<BrowseTab>("characters");
  const [search, setSearch] = useState("");

  const filteredCharacters = ALL_CHARACTER_MODELS.filter(
    (m) => m.name.toLowerCase().includes(search.toLowerCase()) || m.category.toLowerCase().includes(search.toLowerCase())
  );

  const filteredWeapons = ALL_WEAPON_MODELS.filter(
    (m) => m.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {(["characters", "weapons", "animations"] as BrowseTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "6px 12px",
              borderRadius: 4,
              border: tab === t ? "1px solid #c9950a" : "1px solid rgba(201,149,10,0.15)",
              background: tab === t ? "rgba(201,149,10,0.1)" : "#130e08",
              color: tab === t ? "#f0d68a" : "#c9a86c",
              cursor: "pointer",
              fontSize: 12,
              textTransform: "capitalize",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search models..."
        style={{ width: "100%", background: "#0a0705", border: "1px solid rgba(201,149,10,0.15)", borderRadius: 6, color: "#f0e6d0", padding: "8px 12px", fontSize: 12, marginBottom: 12, outline: "none", fontFamily: "'Crimson Text', serif" }}
      />

      {tab === "characters" && (
        <div>
          <div style={{ color: "#7a6a50", fontSize: 11, marginBottom: 8 }}>{filteredCharacters.length} characters registered</div>
          {filteredCharacters.map((model) => (
            <div key={model.id} style={{ padding: 10, marginBottom: 6, background: "#0f0a06", borderRadius: 8, border: "1px solid rgba(201,149,10,0.12)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ color: "#f0e6d0", fontWeight: 600, fontSize: 13, fontFamily: "'Cinzel', serif" }}>{model.name}</span>
                <span style={{
                  padding: "2px 8px",
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: 600,
                  background: model.combatClass === "melee" ? "#b54a3a22" : model.combatClass === "caster" ? "#c9950a22" : "#7ed88a22",
                  color: model.combatClass === "melee" ? "#e8534a" : model.combatClass === "caster" ? "#f0d68a" : "#7ed88a",
                }}>{model.combatClass}</span>
              </div>
              <div style={{ color: "#7a6a50", fontSize: 11, fontFamily: "'Crimson Text', serif" }}>{model.description}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 4, color: "#5a4a36", fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}>
                <span>{model.format.toUpperCase()}</span>
                <span>Scale: {model.defaultScale}</span>
                <span>Height: {model.defaultHeight}m</span>
                <span>Cat: {model.category}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "weapons" && (
        <div>
          <div style={{ color: "#7a6a50", fontSize: 11, marginBottom: 8 }}>{filteredWeapons.length} weapons registered</div>
          {filteredWeapons.map((model) => (
            <div key={model.id} style={{ padding: 10, marginBottom: 6, background: "#0f0a06", borderRadius: 8, border: "1px solid rgba(201,149,10,0.12)" }}>
              <div style={{ color: "#f0e6d0", fontWeight: 600, fontSize: 13, fontFamily: "'Cinzel', serif" }}>{model.name}</div>
              <div style={{ color: "#7a6a50", fontSize: 11, fontFamily: "'Crimson Text', serif" }}>{model.description}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 4, color: "#5a4a36", fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}>
                <span>{model.format.toUpperCase()}</span>
                <span>{model.category}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "animations" && (
        <div>
          <div style={{ color: "#7a6a50", fontSize: 11, marginBottom: 8 }}>{ANIMATION_PACKS.length} animation packs</div>
          {ANIMATION_PACKS.map((pack) => (
            <Section key={pack.id} title={`${pack.name} (${pack.animations.length} clips)`} defaultOpen={false}>
              <div style={{ color: "#7a6a50", fontSize: 11, marginBottom: 6, fontFamily: "'Crimson Text', serif" }}>Style: {pack.combatStyle} | Path: {pack.basePath}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                {pack.animations.map((anim) => (
                  <div key={anim.name} style={{ padding: "3px 6px", background: "#0a0705", borderRadius: 3, color: "#c9a86c", fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}>
                    {anim.name}
                  </div>
                ))}
              </div>
            </Section>
          ))}
        </div>
      )}
    </div>
  );
}
