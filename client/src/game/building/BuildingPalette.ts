/**
 * BuildingPalette — categorized registry of all modular building pieces.
 *
 * Sources:
 *   1. Kenney Retro Fantasy Kit (105 GLBs) — /models/kenney_fantasy/
 *   2. Dungeon KayKit custombuild (31 GLBs) — /models/dungeon_kaykit/custombuild/
 *
 * Categories mirror a real building editor:
 *   - foundation: floors, floor stairs, flat surfaces
 *   - walls: solid walls, half walls, low walls, fortified walls
 *   - walls_paint: painted/plastered wall variants
 *   - walls_pane: timber-frame / pane walls (wood, painted, windowed)
 *   - doors: door frames, gates, gate halves
 *   - windows: windowed wall variants
 *   - ceilings: roofs, roof edges, roof corners, overhangs
 *   - stairs: staircases, ladders, steps
 *   - columns: pillars, structural poles, crosses
 *   - decoration: barrels, crates, furniture, signs, torches
 *   - fortification: battlements, towers, fences
 *   - destroyed: damaged/broken variants for battle aftermath
 *   - nature: trees, shrubs, water
 *   - dock: dock pieces
 *   - npc_furniture: tables, chairs, bookcases, workstations
 *   - traps: spikes, trapdoors
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type BuildingCategory =
  | "foundation"
  | "walls"
  | "walls_paint"
  | "walls_pane"
  | "doors"
  | "windows"
  | "ceilings"
  | "stairs"
  | "columns"
  | "decoration"
  | "fortification"
  | "destroyed"
  | "nature"
  | "dock"
  | "npc_furniture"
  | "traps";

export interface BuildingPiece {
  id: string;
  name: string;
  path: string;
  category: BuildingCategory;
  /** Source pack for attribution / filtering */
  pack: "kenney_fantasy" | "kaykit_dungeon" | "orc_settlement" | "orc_props";
  /** Grid snap size in meters (1 = 1m grid) */
  snapSize: number;
  /** Rotation snap in degrees (90 = quarter turns) */
  rotationSnap: number;
  /** Whether this piece has a damaged/destroyed variant */
  hasDestroyedVariant?: boolean;
  /** ID of the destroyed variant piece */
  destroyedVariantId?: string;
  /** Whether this is itself a destroyed variant */
  isDestroyed?: boolean;
  /** Tags for search/filter */
  tags?: string[];
}

// ---------------------------------------------------------------------------
// Kenney Retro Fantasy Kit — 105 pieces
// ---------------------------------------------------------------------------
const K = "/models/kenney_fantasy";

