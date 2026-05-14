import { create } from "zustand";
import {
  WEAPON_MASTERY_TREES,
  type WeaponTypeId,
  type MasterySkillNode,
} from "../data/WeaponSkillData";
import { useEquipment } from "./useEquipment";

/**
 * useHotbar — mode-aware hotbar bindings + persistence.
 *
 * Source of truth for what the player has slotted into their action
 * bar in each interaction mode. Decoupled from useInventory (raw item
 * grid) and useEquipment (worn gear) so the HUD can render different
 * action bars per mode without coupling those stores together.
 *
 *   combatBindings.weaponSkills  — 3 weapon skill IDs (auto-derived
 *                                  from the currently equipped weapon
 *                                  if a slot is null)
 *   combatBindings.classSkills   — 3 class ability IDs (default to
 *                                  classAbility1/2/3 from useGame's
 *                                  SkillCooldowns)
 *   harvestPinnedTools           — item IDs that should always show up
 *                                  in the harvest hotbar (axe, pickaxe,
 *                                  torch by default)
 *
 * Server persistence: a single (playerId, characterId) row in the
 * `player_loadouts` Postgres table. JSON shape == LoadoutData below.
 */

// ---------- Stable skill ID helpers ----------

/**
 * Encode a weapon-skill node into a stable string ID.
 * Mastery nodes only have a `name`, no UUID, so we anchor by
 * weapon type + tier index + skill index. This is stable across
 * sessions because WEAPON_MASTERY_TREES is declared once at
 * module scope.
 */
export function encodeWeaponSkillId(
  weapon: WeaponTypeId,
  tierIdx: number,
  skillIdx: number,
): string {
  return `wskill:${weapon}:${tierIdx}:${skillIdx}`;
}

export interface ResolvedWeaponSkill {
  id: string;
  weapon: WeaponTypeId;
  tierIdx: number;
  skillIdx: number;
  node: MasterySkillNode;
  color: string;
}

export function resolveWeaponSkillId(id: string): ResolvedWeaponSkill | null {
  if (!id.startsWith("wskill:")) return null;
  const parts = id.split(":");
  if (parts.length !== 4) return null;
  const weapon = parts[1] as WeaponTypeId;
  const tierIdx = Number.parseInt(parts[2], 10);
  const skillIdx = Number.parseInt(parts[3], 10);
  if (!Number.isFinite(tierIdx) || !Number.isFinite(skillIdx)) return null;
  const tree = WEAPON_MASTERY_TREES[weapon];
  if (!tree) return null;
  const tier = tree.tiers[tierIdx];
  if (!tier) return null;
  const node = tier.skills[skillIdx];
  if (!node) return null;
  return { id, weapon, tierIdx, skillIdx, node, color: tree.color };
}

/**
 * Default 3 weapon-skill IDs for a weapon: the first 3 nodes
 * walked tier-by-tier. Returns nulls for missing trees.
 */
export function defaultWeaponSkillIds(
  weapon: WeaponTypeId | null | undefined,
): (string | null)[] {
  if (!weapon) return [null, null, null];
  const tree = WEAPON_MASTERY_TREES[weapon];
  if (!tree) return [null, null, null];
  const out: (string | null)[] = [];
  outer: for (let t = 0; t < tree.tiers.length; t += 1) {
    const skills = tree.tiers[t].skills;
    for (let s = 0; s < skills.length; s += 1) {
      out.push(encodeWeaponSkillId(weapon, t, s));
      if (out.length === 3) break outer;
    }
  }
  while (out.length < 3) out.push(null);
  return out;
}

// ---------- Class-skill IDs ----------

export const DEFAULT_CLASS_SKILL_IDS: [string, string, string] = [
  "classAbility1",
  "classAbility2",
  "classAbility3",
];

// ---------- Persisted shape ----------

export interface CombatBindings {
  weaponSkills: (string | null)[]; // length 3
  classSkills: (string | null)[];  // length 3
}

