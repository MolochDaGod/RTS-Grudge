/**
 * Character archetypes for the selection screen.
 * Each entry drives Player stats and visual colour.
 */

import { ModularLoadout } from './ModularCharacterLoader';

export type { ModularLoadout };

/**
 * Per-slot picked variants for the monolithic GLB (the previewer's loadout).
 * Keys match `CharacterPreviewScene` SlotKey: body, head, arms, legs,
 * shoulderpads, weapon, shield, xtra. Values are *variant letter arrays*
 * (e.g. head: ['A','D'] = face A + helmet D).
 *   - empty array  → slot fully hidden
 *   - missing slot → ToonCharacter falls back to its first-variant default
 */
export type PreviewLoadout = Record<string, string[]>;

export interface CharacterConfig {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  color: number;          // hex, used for ToonCharacter tint
  modelKey: string;       // ModelLoader key
  // Base stats
  maxHealth: number;
  maxStamina: number;
  speed: number;          // movement speed (units/s)
  damage: number;         // melee damage per hit
  // Abilities
  hasPhase: boolean;      // can use phase blink
  startRanged: boolean;   // starts in ranged mode
  // Stat display (0-100 for the bars)
  displayStats: {
    health:  number;
    stamina: number;
    speed:   number;
    power:   number;
  };
  tags: string[];
  accentColor: string;    // CSS color for card border/glow
  // ── Modular character loadout (optional) ─────────────────────────────────
  // When present, ModularCharacterLoader builds the character from individual
  // part GLBs instead of the monolithic modelKey GLB.
  modularLoadout?: ModularLoadout;
  // ── Player-customised character (set by RaceClassSelect on confirm) ──────
  /** Stable UUID stamped at creation. Identifies this exact build for save
   *  files, telemetry, and re-spawning the same character mid-session. */
  uuid?: string;
  /** The user's loadout picks from `CharacterPreviewScene`. Applied to the
   *  in-game ToonCharacter via `applyLoadout(...)` after the GLB loads. */
  loadout?: PreviewLoadout;
}

export const CHARACTERS: CharacterConfig[] = [
  {
    id: 'iron_knight',
    name: 'Iron Knight',
    subtitle: 'Vanguard',
    description: 'Immovable wall of the Ashen Ruins. Crushes foes under the weight of centuries of war.',
    color: 0x2a3e5a,
    modelKey: 'brb',
    maxHealth:  200,
    maxStamina: 80,
    speed:      5.0,
    damage:     55,
    hasPhase:   false,
    startRanged: false,
    displayStats: { health: 95, stamina: 45, speed: 35, power: 80 },
    tags: ['Tanky', 'Melee', 'Slow'],
    accentColor: '#4488cc',
  },
  {
    id: 'shade_ranger',
    name: 'Shade Ranger',
    subtitle: 'Phantom Archer',
    description: 'Strikes from the veil between worlds. Masters the art of phasing through enemy lines.',
    color: 0x3a1a5a,
    modelKey: 'ud',
    maxHealth:  115,
    maxStamina: 130,
    speed:      7.2,
    damage:     38,
    hasPhase:   true,
    startRanged: true,
    displayStats: { health: 50, stamina: 90, speed: 80, power: 50 },
    tags: ['Phase', 'Ranged', 'Fast'],
    accentColor: '#9944ee',
  },
  {
    id: 'void_berserker',
    name: 'Void Berserker',
    subtitle: 'Chaos Blade',
    description: 'Fueled by primal rage. Sacrifices defense for overwhelming, relentless offense.',
    color: 0x5a1a1a,
    modelKey: 'orc',
    maxHealth:  105,
    maxStamina: 160,
    speed:      8.8,
    damage:     72,
    hasPhase:   false,
    startRanged: false,
    displayStats: { health: 42, stamina: 100, speed: 100, power: 100 },
    tags: ['Glass Cannon', 'Melee', 'Berserk'],
    accentColor: '#cc3333',
  },
  {
    id: 'arcane_warden',
    name: 'Arcane Warden',
    subtitle: 'Rift Scholar',
    description: 'Balanced mastery of blade, rifle, and the phase arts. Adaptable to any encounter.',
    color: 0x2a4a3a,
    modelKey: 'wk',
    maxHealth:  150,
    maxStamina: 100,
    speed:      6.0,
    damage:     46,
    hasPhase:   true,
    startRanged: false,
    displayStats: { health: 68, stamina: 68, speed: 55, power: 60 },
    tags: ['Balanced', 'Phase', 'Rifle'],
    accentColor: '#44aa66',
  },
];

