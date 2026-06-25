/**
 * @deprecated Forge is a standalone app at /forge/ (or forge.grudge-studio.com).
 * useGame.goToForge() navigates there directly — no iframe embed.
 */
export const FORGE_EDITOR_URL =
  typeof window !== "undefined" && window.location.hostname.includes("localhost")
    ? "http://localhost:5174/"
    : "/forge/";

export default function ForgeEmbed() {
  if (typeof window !== "undefined") {
    window.location.replace(FORGE_EDITOR_URL);
  }
  return null;
}