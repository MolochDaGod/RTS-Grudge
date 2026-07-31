/**
 * Handoff to canonical Grudge Character Studio (Warlords era create).
 *
 * After save, Foundry returns with ?from=gcs&characterId=… so /character can
 * select the new Railway hero (grudge6 kit). Prefer return /character for RTS
 * forge; /play when entering world directly.
 */

const GCS_ORIGIN = "https://character.grudge-studio.com";

const RETURN_HOST_RE =
  /(^|\.)grudge-studio\.com$|(^|\.)grudgewarlords\.com$|\.vercel\.app$/i;

export function buildGcsCreateUrl(returnPath = "/character"): string {
  const params = new URLSearchParams();
  params.set("era", "warlords");
  params.set("mode", "create");
  params.set("prod", "1");
  params.set("level", "20");
  params.set("entry", "airship_warlords");

  // Allow /character so RTS roster can pick up the new UUID after create
  const safePath =
    !returnPath || returnPath === "/foundry" ? "/character" : returnPath;

  const returnTo =
    typeof window !== "undefined"
      ? `${window.location.origin}${safePath.startsWith("/") ? safePath : `/${safePath}`}`
      : `https://rts-grudge.vercel.app${safePath.startsWith("/") ? safePath : `/${safePath}`}`;
  try {
    if (RETURN_HOST_RE.test(new URL(returnTo).hostname)) {
      params.set("returnTo", returnTo);
    }
  } catch {
    /* ignore */
  }

  const token =
    localStorage.getItem("grudge_auth_token") ||
    localStorage.getItem("grudge_session_token") ||
    localStorage.getItem("sso_token") ||
    localStorage.getItem("access_token");
  if (token) params.set("grudge_token", token);

  const grudgeId =
    localStorage.getItem("grudge_id") ||
    localStorage.getItem("grudge_account_id");
  if (grudgeId) {
    params.set("grudgeId", grudgeId);
    params.set("grudge_id", grudgeId);
  }

  const name = localStorage.getItem("grudge_username");
  if (name) params.set("name", name);

  // Foundry create funnel (warlords era only)
  return `${GCS_ORIGIN}/foundry?${params.toString()}`;
}

export function navigateToGcsCreate(returnPath = "/character"): void {
  window.location.assign(buildGcsCreateUrl(returnPath));
}

/** Open Grudge ID login and return to /character after SSO. */
export function navigateToGrudgeIdLogin(returnPath = "/character"): void {
  const ret =
    typeof window !== "undefined"
      ? `${window.location.origin}${returnPath}`
      : `https://rts-grudge.vercel.app${returnPath}`;
  const url = new URL("https://id.grudge-studio.com/login");
  url.searchParams.set("redirect_uri", ret);
  url.searchParams.set("returnTo", ret);
  window.location.assign(url.toString());
}