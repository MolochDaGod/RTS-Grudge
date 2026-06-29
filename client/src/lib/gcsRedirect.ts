/**
 * Handoff to canonical Grudge Character Studio (account + era rosters).
 */

const GCS_ORIGIN = "https://character.grudge-studio.com";

const RETURN_HOST_RE =
  /(^|\.)grudge-studio\.com$|(^|\.)grudgewarlords\.com$|\.vercel\.app$/i;

export function buildGcsCreateUrl(returnPath = "/character"): string {
  const params = new URLSearchParams();
  params.set("era", "warlords");
  params.set("mode", "create");

  const returnTo =
    typeof window !== "undefined"
      ? `${window.location.origin}${returnPath}`
      : `https://rts-grudge.vercel.app${returnPath}`;
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

  return `${GCS_ORIGIN}?${params.toString()}`;
}

export function navigateToGcsCreate(returnPath = "/character"): void {
  window.location.assign(buildGcsCreateUrl(returnPath));
}