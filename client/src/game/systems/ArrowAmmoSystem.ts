/**
 * ArrowAmmoSystem — Tiered arrow/bolt ammunition with effect-colored
 * trails and status effect procs.
 *
 * Arrow types determine:
 *   1. Which 3D model is used for the projectile in flight
 *   2. Trail particle color (green/red/blue/yellow/purple)
 *   3. What status effect procs on hit
 *   4. Damage bonus on top of the bow's base
 *   5. Which tier of resources are needed to craft
 *
 * Available arrow models:
 *   - Craftpix arrows: arrow_1 to arrow_24 (GLB + FBX)
 *   - Craftpix bow arrows: _arrow_b_1 to _arrow_b_24 (FBX)
 *   - Craftpix crossbow bolts: _arrow_c_1 to _arrow_c_24 (FBX)
 *   - KayKit: arrow_A, arrow_B (GLB)
 *   - Kickin It: Blunt, Broadhead, Bullet, Piercing (FBX)
 *   - Weapon Pack: Blunt, Broadhead, Bullet, Medieval, Piercing (GLB)
 *   - Quaternius: Arrow (GLB)
 */

import type { WeaponTier } from "./WeaponPrefabDatabase";
import type { EffectId } from "./StatusEffectEngine";

// ---------------------------------------------------------------------------
// Arrow effect types — determines trail color and proc
// ---------------------------------------------------------------------------

export type ArrowEffect =
  | "standard"   // white trail, no proc
  | "bleed"      // red trail, bleed proc
  | "poison"     // green trail, poison proc
  | "frost"      // blue trail, slow/freeze proc
  | "fire"       // yellow/orange trail, burn proc
  | "arcane"     // purple trail, silence proc
  | "explosive"  // orange trail, AoE on impact
  | "piercing";  // white-blue trail, armor pen bonus

export const ARROW_EFFECT_COLORS: Record<ArrowEffect, number> = {
  standard:  0xddccaa,
  bleed:     0xff2222,
  poison:    0x33cc33,
  frost:     0x44aaff,
  fire:      0xffaa00,
  arcane:    0x9944ff,
  explosive: 0xff6600,
  piercing:  0xaaddff,
};

export const ARROW_EFFECT_PROCS: Record<ArrowEffect, { effectId: EffectId; chance: number } | null> = {
  standard:  null,
  bleed:     { effectId: "bleed", chance: 0.3 },
  poison:    { effectId: "poison", chance: 0.25 },
  frost:     { effectId: "slow", chance: 0.2 },
  fire:      { effectId: "burn", chance: 0.2 },
  arcane:    { effectId: "silence", chance: 0.15 },
  explosive: null, // handled separately via AoE
  piercing:  null, // flat armor pen bonus
};

// ---------------------------------------------------------------------------
// Arrow prefab
// ---------------------------------------------------------------------------

export interface ArrowPrefab {
  id: string;
  name: string;
  tier: WeaponTier;
  effect: ArrowEffect;
  /** Model path for the projectile in flight */
  modelPath: string;
  modelFormat: "glb" | "fbx";
  /** Damage bonus added to the bow's base */
  damageBonus: number;
  /** Armor penetration bonus (flat) */
  armorPenBonus: number;
  /** Trail color (hex) */
  trailColor: number;
  /** Crafting ingredients */
  craftCost: { itemId: string; count: number }[];
  /** Quantity produced per craft */
  craftYield: number;
  /** Icon for inventory */
  icon: string;
  /** Quiver model (Arrow_Bag.glb) */
  quiverModel: string;
}

// ---------------------------------------------------------------------------
// Arrow registry — 8 tiers × 8 effects = 64 arrow types
// ---------------------------------------------------------------------------

