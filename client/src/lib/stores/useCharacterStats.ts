// ── useCharacterStats — Zustand store ────────────────────────────────────────
// All game-data, formulas, and type definitions have been extracted into
// sibling modules. This file is now the thin Zustand store plus re-exports
// so existing `import { … } from "…/useCharacterStats"` statements keep working.

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

// ── Re-exports (backward compat) ─────────────────────────────────────────────
export type { HeroClass, HeroRace, PrimaryAttributes, SecondaryStats, SkillNode, SkillEffect, HeroStatBlock, HeroDefinition } from "./characterTypes";
export { computeSecondaryStats, ATTR_GAINS, STAT_CAPS, RESOURCE_STATS, effectivePoints } from "./attributeFormulas";
export { computeDamageReduction, rollCrit, rollDodge, rollBlock, computeCombatDamage, synthesizeEnemyDefender } from "./combatFormulas";
export { CDN, RACE_BONUSES, CLASS_LABELS, HERO_DEFINITIONS, getHeroDefinition,
  CLASS_BASE_ATTRIBUTES, HERO_RACES, HERO_CLASSES, isHeroRace, isHeroClass,
  synthesizeHeroDefinition, getOrCreateHeroDefinition } from "./heroDefinitions";
export { CLASS_SKILL_TREES, WEAPON_MASTERY_NODES } from "./skillTreeData";
export { xpForLevel, attributePointsForLevel, skillPointsForLevel, HERO_MAX_LEVEL } from "./levelFormulas";
export { SECONDARY_STAT_LABELS, ATTRIBUTE_EFFECTS, ATTRIBUTE_ICON_BASE, ATTRIBUTE_ICON_ALTS } from "./statLabels";

// ── Internal imports for the store ───────────────────────────────────────────
import type { PrimaryAttributes, SecondaryStats, HeroClass, HeroRace, HeroStatBlock } from "./characterTypes";
import { computeSecondaryStats } from "./attributeFormulas";
import { getHeroDefinition, RACE_BONUSES, synthesizeHeroDefinition } from "./heroDefinitions";
import { CLASS_SKILL_TREES, WEAPON_MASTERY_NODES } from "./skillTreeData";
import { xpForLevel, attributePointsForLevel, skillPointsForLevel, HERO_MAX_LEVEL } from "./levelFormulas";

// ── Store interface ──────────────────────────────────────────────────────────
interface CharacterStatsState {
  heroes: Record<string, HeroStatBlock>;

  initHero: (characterId: string) => void;
  /**
   * Initialize (or re-identify) a hero from the 6-race x 4-class structure.
   * Pass the player character's race + heroClass so the correct class baseline
   * and race bonuses apply. Preserves progression when the class is unchanged.
   */
  initHeroFromConfig: (characterId: string, opts?: { race?: HeroRace; heroClass?: HeroClass; force?: boolean }) => void;
  allocateAttribute: (characterId: string, attr: keyof PrimaryAttributes, points: number) => void;
  resetAttributes: (characterId: string) => void;
  randomizeAttributes: (characterId: string) => void;
  learnSkill: (characterId: string, skillId: string) => boolean;
  resetSkills: (characterId: string) => void;
  addExperience: (characterId: string, amount: number) => void;
  getSecondaryStats: (characterId: string) => SecondaryStats | null;
  getSkillTree: (characterId: string) => import("./characterTypes").SkillNode[];
  getHeroClass: (characterId: string) => HeroClass | null;
  getHero: (characterId: string) => HeroStatBlock | null;
  hasSpecial: (characterId: string, specialId: string) => boolean;
  getSpecialRank: (characterId: string, specialId: string) => number;
}

