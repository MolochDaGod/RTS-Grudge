import { useGame } from "@/lib/stores/useGame";
import { AccountPanel } from "@/game/AccountPanel";

const FONTS = {
  title: "'MorkDungeon', 'Cinzel', serif",
  header: "'Cinzel', serif",
  body: "'Crimson Text', serif",
};

// Fleet game links — external Grudge Studio deployments
const FLEET_GAMES = [
  { name: "Grudge Warlords", desc: "Main RPG — crafting, shop, codex", url: "https://grudgewarlords.com", color: "#f6c945" },
  { name: "Dungeon Crawler Quest", desc: "Voxel dungeon crawling", url: "https://dcq.grudge-studio.com", color: "#66bb6a" },
  { name: "Grudge Crafting", desc: "Crafting & item management", url: "https://grudge-crafting.puter.site", color: "#ce93d8" },
];

interface NavTile {
  label: string;
  desc: string;
  icon: string;
  color: string;
  border: string;
  action: () => void;
}

export default function HomePage() {
  const {
    goToCharacterSelect, goToCombat2d, goToIslandV2,
    goToGGE, goToAdmin, goToController, goToWallet, restart,
  } = useGame();

  const tiles: NavTile[] = [
    { label: "HERO FORGE", desc: "Create & customize your character", icon: "⚔️", color: "#f6c945", border: "rgba(246,201,69,.4)", action: goToCharacterSelect },
    { label: "PLAY", desc: "Enter the 3D open world", icon: "🎮", color: "#ff6b57", border: "rgba(255,107,87,.4)", action: restart },
    { label: "2D COMBAT", desc: "Gruda Wars — 2D battles", icon: "⚡", color: "#6aa9ff", border: "rgba(106,169,255,.4)", action: goToCombat2d },
    { label: "ISLAND", desc: "Shipwreck Island — survival mode", icon: "🏝️", color: "#6bdc8b", border: "rgba(107,220,139,.4)", action: goToIslandV2 },
    { label: "EDITOR", desc: "GGE — level & scene editor", icon: "🔧", color: "#ce93d8", border: "rgba(206,147,216,.4)", action: goToGGE },
    { label: "CONTROLLER", desc: "Animation & input lab", icon: "🕹️", color: "#4dd0e1", border: "rgba(77,208,225,.4)", action: goToController },
    { label: "ADMIN", desc: "Server management", icon: "🛡️", color: "#ffb74d", border: "rgba(255,183,77,.4)", action: goToAdmin },
    { label: "WALLET", desc: "Solana wallet & NFTs", icon: "💎", color: "#4dd0e1", border: "rgba(77,208,225,.4)", action: goToWallet },
  ];

  return (
    <div style={{
      minHeight: "100vh", width: "100vw",
      background: "linear-gradient(135deg, #05060c 0%, #0d1220 50%, #05060c 100%)",
      fontFamily: FONTS.body, color: "#fff",
      display: "flex", flexDirection: "column", alignItems: "center",
      overflow: "auto",
    }}>
      <AccountPanel />

      {/* Header */}
      <header style={{
        textAlign: "center", padding: "32px 24px 20px", width: "100%", maxWidth: 800,
      }}>
        <div style={{
          fontFamily: FONTS.title, fontWeight: 900, letterSpacing: "4px", fontSize: 36,
          background: "linear-gradient(90deg,#f6c945,#fff3c2 50%,#f6c945)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          filter: "drop-shadow(0 0 24px rgba(246,201,69,.2))",
        }}>GRUDGE STUDIO</div>
        <div style={{
          fontFamily: FONTS.header, fontSize: 10, letterSpacing: "4px",
          color: "#9aa3c7", fontWeight: 600, marginTop: 4,
        }}>GAME HUB</div>
      </header>

      {/* Navigation Grid */}
      <main style={{
        width: "100%", maxWidth: 800, padding: "0 20px 24px",
        display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: 12,
      }}>
        {tiles.map(tile => (
          <button
            key={tile.label}
            onClick={tile.action}
            style={{
              display: "flex", flexDirection: "column", alignItems: "flex-start",
              padding: "16px 18px", borderRadius: 12, cursor: "pointer",
              background: "linear-gradient(135deg, rgba(14,22,48,.7), rgba(8,12,28,.8))",
              border: `1px solid ${tile.border}`,
              transition: "all .2s ease",
              textAlign: "left",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = `0 8px 24px -8px ${tile.border}`;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 22 }}>{tile.icon}</span>
              <span style={{
                fontFamily: FONTS.header, fontWeight: 700, fontSize: 13,
                letterSpacing: "1.5px", color: tile.color,
              }}>{tile.label}</span>
            </div>
            <span style={{ fontSize: 11, color: "#8a8fa8", lineHeight: 1.4 }}>{tile.desc}</span>
          </button>
        ))}
      </main>

      {/* Fleet — External Games */}
      <section style={{
        width: "100%", maxWidth: 800, padding: "0 20px 32px",
      }}>
        <div style={{
          fontFamily: FONTS.header, fontSize: 10, letterSpacing: "3px",
          color: "#6a6e82", textTransform: "uppercase", marginBottom: 10,
        }}>FLEET — CONNECTED GAMES</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {FLEET_GAMES.map(game => (
            <a
              key={game.name}
              href={game.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flex: "1 1 200px", padding: "12px 16px", borderRadius: 10,
                background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.08)",
                textDecoration: "none", color: "#fff",
                transition: "all .2s ease",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = `${game.color}55`;
                e.currentTarget.style.background = "rgba(255,255,255,.06)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,.08)";
                e.currentTarget.style.background = "rgba(255,255,255,.03)";
              }}
            >
              <div style={{ fontFamily: FONTS.header, fontSize: 12, fontWeight: 700, color: game.color, letterSpacing: "1px" }}>
                {game.name}
              </div>
              <div style={{ fontSize: 10, color: "#6a6e82", marginTop: 2 }}>{game.desc}</div>
              <div style={{ fontSize: 8, color: "#444", marginTop: 4, fontFamily: "monospace" }}>{game.url.replace("https://", "")}</div>
            </a>
          ))}
        </div>
      </section>

      <footer style={{ padding: "12px 20px 24px", fontSize: 9, color: "#333", textAlign: "center" }}>
        Grudge Studio — Created by Racalvin The Pirate King
      </footer>
    </div>
  );
}
