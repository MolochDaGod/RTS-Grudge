import { create } from "zustand";
import * as THREE from "three";
import type { EnemyData } from "@/game/systems/EnemyManager";

interface TargetingState {
  targetId: string | null;
  setTarget: (id: string | null) => void;
  clearTarget: () => void;
  cycleTarget: (enemies: EnemyData[], playerPosition: THREE.Vector3, maxRange?: number) => void;
}

export const useTargeting = create<TargetingState>()((set, get) => ({
  targetId: null,

  setTarget: (id) => set({ targetId: id }),

  clearTarget: () => set({ targetId: null }),

  cycleTarget: (enemies, playerPosition, maxRange = 40) => {
    const alive = enemies.filter((e) => !e.isDying && e.health > 0);
    if (alive.length === 0) {
      set({ targetId: null });
      return;
    }

    const inRange = alive
      .map((e) => ({ enemy: e, dist: playerPosition.distanceTo(e.position) }))
      .filter((e) => e.dist <= maxRange)
      .sort((a, b) => a.dist - b.dist);

    if (inRange.length === 0) {
      set({ targetId: null });
      return;
    }

    const currentId = get().targetId;
    if (!currentId) {
      set({ targetId: inRange[0].enemy.id });
      return;
    }

    const currentIndex = inRange.findIndex((e) => e.enemy.id === currentId);
    const nextIndex = (currentIndex + 1) % inRange.length;
    set({ targetId: inRange[nextIndex].enemy.id });
  },
}));
