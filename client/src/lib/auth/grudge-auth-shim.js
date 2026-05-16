/**
 * grudge-auth-shim.js
 * ===================
 * Vanilla JS auth shim for Grudge Studio apps deployed on Puter
 * (warlord-crafting-suite, grudge-warlords-game, etc.).
 *
 * Inject this script BEFORE your app bundle in the HTML <head>:
 *
 *   <script src="/grudge-auth-shim.js"></script>
 *   <script src="/assets/index-xxxx.js" defer></script>
 *
 * What it does:
 *  1. Parses ?grudge_token= callback from id.grudge-studio.com and stores it
 *  2. Removes ALL references / navigations to auth-gateway-flax.vercel.app
 *  3. Patches window.location if somehow pointed at the retired gateway
 *  4. Exposes window.GrudgeAuth for app code to use without importing React
 *  5. Silently restores Puter session from localStorage on load
 *
 * ⚠️  auth-gateway-flax.vercel.app is RETIRED. Never add it here.
 *     All auth → id.grudge-studio.com (Cloudflare → Railway DB).
 */

(function GrudgeAuthShim() {
  "use strict";

  var ID_SERVICE    = "https://id.grudge-studio.com";
  var TOKEN_KEY     = "grudge.token";
  var TOKEN_EXP_KEY = "grudge.token.exp";
  var PLAYER_ID_KEY = "grudge.playerId";

  // ── Blocked / retired URLs that must never be navigated to ──────────────────
  var BLOCKED_HOSTS = [
    "auth-gateway-flax.vercel.app",
  ];

  // ── localStorage helpers ─────────────────────────────────────────────────────
  function ls(key) { try { return localStorage.getItem(key); } catch (_) { return null; } }
  function lsSet(key, val) { try { localStorage.setItem(key, val); } catch (_) {} }
  function lsRm(key) { try { localStorage.removeItem(key); } catch (_) {} }

  // ── Token helpers ─────────────────────────────────────────────────────────────
  function getToken() {
    var t = ls(TOKEN_KEY);
    if (!t) return null;
    var exp = Number(ls(TOKEN_EXP_KEY) || "0");
    if (exp > 0 && Date.now() > exp) { lsRm(TOKEN_KEY); lsRm(TOKEN_EXP_KEY); return null; }
    return t;
  }

  function storeToken(token, expiryMs) {
    lsSet(TOKEN_KEY, token);
    lsSet(TOKEN_EXP_KEY, String(expiryMs));
  }

  function clearToken() {
    lsRm(TOKEN_KEY);
    lsRm(TOKEN_EXP_KEY);
  }

  // ── Handle ?grudge_token= callback from id.grudge-studio.com ────────────────
  function handleCallback() {
    var search = window.location.search;
    if (!search || search.indexOf("grudge_token") === -1) return false;
    var p = new URLSearchParams(search);
    var token = p.get("grudge_token");
    var exp   = p.get("expires_at");
    if (!token) return false;
    var expiryMs = exp ? Number(exp) : Date.now() + 7 * 24 * 60 * 60 * 1000;
    storeToken(token, expiryMs);
    // Clean URL
    var clean = new URL(window.location.href);
    clean.searchParams.delete("grudge_token");
    clean.searchParams.delete("expires_at");
    try { window.history.replaceState({}, "", clean.toString()); } catch (_) {}
    return true;
  }

  // ── Puter UUID sync helper ────────────────────────────────────────────────────
  function getPuterUuid() {
    try {
      var raw = localStorage.getItem("puter.user") || localStorage.getItem("puter_user");
      if (!raw) return null;
      var u = JSON.parse(raw);
      return (u && u.uuid) ? u.uuid : null;
    } catch (_) { return null; }
  }

  function resolvePlayerId() {
    var token = getToken();
    if (token) {
      var cached = ls(PLAYER_ID_KEY);
      if (cached && cached.indexOf("grudge_") === 0) return cached;
    }
    var puterUuid = getPuterUuid();
    if (puterUuid) return "puter_" + puterUuid;
    var guest = ls(PLAYER_ID_KEY);
    if (guest && guest.indexOf("anon_") === 0) return guest;
    // Mint a new guest ID
    var id = "anon_" + (Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)).slice(0, 24);
    lsSet(PLAYER_ID_KEY, id);
    return id;
  }

  // ── Block retired gateway navigations ─────────────────────────────────────────
  function isBlockedUrl(url) {
    if (!url || typeof url !== "string") return false;
    for (var i = 0; i < BLOCKED_HOSTS.length; i++) {
      if (url.indexOf(BLOCKED_HOSTS[i]) !== -1) return true;
    }
    return false;
  }

  // Intercept window.location.href assignments (best-effort, not foolproof)
  try {
    var _assign = window.location.assign.bind(window.location);
    var _replace = window.location.replace.bind(window.location);
    window.location.assign = function(url) {
      if (isBlockedUrl(url)) {
        console.warn("[GrudgeAuth] Blocked navigation to retired auth gateway:", url);
        return;
      }
      return _assign(url);
    };
    window.location.replace = function(url) {
      if (isBlockedUrl(url)) {
        console.warn("[GrudgeAuth] Blocked replace to retired auth gateway:", url);
        return;
      }
      return _replace(url);
    };
  } catch (_) {}

  // Check if we're currently ON a blocked URL (shouldn't happen, but safeguard)
  if (typeof window !== "undefined" && isBlockedUrl(window.location.href)) {
    console.error("[GrudgeAuth] Currently on a RETIRED auth gateway — redirecting home.");
    window.location.replace("https://grudgewarlords.com");
  }

  // ── Protected route guard ─────────────────────────────────────────────────────
  var PROTECTED = ["/wallet", "/guild", "/trade", "/profile", "/admin", "/mapadmin", "/account"];

  function isProtected(path) {
    var p = (path || window.location.pathname).toLowerCase().split("?")[0];
    for (var i = 0; i < PROTECTED.length; i++) {
      if (p.indexOf(PROTECTED[i]) === 0) return true;
    }
    return false;
  }

  function guardRoute() {
    if (!isProtected()) return false;
    var token = getToken();
    var puterUuid = getPuterUuid();
    if (token || puterUuid) return false; // authenticated
    // Not authenticated, redirect to Grudge ID
    var ret = encodeURIComponent(window.location.href);
    window.location.href = ID_SERVICE + "/auth/login?redirect=" + ret + "&reason=protected_route";
    return true;
  }

  // ── Public API ────────────────────────────────────────────────────────────────
  window.GrudgeAuth = {
    /** Current Grudge JWT or null */
    getToken:       getToken,
    /** Store a Grudge JWT */
    storeToken:     storeToken,
    /** Clear the Grudge JWT */
    clearToken:     clearToken,
    /** Resolved player ID string */
    getPlayerId:    resolvePlayerId,
    /** True if a valid Grudge token exists */
    hasToken:       function() { return !!getToken(); },
    /** True if Puter session cached */
    hasPuter:       function() { return !!getPuterUuid(); },
    /** True if any auth form available */
    isAuthenticated: function() { return !!(getToken() || getPuterUuid()); },
    /** Redirect to id.grudge-studio.com login */
    redirectToLogin: function(returnUrl, reason) {
      var ret = returnUrl || window.location.href;
      var url = ID_SERVICE + "/auth/login?redirect=" + encodeURIComponent(ret);
      if (reason) url += "&reason=" + encodeURIComponent(reason);
      window.location.href = url;
    },
    /** Guard the current route */
    guardRoute: guardRoute,
    /** Parse callback token from URL */
    handleCallback: handleCallback,
    /** Check if a URL is blocked */
    isBlockedUrl: isBlockedUrl,
    GRUDGE_ID_URL: ID_SERVICE,
  };

  // ── Auto-run on load ──────────────────────────────────────────────────────────
  handleCallback();

  // On DOMContentLoaded, guard protected routes
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", guardRoute);
  } else {
    guardRoute();
  }

  console.info("[GrudgeAuth] Shim active. Auth: " + (window.GrudgeAuth.isAuthenticated() ? "yes" : "guest"));
})();
