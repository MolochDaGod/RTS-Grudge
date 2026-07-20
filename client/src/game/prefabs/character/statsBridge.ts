/**
 * Bridge prefab uppercase stats → canonical PrimaryAttributes (lowercase ids).
 * Legacy LCK → TAC, legacy CHA → AGI per ObjectStore master-attributes.json removedStats.
 */

import { computeSecondaryStats } from "@/lib/stores/attributeFormulas";
import type { PrimaryAttributes } from "@/lib/stores/characterTypes";
import type { StatsAllocation } from "./types";

type LegacyStats = StatsAllocation & {
  LCK?: number;
  CHA?: number;
};

/** Normalize legacy 8-stat saves (LCK/CHA) into canonical AGI/TAC. */
export function normalizeStatsAllocation(attrs: StatsAllocation): StatsAllocation {
  const a = attrs as LegacyStats;
  return {
    STR: a.STR ?? 20,
    DEX: a.DEX ?? 20,
    INT: a.INT ?? 20,
    VIT: a.VIT ?? 20,
    WIS: a.WIS ?? 20,
    END: a.END ?? 20,
    AGI: a.AGI ?? a.CHA ?? 20,
    TAC: a.TAC ?? a.LCK ?? 20,
  };
}

export function statsAllocationToPrimary(attrs: StatsAllocation): PrimaryAttributes {
  const n = normalizeStatsAllocation(attrs);
  return {
    strength: n.STR,
    vitality: n.VIT,
    endurance: n.END,
    intellect: n.INT,
    wisdom: n.WIS,
    dexterity: n.DEX,
    agility: n.AGI,
    tactics: n.TAC,
  };
}

export interface PrefabDerivedStats {
  maxHp: number;
  maxStamina: number;
  maxMana: number;
  attackPower: number;
  defense: number;
  magicPower: number;
  magicDefense: number;
  critChance: number;
  critDamage: number;
  moveSpeed: number;
  attackSpeed: number;
  dodgeChance: number;
  blockChance: number;
}

/** Canonical derived stats for the prefab combat layer (level ≈ 1 + tier). */
export function computePrefabDerivedStats(attrs: StatsAllocation, tier: number): PrefabDerivedStats {
  const level = Math.max(1, 1 + tier);
  const s = computeSecondaryStats(statsAllocationToPrimary(attrs), level);

  return {
    maxHp: Math.floor(s.health),
    maxStamina: Math.floor(s.stamina),
    maxMana: Math.floor(s.mana),
    attackPower: Math.floor(s.damage),
    defense: Math.floor(s.defense),
    magicPower: Math.floor(s.damage * 0.85 + s.spellAccuracy * 0.1),
    magicDefense: Math.floor(s.resistance),
    critChance: Math.min(0.75, s.critChance / 100),
    critDamage: s.critDamage / 100,
    moveSpeed: 5.0 * s.movementSpeed,
    attackSpeed: s.attackSpeed,
    dodgeChance: Math.min(0.5, s.evasion / 100),
    blockChance: Math.min(0.75, s.block / 100),
  };
}