const KENNEY_PIECES: BuildingPiece[] = [
  // ── Foundation ──
  { id: "k_floor",                    name: "Floor",                      path: `${K}/floor.glb`,                       category: "foundation",    pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_floor_flat",               name: "Floor Flat",                 path: `${K}/floor-flat.glb`,                  category: "foundation",    pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_floor_stairs",             name: "Floor Stairs",               path: `${K}/floor-stairs.glb`,                category: "foundation",    pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_floor_stairs_corner_in",   name: "Floor Stairs Corner Inner",  path: `${K}/floor-stairs-corner-inner.glb`,   category: "foundation",    pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_floor_stairs_corner_out",  name: "Floor Stairs Corner Outer",  path: `${K}/floor-stairs-corner-outer.glb`,   category: "foundation",    pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_floor_steps",              name: "Floor Steps",                path: `${K}/floor-steps.glb`,                 category: "foundation",    pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_floor_steps_corner_in",    name: "Floor Steps Corner Inner",   path: `${K}/floor-steps-corner-inner.glb`,    category: "foundation",    pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_floor_steps_corner_out",   name: "Floor Steps Corner Outer",   path: `${K}/floor-steps-corner-outer.glb`,    category: "foundation",    pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_wood_floor",               name: "Wood Floor",                 path: `${K}/wood-floor.glb`,                  category: "foundation",    pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_wood_floor_half",          name: "Wood Floor Half",            path: `${K}/wood-floor-half.glb`,             category: "foundation",    pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_wood_floor_quarter",       name: "Wood Floor Quarter",         path: `${K}/wood-floor-quarter.glb`,          category: "foundation",    pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_wood_floor_railing",       name: "Wood Floor Railing",         path: `${K}/wood-floor-railing.glb`,          category: "foundation",    pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_bricks",                   name: "Bricks",                     path: `${K}/bricks.glb`,                      category: "foundation",    pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },

  // ── Walls ──
  { id: "k_wall",                     name: "Wall",                       path: `${K}/wall.glb`,                        category: "walls",         pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_wall_half",                name: "Wall Half",                  path: `${K}/wall-half.glb`,                   category: "walls",         pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_wall_low",                 name: "Wall Low",                   path: `${K}/wall-low.glb`,                    category: "walls",         pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_wall_detail",              name: "Wall Detail",                path: `${K}/wall-detail.glb`,                 category: "walls",         pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_wall_flat_gate",           name: "Wall Flat Gate",             path: `${K}/wall-flat-gate.glb`,              category: "walls",         pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_wall_fortified",           name: "Wall Fortified",             path: `${K}/wall-fortified.glb`,              category: "walls",         pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_wall_fortified_half",      name: "Wall Fortified Half",        path: `${K}/wall-fortified-half.glb`,         category: "walls",         pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },

  // ── Walls Paint ──
  { id: "k_wall_paint",               name: "Wall Paint",                 path: `${K}/wall-paint.glb`,                  category: "walls_paint",   pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_wall_paint_half",          name: "Wall Paint Half",            path: `${K}/wall-paint-half.glb`,             category: "walls_paint",   pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_wall_paint_flat",          name: "Wall Paint Flat",            path: `${K}/wall-paint-flat.glb`,             category: "walls_paint",   pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_wall_paint_detail",        name: "Wall Paint Detail",          path: `${K}/wall-paint-detail.glb`,           category: "walls_paint",   pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_wall_fortified_paint",     name: "Wall Fortified Paint",       path: `${K}/wall-fortified-paint.glb`,        category: "walls_paint",   pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_wall_fortified_paint_half",name: "Wall Fortified Paint Half",  path: `${K}/wall-fortified-paint-half.glb`,   category: "walls_paint",   pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },

  // ── Walls Pane (timber frame) ──
  { id: "k_wall_pane",                name: "Wall Pane",                  path: `${K}/wall-pane.glb`,                   category: "walls_pane",    pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_wall_pane_paint",          name: "Wall Pane Paint",            path: `${K}/wall-pane-paint.glb`,             category: "walls_pane",    pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_wall_pane_wood",           name: "Wall Pane Wood",             path: `${K}/wall-pane-wood.glb`,              category: "walls_pane",    pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_wall_pane_painted_wood",   name: "Wall Pane Painted Wood",     path: `${K}/wall-pane-painted-wood.glb`,      category: "walls_pane",    pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },

  // ── Doors ──
  { id: "k_wall_door",                name: "Wall Door",                  path: `${K}/wall-door.glb`,                   category: "doors",         pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_wall_gate",                name: "Wall Gate",                  path: `${K}/wall-gate.glb`,                   category: "doors",         pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_wall_gate_half",           name: "Wall Gate Half",             path: `${K}/wall-gate-half.glb`,              category: "doors",         pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_wall_paint_door",          name: "Wall Paint Door",            path: `${K}/wall-paint-door.glb`,             category: "doors",         pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_wall_paint_gate",          name: "Wall Paint Gate",            path: `${K}/wall-paint-gate.glb`,             category: "doors",         pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_wall_fortified_door",      name: "Wall Fortified Door",        path: `${K}/wall-fortified-door.glb`,         category: "doors",         pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_wall_fortified_gate",      name: "Wall Fortified Gate",        path: `${K}/wall-fortified-gate.glb`,         category: "doors",         pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_wall_fortified_gate_half", name: "Wall Fortified Gate Half",   path: `${K}/wall-fortified-gate-half.glb`,    category: "doors",         pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_wall_fortified_paint_door",name: "Wall Fort Paint Door",       path: `${K}/wall-fortified-paint-door.glb`,   category: "doors",         pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_wall_fortified_paint_gate",name: "Wall Fort Paint Gate",       path: `${K}/wall-fortified-paint-gate.glb`,   category: "doors",         pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_wall_pane_door",           name: "Wall Pane Door",             path: `${K}/wall-pane-door.glb`,              category: "doors",         pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_wall_pane_paint_door",     name: "Wall Pane Paint Door",       path: `${K}/wall-pane-paint-door.glb`,        category: "doors",         pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_wall_pane_wood_door",      name: "Wall Pane Wood Door",        path: `${K}/wall-pane-wood-door.glb`,         category: "doors",         pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_wall_pane_pw_door",        name: "Wall Pane Ptd Wood Door",    path: `${K}/wall-pane-painted-wood-door.glb`, category: "doors",         pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },

  // ── Windows ──
  { id: "k_wall_window",              name: "Wall Window",                path: `${K}/wall-window.glb`,                 category: "windows",       pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_wall_paint_window",        name: "Wall Paint Window",          path: `${K}/wall-paint-window.glb`,           category: "windows",       pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_wall_fortified_window",    name: "Wall Fortified Window",      path: `${K}/wall-fortified-window.glb`,       category: "windows",       pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_wall_fort_paint_window",   name: "Wall Fort Paint Window",     path: `${K}/wall-fortified-paint-window.glb`, category: "windows",       pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_wall_pane_window",         name: "Wall Pane Window",           path: `${K}/wall-pane-window.glb`,            category: "windows",       pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_wall_pane_paint_window",   name: "Wall Pane Paint Window",     path: `${K}/wall-pane-paint-window.glb`,      category: "windows",       pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_wall_pane_wood_window",    name: "Wall Pane Wood Window",      path: `${K}/wall-pane-wood-window.glb`,       category: "windows",       pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_wall_pane_pw_window",      name: "Wall Pane Ptd Wood Window",  path: `${K}/wall-pane-painted-wood-window.glb`, category: "windows",     pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },

  // ── Ceilings / Roofs ──
  { id: "k_roof",                     name: "Roof",                       path: `${K}/roof.glb`,                        category: "ceilings",      pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_roof_corner",              name: "Roof Corner",                path: `${K}/roof-corner.glb`,                 category: "ceilings",      pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_roof_edge",                name: "Roof Edge",                  path: `${K}/roof-edge.glb`,                   category: "ceilings",      pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_roof_side",                name: "Roof Side",                  path: `${K}/roof-side.glb`,                   category: "ceilings",      pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_roof_side_corner",         name: "Roof Side Corner",           path: `${K}/roof-side-corner.glb`,            category: "ceilings",      pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_roof_side_corner_in",      name: "Roof Side Corner Inner",     path: `${K}/roof-side-corner-inner.glb`,      category: "ceilings",      pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_roof_high_side",           name: "Roof High Side",             path: `${K}/roof-high-side.glb`,              category: "ceilings",      pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_roof_high_side_corner",    name: "Roof High Side Corner",      path: `${K}/roof-high-side-corner.glb`,       category: "ceilings",      pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_roof_high_side_corner_in", name: "Roof High Side Corner Inner",path: `${K}/roof-high-side-corner-inner.glb`, category: "ceilings",      pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_overhang",                 name: "Overhang",                   path: `${K}/overhang.glb`,                    category: "ceilings",      pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_overhang_fence",           name: "Overhang Fence",             path: `${K}/overhang-fence.glb`,              category: "ceilings",      pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_overhang_round",           name: "Overhang Round",             path: `${K}/overhang-round.glb`,              category: "ceilings",      pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_overhang_round_railing",   name: "Overhang Round Railing",     path: `${K}/overhang-round-railing.glb`,      category: "ceilings",      pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },

  // ── Stairs ──
  { id: "k_stairs_stone",             name: "Stairs Stone",               path: `${K}/stairs-stone.glb`,                category: "stairs",        pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_stairs_wood",              name: "Stairs Wood",                path: `${K}/stairs-wood.glb`,                 category: "stairs",        pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_stairs_corner",            name: "Stairs Corner",              path: `${K}/stairs-corner.glb`,               category: "stairs",        pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_ladder",                   name: "Ladder",                     path: `${K}/ladder.glb`,                      category: "stairs",        pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },

  // ── Columns / Structure ──
  { id: "k_column",                   name: "Column",                     path: `${K}/column.glb`,                      category: "columns",       pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90, hasDestroyedVariant: true, destroyedVariantId: "k_column_damaged" },
  { id: "k_column_damaged",           name: "Column Damaged",             path: `${K}/column-damaged.glb`,              category: "destroyed",     pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90, isDestroyed: true },
  { id: "k_column_paint",             name: "Column Paint",               path: `${K}/column-paint.glb`,                category: "columns",       pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90, hasDestroyedVariant: true, destroyedVariantId: "k_column_paint_damaged" },
  { id: "k_column_paint_damaged",     name: "Column Paint Damaged",       path: `${K}/column-paint-damaged.glb`,        category: "destroyed",     pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90, isDestroyed: true },
  { id: "k_column_wood",              name: "Column Wood",                path: `${K}/column-wood.glb`,                 category: "columns",       pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_structure",                name: "Structure",                  path: `${K}/structure.glb`,                   category: "columns",       pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_structure_pole",           name: "Structure Pole",             path: `${K}/structure-pole.glb`,              category: "columns",       pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_structure_poles",          name: "Structure Poles",            path: `${K}/structure-poles.glb`,             category: "columns",       pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_structure_cross",          name: "Structure Cross",            path: `${K}/structure-cross.glb`,             category: "columns",       pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_structure_wall",           name: "Structure Wall",             path: `${K}/structure-wall.glb`,              category: "columns",       pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_structure_wall_cross",     name: "Structure Wall Cross",       path: `${K}/structure-wall-cross.glb`,        category: "columns",       pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },

  // ── Decoration ──
  { id: "k_barrels",                  name: "Barrels",                    path: `${K}/barrels.glb`,                     category: "decoration",    pack: "kenney_fantasy", snapSize: 0.5, rotationSnap: 45 },
  { id: "k_detail_barrel",            name: "Barrel Single",              path: `${K}/detail-barrel.glb`,               category: "decoration",    pack: "kenney_fantasy", snapSize: 0.5, rotationSnap: 45 },
  { id: "k_detail_crate",             name: "Crate",                      path: `${K}/detail-crate.glb`,                category: "decoration",    pack: "kenney_fantasy", snapSize: 0.5, rotationSnap: 45 },
  { id: "k_detail_crate_small",       name: "Crate Small",                path: `${K}/detail-crate-small.glb`,          category: "decoration",    pack: "kenney_fantasy", snapSize: 0.5, rotationSnap: 45 },
  { id: "k_detail_crate_ropes",       name: "Crate Ropes",                path: `${K}/detail-crate-ropes.glb`,          category: "decoration",    pack: "kenney_fantasy", snapSize: 0.5, rotationSnap: 45 },
  { id: "k_pulley",                   name: "Pulley",                     path: `${K}/pulley.glb`,                      category: "decoration",    pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_pulley_crate",             name: "Pulley Crate",               path: `${K}/pulley-crate.glb`,                category: "decoration",    pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },

  // ── Fortification ──
  { id: "k_battlement",               name: "Battlement",                 path: `${K}/battlement.glb`,                  category: "fortification", pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_battlement_half",          name: "Battlement Half",            path: `${K}/battlement-half.glb`,             category: "fortification", pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_battlement_corner_in",     name: "Battlement Corner Inner",    path: `${K}/battlement-corner-inner.glb`,     category: "fortification", pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_battlement_corner_out",    name: "Battlement Corner Outer",    path: `${K}/battlement-corner-outer.glb`,     category: "fortification", pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_fence",                    name: "Fence",                      path: `${K}/fence.glb`,                       category: "fortification", pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_fence_top",                name: "Fence Top",                  path: `${K}/fence-top.glb`,                   category: "fortification", pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_fence_wood",               name: "Fence Wood",                 path: `${K}/fence-wood.glb`,                  category: "fortification", pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_tower",                    name: "Tower",                      path: `${K}/tower.glb`,                       category: "fortification", pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_tower_base",               name: "Tower Base",                 path: `${K}/tower-base.glb`,                  category: "fortification", pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_tower_top",                name: "Tower Top",                  path: `${K}/tower-top.glb`,                   category: "fortification", pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_tower_edge",               name: "Tower Edge",                 path: `${K}/tower-edge.glb`,                  category: "fortification", pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_tower_paint",              name: "Tower Paint",                path: `${K}/tower-paint.glb`,                 category: "fortification", pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_tower_paint_base",         name: "Tower Paint Base",           path: `${K}/tower-paint-base.glb`,            category: "fortification", pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },

  // ── Nature ──
  { id: "k_tree_large",               name: "Tree Large",                 path: `${K}/tree-large.glb`,                  category: "nature",        pack: "kenney_fantasy", snapSize: 1, rotationSnap: 45 },
  { id: "k_tree_shrub",               name: "Shrub",                      path: `${K}/tree-shrub.glb`,                  category: "nature",        pack: "kenney_fantasy", snapSize: 0.5, rotationSnap: 45 },
  { id: "k_water",                    name: "Water",                      path: `${K}/water.glb`,                       category: "nature",        pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },

  // ── Dock ──
  { id: "k_dock_corner",              name: "Dock Corner",                path: `${K}/dock-corner.glb`,                 category: "dock",          pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
  { id: "k_dock_side",                name: "Dock Side",                  path: `${K}/dock-side.glb`,                   category: "dock",          pack: "kenney_fantasy", snapSize: 1, rotationSnap: 90 },
];

// ---------------------------------------------------------------------------
// Dungeon KayKit custombuild — 31 pieces
// ---------------------------------------------------------------------------
const D = "/models/dungeon_kaykit/custombuild";

const KAYKIT_PIECES: BuildingPiece[] = [
  // ── Foundation ──
  { id: "dk_floor_tiles",             name: "Floor Tiles Large",          path: `${D}/floorDecoration_tilesLarge.glb`,   category: "foundation",    pack: "kaykit_dungeon", snapSize: 1, rotationSnap: 90 },
  { id: "dk_floor_wood",              name: "Floor Wood",                 path: `${D}/floorDecoration_wood.glb`,         category: "foundation",    pack: "kaykit_dungeon", snapSize: 1, rotationSnap: 90 },
  { id: "dk_floor_bricks",            name: "Floor Shattered Bricks",     path: `${D}/floorDecoration_shatteredBricks.glb`, category: "destroyed", pack: "kaykit_dungeon", snapSize: 1, rotationSnap: 90, isDestroyed: true },
  { id: "dk_tile_brick_a_lg",         name: "Tile Brick A Large",         path: `${D}/tileBrickA_large.glb`,             category: "foundation",    pack: "kaykit_dungeon", snapSize: 1, rotationSnap: 90 },
  { id: "dk_tile_brick_a_md",         name: "Tile Brick A Medium",        path: `${D}/tileBrickA_medium.glb`,            category: "foundation",    pack: "kaykit_dungeon", snapSize: 1, rotationSnap: 90 },
  { id: "dk_tile_brick_a_sm",         name: "Tile Brick A Small",         path: `${D}/tileBrickA_small.glb`,             category: "foundation",    pack: "kaykit_dungeon", snapSize: 0.5, rotationSnap: 90 },
  { id: "dk_tile_brick_b_lg",         name: "Tile Brick B Large",         path: `${D}/tileBrickB_large.glb`,             category: "foundation",    pack: "kaykit_dungeon", snapSize: 1, rotationSnap: 90 },

  // ── Walls ──
  { id: "dk_wall",                    name: "Dungeon Wall",               path: `${D}/wall.glb`,                        category: "walls",         pack: "kaykit_dungeon", snapSize: 1, rotationSnap: 90, hasDestroyedVariant: true, destroyedVariantId: "dk_wall_broken" },
  { id: "dk_wall_broken",             name: "Dungeon Wall Broken",        path: `${D}/wall_broken.glb`,                 category: "destroyed",     pack: "kaykit_dungeon", snapSize: 1, rotationSnap: 90, isDestroyed: true },
  { id: "dk_wall_end",                name: "Wall End",                   path: `${D}/wall_end.glb`,                    category: "walls",         pack: "kaykit_dungeon", snapSize: 1, rotationSnap: 90 },

  // ── Doors ──
  { id: "dk_door",                    name: "Dungeon Door",               path: `${D}/door.glb`,                        category: "doors",         pack: "kaykit_dungeon", snapSize: 1, rotationSnap: 90 },
  { id: "dk_door_gate",               name: "Dungeon Gate Door",          path: `${D}/door_gate.glb`,                   category: "doors",         pack: "kaykit_dungeon", snapSize: 1, rotationSnap: 90 },
  { id: "dk_wall_door",               name: "Wall With Door",             path: `${D}/wall_door.glb`,                   category: "doors",         pack: "kaykit_dungeon", snapSize: 1, rotationSnap: 90 },
  { id: "dk_wall_gate",               name: "Wall With Gate",             path: `${D}/wall_gate.glb`,                   category: "doors",         pack: "kaykit_dungeon", snapSize: 1, rotationSnap: 90 },
  { id: "dk_trapdoor",                name: "Trapdoor",                   path: `${D}/trapdoor.glb`,                    category: "doors",         pack: "kaykit_dungeon", snapSize: 1, rotationSnap: 90 },

  // ── Columns ──
  { id: "dk_pillar",                  name: "Pillar",                     path: `${D}/pillar.glb`,                      category: "columns",       pack: "kaykit_dungeon", snapSize: 1, rotationSnap: 90, hasDestroyedVariant: true, destroyedVariantId: "dk_pillar_broken" },
  { id: "dk_pillar_broken",           name: "Pillar Broken",              path: `${D}/pillar_broken.glb`,               category: "destroyed",     pack: "kaykit_dungeon", snapSize: 1, rotationSnap: 90, isDestroyed: true },

  // ── Stairs ──
  { id: "dk_stairs",                  name: "Dungeon Stairs",             path: `${D}/stairs.glb`,                      category: "stairs",        pack: "kaykit_dungeon", snapSize: 1, rotationSnap: 90 },
  { id: "dk_stairs_wide",             name: "Dungeon Stairs Wide",        path: `${D}/stairs_wide.glb`,                 category: "stairs",        pack: "kaykit_dungeon", snapSize: 1, rotationSnap: 90 },
  { id: "dk_scaffold_low",            name: "Scaffold Low",               path: `${D}/scaffold_low.glb`,                category: "stairs",        pack: "kaykit_dungeon", snapSize: 1, rotationSnap: 90 },
  { id: "dk_scaffold_low_railing",    name: "Scaffold Low Railing",       path: `${D}/scaffold_low_railing.glb`,        category: "stairs",        pack: "kaykit_dungeon", snapSize: 1, rotationSnap: 90 },
  { id: "dk_scaffold_stairs",         name: "Scaffold Stairs",            path: `${D}/scaffold_stairs.glb`,             category: "stairs",        pack: "kaykit_dungeon", snapSize: 1, rotationSnap: 90 },

  // ── NPC Furniture ──
  { id: "dk_table_large",             name: "Table Large",                path: `${D}/tableLarge.glb`,                  category: "npc_furniture", pack: "kaykit_dungeon", snapSize: 0.5, rotationSnap: 45 },
  { id: "dk_table_medium",            name: "Table Medium",               path: `${D}/tableMedium.glb`,                 category: "npc_furniture", pack: "kaykit_dungeon", snapSize: 0.5, rotationSnap: 45 },
  { id: "dk_table_small",             name: "Table Small",                path: `${D}/tableSmall.glb`,                  category: "npc_furniture", pack: "kaykit_dungeon", snapSize: 0.5, rotationSnap: 45 },
  { id: "dk_chair",                   name: "Chair",                      path: `${D}/chair.glb`,                       category: "npc_furniture", pack: "kaykit_dungeon", snapSize: 0.5, rotationSnap: 45 },
  { id: "dk_stool",                   name: "Stool",                      path: `${D}/stool.glb`,                       category: "npc_furniture", pack: "kaykit_dungeon", snapSize: 0.5, rotationSnap: 45 },
  { id: "dk_bench",                   name: "Bench",                      path: `${D}/bench.glb`,                       category: "npc_furniture", pack: "kaykit_dungeon", snapSize: 0.5, rotationSnap: 45 },
  { id: "dk_bookcase",                name: "Bookcase",                   path: `${D}/bookcase.glb`,                    category: "npc_furniture", pack: "kaykit_dungeon", snapSize: 1, rotationSnap: 90, hasDestroyedVariant: true, destroyedVariantId: "dk_bookcase_broken" },
  { id: "dk_bookcase_broken",         name: "Bookcase Broken",            path: `${D}/bookcase_broken.glb`,             category: "destroyed",     pack: "kaykit_dungeon", snapSize: 1, rotationSnap: 90, isDestroyed: true },
  { id: "dk_bookcase_filled",         name: "Bookcase Filled",            path: `${D}/bookcaseFilled.glb`,              category: "npc_furniture", pack: "kaykit_dungeon", snapSize: 1, rotationSnap: 90 },
  { id: "dk_bookcase_wide",           name: "Bookcase Wide",              path: `${D}/bookcaseWide.glb`,                category: "npc_furniture", pack: "kaykit_dungeon", snapSize: 1, rotationSnap: 90 },
  { id: "dk_bookcase_wide_filled",    name: "Bookcase Wide Filled",       path: `${D}/bookcaseWideFilled.glb`,          category: "npc_furniture", pack: "kaykit_dungeon", snapSize: 1, rotationSnap: 90 },

  // ── Decoration ──
  { id: "dk_barrel",                  name: "Barrel",                     path: `${D}/barrel.glb`,                      category: "decoration",    pack: "kaykit_dungeon", snapSize: 0.5, rotationSnap: 45 },
  { id: "dk_barrel_dark",             name: "Barrel Dark",                path: `${D}/barrelDark.glb`,                  category: "decoration",    pack: "kaykit_dungeon", snapSize: 0.5, rotationSnap: 45 },
  { id: "dk_crate",                   name: "Crate",                      path: `${D}/crate.glb`,                       category: "decoration",    pack: "kaykit_dungeon", snapSize: 0.5, rotationSnap: 45 },
  { id: "dk_crate_dark",              name: "Crate Dark",                 path: `${D}/crateDark.glb`,                   category: "decoration",    pack: "kaykit_dungeon", snapSize: 0.5, rotationSnap: 45 },
  { id: "dk_bucket",                  name: "Bucket",                     path: `${D}/bucket.glb`,                      category: "decoration",    pack: "kaykit_dungeon", snapSize: 0.5, rotationSnap: 45 },
  { id: "dk_banner",                  name: "Banner",                     path: `${D}/banner.glb`,                      category: "decoration",    pack: "kaykit_dungeon", snapSize: 1, rotationSnap: 90 },
  { id: "dk_torch",                   name: "Torch",                      path: `${D}/torch.glb`,                       category: "decoration",    pack: "kaykit_dungeon", snapSize: 0.5, rotationSnap: 45, tags: ["light"] },
  { id: "dk_torch_wall",              name: "Torch Wall",                 path: `${D}/torchWall.glb`,                   category: "decoration",    pack: "kaykit_dungeon", snapSize: 1, rotationSnap: 90, tags: ["light", "wall_mount"] },

  // ── Traps ──
  { id: "dk_tile_spikes",             name: "Tile Spikes",                path: `${D}/tileSpikes.glb`,                  category: "traps",         pack: "kaykit_dungeon", snapSize: 1, rotationSnap: 90, tags: ["trap", "damage"] },
];

// ---------------------------------------------------------------------------
// Orc Settlement (Craftpix Low-Poly) — 22 buildings + props + bridge
// Converted from FBX → GLB via scripts/convert-orc-settlement.cjs
// ---------------------------------------------------------------------------
const OS = "/models/orc_settlement";

const ORC_SETTLEMENT_PIECES: BuildingPiece[] = [
  // ── Full Buildings (RTS-ready structures) ──
  { id: "os_alchemist",      name: "Alchemist House",    path: `${OS}/Alchemist_House.glb`,  category: "npc_furniture", pack: "orc_settlement", snapSize: 2, rotationSnap: 90, tags: ["building", "crafting", "alchemy"] },
  { id: "os_bakery",          name: "Bakery",             path: `${OS}/Bakery.glb`,           category: "npc_furniture", pack: "orc_settlement", snapSize: 2, rotationSnap: 90, tags: ["building", "food", "production"] },
  { id: "os_brewery",         name: "Brewery",            path: `${OS}/Brewery.glb`,          category: "npc_furniture", pack: "orc_settlement", snapSize: 2, rotationSnap: 90, tags: ["building", "food", "production"] },
  { id: "os_herbalist",       name: "Herbalist Hut",      path: `${OS}/Herbalist_Hut.glb`,    category: "npc_furniture", pack: "orc_settlement", snapSize: 2, rotationSnap: 90, tags: ["building", "crafting", "herbs"] },
  { id: "os_dwelling",        name: "Dwelling Hut",       path: `${OS}/Dwelling_Hut.glb`,     category: "npc_furniture", pack: "orc_settlement", snapSize: 2, rotationSnap: 90, tags: ["building", "housing"] },
  { id: "os_prison",          name: "Prison",             path: `${OS}/Prison.glb`,           category: "fortification", pack: "orc_settlement", snapSize: 2, rotationSnap: 90, tags: ["building", "military"] },
  { id: "os_smithy",          name: "Smithy",             path: `${OS}/Smithy.glb`,           category: "npc_furniture", pack: "orc_settlement", snapSize: 2, rotationSnap: 90, tags: ["building", "crafting", "forge"] },
  { id: "os_tanner",          name: "Tanner Hut",         path: `${OS}/Tanner_Hut.glb`,       category: "npc_furniture", pack: "orc_settlement", snapSize: 2, rotationSnap: 90, tags: ["building", "crafting", "leather", "skinning"] },
  { id: "os_tavern",          name: "Tavern",             path: `${OS}/Tavern.glb`,           category: "npc_furniture", pack: "orc_settlement", snapSize: 2, rotationSnap: 90, tags: ["building", "social", "inn"] },

  // ── Tents ──
  { id: "os_tent_small",      name: "Tent (Small)",       path: `${OS}/Tent_Small.glb`,       category: "npc_furniture", pack: "orc_settlement", snapSize: 2, rotationSnap: 90, tags: ["tent", "shelter", "camp"] },
  { id: "os_tent_large",      name: "Tent (Large)",       path: `${OS}/Tent_Large.glb`,       category: "npc_furniture", pack: "orc_settlement", snapSize: 2, rotationSnap: 90, tags: ["tent", "shelter", "camp", "market"] },

  // ── Bridge (modular: end pieces + extendable middle) ──
  { id: "os_bridge_full",     name: "Bridge (Full)",      path: `${OS}/Bridge_Full.glb`,      category: "dock",          pack: "orc_settlement", snapSize: 2, rotationSnap: 90, tags: ["bridge", "crossing"] },
  { id: "os_bridge_end",      name: "Bridge End",         path: `${OS}/Bridge_End.glb`,       category: "dock",          pack: "orc_settlement", snapSize: 2, rotationSnap: 90, tags: ["bridge", "modular"] },
  { id: "os_bridge_middle",   name: "Bridge Middle",      path: `${OS}/Bridge_Middle.glb`,    category: "dock",          pack: "orc_settlement", snapSize: 2, rotationSnap: 90, tags: ["bridge", "modular", "extendable"] },

  // ── Market / Interaction ──
  { id: "os_counter",         name: "Market Counter",     path: `${OS}/Market_Counter.glb`,   category: "decoration",    pack: "orc_settlement", snapSize: 1, rotationSnap: 90, tags: ["market", "vendor", "counter"] },

  // ── Decoration / Props ──
  { id: "os_fountain_sm",     name: "Fountain (Small)",   path: `${OS}/Fountain_Small.glb`,   category: "decoration",    pack: "orc_settlement", snapSize: 1, rotationSnap: 90, tags: ["fountain", "water", "decoration"] },
  { id: "os_fountain_lg",     name: "Fountain (Large)",   path: `${OS}/Fountain_Large.glb`,   category: "decoration",    pack: "orc_settlement", snapSize: 2, rotationSnap: 90, tags: ["fountain", "water", "decoration", "landmark"] },
  { id: "os_statue_warrior",  name: "Warrior Statue",     path: `${OS}/Statue_Warrior.glb`,   category: "decoration",    pack: "orc_settlement", snapSize: 1, rotationSnap: 90, tags: ["statue", "decoration", "landmark"] },
  { id: "os_statue_orc",      name: "Orc Statue",         path: `${OS}/Statue_Orc.glb`,       category: "decoration",    pack: "orc_settlement", snapSize: 1, rotationSnap: 90, tags: ["statue", "decoration", "faction"] },
  { id: "os_lamp_a",          name: "Lamp Post A",        path: `${OS}/Lamp_Post_A.glb`,      category: "decoration",    pack: "orc_settlement", snapSize: 1, rotationSnap: 90, tags: ["lamp", "light", "street"] },
  { id: "os_lamp_b",          name: "Lamp Post B",        path: `${OS}/Lamp_Post_B.glb`,      category: "decoration",    pack: "orc_settlement", snapSize: 1, rotationSnap: 90, tags: ["lamp", "light", "street"] },
  { id: "os_sign",            name: "Sign Post",          path: `${OS}/Sign_Post.glb`,        category: "decoration",    pack: "orc_settlement", snapSize: 1, rotationSnap: 45, tags: ["sign", "direction", "wayfinding"] },
];

// ---------------------------------------------------------------------------
// Orc Props (Craftpix Low-Poly) — 20 interactable furniture & buildables
// Converted from FBX → GLB via scripts/convert-all-craftpix.cjs --pack=orc_props
// ---------------------------------------------------------------------------
const OP = "/models/orc_props";

const ORC_PROPS_PIECES: BuildingPiece[] = [
  // ── Crafting Stations (buildable, interactable) ──
  { id: "op_oven",         name: "Bakery Oven",       path: `${OP}/Bakery_Oven.glb`,    category: "npc_furniture", pack: "orc_props", snapSize: 2, rotationSnap: 90, tags: ["crafting", "cooking", "buildable", "oven"] },
  { id: "op_waterwheel",   name: "Waterwheel",        path: `${OP}/Waterwheel.glb`,     category: "npc_furniture", pack: "orc_props", snapSize: 2, rotationSnap: 90, tags: ["crafting", "production", "buildable", "mill"] },
  { id: "op_cauldron",     name: "Cauldron",          path: `${OP}/Cauldron.glb`,       category: "npc_furniture", pack: "orc_props", snapSize: 1, rotationSnap: 90, tags: ["crafting", "alchemy", "cooking", "buildable"] },
  { id: "op_cooking_pot",  name: "Cooking Pot",       path: `${OP}/Cooking_Pot.glb`,    category: "npc_furniture", pack: "orc_props", snapSize: 1, rotationSnap: 90, tags: ["crafting", "cooking", "buildable"] },

  // ── Furniture (buildable) ──
  { id: "op_throne",       name: "Warchief Throne",   path: `${OP}/Warchief_Throne.glb`,category: "npc_furniture", pack: "orc_props", snapSize: 1, rotationSnap: 90, tags: ["furniture", "throne", "buildable", "faction"] },
  { id: "op_table",        name: "Table",             path: `${OP}/Table.glb`,          category: "npc_furniture", pack: "orc_props", snapSize: 1, rotationSnap: 90, tags: ["furniture", "buildable"] },
  { id: "op_chair",        name: "Chair",             path: `${OP}/Chair.glb`,          category: "npc_furniture", pack: "orc_props", snapSize: 0.5, rotationSnap: 45, tags: ["furniture", "buildable"] },

  // ── Military / Faction ──
  { id: "op_war_banner",   name: "War Banner",        path: `${OP}/War_Banner.glb`,     category: "fortification", pack: "orc_props", snapSize: 1, rotationSnap: 90, tags: ["faction", "flag", "military", "buildable"] },
  { id: "op_alarm_horn",   name: "Alarm Horn",        path: `${OP}/Alarm_Horn.glb`,     category: "fortification", pack: "orc_props", snapSize: 1, rotationSnap: 90, tags: ["military", "alarm", "interactable", "buildable"] },
  { id: "op_war_drum_a",   name: "War Drum A",        path: `${OP}/War_Drum_A.glb`,     category: "decoration",    pack: "orc_props", snapSize: 1, rotationSnap: 90, tags: ["military", "drum", "music", "buildable"] },
  { id: "op_war_drum_b",   name: "War Drum B",        path: `${OP}/War_Drum_B.glb`,     category: "decoration",    pack: "orc_props", snapSize: 1, rotationSnap: 90, tags: ["military", "drum", "music", "buildable"] },

  // ── Lighting ──
  { id: "op_torch_a",      name: "Torch A",           path: `${OP}/Torch_A.glb`,        category: "decoration",    pack: "orc_props", snapSize: 0.5, rotationSnap: 45, tags: ["light", "torch", "buildable"] },
  { id: "op_torch_b",      name: "Torch B",           path: `${OP}/Torch_B.glb`,        category: "decoration",    pack: "orc_props", snapSize: 0.5, rotationSnap: 45, tags: ["light", "torch", "buildable"] },

  // ── Storage / Containers ──
  { id: "op_barrel_a",     name: "Barrel A",          path: `${OP}/Barrel_A.glb`,       category: "decoration",    pack: "orc_props", snapSize: 0.5, rotationSnap: 45, tags: ["storage", "barrel", "buildable"] },
  { id: "op_barrel_b",     name: "Barrel B",          path: `${OP}/Barrel_B.glb`,       category: "decoration",    pack: "orc_props", snapSize: 0.5, rotationSnap: 45, tags: ["storage", "barrel", "buildable"] },
  { id: "op_box",          name: "Storage Box",       path: `${OP}/Storage_Box.glb`,    category: "decoration",    pack: "orc_props", snapSize: 0.5, rotationSnap: 90, tags: ["storage", "crate", "buildable"] },

  // ── Small Props ──
  { id: "op_clay_pot",     name: "Clay Pot",          path: `${OP}/Clay_Pot.glb`,       category: "decoration",    pack: "orc_props", snapSize: 0.5, rotationSnap: 45, tags: ["decoration", "pottery"] },
  { id: "op_bottle",       name: "Bottle",            path: `${OP}/Bottle.glb`,         category: "decoration",    pack: "orc_props", snapSize: 0.5, rotationSnap: 45, tags: ["decoration", "potion"] },
  { id: "op_cup",          name: "Drinking Cup",      path: `${OP}/Drinking_Cup.glb`,   category: "decoration",    pack: "orc_props", snapSize: 0.5, rotationSnap: 45, tags: ["decoration", "tavern"] },
  { id: "op_sign",         name: "Sign Post",         path: `${OP}/Sign_Post.glb`,      category: "decoration",    pack: "orc_props", snapSize: 1, rotationSnap: 45, tags: ["sign", "direction"] },
];

// ---------------------------------------------------------------------------
// Combined palette
// ---------------------------------------------------------------------------
export const ALL_BUILDING_PIECES: BuildingPiece[] = [
  ...KENNEY_PIECES,
  ...KAYKIT_PIECES,
  ...ORC_SETTLEMENT_PIECES,
  ...ORC_PROPS_PIECES,
];

// ---------------------------------------------------------------------------
// Category metadata for UI
// ---------------------------------------------------------------------------
export const CATEGORY_INFO: Record<BuildingCategory, { label: string; icon: string; color: string }> = {
  foundation:    { label: "Foundation",    icon: "🧱", color: "#8b7355" },
  walls:         { label: "Walls",         icon: "🏗️", color: "#a0a0a0" },
  walls_paint:   { label: "Painted Walls", icon: "🎨", color: "#c9a04e" },
  walls_pane:    { label: "Timber Frame",  icon: "🪵", color: "#9b7653" },
  doors:         { label: "Doors/Gates",   icon: "🚪", color: "#cd853f" },
  windows:       { label: "Windows",       icon: "🪟", color: "#87ceeb" },
  ceilings:      { label: "Roofs/Ceiling", icon: "🏠", color: "#b22222" },
  stairs:        { label: "Stairs",        icon: "🪜", color: "#deb887" },
  columns:       { label: "Columns/Beams", icon: "🏛️", color: "#808080" },
  decoration:    { label: "Decoration",    icon: "🏺", color: "#d4a437" },
  fortification: { label: "Fortification", icon: "🏰", color: "#4a4a4a" },
  destroyed:     { label: "Destroyed",     icon: "💥", color: "#8b0000" },
  nature:        { label: "Nature",        icon: "🌳", color: "#228b22" },
  dock:          { label: "Dock",          icon: "⚓", color: "#4682b4" },
  npc_furniture: { label: "NPC Furniture", icon: "🪑", color: "#8b6914" },
  traps:         { label: "Traps",         icon: "⚠️", color: "#ff4500" },
};

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

/** Get all pieces in a category */
export function getPiecesByCategory(category: BuildingCategory): BuildingPiece[] {
  return ALL_BUILDING_PIECES.filter(p => p.category === category);
}

/** Get a piece by ID */
export function getPieceById(id: string): BuildingPiece | undefined {
  return ALL_BUILDING_PIECES.find(p => p.id === id);
}

/** Get the destroyed variant of a piece (if it has one) */
export function getDestroyedVariant(id: string): BuildingPiece | undefined {
  const piece = getPieceById(id);
  if (!piece?.destroyedVariantId) return undefined;
  return getPieceById(piece.destroyedVariantId);
}

/** Get pieces from a specific pack */
export function getPiecesByPack(pack: "kenney_fantasy" | "kaykit_dungeon" | "orc_settlement" | "orc_props"): BuildingPiece[] {
  return ALL_BUILDING_PIECES.filter(p => p.pack === pack);
}

/** Get all categories that have at least one piece */
export function getActiveCategories(): BuildingCategory[] {
  const cats = new Set<BuildingCategory>();
  for (const p of ALL_BUILDING_PIECES) cats.add(p.category);
  return Array.from(cats);
}

/** Search pieces by name (case-insensitive) */
export function searchPieces(query: string): BuildingPiece[] {
  const q = query.toLowerCase();
  return ALL_BUILDING_PIECES.filter(p =>
    p.name.toLowerCase().includes(q) ||
    p.id.toLowerCase().includes(q) ||
    p.tags?.some(t => t.includes(q))
  );
}

/** Get all pieces that have destroyed variants (for battle aftermath system) */
export function getDestructiblePieces(): BuildingPiece[] {
  return ALL_BUILDING_PIECES.filter(p => p.hasDestroyedVariant);
}

/** Get all destroyed variant pieces */
export function getDestroyedPieces(): BuildingPiece[] {
  return ALL_BUILDING_PIECES.filter(p => p.isDestroyed);
}
