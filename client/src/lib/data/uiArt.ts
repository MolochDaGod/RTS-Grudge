/**
 * Fleet UI art registry — SSOT consumer for ObjectStore /ui-art.json.
 * Keep in sync with GrudgeBuilder shared/fleet/uiArt.ts
 */

export type UiRaceId =
  | "elf"
  | "human"
  | "dwarf"
  | "orc"
  | "barbarian"
  | "undead";

export type UiClassId = "mage" | "warrior" | "ranger" | "worge" | "worg";

export interface UiArtRaceEntry {
  portrait: string;
  cdn?: string;
}

export interface UiArtClassEntry {
  hero: string;
  cdn?: string;
  accent: string;
}

export interface UiArtViewerTokens {
  canvas: {
    cameraPosition: [number, number, number];
    fov: number;
    target: [number, number, number];
    dpr: [number, number];
    minDistance: number;
    maxDistance: number;
  };
  gcs: {
    cameraPosition: [number, number, number];
    cameraTarget: [number, number, number];
    fov: number;
    minDistance: number;
    maxDistance: number;
  };
  portraitTile: {
    aspectRatio: string;
    objectPosition: string;
  };
  equipmentPortrait: {
    width: number;
    height: number;
    aspectRatio: string;
    objectPosition: string;
  };
  gizmo: {
    size: number;
  };
}

export interface UiArtRegistry {
  version: string;
  updated: string;
  source: string;
  cdnBase: string;
  races: Record<UiRaceId, UiArtRaceEntry>;
  classes: Record<UiClassId, UiArtClassEntry>;
  panels: {
    parchment: string;
    parchmentCdn?: string;
  };
  combatClassBackgrounds: Record<string, string>;
  viewer: UiArtViewerTokens;
}

export const UI_ART_FALLBACK: UiArtRegistry = {
  version: "1.0.0",
  updated: "2026-06-29",
  source: "grudge-skill-tree/class-selector.html",
  cdnBase: "https://assets.grudge-studio.com/gruda-armada/grudge-warlords/ui",
  races: {
    elf: { portrait: "https://i.imgur.com/rWEKVAw.png", cdn: "/races/elf.png" },
    human: { portrait: "https://i.imgur.com/qBSRLZG.png", cdn: "/races/human.png" },
    dwarf: { portrait: "https://i.imgur.com/6A4px2O.png", cdn: "/races/dwarf.png" },
    orc: { portrait: "https://i.imgur.com/4PyTEN5.png", cdn: "/races/orc.png" },
    barbarian: { portrait: "https://i.imgur.com/7WKJ8Bw.png", cdn: "/races/barbarian.png" },
    undead: { portrait: "https://i.imgur.com/mPTojTj.png", cdn: "/races/undead.png" },
  },
  classes: {
    mage: { hero: "https://i.imgur.com/vKQR4UT.png", cdn: "/classes/mage.png", accent: "#6aa9ff" },
    warrior: { hero: "https://i.imgur.com/Wj2mUH2.png", cdn: "/classes/warrior.png", accent: "#ff6b57" },
    ranger: { hero: "https://i.imgur.com/5A6e5kL.png", cdn: "/classes/ranger.png", accent: "#6bdc8b" },
    worge: { hero: "https://i.imgur.com/BrQH0Bx.png", cdn: "/classes/worge.png", accent: "#c792ff" },
    worg: { hero: "https://i.imgur.com/BrQH0Bx.png", cdn: "/classes/worge.png", accent: "#c792ff" },
  },
  panels: {
    parchment: "https://i.imgur.com/0SOCXgv.png",
    parchmentCdn: "/panels/parchment.png",
  },
  combatClassBackgrounds: {
    melee: "warrior",
    caster: "mage",
    ranger: "ranger",
  },
  viewer: {
    canvas: {
      cameraPosition: [0, 1.2, 3],
      fov: 45,
      target: [0, 0.9, 0],
      dpr: [1, 1.5],
      minDistance: 0.5,
      maxDistance: 10,
    },
    gcs: {
      cameraPosition: [-2.2368, 1.1513, 2.2612],
      cameraTarget: [0, 0.8, 0],
      fov: 30,
      minDistance: 1,
      maxDistance: 4,
    },
    portraitTile: {
      aspectRatio: "1 / 1",
      objectPosition: "center top",
    },
    equipmentPortrait: {
      width: 110,
      height: 180,
      aspectRatio: "11 / 18",
      objectPosition: "top center",
    },
    gizmo: { size: 0.4 },
  },
};

const OBJECT_STORE_UI_ART =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_OBJECTSTORE_URL
    ? `${import.meta.env.VITE_OBJECTSTORE_URL}/api/v1/ui-art.json`
    : "https://objectstore.grudge-studio.com/api/v1/ui-art.json");

let cachedRegistry: UiArtRegistry = UI_ART_FALLBACK;
let fetchPromise: Promise<UiArtRegistry> | null = null;

export function setUiArtRegistry(data: UiArtRegistry): void {
  cachedRegistry = data;
}

export function getUiArtRegistry(): UiArtRegistry {
  return cachedRegistry;
}

export function getRacePortraitUrl(race: string): string {
  const key = race.toLowerCase() as UiRaceId;
  return cachedRegistry.races[key]?.portrait ?? cachedRegistry.races.human.portrait;
}

export function getClassHeroUrl(cls: string): string {
  const key = cls.toLowerCase() as UiClassId;
  return cachedRegistry.classes[key]?.hero ?? cachedRegistry.classes.warrior.hero;
}

export function getClassAccentColor(cls: string): string {
  const key = cls.toLowerCase() as UiClassId;
  return cachedRegistry.classes[key]?.accent ?? cachedRegistry.classes.warrior.accent;
}

export function getPanelParchmentUrl(): string {
  return cachedRegistry.panels.parchment;
}

export function getCombatClassBackgroundKey(combatClass: string): string {
  return cachedRegistry.combatClassBackgrounds[combatClass] ?? "warrior";
}

export function getCombatClassBackgroundUrl(combatClass: string): string {
  return getClassHeroUrl(getCombatClassBackgroundKey(combatClass));
}

export const CHARACTER_VIEWER_TOKENS = UI_ART_FALLBACK.viewer;

export function getUiArt(path: string): string | number | boolean | undefined {
  const parts = path.split(".");
  let cur: unknown = cachedRegistry;
  for (const part of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  if (typeof cur === "string" || typeof cur === "number" || typeof cur === "boolean") {
    return cur;
  }
  return undefined;
}

export function fetchUiArt(): Promise<UiArtRegistry> {
  if (!fetchPromise) {
    fetchPromise = fetch(OBJECT_STORE_UI_ART)
      .then((res) => (res.ok ? res.json() : UI_ART_FALLBACK))
      .then((data: UiArtRegistry) => {
        setUiArtRegistry(data);
        return data;
      })
      .catch(() => UI_ART_FALLBACK);
  }
  return fetchPromise;
}