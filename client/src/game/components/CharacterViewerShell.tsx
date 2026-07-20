import type { CSSProperties, ReactNode } from "react";
import { CHARACTER_VIEWER_TOKENS } from "@/lib/data/uiArt";

/** Canonical 3D character preview container — Hero Forge, equipment panels, editors. */
export function characterViewerShellStyle(variant: "forge" | "panel" = "forge"): CSSProperties {
  if (variant === "panel") {
    const p = CHARACTER_VIEWER_TOKENS.equipmentPortrait;
    return {
      width: p.width,
      height: p.height,
      aspectRatio: p.aspectRatio,
      overflow: "hidden",
      position: "relative",
      flexShrink: 0,
      borderRadius: 10,
      background:
        "radial-gradient(ellipse at 50% 35%, rgba(201,149,10,0.08), transparent 65%), linear-gradient(180deg, #12141f 0%, #060810 100%)",
    };
  }

  return {
    position: "relative",
    flex: 1,
    minHeight: 0,
    width: "100%",
    height: "100%",
    overflow: "hidden",
    borderRadius: 0,
    background:
      "radial-gradient(ellipse at 50% 20%, rgba(106,169,255,0.06), transparent 55%), linear-gradient(180deg, #0a0c14 0%, #040508 100%)",
  };
}

export function CharacterViewerShell({
  children,
  variant = "forge",
  style,
}: {
  children: ReactNode;
  variant?: "forge" | "panel";
  style?: CSSProperties;
}) {
  return (
    <div
      className="grudge-character-viewer"
      data-viewer-variant={variant}
      style={{ ...characterViewerShellStyle(variant), ...style }}
    >
      {children}
    </div>
  );
}