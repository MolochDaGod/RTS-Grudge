import { useCharacterStats } from "@/lib/stores/useCharacterStats";
import { useEquipment } from "@/lib/stores/useEquipment";
import { useInventory } from "@/lib/stores/useInventory";
import { useSurvival } from "@/lib/stores/useSurvival";
import { useMissions } from "@/lib/stores/useMissions";
import { useProfessions } from "@/lib/stores/useProfessions";
import { usePets } from "@/lib/stores/usePets";
import { useBuildingStorage } from "@/lib/stores/useBuildingStorage";
import { useGame } from "@/lib/stores/useGame";
import { getPlayerId } from "./playerId";

/**
 * Pulls plain-data fields out of every store we care about and bundles them
 * into a JSON-safe payload. Keep this list small and explicit — Zustand
 * actions, Maps and Sets do not survive JSON.stringify and we don't want
 * "save bloat" creeping in by accident.
 */
export interface GameSnapshot {
  schemaVersion: 1;
  timestamp: number;
  characterStats: { heroes: Record<string, unknown> };
  equipment: {
    equipped: unknown;
    actionSlots: unknown;
    /** Added in server-side migration — absent in legacy saves. */
    gold?: number;
    level?: number;
    experience?: number;
    experienceToNext?: number;
    mana?: number;
    maxMana?: number;
  };
  inventory: { items: unknown; maxSlots: number };
  survival: {
    health: number; maxHealth: number;
    hunger: number; maxHunger: number;
    stamina: number; maxStamina: number;
    isAlive: boolean;
    activeCharacterId: string | null;
  };
  /** Phase 1 consolidation — absent in pre-consolidation saves. */
  missions?: {
    active: unknown[];
    completed: string[];
    rotations: Record<string, unknown>;
  };
  professions?: Record<string, unknown>;
  pets?: {
    pets: unknown[];
    furnacePending: unknown | null;
  };
  buildingStorage?: Record<string, unknown[]>;
  /** World position — which sub-scene the player was in, and where. */
  worldContext?: {
    inTutorialIsland: boolean;
    spawnX?: number;
    spawnZ?: number;
  };
}

export function snapshotGame(): GameSnapshot {
  const cs = useCharacterStats.getState();
  const eq = useEquipment.getState();
  const inv = useInventory.getState();
  const sv = useSurvival.getState();
  return {
    schemaVersion: 1,
    timestamp: Date.now(),
    characterStats: { heroes: cs.heroes },
    equipment: {
      equipped: eq.equipped,
      actionSlots: eq.actionSlots,
      gold: eq.gold,
      level: eq.level,
      experience: eq.experience,
      experienceToNext: eq.experienceToNext,
      mana: eq.mana,
      maxMana: eq.maxMana,
    },
    inventory: { items: inv.items, maxSlots: inv.maxSlots },
    survival: {
      health: sv.health, maxHealth: sv.maxHealth,
      hunger: sv.hunger, maxHunger: sv.maxHunger,
      stamina: sv.stamina, maxStamina: sv.maxStamina,
      isAlive: sv.isAlive,
      activeCharacterId: sv.activeCharacterId,
    },
    // Phase 1 consolidation — gameplay stores that were previously localStorage-only
    missions: (() => {
      const ms = useMissions.getState();
      const rotObj: Record<string, unknown> = {};
      for (const [k, v] of ms.rotations) rotObj[k] = v;
      return {
        active: Array.from(ms.active.values()),
        completed: Array.from(ms.completed),
        rotations: rotObj,
      };
    })(),
    professions: useProfessions.getState().professions,
    pets: (() => {
      const ps = usePets.getState();
      return { pets: ps.pets, furnacePending: ps.furnacePending };
    })(),
    buildingStorage: useBuildingStorage.getState().chests,
    worldContext: (() => {
      const gm = useGame.getState();
      return {
        inTutorialIsland: !!gm.inTutorialIsland,
        spawnX: (gm as any).playerPosition?.x,
        spawnZ: (gm as any).playerPosition?.z,
      };
    })(),
  };
}

