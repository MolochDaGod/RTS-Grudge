import { useFrame } from "@react-three/fiber";
import { tickYuka } from "./YukaWorld";

// Drop this hook into ONE component (e.g. GameScene) so the shared YUKA
// EntityManager advances each frame. Calling it from multiple components is
// safe but redundant — the EntityManager will be updated multiple times
// per frame, which usually isn't what you want.
export function useYukaTick(enabled: boolean = true) {
  useFrame((_, delta) => {
    if (!enabled) return;
    tickYuka(delta);
  });
}