export const useCharacterStats = create<CharacterStatsState>()(
  subscribeWithSelector((set, get) => ({
    heroes: {},

    initHero: (characterId: string) => {
      const def = getHeroDefinition(characterId);
      if (!def) return;
      const existing = get().heroes[characterId];
      if (existing) return;

      const level = 1;
      const hero: HeroStatBlock = {
        characterId,
        heroClass: def.heroClass,
        race: def.race,
        level,
        experience: 0,
        experienceToNext: xpForLevel(level + 1),
        attributePointsSpent: 0,
        attributePointsMax: attributePointsForLevel(level),
        attributes: { ...def.baseAttributes },
        baseAttributes: { ...def.baseAttributes },
        skillPoints: skillPointsForLevel(level),
        skillPointsTotal: skillPointsForLevel(level),
        skills: {},
      };

      set(state => ({ heroes: { ...state.heroes, [characterId]: hero } }));
    },

    initHeroFromConfig: (characterId, opts) => {
      const race = opts?.race;
      const heroClass = opts?.heroClass;
      // Prefer an explicit race + class (the 6x4 player-character structure)
      // over a static preset so any of the 24 combos initializes with the right
      // class baseline + race identity. Fall back to a named preset by id.
      const def = (race && heroClass)
        ? synthesizeHeroDefinition(race, heroClass, characterId)
        : getHeroDefinition(characterId);
      if (!def) return;

      set(state => {
        const existing = state.heroes[characterId];
        // Same class already in play: preserve the player's progression and
        // only sync race so the correct RACE_BONUSES apply. A class change
        // (different character) rebuilds a fresh level-1 block.
        if (existing && !opts?.force && existing.heroClass === def.heroClass) {
          if (existing.race === def.race) return state;
          return { heroes: { ...state.heroes, [characterId]: { ...existing, race: def.race } } };
        }
        const level = 1;
        const hero: HeroStatBlock = {
          characterId,
          heroClass: def.heroClass,
          race: def.race,
          level,
          experience: 0,
          experienceToNext: xpForLevel(level + 1),
          attributePointsSpent: 0,
          attributePointsMax: attributePointsForLevel(level),
          attributes: { ...def.baseAttributes },
          baseAttributes: { ...def.baseAttributes },
          skillPoints: skillPointsForLevel(level),
          skillPointsTotal: skillPointsForLevel(level),
          skills: {},
        };
        return { heroes: { ...state.heroes, [characterId]: hero } };
      });
    },

    allocateAttribute: (characterId, attr, points) => {
      set(state => {
        const hero = state.heroes[characterId];
        if (!hero) return state;
        const remaining = hero.attributePointsMax - hero.attributePointsSpent;
        const toAdd = Math.min(points, remaining);
        if (toAdd <= 0) return state;

        return {
          heroes: {
            ...state.heroes,
            [characterId]: {
              ...hero,
              attributes: { ...hero.attributes, [attr]: hero.attributes[attr] + toAdd },
              attributePointsSpent: hero.attributePointsSpent + toAdd,
            },
          },
        };
      });
    },

    resetAttributes: (characterId) => {
      set(state => {
        const hero = state.heroes[characterId];
        if (!hero) return state;
        return {
          heroes: {
            ...state.heroes,
            [characterId]: {
              ...hero,
              attributes: { ...hero.baseAttributes },
              attributePointsSpent: 0,
            },
          },
        };
      });
    },

    randomizeAttributes: (characterId) => {
      set(state => {
        const hero = state.heroes[characterId];
        if (!hero) return state;
        const remaining = hero.attributePointsMax - hero.attributePointsSpent;
        const attrs = { ...hero.attributes };
        const keys: (keyof PrimaryAttributes)[] = ["strength", "vitality", "endurance", "intellect", "wisdom", "dexterity", "agility", "tactics"];
        let left = remaining;
        for (let i = 0; i < left; i++) {
          const key = keys[Math.floor(Math.random() * keys.length)];
          attrs[key]++;
        }
        return {
          heroes: {
            ...state.heroes,
            [characterId]: {
              ...hero,
              attributes: attrs,
              attributePointsSpent: hero.attributePointsMax,
            },
          },
        };
      });
    },

    learnSkill: (characterId, skillId) => {
      const state = get();
      const hero = state.heroes[characterId];
      if (!hero || hero.skillPoints <= 0) return false;

      const tree = get().getSkillTree(characterId);
      const node = tree.find(n => n.id === skillId);
      if (!node) return false;

      const currentRank = hero.skills[skillId] || 0;
      if (currentRank >= node.maxRank) return false;

      for (const req of node.requires) {
        const reqNode = tree.find(n => n.id === req);
        if (!reqNode) return false;
        const reqRank = hero.skills[req] || 0;
        if (reqRank < 1) return false;
      }

      set(s => ({
        heroes: {
          ...s.heroes,
          [characterId]: {
            ...hero,
            skills: { ...hero.skills, [skillId]: currentRank + 1 },
            skillPoints: hero.skillPoints - 1,
          },
        },
      }));
      return true;
    },

    resetSkills: (characterId) => {
      set(state => {
        const hero = state.heroes[characterId];
        if (!hero) return state;
        return {
          heroes: {
            ...state.heroes,
            [characterId]: {
              ...hero,
              skills: {},
              skillPoints: hero.skillPointsTotal,
            },
          },
        };
      });
    },

    addExperience: (characterId, amount) => {
      set(state => {
        const hero = state.heroes[characterId];
        if (!hero) return state;
        let newXP = hero.experience + amount;
        let newLevel = hero.level;
        let nextXP = hero.experienceToNext;

        while (newXP >= nextXP && newLevel < HERO_MAX_LEVEL) {
          newXP -= nextXP;
          newLevel++;
          nextXP = xpForLevel(newLevel + 1);
        }

        // Heroes finish their build at HERO_MAX_LEVEL. At the cap, stop accruing
        // toward a non-existent next level and present a full bar
        // (experience === experienceToNext) rather than "0/next".
        if (newLevel >= HERO_MAX_LEVEL) {
          newLevel = HERO_MAX_LEVEL;
          const capXP = xpForLevel(HERO_MAX_LEVEL);
          newXP = capXP;
          nextXP = capXP;
        }

        const newAttrMax = attributePointsForLevel(newLevel);
        const newSkillTotal = skillPointsForLevel(newLevel);
        const skillGain = newSkillTotal - hero.skillPointsTotal;

        return {
          heroes: {
            ...state.heroes,
            [characterId]: {
              ...hero,
              experience: newXP,
              level: newLevel,
              experienceToNext: nextXP,
              attributePointsMax: newAttrMax,
              skillPoints: hero.skillPoints + skillGain,
              skillPointsTotal: newSkillTotal,
            },
          },
        };
      });
    },

    getSecondaryStats: (characterId) => {
      const hero = get().heroes[characterId];
      if (!hero) return null;

      const def = getHeroDefinition(characterId);
      // Prefer the race stored on the hero block (set for synthesized 6x4
      // player characters); fall back to the static preset's race.
      const raceKey = hero.race ?? def?.race;
      const effectiveAttrs = { ...hero.attributes };
      if (raceKey && RACE_BONUSES[raceKey]?.bonuses) {
        for (const [attr, bonus] of Object.entries(RACE_BONUSES[raceKey].bonuses)) {
          effectiveAttrs[attr as keyof PrimaryAttributes] += bonus as number;
        }
      }

      const base = computeSecondaryStats(effectiveAttrs, hero.level);

      const tree = get().getSkillTree(characterId);
      for (const node of tree) {
        const rank = hero.skills[node.id] || 0;
        if (rank <= 0) continue;
        for (const eff of node.effects) {
          if (!eff.stat) continue;
          if (eff.type === "flat") {
            (base[eff.stat] as number) += eff.value * rank;
          } else if (eff.type === "percent") {
            (base[eff.stat] as number) *= 1 + (eff.value * rank) / 100;
          }
        }
      }

      base.combatPower = Math.round(
        base.damage * 2 + base.defense + base.health * 0.1 + base.mana * 0.05 +
        base.critChance * 3 + base.block * 2 + base.dodge * 2.5 +
        base.attackSpeed * 50 + base.armor * 0.5 + base.resistance * 0.5 + hero.level * 10
      );

      return base;
    },

    getSkillTree: (characterId) => {
      const hero = get().heroes[characterId];
      if (!hero) return [];
      const classTree = CLASS_SKILL_TREES[hero.heroClass] || [];
      return [...classTree, ...WEAPON_MASTERY_NODES].map(node => ({
        ...node,
        currentRank: hero.skills[node.id] || 0,
      }));
    },

    getHeroClass: (characterId) => {
      // Prefer the live hero block (reflects the chosen 6x4 class) over the
      // static preset, which may not exist for synthesized player characters.
      return get().heroes[characterId]?.heroClass ?? getHeroDefinition(characterId)?.heroClass ?? null;
    },

    getHero: (characterId) => {
      return get().heroes[characterId] || null;
    },

    hasSpecial: (characterId, specialId) => {
      const hero = get().heroes[characterId];
      if (!hero) return false;
      const tree = get().getSkillTree(characterId);
      for (const node of tree) {
        const rank = hero.skills[node.id] || 0;
        if (rank <= 0) continue;
        for (const eff of node.effects) {
          if (eff.specialId === specialId) return true;
        }
      }
      return false;
    },

    getSpecialRank: (characterId, specialId) => {
      const hero = get().heroes[characterId];
      if (!hero) return 0;
      const tree = get().getSkillTree(characterId);
      for (const node of tree) {
        const rank = hero.skills[node.id] || 0;
        if (rank <= 0) continue;
        for (const eff of node.effects) {
          if (eff.specialId === specialId) return rank;
        }
      }
      return 0;
    },
  }))
);
