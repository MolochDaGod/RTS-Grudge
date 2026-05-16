/**
 * useBuildingStorage — per-building chest inventory.
 *
 * Each storage structure (chest, storage_box, barrel, large_chest, or any
 * world building with interaction "storage") gets its own item list keyed by
 * its UID/id. Items are separate from the player's carried inventory and are
 * persisted to localStorage so they survive page refreshes.
 *
 * Transfer helpers move stacks between a chest and the player's inventory.
 */

import { create } from "zustand";
import type { InventoryItem } from "./useInventory";
import { useInventory } from "./useInventory";

const PERSIST_KEY = "grudge_building_storage_v1";

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

function loadPersisted(): Record<string, InventoryItem[]> {
  try {
    const raw = localStorage.getItem(PERSIST_KEY);
    return raw ? (JSON.parse(raw) as Record<string, InventoryItem[]>) : {};
  } catch {
    return {};
  }
}

function savePersisted(chests: Record<string, InventoryItem[]>) {
  try {
    localStorage.setItem(PERSIST_KEY, JSON.stringify(chests));
  } catch {}
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const CHEST_MAX_SLOTS = 24;

interface BuildingStorageState {
  /** uid/id → item list */
  chests: Record<string, InventoryItem[]>;

  /** Read items for a specific chest (returns [] for unknown UID). */
  getChestItems: (uid: string) => InventoryItem[];

  /** Add (or stack) an item in a chest. Returns false if no slots remain. */
  addToChest: (uid: string, item: Omit<InventoryItem, "quantity"> & { quantity?: number }) => boolean;

  /** Remove qty of an item from a chest. */
  removeFromChest: (uid: string, itemId: string, quantity?: number) => void;

  /**
   * Transfer one stack of itemId from a chest to the player's carried inventory.
   * If the chest item qty > 1 it reduces by 1; at 0 it removes the slot.
   */
  transferToPlayer: (uid: string, itemId: string, quantity?: number) => void;

  /**
   * Transfer one stack of itemId from the player's carried inventory to a chest.
   * Reduces player stack by quantity (or by 1). Returns false if no chest slot.
   */
  transferFromPlayer: (uid: string, itemId: string, quantity?: number) => boolean;

  /** Clear a chest completely (e.g. on destroy). */
  clearChest: (uid: string) => void;
}

export const useBuildingStorage = create<BuildingStorageState>((set, get) => ({
  chests: loadPersisted(),

  getChestItems: (uid) => get().chests[uid] ?? [],

  addToChest: (uid, item) => {
    const { chests } = get();
    const existing = chests[uid] ?? [];

    // Stack with existing
    const match = existing.find(i => i.id === item.id);
    const qty = item.quantity ?? 1;
    let updated: InventoryItem[];
    if (match) {
      updated = existing.map(i =>
        i.id === item.id ? { ...i, quantity: i.quantity + qty } : i
      );
    } else {
      if (existing.length >= CHEST_MAX_SLOTS) return false;
      updated = [...existing, { ...item, quantity: qty } as InventoryItem];
    }

    const next = { ...chests, [uid]: updated };
    set({ chests: next });
    savePersisted(next);
    return true;
  },

  removeFromChest: (uid, itemId, quantity = 1) => {
    const { chests } = get();
    const existing = chests[uid] ?? [];
    const item = existing.find(i => i.id === itemId);
    if (!item) return;

    let updated: InventoryItem[];
    if (item.quantity <= quantity) {
      updated = existing.filter(i => i.id !== itemId);
    } else {
      updated = existing.map(i =>
        i.id === itemId ? { ...i, quantity: i.quantity - quantity } : i
      );
    }

    const next = { ...chests, [uid]: updated };
    set({ chests: next });
    savePersisted(next);
  },

  transferToPlayer: (uid, itemId, quantity = 1) => {
    const { chests, removeFromChest } = get();
    const item = (chests[uid] ?? []).find(i => i.id === itemId);
    if (!item) return;

    const qty = Math.min(quantity, item.quantity);
    useInventory.getState().addItem({ ...item, quantity: qty });
    removeFromChest(uid, itemId, qty);
  },

  transferFromPlayer: (uid, itemId, quantity = 1) => {
    const { addToChest } = get();
    const inv = useInventory.getState();
    const item = inv.items.find(i => i.id === itemId);
    if (!item) return false;

    const qty = Math.min(quantity, item.quantity);
    const ok = addToChest(uid, { ...item, quantity: qty });
    if (ok) {
      inv.removeItem(itemId, qty);
    }
    return ok;
  },

  clearChest: (uid) => {
    const { chests } = get();
    const next = { ...chests };
    delete next[uid];
    set({ chests: next });
    savePersisted(next);
  },
}));
