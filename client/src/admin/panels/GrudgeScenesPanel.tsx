import { useState, useMemo } from "react";
import {
  ALL_TJG_ASSETS,
  TJG_SCENES,
  TJG_TEXTURES,
  TJG_SOUNDS,
  getTJGAssetsByCategory,
  getTJGRetextureNeeded,
  getTJGFantasyCharacters,
  searchTJGAssets,
  type TJGAsset,
  type TJGCategory,
  type TJGScene,
  type TJGTexture,
  type TJGSound,
} from "@/lib/data/ThreeJSGamesRegistry";

type SubTab = "assets" | "scenes" | "textures" | "sounds" | "retexture";

const CATEGORY_ICONS: Record<TJGCategory, string> = {
  character: "🧙",
  animal: "🐦",
  building: "🏰",
  weapon: "⚔️",
  item: "📦",
  vehicle: "🚀",
  nature: "🌳",
  ship: "⛵",
};

const CATEGORY_COLORS: Record<TJGCategory, string> = {
  character: "#d2a8ff",
  animal: "#7ee787",
  building: "#f0883e",
  weapon: "#f85149",
  item: "#c9950a",
  vehicle: "#c9a86c",
  nature: "#56d364",
  ship: "#3fb950",
};

const POLY_COLORS: Record<string, string> = {
  low: "#56d364",
  medium: "#d29922",
  high: "#f85149",
};

function AssetCard({ asset }: { asset: TJGAsset }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      style={{
        background: "#0f0a06",
        border: `1px solid ${asset.usableInGame ? "rgba(201,149,10,0.15)" : "#f8514933"}`,
        borderRadius: 8,
        padding: 12,
        cursor: "pointer",
        transition: "border-color 0.2s",
      }}
      onClick={() => setExpanded(!expanded)}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 20 }}>{CATEGORY_ICONS[asset.category]}</span>
          <div>
            <div style={{ fontWeight: 600, color: "#e6edf3", fontSize: 14 }}>{asset.name}</div>
            <div style={{ fontSize: 11, color: "#7a6a50" }}>{asset.subcategory}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {asset.needsRetexture && (
            <span style={{ background: "#f8514933", color: "#f85149", fontSize: 10, padding: "2px 6px", borderRadius: 4 }}>
              RETEXTURE
            </span>
          )}
          <span
            style={{
              background: `${POLY_COLORS[asset.polyLevel]}22`,
              color: POLY_COLORS[asset.polyLevel],
              fontSize: 10,
              padding: "2px 6px",
              borderRadius: 4,
            }}
          >
            {asset.polyLevel.toUpperCase()}
          </span>
          {asset.usableInGame && (
            <span style={{ background: "#56d36422", color: "#56d364", fontSize: 10, padding: "2px 6px", borderRadius: 4 }}>
              IN-GAME
            </span>
          )}
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: 10, borderTop: "1px solid rgba(201,149,10,0.15)", paddingTop: 10 }}>
          <div style={{ color: "#c9a86c", fontSize: 12, marginBottom: 8 }}>{asset.description}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, fontSize: 11, color: "#7a6a50" }}>
            <div>Vertices: <span style={{ color: "#c9950a" }}>{asset.vertexCount.toLocaleString()}</span></div>
            <div>Bones: <span style={{ color: "#c9950a" }}>{asset.boneCount}</span></div>
            <div>Animations: <span style={{ color: "#c9950a" }}>{asset.animationCount}</span></div>
            <div>Skeleton: <span style={{ color: asset.hasSkeleton ? "#56d364" : "#f85149" }}>{asset.hasSkeleton ? "Yes" : "No"}</span></div>
          </div>
          <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
            {asset.tags.map(tag => (
              <span key={tag} style={{ background: "rgba(201,149,10,0.15)", color: "#c9a86c", fontSize: 10, padding: "1px 5px", borderRadius: 3 }}>
                {tag}
              </span>
            ))}
          </div>
          <div style={{ marginTop: 6, fontSize: 10, color: "#484f58", fontFamily: "monospace" }}>{asset.modelPath}</div>
        </div>
      )}
    </div>
  );
}

