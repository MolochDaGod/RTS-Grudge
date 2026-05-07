import { Suspense } from "react";
import Sky from "../components/Sky";
import Lighting from "../components/Lighting";
import Terrain from "../components/Terrain";
import World from "../components/World";
import NatureScatter from "../terrain/NatureScatter";
import { OceanPlane } from "../world/BoatSystem";

export type GameSceneBackdropType = "none" | "wilderness";

export const GAME_SCENE_BACKDROP_OPTIONS: { id: GameSceneBackdropType; label: string; description: string }[] = [
  { id: "none", label: "Empty Scene", description: "Default editor scene (just lights + grid)" },
  { id: "wilderness", label: "Wilderness (Main World)", description: "Live game world: sky, terrain, buildings, nature" },
];

function WildernessBackdrop() {
  return (
    <Suspense fallback={null}>
      <Sky />
      <Lighting />
      <Terrain />
      <World />
      <Suspense fallback={null}>
        <NatureScatter />
      </Suspense>
      <OceanPlane />
      <fog attach="fog" args={["#87CEEB", 80, 220]} />
    </Suspense>
  );
}

export default function GameSceneBackdrop({ type }: { type: GameSceneBackdropType }) {
  switch (type) {
    case "wilderness":
      return <WildernessBackdrop />;
    case "none":
    default:
      return null;
  }
}
