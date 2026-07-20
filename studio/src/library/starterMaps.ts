/**
 * Curated starter maps — each is a deterministic seed handed to the
 * island generator, with a name, description, and gameplay tags. Loaded
 * on demand from the Library page so users have something to open and
 * tinker with on first launch.
 */
import type { MapProject } from '../types';
import { createBlankProject } from '../editor/project';
import { generateIsland, type IslandGenOptions } from '../editor/IslandGenerator';

export interface StarterMap {
  id: string;
  name: string;
  tagline: string;
  description: string;
  seed: number;
  difficulty: 'Skirmish' | 'Standard' | 'Hard';
  recommendedPlayers: string;
  options?: IslandGenOptions;
}

export const STARTER_MAPS: StarterMap[] = [
  // ── uMMORPG migrated hubs (locked seeds — parity with Unity Dojo / Island1 / Genesis) ──
  {
    id: 'ummorpg-dojo',
    name: 'Dojo Hub',
    tagline: 'Private start pad — craft, bank, portal to the world.',
    description:
      'Migrated from uMMORPG Dojo scene. Small safe hub for character flow, profession stations, and zone portals. Not a full open-world sim.',
    seed: 10001,
    difficulty: 'Skirmish',
    recommendedPlayers: '1',
    options: { treeDensity: 0.3, rockDensity: 0.4, flowerDensity: 0.5, animalDensity: 0 },
  },
  {
    id: 'ummorpg-island1',
    name: 'Island 1 (Starter)',
    tagline: 'First open island — harvest, mines, farm, claim practice.',
    description:
      'Migrated from uMMORPG Island1 / starter world. Mines, farm/wheat, survival craft, tutorial claim flag. Professions SSOT: ObjectStore.',
    seed: 10002,
    difficulty: 'Standard',
    recommendedPlayers: '1 – 3',
    options: { treeDensity: 1.1, flowerDensity: 1.2, rockDensity: 1.0, animalDensity: 1.0 },
  },
  {
    id: 'ummorpg-genesis',
    name: 'Genesis Island',
    tagline: 'Guild-claimable birthplace island — PvP, dense nodes.',
    description:
      'Migrated from Unity Genesis / DCQ zone-10. Claimable, requiredLevel 5, denser resources. Align spawns with genesis-zone-10.json when refining.',
    seed: 10010,
    difficulty: 'Hard',
    recommendedPlayers: '2 – 8',
    options: { treeDensity: 0.9, rockDensity: 1.5, flowerDensity: 0.8, animalDensity: 1.2 },
  },
  {
    id: 'starter-emerald-cove',
    name: 'Emerald Cove',
    tagline: 'A lush starter island with a sheltered bay.',
    description:
      'Gentle hills, a wide grass plateau, and a deep northern bay perfect for an early dock. Great for learning the editor.',
    seed: 1337,
    difficulty: 'Skirmish',
    recommendedPlayers: '1 – 2',
    options: { treeDensity: 1.2, flowerDensity: 1.4 },
  },
  {
    id: 'starter-stonewatch',
    name: 'Stonewatch',
    tagline: 'Rocky highlands ring a single defensible plateau.',
    description:
      'High rocky biomes hem in a narrow build pad. Resource nodes are scarce — economy first, then expand.',
    seed: 90210,
    difficulty: 'Standard',
    recommendedPlayers: '2',
    options: { treeDensity: 0.7, rockDensity: 1.6, animalDensity: 0.6 },
  },
  {
    id: 'starter-driftwood-bay',
    name: 'Driftwood Bay',
    tagline: 'A wide sandy crescent fringed with palms.',
    description:
      'Long beaches and shallow water make this map dock-friendly on every side. Wildlife is plentiful.',
    seed: 4242,
    difficulty: 'Skirmish',
    recommendedPlayers: '1 – 3',
    options: { treeDensity: 1.4, bushDensity: 1.2, animalDensity: 1.5 },
  },
  {
    id: 'starter-ironfang-spire',
    name: 'Ironfang Spire',
    tagline: 'A jagged peak surrounded by deep water.',
    description:
      'Rugged terrain, sparse forests, abundant rock. Tight choke points reward defensive play.',
    seed: 77777,
    difficulty: 'Hard',
    recommendedPlayers: '2 – 4',
    options: { treeDensity: 0.5, rockDensity: 2.0, flowerDensity: 0.3 },
  },
];

/** Build a fully-generated MapProject from a starter preset. */
export function buildStarterProject(preset: StarterMap): MapProject {
  const project = createBlankProject(preset.name);
  const result = generateIsland(project, { seed: preset.seed, ...preset.options });
  project.entities = result.entities;
  project.seed = result.seed;
  project.updatedAt = new Date().toISOString();
  return project;
}