// ── Race + class system ───────────────────────────────────────────────────────
//
// The opening flow is "pick a race, then pick a class".  A built CharacterConfig
// is computed by fusing the race's base stats with the class's modifiers.
// Six races × four classes = 24 viable combinations, each with its own stat
// profile, starting weapon mode, and ability set.

export interface RaceDef {
  id:           string;
  name:         string;
  subtitle:     string;
  description:  string;
  modelKey:     string;
  /** Multiplicative tint blended into the GLB textures (visual flavour) */
  color:        number;
  accentColor:  string;
  /** Race-baseline stats (class will modify) */
  base: { health: number; stamina: number; speed: number; damage: number };
  passive:      string;
}

export interface ClassDef {
  id:               string;
  name:             string;
  subtitle:         string;
  description:      string;
  /** Additive modifiers applied on top of race base stats */
  mods:             { health: number; stamina: number; speed: number; damage: number };
  startWeaponMode:  'melee' | 'ranged';
  hasPhase:         boolean;
  /** Skills bound to keys 1-5 (display labels for the HUD legend) */
  startingSkills:   [string, string, string, string, string];
  /** Starting gear blurb */
  startingGear:     string;
  accentColor:      string;
}

export const RACES: RaceDef[] = [
  {
    id: 'human', name: 'Human', subtitle: 'Adaptable Survivors',
    description: 'Veterans of countless rifts, balanced in every art.',
    modelKey: 'wk', color: 0xc8b89a, accentColor: '#bda871',
    base: { health: 130, stamina: 100, speed: 6.0, damage: 45 },
    passive: 'Versatile · +5% all stats',
  },
  {
    id: 'elf', name: 'Elf', subtitle: 'Star-Touched',
    description: 'Long-lived scholars whose blood hums with arcane resonance.',
    modelKey: 'elf', color: 0x9ad0e0, accentColor: '#88ccee',
    base: { health: 110, stamina: 130, speed: 7.0, damage: 40 },
    passive: 'Arcane Affinity · −2s skill cooldowns',
  },
  {
    id: 'dwarf', name: 'Dwarf', subtitle: 'Stone-Sworn',
    description: 'Mountain-forged smiths who treat pain as currency.',
    modelKey: 'brb', color: 0xb88560, accentColor: '#cc8855',
    base: { health: 180, stamina: 90, speed: 5.0, damage: 55 },
    passive: 'Iron Hide · −15% incoming damage',
  },
  {
    id: 'orc', name: 'Orc', subtitle: 'Blood-Warlords',
    description: 'Tusked warriors whose fury sharpens every swing.',
    modelKey: 'orc', color: 0x6a8a3a, accentColor: '#88bb44',
    base: { health: 160, stamina: 120, speed: 6.5, damage: 60 },
    passive: 'Bloodfury · +1% damage per 1% missing HP',
  },
  {
    id: 'undead', name: 'Undead', subtitle: 'The Returned',
    description: 'Hollowed husks bound to flesh by spite and forgotten oaths.',
    modelKey: 'ud', color: 0x9a88c8, accentColor: '#aa88ee',
    base: { health: 100, stamina: 140, speed: 7.5, damage: 42 },
    passive: 'Soul-Tethered · Phase blink available to all classes',
  },
  {
    id: 'barbarian', name: 'Barbarian', subtitle: 'Blood-Mad',
    description: 'Tribal berserkers who feed on the fall of the strong.',
    modelKey: 'barbarian', color: 0xc83838, accentColor: '#dd3333',
    base: { health: 140, stamina: 110, speed: 6.8, damage: 65 },
    passive: 'Blood Frenzy · Killing an enemy restores 8 HP',
  },
];