/**
 * Action bar layout (unified for combat & harvest):
 *
 *   Slots 1–4: Held-item actions — derived from whatever is in the
 *              player's hands. In combat mode these are weapon skills
 *              (from the weapon's mastery tree). In harvest mode these
 *              are tool actions (swing, dig, cast line, etc.).
 *              These 4 slots are ALWAYS driven by the held item's
 *              skill list — the player can rearrange which 4 of the
 *              available skills are slotted, but they all come from
 *              the held item.
 *
 *   Slots 5–7: Consumables / deployables — potions, food, traps,
 *              bandages, etc. These persist across mode switches.
 *              The player drags items from inventory into these slots.
 */
export interface ActionBarBindings {
  /** Slots 1–4: held-item skill IDs (weapon skills in combat, tool actions in harvest) */
  heldItemSkills: (string | null)[]; // length 4
  /** Slots 5–7: consumable/deployable item IDs from inventory */
  useItemSlots: (string | null)[];   // length 3
}

export interface LoadoutData {
  combat: CombatBindings;
  /** New unified action bar — replaces the old combat/harvest split */
  actionBar: ActionBarBindings;
  harvest: { pinnedToolIds: string[] };
  schemaVersion: number;
}

export const HOTBAR_SCHEMA_VERSION = 1;

const DEFAULT_PINNED_TOOLS = ["stone_axe", "stone_pickaxe", "torch"];

function defaultLoadout(): LoadoutData {
  return {
    combat: {
      weaponSkills: [null, null, null],
      classSkills: [...DEFAULT_CLASS_SKILL_IDS],
    },
    actionBar: {
      heldItemSkills: [null, null, null, null],
      useItemSlots: [null, null, null],
    },
    harvest: { pinnedToolIds: [...DEFAULT_PINNED_TOOLS] },
    schemaVersion: HOTBAR_SCHEMA_VERSION,
  };
}

// ---------- Store ----------

/** Compose a stable per-character cache key for the loadout
 *  identity. Used to gate persistence so we never write stale
 *  in-memory state from character A into character B's row. */
export function loadoutKey(playerId: string, characterId: string): string {
  return `${playerId}:${characterId}`;
}

interface HotbarState extends LoadoutData {
  /** Composite key (playerId:characterId) of the loadout the
   *  store currently holds. `null` means "not hydrated for any
   *  character yet" — persist must be a no-op in that case. */
  hydratedKey: string | null;
  hydrating: boolean;
  /** Monotonic token used to invalidate in-flight hydrate
   *  requests when the active character changes mid-fetch. */
  hydrateToken: number;
  serverVersion: number | null;
  lastError: string | null;

  setWeaponSkillSlot: (idx: number, skillId: string | null) => void;
  setClassSkillSlot: (idx: number, skillId: string | null) => void;
  pinTool: (itemId: string) => void;
  unpinTool: (itemId: string) => void;

  /** Set a held-item action slot (1–4, zero-indexed 0–3) */
  setHeldItemSkill: (idx: number, skillId: string | null) => void;
  /** Set a use-item slot (5–7, zero-indexed 0–2) */
  setUseItemSlot: (idx: number, itemId: string | null) => void;

  hydrate: (playerId: string, characterId: string) => Promise<void>;
  persist: (playerId: string, characterId: string) => Promise<void>;
  reset: () => void;

  /** Resolve the 3 combat weapon-skill slots, auto-filling nulls
   *  from the currently equipped main-hand weapon's mastery tree. */
  resolveWeaponSkills: () => (ResolvedWeaponSkill | null)[];
  /** Resolve the 4 held-item skill slots for the current mode,
   *  auto-filling from weapon tree (combat) or tool actions (harvest). */
  resolveHeldItemSkills: () => (ResolvedWeaponSkill | null)[];
}

