/**
 * usePets — Dragon companion management store.
 *
 * Handles the full pet lifecycle:
 *   hatchEgg()   → consumes dragon_egg from inventory, creates stage-2 pet
 *   feedPet()    → consume materials from inventory/storage to gain XP
 *   mountPet()   → fly adult+ dragon; player becomes dragon rider
 *   dismountPet()→ return to ground, restore normal controls
 *   releasePet() → remove pet (cannot be undone unless NFT-backed)
 *   mintAsNFT()  → call /api/nfts/mint to create Solana NFT for this pet
 *
 * Persisted in localStorage under 'grudge_pets'.
 * Up to 5 pets per account. NFT-backed pets survive through release.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  type DragonStage, type DragonColor,
  DRAGON_STAGES, getXpThreshold, canAdvanceStage,
  getDragonModelPath,
} from "@/game/systems/DragonPetRegistry";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type PetType = "dragon";  // extensible for future pet types

export interface PetEntry {
  id: string;
  type: PetType;
  name: string;
  stage: DragonStage;
  color: DragonColor;
  xp: number;
  /** Times fed (flavor stat) */
  feedCount: number;
  /** ISO timestamp of when the egg was hatched */
  hatchedAt: string;
  /** Solana mint address if this pet has been minted as an NFT */
  nftMintAddress?: string;
  /** True while the player is mounted on this pet */
  isMounted: boolean;
  /** Whether this pet is currently the "active" companion following the player */
  isActive: boolean;
  /** Combat assists recorded (used for stage XP calculation) */
  combatAssists: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────────────

interface PetsState {
  pets: PetEntry[];
  maxPets: number;

  /** Consume a dragon_egg from inventory and create a stage-2 hatchling. */
  hatchEgg: (
    eggItemId: string,
    removeFromInventory: (id: string, qty: number) => void,
    color?: DragonColor,
  ) => PetEntry | null;

  /** Feed materials to the pet for XP. Consumes from storage first then inventory. */
  feedPet: (
    petId: string,
    materialId: string,
    quantity: number,
    removeFromStorage: (id: string, qty: number) => void,
    removeFromInventory: (id: string, qty: number) => void,
    hasEnough: (id: string, qty: number, inStorage: boolean) => boolean,
  ) => { success: boolean; xpGained: number; stagedUp: boolean };

  /** Award XP for a combat assist (pet participated in a kill). */
  awardCombatXP: (petId: string, xp: number) => void;

  /** Mount the dragon (stage 4+). Returns false if not mountable. */
  mountPet: (petId: string) => boolean;

  /** Dismount. */
  dismountPet: (petId: string) => void;

  /** Set a pet as the active companion. */
  setActivePet: (petId: string | null) => void;

  /** Rename a pet. */
  renamePet: (petId: string, name: string) => void;

  /** Release (delete) a pet. NFT-backed pets save their mint address to cloud. */
  releasePet: (petId: string) => void;

  /** Returns the current active pet (following player). */
  getActivePet: () => PetEntry | undefined;

  /** Returns the mounted pet (player is riding it). */
  getMountedPet: () => PetEntry | undefined;