export const CLASSES: ClassDef[] = [
  {
    id: 'warrior', name: 'Warrior', subtitle: 'Vanguard',
    description: 'Heavy plate, longsword, and a shield. Front-line absorber.',
    mods: { health: +50, stamina: -10, speed: -1.0, damage: +5 },
    startWeaponMode: 'melee', hasPhase: false,
    startingSkills: ['Slash', 'Shield Bash', 'War Cry', 'Heal', 'Bulwark'],
    startingGear: 'Steel longsword · Tower shield · Plate hauberk',
    accentColor: '#88aacc',
  },
  {
    id: 'ranger', name: 'Ranger', subtitle: 'Phantom Archer',
    description: 'Light cloak and longbow. Strikes at distance, fades into shadow.',
    mods: { health: -20, stamina: +30, speed: +1.5, damage: -2 },
    startWeaponMode: 'ranged', hasPhase: true,
    startingSkills: ['Quick Shot', 'Pierce', 'Smoke Bolt', 'Heal', 'Rain of Arrows'],
    startingGear: 'Yew longbow · Quiver of 40 · Hooded cloak',
    accentColor: '#aa66dd',
  },
  {
    id: 'mage', name: 'Mage', subtitle: 'Rift Scholar',
    description: 'Spellweaver. Hurls arc-bolts and rift-fire from a focus crystal.',
    mods: { health: -10, stamina: +40, speed: +0.5, damage: +10 },
    startWeaponMode: 'ranged', hasPhase: true,
    startingSkills: ['Arc Bolt', 'Phase Blink', 'Soul Drain', 'Heal', 'Rift Nova'],
    startingGear: 'Runic staff · Focus crystal · Scholar\'s robes',
    accentColor: '#44bb88',
  },
  {
    id: 'worge', name: 'Worge', subtitle: 'Primal Druid',
    description: 'Shapeshifter bound to beast spirits. Morphs into WorgBear for tanking or Raptor for stealth DPS.',
    mods: { health: +10, stamina: +30, speed: +1.5, damage: +10 },
    startWeaponMode: 'melee', hasPhase: false,
    startingSkills: ['Bear Form', 'Howl', 'Feral Rage', 'Pack Hunt', 'Worg Lord'],
    startingGear: 'Bone staff · Beast pelt · Fang fetishes',
    accentColor: '#dd4444',
  },
];

/**
 * Fuse a race + class into a fully-populated CharacterConfig that the engine
 * can consume.  Race grants the model + base stats + passive flavour; class
 * grants modifiers + starting weapon mode + skill bar.
 */
export function buildCharacter(raceId: string, classId: string): CharacterConfig {
  const race  = RACES.find(r => r.id === raceId)   ?? RACES[0];
  const klass = CLASSES.find(c => c.id === classId) ?? CLASSES[0];
  const maxHealth  = Math.max(40, race.base.health  + klass.mods.health);
  const maxStamina = Math.max(40, race.base.stamina + klass.mods.stamina);
  const speed      = Math.max(2,  race.base.speed   + klass.mods.speed);
  const damage     = Math.max(5,  race.base.damage  + klass.mods.damage);
  const hasPhase   = klass.hasPhase || race.id === 'undead';   // undead passive
  // Display stats are normalised 0-100 for the bars
  const norm = (v: number, max: number) => Math.round(Math.min(100, (v / max) * 100));
  return {
    id:          `${race.id}_${klass.id}`,
    name:        `${race.name} ${klass.name}`,
    subtitle:    `${klass.subtitle} of the ${race.name}`,
    description: `${race.description} ${klass.description}`,
    color:       race.color,
    modelKey:    race.modelKey,
    maxHealth, maxStamina, speed, damage,
    hasPhase,
    startRanged: klass.startWeaponMode === 'ranged',
    displayStats: {
      health:  norm(maxHealth,  220),
      stamina: norm(maxStamina, 200),
      speed:   norm(speed,      10),
      power:   norm(damage,     90),
    },
    tags: [klass.name, race.name, klass.startWeaponMode === 'ranged' ? 'Ranged' : 'Melee'],
    accentColor: klass.accentColor,
  };
}

// ── Default faction loadouts for The Ashen Crypt enemy archetypes ─────────────
// Maps horror enemy type → modular faction (used by ModelLoader / ToonCharacter).
//   drowned_shade     → 'ud'  (undead — spectral, agile)
//   grave_warden      → 'brb' (barbarian — heavy armour)
//   feral_hollowed    → 'orc' (orc — berserk, feral)
//   nightmare_herald  → boss GLTF (own model, faction key only for fallback)
//   rock_guardian     → boss GLTF (own model, faction key only for fallback)
export const ENEMY_FACTION_LOADOUTS: Record<string, Omit<ModularLoadout, 'skinIndex'>> = {
  drowned_shade:    { faction: 'ud',  slots: {} },
  grave_warden:     { faction: 'brb', slots: {} },
  feral_hollowed:   { faction: 'orc', slots: {} },
  nightmare_herald: { faction: 'ud',  slots: {} },
  rock_guardian:    { faction: 'brb', slots: {} },
};