export function restoreGame(snapshot: GameSnapshot): void {
  if (!snapshot || snapshot.schemaVersion !== 1) {
    console.warn("[save] Unknown snapshot version; refusing to restore", snapshot);
    return;
  }
  try {
    useCharacterStats.setState({ heroes: snapshot.characterStats.heroes as any });
    useEquipment.setState({
      equipped: snapshot.equipment.equipped as any,
      actionSlots: snapshot.equipment.actionSlots as any,
      // Fields added in server-side migration; gracefully default for legacy saves.
      ...(snapshot.equipment.gold        != null && { gold: snapshot.equipment.gold }),
      ...(snapshot.equipment.level       != null && { level: snapshot.equipment.level }),
      ...(snapshot.equipment.experience  != null && { experience: snapshot.equipment.experience }),
      ...(snapshot.equipment.experienceToNext != null && { experienceToNext: snapshot.equipment.experienceToNext }),
      ...(snapshot.equipment.mana        != null && { mana: snapshot.equipment.mana }),
      ...(snapshot.equipment.maxMana     != null && { maxMana: snapshot.equipment.maxMana }),
    });
    useInventory.setState({
      items: snapshot.inventory.items as any,
      maxSlots: snapshot.inventory.maxSlots,
    });
    useSurvival.setState({
      health: snapshot.survival.health,
      maxHealth: snapshot.survival.maxHealth,
      hunger: snapshot.survival.hunger,
      maxHunger: snapshot.survival.maxHunger,
      stamina: snapshot.survival.stamina,
      maxStamina: snapshot.survival.maxStamina,
      isAlive: snapshot.survival.isAlive,
      activeCharacterId: snapshot.survival.activeCharacterId,
    });
    // Phase 1 consolidation — restore gameplay stores (absent in legacy saves)
    if (snapshot.missions) {
      const activeMap = new Map(
        (snapshot.missions.active as any[]).map((m: any) => [m.missionId, m])
      );
      const completedSet = new Set(snapshot.missions.completed);
      const rotMap = new Map(
        Object.entries(snapshot.missions.rotations)
      );
      useMissions.setState({
        active: activeMap as any,
        completed: completedSet as any,
        rotations: rotMap as any,
      });
    }
    if (snapshot.professions) {
      useProfessions.setState({ professions: snapshot.professions as any });
    }
    if (snapshot.pets) {
      usePets.setState({
        pets: snapshot.pets.pets as any,
        furnacePending: snapshot.pets.furnacePending as any,
      });
    }
    if (snapshot.buildingStorage) {
      useBuildingStorage.setState({ chests: snapshot.buildingStorage as any });
    }
    if (snapshot.worldContext) {
      useGame.setState({ inTutorialIsland: snapshot.worldContext.inTutorialIsland });
    }
    console.log("[save] Restored snapshot from", new Date(snapshot.timestamp).toLocaleString());
  } catch (e) {
    console.error("[save] Restore failed", e);
  }
}

export interface SaveSummary {
  player_id: string;
  slot: number;
  character_id: string | null;
  character_name: string | null;
  character_class: string | null;
  character_race: string | null;
  level: number;
  play_seconds: number;
  version: number;
  updated_at: string;
}

export interface SaveRecord extends SaveSummary {
  save_data: GameSnapshot;
}

function activeHeroSummary(snap: GameSnapshot) {
  const sv = snap.survival;
  const heroes = snap.characterStats.heroes as Record<string, any>;
  const id = sv.activeCharacterId || Object.keys(heroes)[0] || null;
  const hero = id ? heroes[id] : null;
  return {
    characterId: id,
    characterName: id ?? null,
    characterClass: hero?.heroClass ?? null,
    level: hero?.level ?? 1,
  };
}

export async function listSavesRemote(): Promise<SaveSummary[]> {
  const r = await fetch(`/api/saves/${encodeURIComponent(getPlayerId())}`);
  if (!r.ok) throw new Error(`listSaves failed (${r.status})`);
  const j = await r.json();
  return j.saves || [];
}

export async function loadSlot(slot: number): Promise<SaveRecord | null> {
  const r = await fetch(`/api/saves/${encodeURIComponent(getPlayerId())}/${slot}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`loadSlot failed (${r.status})`);
  const j = await r.json();
  return j.save;
}

export async function saveSlot(
  slot: number,
  opts: { expectedVersion?: number; playSeconds?: number } = {},
): Promise<SaveRecord> {
  const snap = snapshotGame();
  const summary = activeHeroSummary(snap);
  const r = await fetch(
    `/api/saves/${encodeURIComponent(getPlayerId())}/${slot}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...summary,
        playSeconds: opts.playSeconds,
        expectedVersion: opts.expectedVersion,
        saveData: snap,
      }),
    },
  );
  if (r.status === 409) {
    const j = await r.json();
    throw new Error(`Save conflict (server v${j.current?.version}). Reload then try again.`);
  }
  if (!r.ok) throw new Error(`saveSlot failed (${r.status})`);
  const j = await r.json();
  return j.save;
}

export async function deleteSlot(slot: number): Promise<boolean> {
  const r = await fetch(
    `/api/saves/${encodeURIComponent(getPlayerId())}/${slot}`,
    { method: "DELETE" },
  );
  if (!r.ok) throw new Error(`deleteSlot failed (${r.status})`);
  const j = await r.json();
  return !!j.removed;
}
