/**
 * Handoff to canonical Grudge Character Studio (account + era rosters).
 *
 * Production: always return to /play (enter world), never /character — that
 * path re-opens Hero Forge and traps players in a create loop.
 */

const GCS_ORIGIN = "https://character.grudge-studio.com";

const RETURN_HOST_RE =
  /(^|\.)grudge-studio\.com$|(^|\.)grudgewarlords\.com$|\.vercel\.app$/i;

export function buildGcsCreateUrl(returnPath = "/play"): string {
  const params = new URLSearchParams();
  params.set("era", "warlords");
  params.set("mode", "create");
  params.set("prod", "1");
  params.set("level", "20");

  const safePath =
    !returnPath || returnPath === "/character" || returnPath === "/foundry"
      ? "/play"
      : returnPath;

  const returnTo =
    typeof window !== "undefined"
      ? `${window.location.origin}${safePath}`
      : `https://grudgewarlords.com${safePath}`;
  try {
    if (RETURN_HOST_RE.test(new URL(returnTo).hostname)) {
      params.set("returnTo", returnTo);
    }
  } catch { /* ignore */ }

  const token =
    localStorage.getItem("grudge_auth_token") ||
    localStorage.getItem("access_token");
  if (token) params.set("grudge_token", token);

  const grudgeId =
    localStorage.getItem("grudge_id") ||
    localStorage.getItem("grudge_account_id");
  if (grudgeId) params.set("grudgeId", grudgeId);

  // Deep-link Foundry with production chrome (exit + L20 enter world).
  return `${GCS_ORIGIN}/foundry?${params.toString()}`;
}

export function navigateToGcsCreate(returnPath = "/play"): void {
  window.location.assign(buildGcsCreateUrl(returnPath));
}