export const useHotbar = create<HotbarState>((set, get) => ({
  ...defaultLoadout(),
  hydratedKey: null,
  hydrating: false,
  hydrateToken: 0,
  serverVersion: null,
  lastError: null,

  setWeaponSkillSlot: (idx, skillId) => {
    if (idx < 0 || idx > 2) return;
    set((s) => {
      const next = [...s.combat.weaponSkills];
      next[idx] = skillId;
      return { combat: { ...s.combat, weaponSkills: next } };
    });
  },

  setClassSkillSlot: (idx, skillId) => {
    if (idx < 0 || idx > 2) return;
    set((s) => {
      const next = [...s.combat.classSkills];
      next[idx] = skillId;
      return { combat: { ...s.combat, classSkills: next } };
    });
  },

  pinTool: (itemId) => set((s) => {
    if (s.harvest.pinnedToolIds.includes(itemId)) return s;
    return { harvest: { pinnedToolIds: [...s.harvest.pinnedToolIds, itemId] } };
  }),

  unpinTool: (itemId) => set((s) => ({
    harvest: { pinnedToolIds: s.harvest.pinnedToolIds.filter((id) => id !== itemId) },
  })),

  setHeldItemSkill: (idx, skillId) => {
    if (idx < 0 || idx > 3) return;
    set((s) => {
      const next = [...s.actionBar.heldItemSkills];
      next[idx] = skillId;
      return { actionBar: { ...s.actionBar, heldItemSkills: next } };
    });
  },

  setUseItemSlot: (idx, itemId) => {
    if (idx < 0 || idx > 2) return;
    set((s) => {
      const next = [...s.actionBar.useItemSlots];
      next[idx] = itemId;
      return { actionBar: { ...s.actionBar, useItemSlots: next } };
    });
  },

  hydrate: async (playerId, characterId) => {
    const key = loadoutKey(playerId, characterId);
    // Already hydrated for this exact character — nothing to do.
    if (get().hydratedKey === key) return;

    // Bump token AND clear the previous hydration key BEFORE we
    // start the fetch. Two effects of this:
    //   1. The persist effect (gated on hydratedKey === currentKey)
    //      will refuse to fire while the hydrate is in flight, so we
    //      can't clobber the new character's row with the previous
    //      character's in-memory bindings.
    //   2. Any in-flight response from the *previous* hydrate call
    //      will see its token != the current one and bail out instead
    //      of overwriting state out-of-order.
    const myToken = get().hydrateToken + 1;
    set({
      hydratedKey: null,
      hydrating: true,
      hydrateToken: myToken,
      serverVersion: null,
      lastError: null,
      // Reset bindings to defaults so we don't briefly render stale
      // bindings from the previous character while the fetch lands.
      ...defaultLoadout(),
    });

    try {
      const r = await fetch(`/api/loadouts/${encodeURIComponent(playerId)}/${encodeURIComponent(characterId)}`);
      // Stale response from a previous character switch — discard.
      if (get().hydrateToken !== myToken) return;

      if (r.status === 404) {
        // No record yet — defaults are already in place, just mark hydrated.
        set({ hydratedKey: key, hydrating: false, serverVersion: null });
        return;
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      // Re-check token after the body parse (another await boundary).
      if (get().hydrateToken !== myToken) return;

      const data = j?.loadout?.loadout_data as Partial<LoadoutData> | undefined;
      const ver  = j?.loadout?.version as number | undefined;
      if (data && typeof data === "object") {
        const merged: LoadoutData = {
          combat: {
            weaponSkills: Array.isArray(data.combat?.weaponSkills)
              ? data.combat!.weaponSkills.slice(0, 3).concat([null, null, null]).slice(0, 3)
              : [null, null, null],
            classSkills: Array.isArray(data.combat?.classSkills) && data.combat!.classSkills.length === 3
              ? data.combat!.classSkills
              : [...DEFAULT_CLASS_SKILL_IDS],
          },
          actionBar: {
            heldItemSkills: Array.isArray((data as any).actionBar?.heldItemSkills)
              ? (data as any).actionBar.heldItemSkills.slice(0, 4).concat([null, null, null, null]).slice(0, 4)
              : [null, null, null, null],
            useItemSlots: Array.isArray((data as any).actionBar?.useItemSlots)
              ? (data as any).actionBar.useItemSlots.slice(0, 3).concat([null, null, null]).slice(0, 3)
              : [null, null, null],
          },
          harvest: {
            pinnedToolIds: Array.isArray(data.harvest?.pinnedToolIds)
              ? data.harvest!.pinnedToolIds.filter((x): x is string => typeof x === "string")
              : [...DEFAULT_PINNED_TOOLS],
          },
          schemaVersion: HOTBAR_SCHEMA_VERSION,
        };
        set({
          ...merged,
          hydratedKey: key,
          hydrating: false,
          serverVersion: ver ?? null,
        });
      } else {
        set({ hydratedKey: key, hydrating: false, serverVersion: ver ?? null });
      }
    } catch (e: any) {
      // Stale response — silently ignore.
      if (get().hydrateToken !== myToken) return;
      // Non-fatal: keep defaults but mark hydrated for this key so
      // local edits can still persist (server will create on PUT).
      set({
        hydratedKey: key,
        hydrating: false,
        lastError: e?.message ?? "hydrate failed",
      });
    }
  },

  persist: async (playerId, characterId) => {
    const s = get();
    // Refuse to persist if we haven't hydrated for THIS exact
    // character. Without this, switching from character A to B
    // would let the (still in-memory) bindings from A be written
    // into B's row before B's hydrate completes.
    if (s.hydratedKey !== loadoutKey(playerId, characterId)) return;
    const body = {
      loadoutData: {
        combat: s.combat,
        actionBar: s.actionBar,
        harvest: s.harvest,
        schemaVersion: HOTBAR_SCHEMA_VERSION,
      } satisfies LoadoutData,
      expectedVersion: s.serverVersion ?? undefined,
    };
    try {
      const r = await fetch(
        `/api/loadouts/${encodeURIComponent(playerId)}/${encodeURIComponent(characterId)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!r.ok) {
        const txt = await r.text().catch(() => "");
        // 409 = stale version — drop expectedVersion and retry once,
        // adopting whatever the server has as our new baseline.
        if (r.status === 409) {
          const r2 = await fetch(
            `/api/loadouts/${encodeURIComponent(playerId)}/${encodeURIComponent(characterId)}`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...body, expectedVersion: undefined }),
            },
          );
          if (!r2.ok) throw new Error(`HTTP ${r2.status}`);
          const j2 = await r2.json();
          set({ serverVersion: j2?.loadout?.version ?? null });
          return;
        }
        throw new Error(`HTTP ${r.status}: ${txt.slice(0, 120)}`);
      }
      const j = await r.json();
      set({ serverVersion: j?.loadout?.version ?? null, lastError: null });
    } catch (e: any) {
      set({ lastError: e?.message ?? "persist failed" });
    }
  },

  reset: () => set({
    ...defaultLoadout(),
    hydratedKey: null,
    hydrating: false,
    hydrateToken: get().hydrateToken + 1,
    serverVersion: null,
    lastError: null,
  }),

  resolveWeaponSkills: () => {
    const s = get();
    const equipped = useEquipment.getState().equipped.mainHand;
    const equippedType = equipped?.weaponType as WeaponTypeId | undefined;
    const fallback = defaultWeaponSkillIds(equippedType);
    return s.combat.weaponSkills.map((id, i) => {
      const effective = id ?? fallback[i];
      return effective ? resolveWeaponSkillId(effective) : null;
    });
  },

  resolveHeldItemSkills: () => {
    const s = get();
    const equipped = useEquipment.getState().equipped.mainHand;
    const equippedType = equipped?.weaponType as WeaponTypeId | undefined;
    // Build a 4-slot fallback from the weapon's mastery tree
    const fallbackIds: (string | null)[] = [];
    if (equippedType) {
      const tree = WEAPON_MASTERY_TREES[equippedType];
      if (tree) {
        outer: for (let t = 0; t < tree.tiers.length; t++) {
          for (let sk = 0; sk < tree.tiers[t].skills.length; sk++) {
            fallbackIds.push(encodeWeaponSkillId(equippedType, t, sk));
            if (fallbackIds.length === 4) break outer;
          }
        }
      }
    }
    while (fallbackIds.length < 4) fallbackIds.push(null);

    return s.actionBar.heldItemSkills.map((id, i) => {
      const effective = id ?? fallbackIds[i];
      return effective ? resolveWeaponSkillId(effective) : null;
    });
  },
}));
