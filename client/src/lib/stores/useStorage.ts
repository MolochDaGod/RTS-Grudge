/**
 * useStorage — global persistent account-level storage.
 *
 * This is the NON-DROPPABLE collective goods pool that:
 *  - Receives output from auto-harvesting NPC allies
 *  - Is shared across all Grudge game modes (inventory is per-session/per-player)
 *  - Is never dropped on death, never lost if a building is destroyed
 *  - Persists to localStorage under the key "grudge_storage"
 *  - Has 500 unique-item slots (stacks freely, no stack cap)
 *
 * Distinction from useInventory:
 *   useInventory = items the player is actively carrying. Can be used in
 *   combat, dropped, lost. Synced with other Grudge apps.
 *   useStorage   = permanent account-safe goods & crafting materials.
 *   Crafting stations prefer storage ingredients first, then inventory.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { InventoryItem } from "./useInventory";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type StorageSource =
  | "auto_harvest"   // NPC ally harvested this
  | "manual"         // Player manually placed it here
  | "crafted"        // Output of a crafting recipe
  | "looted"         // Boss / chest drop
  | "transfer"       // Moved from inventory
  | "quest"          // Quest reward stored directly
  ;

export interface StorageEntry {
  id: string;
  name: string;
  icon: string;
  quantity: number;
  type: InventoryItem["type"];
  /** WCS tier (1-8). Undefined for untierered items like food. */
  tier?: number;
  /** Tags how this item arrived in storage. */
  source?: StorageSource;
  description?: string;
  /** Harvest profession that produced this (for UI grouping). */
  gatherType?: "mining" | "logging" | "skinning" | "fishing" | "herbalism" | "scavenging";
}

// ─────────────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────────────

interface StorageState {
  /** All stored items. Stacks freely — no per-stack cap. */
  entries: StorageEntry[];
  /** Hard slot cap — limits unique item types, not total quantity. */
  maxSlots: number;

  /** Add (or stack onto) an item in storage. Returns false if at max unique slots. */
  addToStorage: (
    item: Omit<StorageEntry, "quantity"> & { quantity?: number }
  ) => boolean;

  /** Remove quantity from a stored item (removes entry when qty reaches 0). */
  removeFromStorage: (id: string, quantity?: number) => void;

  /** Returns true if storage contains at least `quantity` of item `id`. */
  hasInStorage: (id: string, quantity?: number) => boolean;

  /** Look up a single entry by id. */
  getStorageItem: (id: string) => StorageEntry | undefined;

  /**
   * Consume ingredients for a recipe, preferring storage then falling through
   * to inventory. Returns false without consuming anything if amounts are
   * insufficient across both.
   */
  consumeIngredients: (
    ingredients: { itemId: string; count: number }[],
    inventoryItems: InventoryItem[],
    removeFromInventory: (id: string, qty: number) => void
  ) => boolean;

  /** Wipe all storage (admin / reset). */
  clearStorage: () => void;

  /** Total count of items stored (sum of all quantities). */
  totalQuantity: () => number;

  /** Number of unique item slots occupied. */
  usedSlots: () => number;
}

export const useStorage = create<StorageState>()(
  persist(
    (set, get) => ({
      entries: [],
      maxSlots: 500,

      // ── addToStorage ──────────────────────────────────────────────────────
      addToStorage: (item) => {
        const { entries, maxSlots } = get();
        const qty = item.quantity ?? 1;
        const existing = entries.find(e => e.id === item.id);

        if (existing) {
          // Stack onto existing entry
          set(s => ({
            entries: s.entries.map(e =>
              e.id === item.id ? { ...e, quantity: e.quantity + qty } : e
            ),
          }));
          return true;
        }

        // New unique slot
        if (entries.length >= maxSlots) return false;
        const entry: StorageEntry = { ...item, quantity: qty };
        set(s => ({ entries: [...s.entries, entry] }));
        return true;
      },

      // ── removeFromStorage ─────────────────────────────────────────────────
      removeFromStorage: (id, quantity = 1) => {
        set(s => {
          const item = s.entries.find(e => e.id === id);
          if (!item) return s;
          if (item.quantity <= quantity) {
            return { entries: s.entries.filter(e => e.id !== id) };
          }
          return {
            entries: s.entries.map(e =>
              e.id === id ? { ...e, quantity: e.quantity - quantity } : e
            ),
          };
        });
      },

      // ── hasInStorage ──────────────────────────────────────────────────────
      hasInStorage: (id, quantity = 1) => {
        const item = get().entries.find(e => e.id === id);
        return !!item && item.quantity >= quantity;
      },

      // ── getStorageItem ────────────────────────────────────────────────────
      getStorageItem: (id) => get().entries.find(e => e.id === id),

      // ── consumeIngredients ────────────────────────────────────────────────
      consumeIngredients: (ingredients, inventoryItems, removeFromInventory) => {
        const { entries, removeFromStorage } = get();

        // First pass: check totals (storage + inventory combined)
        for (const ing of ingredients) {
          const stored = entries.find(e => e.id === ing.itemId)?.quantity ?? 0;
          const carried = inventoryItems.find(i => i.id === ing.itemId)?.quantity ?? 0;
          if (stored + carried < ing.count) return false;
        }

        // Second pass: consume — drain storage first, remainder from inventory
        for (const ing of ingredients) {
          let needed = ing.count;
          const stored = entries.find(e => e.id === ing.itemId)?.quantity ?? 0;
          if (stored > 0) {
            const fromStorage = Math.min(stored, needed);
            removeFromStorage(ing.itemId, fromStorage);
            needed -= fromStorage;
          }
          if (needed > 0) {
            removeFromInventory(ing.itemId, needed);
          }
        }

        return true;
      },

      // ── clearStorage ──────────────────────────────────────────────────────
      clearStorage: () => set({ entries: [] }),

      // ── derived ───────────────────────────────────────────────────────────
      totalQuantity: () =>
        get().entries.reduce((sum, e) => sum + e.quantity, 0),

      usedSlots: () => get().entries.length,
    }),
    {
      name: "grudge_storage",
      storage: createJSONStorage(() => {
        try { return localStorage; }
        catch { return { getItem: () => null, setItem: () => {}, removeItem: () => {} }; }
      }),
      partialize: (s) => ({ entries: s.entries }),
    }
  )
);
