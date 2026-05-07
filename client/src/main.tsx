import { createRoot } from "react-dom/client";
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

createRoot(document.getElementById("root")!).render(<App />);
