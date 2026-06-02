/**
 * Project lifecycle helpers — blank project factory, JSON serialise,
 * localStorage persistence (Postgres can replace these calls later
 * without changing call sites).
 */
import type { MapProject, TerrainData } from '../types';

const STORAGE_PREFIX = 'studio.project.';
const STORAGE_INDEX = 'studio.projectIndex';

const uid = () => Math.random().toString(36).slice(2, 10);

export function createBlankTerrain(resolution = 128, size = 256): TerrainData {
  const cells = resolution * resolution;
  return {
    resolution,
    size,
    heights: new Array(cells).fill(0),
    biome: new Array(cells).fill(0),
  };
}

export function createBlankProject(name = 'Untitled Map'): MapProject {
  const now = new Date().toISOString();
  return {
    schema: 1,
    id: uid(),
    name,
    createdAt: now,
    updatedAt: now,
    terrain: createBlankTerrain(),
    entities: [],
    rules: {
      startingFunds: 10000,
      fogOfWar: true,
      waveCount: 8,
      victoryCondition: 'eliminate',
    },
  };
}

export function projectToJSON(p: MapProject): string {
  return JSON.stringify(p);
}

/**
 * Forward-compatible loader. Older schemas are migrated up to current;
 * newer schemas are accepted with a console warning so projects saved by
 * a future build still open in this one (extra fields preserved verbatim).
 */
const CURRENT_SCHEMA = 1 as const;

type AnyProject = Partial<MapProject> & { schema?: number };

function migrate(p: AnyProject): MapProject {
  // Future migrations slot in here, e.g.:
  //   if ((p.schema ?? 1) < 2) { ...transform fields...; p.schema = 2; }
  if (p.schema == null) p.schema = CURRENT_SCHEMA;
  if (p.schema > CURRENT_SCHEMA) {
    // eslint-disable-next-line no-console
    console.warn(
      `[studio] Loading project saved with newer schema (${p.schema} > ${CURRENT_SCHEMA}). ` +
      `Unknown fields will be preserved.`,
    );
  }
  // Fill required defaults if missing so older saves still mount cleanly
  const blank = createBlankProject();
  return {
    ...blank,
    ...p,
    schema: CURRENT_SCHEMA,
    terrain: p.terrain ?? blank.terrain,
    entities: p.entities ?? [],
    rules: { ...blank.rules, ...(p.rules ?? {}) },
  } as MapProject;
}

export function projectFromJSON(s: string): MapProject {
  return migrate(JSON.parse(s) as AnyProject);
}

interface IndexEntry { id: string; name: string; updatedAt: string }

export function listSavedProjects(): IndexEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_INDEX);
    return raw ? (JSON.parse(raw) as IndexEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveProjectLocal(p: MapProject): void {
  localStorage.setItem(STORAGE_PREFIX + p.id, projectToJSON(p));
  const idx = listSavedProjects().filter((e) => e.id !== p.id);
  idx.unshift({ id: p.id, name: p.name, updatedAt: p.updatedAt });
  localStorage.setItem(STORAGE_INDEX, JSON.stringify(idx.slice(0, 50)));
}

export function loadProjectLocal(id: string): MapProject | null {
  const raw = localStorage.getItem(STORAGE_PREFIX + id);
  return raw ? projectFromJSON(raw) : null;
}

export function deleteProjectLocal(id: string): void {
  localStorage.removeItem(STORAGE_PREFIX + id);
  const idx = listSavedProjects().filter((e) => e.id !== id);
  localStorage.setItem(STORAGE_INDEX, JSON.stringify(idx));
}

export function downloadJSON(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function newEntityId(): string { return uid(); }
