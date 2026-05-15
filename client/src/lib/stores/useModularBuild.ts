import { create } from "zustand";
import { getPieceById, type BuildingPiece } from "@/game/building/BuildingPalette";

// ---------------------------------------------------------------------------
// Modular building system — places individual BuildingPalette pieces (walls,
// floors, pillars, doors, furniture, traps) with grid snap + rotation snap.
//
// Separate from useBuildSystem (RTS buildings) and useSurvivalBuilding
// (survival-crafted structures). This system is the creative/dungeon builder
// that lets the player (or the GGE editor) compose environments from the
// 136-piece Kenney + KayKit palette.
// ---------------------------------------------------------------------------

export interface ModularPiece {
  uid: string;
  pieceId: string;
  position: [number, number, number];
  rotation: number;
  /** Current health. Pieces with hasDestroyedVariant swap model at 0 HP. */
  health: number;
  maxHealth: number;
  /** True once the piece has been swapped to its destroyed variant. */
  destroyed: boolean;
}

interface ModularBuildState {
  /** Currently selected palette piece ID for placement. */
  selectedPieceId: string | null;
  /** All placed modular pieces in the world. */
  placedPieces: ModularPiece[];
  /** Ghost position for the placement preview. */
  ghostPosition: [number, number, number] | null;
  /** Ghost rotation in radians. */
  ghostRotation: number;
  /** Whether the modular build mode is active. */
  active: boolean;

  // --- Actions ---
  setActive: (active: boolean) => void;
  selectPiece: (id: string | null) => void;
  setGhostPosition: (pos: [number, number, number] | null) => void;
  rotateGhost: () => void;
  /** Place the currently selected piece at the ghost position. */
  placeCurrentPiece: () => boolean;
  /** Remove a placed piece by UID. */
  removePiece: (uid: string) => void;
  /** Apply damage to a placed piece. Swaps to destroyed variant at 0 HP. */
  damagePiece: (uid: string, amount: number) => void;
  /** Clear all placed pieces. */
  clearAll: () => void;
}

let _uidCounter = 0;

/**
 * Snap a world coordinate to the piece's grid.
 * `snapSize` = 1 → round to 1 m; 0.5 → round to 0.5 m.
 */
function snap(value: number, snapSize: number): number {
  if (snapSize <= 0) return value;
  return Math.round(value / snapSize) * snapSize;
}

export const useModularBuild = create<ModularBuildState>((set, get) => ({
  selectedPieceId: null,
  placedPieces: [],
  ghostPosition: null,
  ghostRotation: 0,
  active: false,

  setActive: (active) => set({ active, selectedPieceId: active ? get().selectedPieceId : null, ghostPosition: null }),

  selectPiece: (id) => set({ selectedPieceId: id, ghostPosition: null, ghostRotation: 0 }),

  setGhostPosition: (pos) => {
    if (!pos) { set({ ghostPosition: null }); return; }
    const piece = get().selectedPieceId ? getPieceById(get().selectedPieceId!) : null;
    const sz = piece?.snapSize ?? 1;
    set({ ghostPosition: [snap(pos[0], sz), pos[1], snap(pos[2], sz)] });
  },

  rotateGhost: () => {
    const piece = get().selectedPieceId ? getPieceById(get().selectedPieceId!) : null;
    const snapDeg = piece?.rotationSnap ?? 90;
    const snapRad = (snapDeg * Math.PI) / 180;
    set(s => ({ ghostRotation: (s.ghostRotation + snapRad) % (Math.PI * 2) }));
  },

  placeCurrentPiece: () => {
    const { selectedPieceId, ghostPosition, ghostRotation } = get();
    if (!selectedPieceId || !ghostPosition) return false;
    const def = getPieceById(selectedPieceId);
    if (!def) return false;

    const uid = `mp_${++_uidCounter}_${Date.now()}`;
    const placed: ModularPiece = {
      uid,
      pieceId: def.id,
      position: [...ghostPosition],
      rotation: ghostRotation,
      health: 100,
      maxHealth: 100,
      destroyed: false,
    };

    set(s => ({ placedPieces: [...s.placedPieces, placed] }));
    return true;
  },

  removePiece: (uid) => set(s => ({
    placedPieces: s.placedPieces.filter(p => p.uid !== uid),
  })),

  damagePiece: (uid, amount) => set(s => ({
    placedPieces: s.placedPieces.map(p => {
      if (p.uid !== uid) return p;
      const newHp = Math.max(0, p.health - amount);
      if (newHp <= 0 && !p.destroyed) {
        // Swap to destroyed variant if one exists
        const def = getPieceById(p.pieceId);
        if (def?.destroyedVariantId) {
          return { ...p, health: 50, maxHealth: 50, destroyed: true, pieceId: def.destroyedVariantId };
        }
        // No destroyed variant — just remove (filter below)
        return { ...p, health: 0 };
      }
      return { ...p, health: newHp };
    }).filter(p => p.health > 0),
  })),

  clearAll: () => set({ placedPieces: [], ghostPosition: null, selectedPieceId: null }),
}));

/** Get the BuildingPiece definition for a placed piece. */
export function getModularPieceDef(pieceId: string): BuildingPiece | undefined {
  return getPieceById(pieceId);
}