function makeArrow(
  tier: WeaponTier,
  effect: ArrowEffect,
  modelIdx: number,
  namePrefix: string,
): ArrowPrefab {
  const tierNames = ["Crude", "Iron", "Steel", "Mithril", "Obsidian", "Dragon", "Celestial", "Ancient", "Divine"];
  const effectNames: Record<ArrowEffect, string> = {
    standard: "", bleed: "Rending", poison: "Venomous", frost: "Frost",
    fire: "Flame", arcane: "Arcane", explosive: "Blast", piercing: "Piercing",
  };

  const tierMult = [0.5, 1, 1.3, 1.6, 2, 2.5, 3, 3.5, 4][tier];
  const effectLabel = effectNames[effect] ? ` ${effectNames[effect]}` : "";
  const name = `${tierNames[tier]}${effectLabel} ${namePrefix}`;

  // Pick model based on tier — low tiers use simpler models
  const modelPaths = [
    `/models/weapons/arrows/arrow_${modelIdx}.glb`,      // T0-T2: craftpix basic
    `/models/weapon_pack/Medieval_Arrow.glb`,             // T3: medieval
    `/models/weapon_pack/Broadhead_Arrow.glb`,            // T4: broadhead
    `/models/weapon_pack/Piercing_Arrow.glb`,             // T5: piercing
    `/models/weapon_pack/Bullet_Arrow.glb`,               // T6: bullet
    `/models/kaykit_weapons/arrow_A.glb`,                 // T7: kaykit A
    `/models/kaykit_weapons/arrow_B.glb`,                 // T8: kaykit B
  ];
  const modelPath = tier <= 2 ? modelPaths[0] : modelPaths[Math.min(tier - 2, modelPaths.length - 1)];

  // Craft costs scale with tier
  const baseMats: { itemId: string; count: number }[] = [
    { itemId: "wood", count: 2 + tier },
    { itemId: tier <= 2 ? "stone" : tier <= 5 ? "iron_ore" : "crystal", count: 1 + tier },
  ];
  // Effect-specific additional material
  const effectMats: Partial<Record<ArrowEffect, { itemId: string; count: number }>> = {
    poison: { itemId: "herb", count: 2 + tier },
    fire:   { itemId: "wood", count: 3 + tier },
    frost:  { itemId: "crystal", count: 1 + Math.floor(tier / 2) },
    arcane: { itemId: "crystal", count: 2 + tier },
    bleed:  { itemId: "iron_ore", count: 1 + Math.floor(tier / 2) },
  };
  const extraMat = effectMats[effect];
  if (extraMat) baseMats.push(extraMat);

  return {
    id: `arrow_${effect}_t${tier}`,
    name,
    tier,
    effect,
    modelPath,
    modelFormat: "glb",
    damageBonus: Math.round(2 * tierMult),
    armorPenBonus: effect === "piercing" ? Math.round(5 * tierMult) : 0,
    trailColor: ARROW_EFFECT_COLORS[effect],
    craftCost: baseMats,
    craftYield: 10 + tier * 5,
    icon: effect === "fire" ? "🔥" : effect === "poison" ? "☠️" : effect === "frost" ? "❄️" : effect === "arcane" ? "💜" : effect === "bleed" ? "🩸" : effect === "explosive" ? "💥" : effect === "piercing" ? "🎯" : "🏹",
    quiverModel: "/models/weapon_pack/Arrow_Bag.glb",
  };
}

// Build the full registry
const EFFECTS: ArrowEffect[] = ["standard", "bleed", "poison", "frost", "fire", "arcane", "explosive", "piercing"];
const TIERS: WeaponTier[] = [0, 1, 2, 3, 4, 5, 6, 7, 8];

export const ALL_ARROWS: ArrowPrefab[] = [];
for (const tier of TIERS) {
  for (const effect of EFFECTS) {
    const modelIdx = Math.min(1 + tier * 3 + EFFECTS.indexOf(effect), 24);
    ALL_ARROWS.push(makeArrow(tier, effect, modelIdx, "Arrow"));
  }
}

// Also add crossbow bolts (same stats, different models)
export const ALL_BOLTS: ArrowPrefab[] = [];
for (const tier of TIERS) {
  for (const effect of EFFECTS) {
    const bolt = makeArrow(tier, effect, Math.min(1 + tier * 3, 24), "Bolt");
    bolt.id = `bolt_${effect}_t${tier}`;
    bolt.modelPath = `/models/weapons/crossbows_fbx/_arrow_c_${Math.min(1 + tier * 3, 24)}.fbx`;
    bolt.modelFormat = "fbx";
    ALL_BOLTS.push(bolt);
  }
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

export function getArrowsByTier(tier: WeaponTier): ArrowPrefab[] {
  return ALL_ARROWS.filter(a => a.tier === tier);
}

export function getArrowsByEffect(effect: ArrowEffect): ArrowPrefab[] {
  return ALL_ARROWS.filter(a => a.effect === effect);
}

export function getArrow(effect: ArrowEffect, tier: WeaponTier): ArrowPrefab | undefined {
  return ALL_ARROWS.find(a => a.effect === effect && a.tier === tier);
}

export function getBolt(effect: ArrowEffect, tier: WeaponTier): ArrowPrefab | undefined {
  return ALL_BOLTS.find(a => a.effect === effect && a.tier === tier);
}

export function getAmmoForWeapon(weaponType: "bow" | "crossbow", effect: ArrowEffect, tier: WeaponTier): ArrowPrefab | undefined {
  return weaponType === "crossbow" ? getBolt(effect, tier) : getArrow(effect, tier);
}

/** Get the trail particle config for an arrow in flight */
export function getArrowTrailConfig(arrow: ArrowPrefab): {
  colorStart: number;
  colorEnd: number;
  particleRate: number;
  sizeStart: number;
} {
  const base = ARROW_EFFECT_COLORS[arrow.effect];
  return {
    colorStart: base,
    colorEnd: base & 0x333333,
    particleRate: arrow.effect === "standard" ? 10 : 20,
    sizeStart: arrow.effect === "explosive" ? 0.15 : 0.08,
  };
}

/** Total arrow + bolt count */
export function getAmmoCount(): number {
  return ALL_ARROWS.length + ALL_BOLTS.length;
}
