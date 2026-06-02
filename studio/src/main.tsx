import { createRoot } from "react-dom/client";
import { GrudgeHeader } from "@workspace/brand";
import App from "./App";
import "./index.css";

function Root() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <GrudgeHeader app="Studio" subtitle="Map + Model Editor" />
      <div style={{ flex: 1, minHeight: 0 }}>
        <App />
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<Root />);