  /** Save NFT mint address after successful on-chain minting. */
  setNFTMintAddress: (petId: string, mintAddress: string) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makePetId(): string {
  return `pet_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const DEFAULT_NAMES = [
  "Ignis", "Vex", "Flare", "Crimson", "Emberwing", "Ashclaw",
  "Pyro", "Blaze", "Scorch", "Cinder", "Smolder", "Inferno",
  "Dusk", "Void", "Aether", "Frost", "Nox", "Solara",
];

function randomDragonName(): string {
  return DEFAULT_NAMES[Math.floor(Math.random() * DEFAULT_NAMES.length)];
}

// ─────────────────────────────────────────────────────────────────────────────
// Store implementation
// ─────────────────────────────────────────────────────────────────────────────

export const usePets = create<PetsState>()(
  persist(
    (set, get) => ({
      pets: [],
      maxPets: 5,

      // ── hatchEgg ──────────────────────────────────────────────────────────
      hatchEgg: (eggItemId, removeFromInventory, color = "red") => {
        const { pets, maxPets } = get();
        if (pets.length >= maxPets) return null;

        // Consume one dragon_egg from inventory
        removeFromInventory(eggItemId, 1);

        const newPet: PetEntry = {
          id: makePetId(),
          type: "dragon",
          name: randomDragonName(),
          stage: 2,
          color,
          xp: 0,
          feedCount: 0,
          hatchedAt: new Date().toISOString(),
          nftMintAddress: undefined,
          isMounted: false,
          isActive: pets.length === 0,  // first pet auto-activates
          combatAssists: 0,
        };

        set(s => ({ pets: [...s.pets, newPet] }));
        return newPet;
      },

      // ── feedPet ───────────────────────────────────────────────────────────
      feedPet: (petId, materialId, quantity, removeFromStorage, removeFromInventory, hasEnough) => {
        const { pets } = get();
        const pet = pets.find(p => p.id === petId);
        if (!pet) return { success: false, xpGained: 0, stagedUp: false };

        const stageDef = DRAGON_STAGES[pet.stage];
        const feedEntry = stageDef.feedMaterials.find(f => f.itemId === materialId);
        if (!feedEntry) return { success: false, xpGained: 0, stagedUp: false };

        const needed = feedEntry.quantity * quantity;
        // Try storage first, then inventory
        const inStorage = hasEnough(materialId, needed, true);
        const inInventory = hasEnough(materialId, needed, false);
        if (!inStorage && !inInventory) return { success: false, xpGained: 0, stagedUp: false };

        if (inStorage) removeFromStorage(materialId, needed);
        else removeFromInventory(materialId, needed);

        const xpGained = feedEntry.xpGain * quantity;
        let newXp = pet.xp + xpGained;
        let newStage = pet.stage;
        let stagedUp = false;

        if (canAdvanceStage(pet.stage)) {
          const threshold = getXpThreshold(pet.stage);
          if (newXp >= threshold) {
            newXp -= threshold;
            newStage = (pet.stage + 1) as DragonStage;
            stagedUp = true;
          }
        }

        set(s => ({
          pets: s.pets.map(p =>
            p.id !== petId ? p : {
              ...p,
              xp: newXp,
              stage: newStage,
              feedCount: p.feedCount + quantity,
            }
          ),
        }));

        return { success: true, xpGained, stagedUp };
      },

      // ── awardCombatXP ────────────────────────────────────────────────────
      awardCombatXP: (petId, xp) => {
        set(s => {
          return {
            pets: s.pets.map(p => {
              if (p.id !== petId) return p;
              let newXp = p.xp + xp;
              let newStage = p.stage;
              if (canAdvanceStage(p.stage) && newXp >= getXpThreshold(p.stage)) {
                newXp -= getXpThreshold(p.stage);
                newStage = (p.stage + 1) as DragonStage;
              }
              return { ...p, xp: newXp, stage: newStage, combatAssists: p.combatAssists + 1 };
            }),
          };
        });
      },

      // ── mountPet ─────────────────────────────────────────────────────────
      mountPet: (petId) => {
        const pet = get().pets.find(p => p.id === petId);
        if (!pet || !DRAGON_STAGES[pet.stage].mountable) return false;

        set(s => ({
          pets: s.pets.map(p => ({ ...p, isMounted: p.id === petId ? true : false })),
        }));
        return true;
      },

      // ── dismountPet ───────────────────────────────────────────────────────
      dismountPet: (petId) => {
        set(s => ({
          pets: s.pets.map(p => p.id === petId ? { ...p, isMounted: false } : p),
        }));
      },

      // ── setActivePet ──────────────────────────────────────────────────────
      setActivePet: (petId) => {
        set(s => ({
          pets: s.pets.map(p => ({ ...p, isActive: p.id === petId })),
        }));
      },

      // ── renamePet ─────────────────────────────────────────────────────────
      renamePet: (petId, name) => {
        set(s => ({
          pets: s.pets.map(p => p.id === petId ? { ...p, name: name.trim().slice(0, 24) || p.name } : p),
        }));
      },

      // ── releasePet ────────────────────────────────────────────────────────
      releasePet: (petId) => {
        set(s => ({
          pets: s.pets.filter(p => p.id !== petId),
        }));
      },

      // ── getActivePet ──────────────────────────────────────────────────────
      getActivePet: () => get().pets.find(p => p.isActive && !p.isMounted),

      // ── getMountedPet ─────────────────────────────────────────────────────
      getMountedPet: () => get().pets.find(p => p.isMounted),

      // ── setNFTMintAddress ─────────────────────────────────────────────────
      setNFTMintAddress: (petId, mintAddress) => {
        set(s => ({
          pets: s.pets.map(p => p.id === petId ? { ...p, nftMintAddress: mintAddress } : p),
        }));
      },
    }),
    {
      name: "grudge_pets",
      storage: createJSONStorage(() => {
        try { return localStorage; }
        catch { return { getItem: () => null, setItem: () => {}, removeItem: () => {} }; }
      }),
      partialize: s => ({ pets: s.pets }),
    }
  )
);

// ─────────────────────────────────────────────────────────────────────────────
// Mint pet as NFT (calls production API)
// ─────────────────────────────────────────────────────────────────────────────

export async function mintPetAsNFT(petId: string, walletAddress: string): Promise<{
  success: boolean; mintAddress?: string; txId?: string; error?: string;
}> {
  const pet = usePets.getState().pets.find(p => p.id === petId);
  if (!pet) return { success: false, error: "Pet not found" };
  if (pet.nftMintAddress) return { success: false, error: "Already minted" };

  const stageDef = DRAGON_STAGES[pet.stage];

  try {
    const res = await fetch("/api/nfts/mint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        walletAddress,
        collection: stageDef.nft.collection,
        name: `${pet.name} — ${stageDef.name}`,
        description: stageDef.description,
        image: getDragonModelPath(pet.stage),  // use CDN GLB as preview (Crossmint accepts model URL)
        attributes: {
          ...stageDef.nft.attributes,
          color: pet.color,
          feedCount: pet.feedCount,
          combatAssists: pet.combatAssists,
          hatchedAt: pet.hatchedAt,
          petId: pet.id,
        },
        royaltyBps: stageDef.nft.royaltyBps,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { success: false, error: `Mint failed: ${res.status} ${text.slice(0, 100)}` };
    }

    const data = await res.json();
    if (data.mintAddress) {
      usePets.getState().setNFTMintAddress(petId, data.mintAddress);
      return { success: true, mintAddress: data.mintAddress, txId: data.txId };
    }
    return { success: false, error: data.error || "No mint address returned" };
  } catch (e: any) {
    return { success: false, error: e?.message ?? String(e) };
  }
}
