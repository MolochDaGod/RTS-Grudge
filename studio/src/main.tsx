import { createRoot } from "react-dom/client";
import App from "./App";
import { ForgeProviders } from "./components/ForgeProviders";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <ForgeProviders>
    <App />
  </ForgeProviders>,
);