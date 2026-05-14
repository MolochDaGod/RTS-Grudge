import { create } from "zustand";

export interface Waypoint {
  id: string;
  name: string;
  worldX: number;
  worldZ: number;
  color: string;
  icon: string;
}

export interface DiscoveredLocation {
  id: string;
  name: string;
  type: "dock" | "village" | "dungeon" | "shop" | "portal" | "spawn" | "landmark";
  islandId: string;
  worldX: number;
  worldZ: number;
}

interface WorldMapState {
  mapOpen: boolean;
  waypoints: Waypoint[];
  discoveredLocations: DiscoveredLocation[];
  selectedWaypointId: string | null;
  trackingWaypointId: string | null;

  toggleMap: () => void;
  openMap: () => void;
  closeMap: () => void;

  addWaypoint: (wp: Omit<Waypoint, "id">) => void;
  removeWaypoint: (id: string) => void;
  updateWaypoint: (id: string, updates: Partial<Omit<Waypoint, "id">>) => void;
  clearWaypoints: () => void;

  discoverLocation: (loc: Omit<DiscoveredLocation, "id">) => void;
  isLocationDiscovered: (name: string, islandId: string) => boolean;

  setSelectedWaypoint: (id: string | null) => void;
  setTrackingWaypoint: (id: string | null) => void;
}

function generateId(): string {
  return `wp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function loadWaypoints(): Waypoint[] {
  try {
    const raw = localStorage.getItem("world_map_waypoints");
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveWaypoints(wps: Waypoint[]) {
  try { localStorage.setItem("world_map_waypoints", JSON.stringify(wps)); } catch {}
}

function loadDiscovered(): DiscoveredLocation[] {
  try {
    const raw = localStorage.getItem("world_map_discovered");
    return raw ? JSON.parse(raw) : getDefaultLocations();
  } catch { return getDefaultLocations(); }
}

function saveDiscovered(locs: DiscoveredLocation[]) {
  try { localStorage.setItem("world_map_discovered", JSON.stringify(locs)); } catch {}
}

function getDefaultLocations(): DiscoveredLocation[] {
  return [
    { id: "loc_spawn", name: "Spawn Point", type: "spawn", islandId: "island_0_0", worldX: 0, worldZ: -5 },
    { id: "loc_home_village", name: "Home Village", type: "village", islandId: "island_0_0", worldX: 0, worldZ: 0 },
    { id: "loc_home_dock", name: "Harbor", type: "dock", islandId: "island_0_0", worldX: -80, worldZ: 0 },
  ];
}

const WAYPOINT_COLORS = ["#ff6b6b", "#ffd93d", "#6bcb77", "#4d96ff", "#ff6fff", "#ff9f43", "#00d2d3", "#a29bfe"];
const WAYPOINT_ICONS = ["📍", "⚔️", "💎", "🏠", "⚠️", "🎯", "🔥", "⭐"];

export { WAYPOINT_COLORS, WAYPOINT_ICONS };

export const useWorldMap = create<WorldMapState>((set, get) => ({
  mapOpen: false,
  waypoints: loadWaypoints(),
  discoveredLocations: loadDiscovered(),
  selectedWaypointId: null,
  trackingWaypointId: null,

  toggleMap: () => set(s => ({ mapOpen: !s.mapOpen })),
  openMap: () => set({ mapOpen: true }),
  closeMap: () => set({ mapOpen: false }),

  addWaypoint: (wp) => {
    const newWp = { ...wp, id: generateId() };
    set(s => {
      const updated = [...s.waypoints, newWp];
      saveWaypoints(updated);
      return { waypoints: updated };
    });
  },

  removeWaypoint: (id) => set(s => {
    const updated = s.waypoints.filter(w => w.id !== id);
    saveWaypoints(updated);
    return {
      waypoints: updated,
      selectedWaypointId: s.selectedWaypointId === id ? null : s.selectedWaypointId,
      trackingWaypointId: s.trackingWaypointId === id ? null : s.trackingWaypointId,
    };
  }),

  updateWaypoint: (id, updates) => set(s => {
    const updated = s.waypoints.map(w => w.id === id ? { ...w, ...updates } : w);
    saveWaypoints(updated);
    return { waypoints: updated };
  }),

  clearWaypoints: () => {
    saveWaypoints([]);
    set({ waypoints: [], selectedWaypointId: null, trackingWaypointId: null });
  },

  discoverLocation: (loc) => {
    const state = get();
    const exists = state.discoveredLocations.some(
      l => l.name === loc.name && l.islandId === loc.islandId
    );
    if (exists) return;
    const newLoc = { ...loc, id: `loc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` };
    set(s => {
      const updated = [...s.discoveredLocations, newLoc];
      saveDiscovered(updated);
      return { discoveredLocations: updated };
    });
  },

  isLocationDiscovered: (name, islandId) => {
    return get().discoveredLocations.some(l => l.name === name && l.islandId === islandId);
  },

  setSelectedWaypoint: (id) => set({ selectedWaypointId: id }),
  setTrackingWaypoint: (id) => set({ trackingWaypointId: id }),
}));
