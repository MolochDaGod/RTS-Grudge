import { createRoot } from "react-dom/client";
import { Router } from "wouter";
import App from "./App";
import "./index.css";
import { registerStatLookup } from "./lib/stores/useSurvival";
import { getCachedPlayerStats, initStatsBridge } from "./lib/stores/useStatsBridge";
import { initAssetLoader } from "./game/systems/AssetLoader";

initAssetLoader();

registerStatLookup((charId) => {
  if (!charId) return null;
  return getCachedPlayerStats(charId);
});

initStatsBridge();

// wouter uses the browser History API by default (no hash routing).
// The Express server already has a SPA catch-all that serves index.html
// for any unknown path, so all routes work on hard-refresh.
createRoot(document.getElementById("root")!).render(
  <Router>
    <App />
  </Router>
);
