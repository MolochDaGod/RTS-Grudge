/**
 * ForgeEmbed — Embeds the Grudge Studio Forge editor (forge.grudge-studio.com)
 * as a full-screen iframe within the RTS-Grudge app.
 *
 * Supports passing scene data via the `?scene=<url>` query parameter that the
 * Forge editor already handles natively (see Forge App.tsx published-scene
 * auto-loader).
 *
 * The Forge editor provides: scene hierarchy, inspector, transform gizmos,
 * 96+ builtin models, AI assistant, visual scripting, GitHub project sync,
 * asset conversion (FBX/OBJ/STL → GLB), play mode, and more.
 */

import { useGame } from "@/lib/stores/useGame";

const FORGE_BASE_URL = "https://forge.grudge-studio.com";

export default function ForgeEmbed() {
  const restart = useGame((s) => s.restart);

  // Build the Forge URL — can optionally pass a scene to load via query param
  const forgeUrl = FORGE_BASE_URL;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "#0d1117",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Top bar with back button and title */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "6px 12px",
          background: "#161b22",
          borderBottom: "1px solid #30363d",
          flexShrink: 0,
        }}
      >
        <button
          onClick={restart}
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid #30363d",
            borderRadius: 6,
            color: "#c9d1d9",
            padding: "4px 12px",
            fontSize: 13,
            cursor: "pointer",
            fontFamily: "Inter, sans-serif",
          }}
        >
          ← Menu
        </button>
        <span
          style={{
            color: "#e6edf3",
            fontSize: 14,
            fontWeight: 600,
            fontFamily: "'Cinzel', serif",
            letterSpacing: 1,
          }}
        >
          GRUDGE STUDIO FORGE
        </span>
        <a
          href={forgeUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            marginLeft: "auto",
            color: "#58a6ff",
            fontSize: 12,
            textDecoration: "none",
            fontFamily: "Inter, sans-serif",
          }}
        >
          Open in new tab ↗
        </a>
      </div>

      {/* Forge editor iframe */}
      <iframe
        src={forgeUrl}
        title="Grudge Studio Forge"
        style={{
          flex: 1,
          width: "100%",
          border: "none",
          background: "#0d1117",
        }}
        allow="accelerometer; camera; clipboard-read; clipboard-write; fullscreen; gamepad; gyroscope; microphone; xr-spatial-tracking"
        sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals allow-downloads"
      />
    </div>
  );
}