function SceneCard({ scene }: { scene: TJGScene }) {
  const [expanded, setExpanded] = useState(false);
  const genreColors: Record<string, string> = {
    RPG: "#d2a8ff",
    "Survival Horror": "#f85149",
    FPS: "#f0883e",
    "Vehicle Combat": "#c9a86c",
    "Flight Combat": "#c9950a",
    Adventure: "#56d364",
    Simulation: "#d29922",
    Exploration: "#3fb950",
    Arena: "#f85149",
    "Physics Puzzle": "#c9a86c",
    "Art/Gallery": "#d2a8ff",
  };

  return (
    <div
      style={{
        background: "#0f0a06",
        border: "1px solid rgba(201,149,10,0.15)",
        borderRadius: 8,
        padding: 14,
        cursor: "pointer",
      }}
      onClick={() => setExpanded(!expanded)}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: 600, color: "#e6edf3", fontSize: 14 }}>{scene.name}</div>
        <span
          style={{
            background: `${genreColors[scene.genre] || "#c9950a"}22`,
            color: genreColors[scene.genre] || "#c9950a",
            fontSize: 10,
            padding: "2px 8px",
            borderRadius: 4,
          }}
        >
          {scene.genre}
        </span>
      </div>
      <div style={{ color: "#7a6a50", fontSize: 12, marginTop: 4 }}>{scene.description}</div>

      {expanded && (
        <div style={{ marginTop: 10, borderTop: "1px solid rgba(201,149,10,0.15)", paddingTop: 10 }}>
          <div style={{ fontSize: 12, color: "#c9a86c", fontWeight: 600, marginBottom: 4 }}>Design Concepts:</div>
          <ul style={{ margin: 0, paddingLeft: 16, color: "#7a6a50", fontSize: 11 }}>
            {scene.concepts.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
          {scene.assets.length > 0 && (
            <>
              <div style={{ fontSize: 12, color: "#c9a86c", fontWeight: 600, marginTop: 8, marginBottom: 4 }}>Referenced Assets:</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {scene.assets.map(id => (
                  <span key={id} style={{ background: "rgba(201,149,10,0.15)", color: "#c9950a", fontSize: 10, padding: "2px 6px", borderRadius: 3 }}>
                    {id}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function TextureGrid({ textures }: { textures: TJGTexture[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
      {textures.map(tex => (
        <div key={tex.id} style={{ background: "#0f0a06", border: "1px solid rgba(201,149,10,0.15)", borderRadius: 8, overflow: "hidden" }}>
          <div style={{ width: "100%", height: 80, backgroundImage: `url(${tex.path})`, backgroundSize: "cover", backgroundPosition: "center" }} />
          <div style={{ padding: 6 }}>
            <div style={{ color: "#e6edf3", fontSize: 11, fontWeight: 600 }}>{tex.name}</div>
            <div style={{ color: "#7a6a50", fontSize: 10 }}>{tex.category}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SoundList({ sounds }: { sounds: TJGSound[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {sounds.map(snd => (
        <div key={snd.id} style={{ display: "flex", alignItems: "center", gap: 8, background: "#0f0a06", border: "1px solid rgba(201,149,10,0.15)", borderRadius: 8, padding: 8 }}>
          <span style={{ fontSize: 16 }}>🔊</span>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#e6edf3", fontSize: 12, fontWeight: 600 }}>{snd.name}</div>
            <div style={{ color: "#7a6a50", fontSize: 10, fontFamily: "monospace" }}>{snd.path}</div>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {snd.tags.map(t => (
              <span key={t} style={{ background: "rgba(201,149,10,0.15)", color: "#c9a86c", fontSize: 9, padding: "1px 4px", borderRadius: 2 }}>{t}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function GrudgeScenesPanel() {
  const [subTab, setSubTab] = useState<SubTab>("assets");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<TJGCategory | "all">("all");

  const filteredAssets = useMemo(() => {
    let results = categoryFilter === "all" ? ALL_TJG_ASSETS : getTJGAssetsByCategory(categoryFilter);
    if (search.trim()) {
      const searchResults = searchTJGAssets(search);
      results = results.filter(a => searchResults.includes(a));
    }
    return results;
  }, [search, categoryFilter]);

  const retextureAssets = useMemo(() => getTJGRetextureNeeded(), []);
  const fantasyChars = useMemo(() => getTJGFantasyCharacters(), []);

  const stats = useMemo(() => ({
    totalAssets: ALL_TJG_ASSETS.length,
    characters: getTJGAssetsByCategory("character").length,
    buildings: getTJGAssetsByCategory("building").length,
    weapons: getTJGAssetsByCategory("weapon").length,
    animals: getTJGAssetsByCategory("animal").length,
    scenes: TJG_SCENES.length,
    textures: TJG_TEXTURES.length,
    sounds: TJG_SOUNDS.length,
    inGame: ALL_TJG_ASSETS.filter(a => a.usableInGame).length,
    needsRetexture: retextureAssets.length,
    fantasyPlayable: fantasyChars.length,
  }), [retextureAssets, fantasyChars]);

  const tabStyle = (active: boolean) => ({
    padding: "6px 14px",
    borderRadius: 6,
    border: "none",
    background: active ? "#c9950a22" : "transparent",
    color: active ? "#c9950a" : "#7a6a50",
    cursor: "pointer" as const,
    fontSize: 12,
    fontWeight: active ? 600 : 400,
  });

  const filteredTextures = useMemo(() => {
    if (!search.trim()) return TJG_TEXTURES;
    const q = search.toLowerCase();
    return TJG_TEXTURES.filter(t => t.name.toLowerCase().includes(q) || t.tags.some(tag => tag.includes(q)));
  }, [search]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
        <div style={{ background: "#0f0a06", borderRadius: 6, padding: 8, textAlign: "center" }}>
          <div style={{ color: "#c9950a", fontSize: 20, fontWeight: 700 }}>{stats.totalAssets}</div>
          <div style={{ color: "#7a6a50", fontSize: 10 }}>Total Assets</div>
        </div>
        <div style={{ background: "#0f0a06", borderRadius: 6, padding: 8, textAlign: "center" }}>
          <div style={{ color: "#d2a8ff", fontSize: 20, fontWeight: 700 }}>{stats.characters}</div>
          <div style={{ color: "#7a6a50", fontSize: 10 }}>Characters</div>
        </div>
        <div style={{ background: "#0f0a06", borderRadius: 6, padding: 8, textAlign: "center" }}>
          <div style={{ color: "#56d364", fontSize: 20, fontWeight: 700 }}>{stats.inGame}</div>
          <div style={{ color: "#7a6a50", fontSize: 10 }}>Game-Ready</div>
        </div>
        <div style={{ background: "#0f0a06", borderRadius: 6, padding: 8, textAlign: "center" }}>
          <div style={{ color: "#f85149", fontSize: 20, fontWeight: 700 }}>{stats.needsRetexture}</div>
          <div style={{ color: "#7a6a50", fontSize: 10 }}>Need Retexture</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        <button style={tabStyle(subTab === "assets")} onClick={() => setSubTab("assets")}>Assets ({stats.totalAssets})</button>
        <button style={tabStyle(subTab === "scenes")} onClick={() => setSubTab("scenes")}>Scenes ({stats.scenes})</button>
        <button style={tabStyle(subTab === "textures")} onClick={() => setSubTab("textures")}>Textures ({stats.textures})</button>
        <button style={tabStyle(subTab === "sounds")} onClick={() => setSubTab("sounds")}>Sounds ({stats.sounds})</button>
        <button style={tabStyle(subTab === "retexture")} onClick={() => setSubTab("retexture")}>Retexture Queue ({stats.needsRetexture})</button>
      </div>

      {(subTab === "assets" || subTab === "retexture") && (
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            placeholder="Search assets..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              flex: 1,
              background: "#0a0705",
              border: "1px solid rgba(201,149,10,0.15)",
              borderRadius: 6,
              color: "#e6edf3",
              padding: "6px 10px",
              fontSize: 12,
              outline: "none",
            }}
          />
          {subTab === "assets" && (
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value as TJGCategory | "all")}
              style={{
                background: "#0a0705",
                border: "1px solid rgba(201,149,10,0.15)",
                borderRadius: 6,
                color: "#e6edf3",
                padding: "6px 8px",
                fontSize: 12,
                outline: "none",
              }}
            >
              <option value="all">All Categories</option>
              <option value="character">Characters</option>
              <option value="animal">Animals</option>
              <option value="building">Buildings</option>
              <option value="weapon">Weapons</option>
              <option value="vehicle">Vehicles</option>
              <option value="ship">Ships</option>
              <option value="nature">Nature</option>
            </select>
          )}
        </div>
      )}

      {subTab === "textures" && (
        <input
          type="text"
          placeholder="Search textures..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            background: "#0a0705",
            border: "1px solid rgba(201,149,10,0.15)",
            borderRadius: 6,
            color: "#e6edf3",
            padding: "6px 10px",
            fontSize: 12,
            outline: "none",
          }}
        />
      )}

      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
        {subTab === "assets" && filteredAssets.map(a => <AssetCard key={a.id} asset={a} />)}
        {subTab === "scenes" && TJG_SCENES.map(s => <SceneCard key={s.id} scene={s} />)}
        {subTab === "textures" && <TextureGrid textures={filteredTextures} />}
        {subTab === "sounds" && <SoundList sounds={TJG_SOUNDS} />}
        {subTab === "retexture" && (search.trim()
          ? retextureAssets.filter(a => {
              const q = search.toLowerCase();
              return a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q) || a.tags.some(t => t.includes(q));
            })
          : retextureAssets
        ).map(a => <AssetCard key={a.id} asset={a} />)}
      </div>
    </div>
  );
}
