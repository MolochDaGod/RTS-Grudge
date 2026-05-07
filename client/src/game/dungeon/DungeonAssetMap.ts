export interface DungeonAssetDef {
  path: string;
  height: number;
  category: "structural" | "prop" | "light" | "container" | "decoration";
}

const KK = "/models/dungeon_kaykit";

export const KAYKIT_DUNGEON_ASSETS: Record<string, DungeonAssetDef> = {
  kk_wall: { path: `${KK}/wall.glb`, height: 4, category: "structural" },
  kk_wallCorner: { path: `${KK}/wallCorner.glb`, height: 4, category: "structural" },
  kk_wall_broken: { path: `${KK}/wall_broken.glb`, height: 3.5, category: "structural" },
  kk_wall_door: { path: `${KK}/wall_door.glb`, height: 4, category: "structural" },
  kk_wall_window: { path: `${KK}/wall_window.glb`, height: 4, category: "structural" },
  kk_wall_end: { path: `${KK}/wall_end.glb`, height: 4, category: "structural" },
  kk_wall_gate: { path: `${KK}/wall_gate.glb`, height: 4, category: "structural" },
  kk_wall_gateDoor: { path: `${KK}/wall_gateDoor.glb`, height: 4, category: "structural" },
  kk_wallSingle: { path: `${KK}/wallSingle.glb`, height: 3, category: "structural" },
  kk_wallSingle_broken: { path: `${KK}/wallSingle_broken.glb`, height: 2.5, category: "structural" },
  kk_wallSingle_door: { path: `${KK}/wallSingle_door.glb`, height: 3, category: "structural" },
  kk_wallSingle_window: { path: `${KK}/wallSingle_window.glb`, height: 3, category: "structural" },
  kk_wallSingle_decorationA: { path: `${KK}/wallSingle_decorationA.glb`, height: 3, category: "structural" },
  kk_wallSingle_decorationB: { path: `${KK}/wallSingle_decorationB.glb`, height: 3, category: "structural" },
  kk_wallSingle_corner: { path: `${KK}/wallSingle_corner.glb`, height: 3, category: "structural" },
  kk_wallSplit: { path: `${KK}/wallSplit.glb`, height: 4, category: "structural" },
  kk_wallIntersection: { path: `${KK}/wallIntersection.glb`, height: 4, category: "structural" },

  kk_floor_large: { path: `${KK}/tileBrickA_large.glb`, height: 0.25, category: "structural" },
  kk_floor_medium: { path: `${KK}/tileBrickA_medium.glb`, height: 0.25, category: "structural" },
  kk_floor_small: { path: `${KK}/tileBrickA_small.glb`, height: 0.25, category: "structural" },
  kk_floor_dark: { path: `${KK}/tileBrickB_large.glb`, height: 0.25, category: "structural" },
  kk_floor_tiles: { path: `${KK}/floorDecoration_tilesLarge.glb`, height: 0.05, category: "decoration" },
  kk_floor_shattered: { path: `${KK}/floorDecoration_shatteredBricks.glb`, height: 0.05, category: "decoration" },
  kk_floor_wood: { path: `${KK}/floorDecoration_wood.glb`, height: 0.05, category: "decoration" },
  kk_spikes: { path: `${KK}/tileSpikes.glb`, height: 0.3, category: "structural" },

  kk_pillar: { path: `${KK}/pillar.glb`, height: 3.5, category: "structural" },
  kk_pillar_broken: { path: `${KK}/pillar_broken.glb`, height: 2, category: "structural" },
  kk_torch: { path: `${KK}/torch.glb`, height: 1.2, category: "light" },
  kk_torchWall: { path: `${KK}/torchWall.glb`, height: 0.8, category: "light" },
  kk_door: { path: `${KK}/door.glb`, height: 2.5, category: "structural" },
  kk_door_gate: { path: `${KK}/door_gate.glb`, height: 2.5, category: "structural" },
  kk_stairs: { path: `${KK}/stairs.glb`, height: 2, category: "structural" },
  kk_stairs_wide: { path: `${KK}/stairs_wide.glb`, height: 2, category: "structural" },
  kk_trapdoor: { path: `${KK}/trapdoor.glb`, height: 0.1, category: "structural" },

  kk_barrel: { path: `${KK}/barrel.glb`, height: 0.8, category: "prop" },
  kk_barrelDark: { path: `${KK}/barrelDark.glb`, height: 0.8, category: "prop" },
  kk_bench: { path: `${KK}/bench.glb`, height: 0.5, category: "prop" },
  kk_bucket: { path: `${KK}/bucket.glb`, height: 0.4, category: "prop" },
  kk_chair: { path: `${KK}/chair.glb`, height: 0.9, category: "prop" },
  kk_stool: { path: `${KK}/stool.glb`, height: 0.5, category: "prop" },
  kk_mug: { path: `${KK}/mug.glb`, height: 0.15, category: "prop" },
  kk_bricks: { path: `${KK}/bricks.glb`, height: 0.3, category: "decoration" },
  kk_crate: { path: `${KK}/crate.glb`, height: 0.6, category: "prop" },
  kk_crateDark: { path: `${KK}/crateDark.glb`, height: 0.6, category: "prop" },
  kk_banner: { path: `${KK}/banner.glb`, height: 3, category: "decoration" },
  kk_weaponRack: { path: `${KK}/weaponRack.glb`, height: 2, category: "prop" },
  kk_artifact: { path: `${KK}/artifact.glb`, height: 1, category: "decoration" },

  kk_chest_common: { path: `${KK}/chest_common.glb`, height: 0.6, category: "container" },
  kk_chest_uncommon: { path: `${KK}/chest_uncommon.glb`, height: 0.6, category: "container" },
  kk_chest_rare: { path: `${KK}/chest_rare.glb`, height: 0.7, category: "container" },
  kk_chest_mimic: { path: `${KK}/chest_rare_mimic.glb`, height: 0.7, category: "container" },
  kk_chestTop_common: { path: `${KK}/chestTop_common.glb`, height: 0.6, category: "container" },
  kk_chestTop_rare: { path: `${KK}/chestTop_rare.glb`, height: 0.7, category: "container" },

  kk_bookcase: { path: `${KK}/bookcase.glb`, height: 2.0, category: "prop" },
  kk_bookcaseFilled: { path: `${KK}/bookcaseFilled.glb`, height: 2.0, category: "prop" },
  kk_bookcaseWide: { path: `${KK}/bookcaseWide.glb`, height: 2.0, category: "prop" },
  kk_bookcaseWideFilled: { path: `${KK}/bookcaseWideFilled.glb`, height: 2.0, category: "prop" },
  kk_bookcase_broken: { path: `${KK}/bookcase_broken.glb`, height: 1.5, category: "prop" },
  kk_bookA: { path: `${KK}/bookA.glb`, height: 0.2, category: "decoration" },
  kk_bookB: { path: `${KK}/bookB.glb`, height: 0.2, category: "decoration" },
  kk_bookOpen: { path: `${KK}/bookOpenA.glb`, height: 0.15, category: "decoration" },
  kk_spellBook: { path: `${KK}/spellBook.glb`, height: 0.3, category: "decoration" },

  kk_tableLarge: { path: `${KK}/tableLarge.glb`, height: 0.8, category: "prop" },
  kk_tableMedium: { path: `${KK}/tableMedium.glb`, height: 0.8, category: "prop" },
  kk_tableSmall: { path: `${KK}/tableSmall.glb`, height: 0.7, category: "prop" },
  kk_plateFull: { path: `${KK}/plateFull.glb`, height: 0.15, category: "decoration" },
  kk_plate: { path: `${KK}/plate.glb`, height: 0.05, category: "decoration" },

  kk_potionRed: { path: `${KK}/potionLarge_red.glb`, height: 0.3, category: "prop" },
  kk_potionBlue: { path: `${KK}/potionLarge_blue.glb`, height: 0.3, category: "prop" },
  kk_potionGreen: { path: `${KK}/potionLarge_green.glb`, height: 0.3, category: "prop" },
  kk_potionSmallRed: { path: `${KK}/potionSmall_red.glb`, height: 0.2, category: "prop" },
  kk_potionSmallBlue: { path: `${KK}/potionSmall_blue.glb`, height: 0.2, category: "prop" },
  kk_potionSmallGreen: { path: `${KK}/potionSmall_green.glb`, height: 0.2, category: "prop" },

  kk_coin: { path: `${KK}/coin.glb`, height: 0.1, category: "decoration" },
  kk_coinsSmall: { path: `${KK}/coinsSmall.glb`, height: 0.15, category: "decoration" },
  kk_coinsMedium: { path: `${KK}/coinsMedium.glb`, height: 0.2, category: "decoration" },
  kk_lootSackA: { path: `${KK}/lootSackA.glb`, height: 0.4, category: "prop" },
  kk_lootSackB: { path: `${KK}/lootSackB.glb`, height: 0.5, category: "prop" },
  kk_pots: { path: `${KK}/pots.glb`, height: 0.4, category: "prop" },
  kk_potA: { path: `${KK}/potA.glb`, height: 0.3, category: "prop" },
  kk_potA_decorated: { path: `${KK}/potA_decorated.glb`, height: 0.35, category: "prop" },

  kk_scaffold_low: { path: `${KK}/scaffold_low.glb`, height: 1.5, category: "structural" },
  kk_scaffold_railing: { path: `${KK}/scaffold_low_railing.glb`, height: 1.5, category: "structural" },
  kk_scaffold_stairs: { path: `${KK}/scaffold_stairs.glb`, height: 2, category: "structural" },
};

export const DUNGEON_ASSETS: Record<string, DungeonAssetDef> = {
  floor: { path: "/models/dungeon_quaternius/ModularFloor.glb", height: 0.5, category: "structural" },
  wall: { path: "/models/dungeon_quaternius/ModularStoneWall.glb", height: 4, category: "structural" },
  wall_top: { path: "/models/dungeon_quaternius/ModularStoneWall_top.glb", height: 1, category: "structural" },
  wall_entrance: { path: "/models/dungeon_quaternius/ModularStoneWall_EntranceTop.glb", height: 2, category: "structural" },
  entrance: { path: "/models/dungeon_quaternius/Entrance.glb", height: 3.5, category: "structural" },
  entrance2: { path: "/models/dungeon_quaternius/Entrance2.glb", height: 3.5, category: "structural" },
  stairs: { path: "/models/dungeon_quaternius/Stairs.glb", height: 2, category: "structural" },
  column: { path: "/models/dungeon_quaternius/Column.glb", height: 3.5, category: "structural" },
  column_broken: { path: "/models/dungeon_quaternius/Column_Broken.glb", height: 2, category: "structural" },
  column_broken2: { path: "/models/dungeon_quaternius/Column_Broken2.glb", height: 1.5, category: "structural" },
  column_top: { path: "/models/dungeon_quaternius/ModularColumn_top.glb", height: 1, category: "structural" },
  column_middle: { path: "/models/dungeon_quaternius/ModularColumn_middle.glb", height: 1, category: "structural" },
  column_bottom: { path: "/models/dungeon_quaternius/ModularColumn_bottom.glb", height: 1, category: "structural" },
  bars: { path: "/models/dungeon_quaternius/Bars.glb", height: 3, category: "structural" },
  window: { path: "/models/dungeon_quaternius/Window.glb", height: 2, category: "structural" },

  torch: { path: "/models/dungeon_quaternius/Torch.glb", height: 1.2, category: "light" },
  torch_wall: { path: "/models/dungeon_quaternius/Torch_wall.glb", height: 0.8, category: "light" },
  candle: { path: "/models/dungeon_quaternius/Candle.glb", height: 0.4, category: "light" },
  candelabrum: { path: "/models/dungeon_quaternius/Candelabrum.glb", height: 1.5, category: "light" },
  candelabrum_tall: { path: "/models/dungeon_quaternius/Candelabrum_tall.glb", height: 2.2, category: "light" },

  barrel: { path: "/models/dungeon_quaternius/Barrel.glb", height: 0.8, category: "prop" },
  chest: { path: "/models/dungeon_quaternius/Chest.glb", height: 0.6, category: "container" },
  chest_gold: { path: "/models/dungeon_quaternius/Chest_gold.glb", height: 0.6, category: "container" },
  carpet: { path: "/models/dungeon_quaternius/Carpet.glb", height: 0.05, category: "decoration" },
  wall_rocks: { path: "/models/dungeon_quaternius/WallRocks.glb", height: 0.5, category: "decoration" },

  potion: { path: "/models/dungeon_quaternius/Potion.glb", height: 0.3, category: "prop" },
  potion2: { path: "/models/dungeon_quaternius/Potion2.glb", height: 0.3, category: "prop" },
  potion3: { path: "/models/dungeon_quaternius/Potion3.glb", height: 0.3, category: "prop" },
  potion4: { path: "/models/dungeon_quaternius/Potion4.glb", height: 0.3, category: "prop" },
  potion5: { path: "/models/dungeon_quaternius/Potion5.glb", height: 0.3, category: "prop" },
  potion6: { path: "/models/dungeon_quaternius/Potion6.glb", height: 0.3, category: "prop" },

  book2: { path: "/models/dungeon_quaternius/Book2.glb", height: 0.2, category: "decoration" },
  book3: { path: "/models/dungeon_quaternius/Book3.glb", height: 0.2, category: "decoration" },
  book_open: { path: "/models/dungeon_quaternius/Book_Open.glb", height: 0.15, category: "decoration" },
  bones: { path: "/models/dungeon_quaternius/Bones.glb", height: 0.3, category: "decoration" },
  bones2: { path: "/models/dungeon_quaternius/Bones2.glb", height: 0.3, category: "decoration" },

  rock1: { path: "/models/dungeon_quaternius/Rock1.glb", height: 0.4, category: "decoration" },
  rock2: { path: "/models/dungeon_quaternius/Rock2.glb", height: 0.35, category: "decoration" },
  rock3: { path: "/models/dungeon_quaternius/Rock3.glb", height: 0.5, category: "decoration" },
  rock4: { path: "/models/dungeon_quaternius/Rock4.glb", height: 0.3, category: "decoration" },
  rock5: { path: "/models/dungeon_quaternius/Rock5.glb", height: 0.45, category: "decoration" },
};

export const FURNITURE_ASSETS: Record<string, DungeonAssetDef> = {
  bookcase: { path: "/models/furniture_quaternius/BookCase.glb", height: 2.0, category: "prop" },
  bookcase_books: { path: "/models/furniture_quaternius/BookCaseBooks.glb", height: 2.0, category: "prop" },
  bookcase_large: { path: "/models/furniture_quaternius/BookCaseLarge.glb", height: 2.5, category: "prop" },
  bookcase_large_books: { path: "/models/furniture_quaternius/BookCaseLargeBooks.glb", height: 2.5, category: "prop" },
  table: { path: "/models/furniture_quaternius/Table.glb", height: 0.8, category: "prop" },
  chair: { path: "/models/furniture_quaternius/Chair.glb", height: 0.9, category: "prop" },
  chair_handle: { path: "/models/furniture_quaternius/ChairHandle.glb", height: 1.0, category: "prop" },
  chair_cushioned: { path: "/models/furniture_quaternius/ChairCushioned.glb", height: 1.0, category: "prop" },
  stool: { path: "/models/furniture_quaternius/Stool.glb", height: 0.5, category: "prop" },
  bed: { path: "/models/furniture_quaternius/Bed.glb", height: 0.6, category: "prop" },
  bed_king: { path: "/models/furniture_quaternius/BedKing.glb", height: 0.8, category: "prop" },
  closet: { path: "/models/furniture_quaternius/Closet.glb", height: 1.8, category: "prop" },
  closet2: { path: "/models/furniture_quaternius/Closet2.glb", height: 1.8, category: "prop" },
  coffee_table: { path: "/models/furniture_quaternius/CoffeeTable.glb", height: 0.4, category: "prop" },
  coffee_table2: { path: "/models/furniture_quaternius/CoffeeTable2.glb", height: 0.4, category: "prop" },
  sofa: { path: "/models/furniture_quaternius/Sofa.glb", height: 0.8, category: "prop" },
  sofa_double: { path: "/models/furniture_quaternius/SofaDouble.glb", height: 0.8, category: "prop" },
  sofa_long: { path: "/models/furniture_quaternius/SofaLong.glb", height: 0.8, category: "prop" },
  lamp: { path: "/models/furniture_quaternius/Lamp.glb", height: 1.2, category: "light" },
  lamp2: { path: "/models/furniture_quaternius/Lamp2.glb", height: 1.0, category: "light" },
  plant: { path: "/models/furniture_quaternius/Plant.glb", height: 0.6, category: "decoration" },
  vase: { path: "/models/furniture_quaternius/Vase.glb", height: 0.5, category: "decoration" },
  vase2: { path: "/models/furniture_quaternius/Vase2.glb", height: 0.4, category: "decoration" },
};

/**
 * Quaternius "Fantasy Props Mega Kit" — a small hero-prop subset extracted
 * from the standard pack. These have richer PBR (metallic/roughness +
 * normal maps via shared trim atlases) than the older flat-shaded
 * dungeon_quaternius / kaykit props, so we use them as upgraded swap-ins
 * for the most visible decor types (chest, barrel, bookshelf, bed, anvil,
 * cauldron, cabinet, candelabrum) without touching the dungeon
 * placement/AI logic.
 */
const FP = "/models/fantasy_props";
export const FANTASY_PROP_ASSETS: Record<string, DungeonAssetDef> = {
  fp_chest:        { path: `${FP}/Chest_Wood.gltf`,         height: 0.55, category: "container" },
  fp_barrel:       { path: `${FP}/Barrel.gltf`,             height: 0.95, category: "prop" },
  fp_bookshelf:    { path: `${FP}/Bookcase_2.gltf`,         height: 2.10, category: "prop" },
  fp_bed:          { path: `${FP}/Bed_Twin1.gltf`,          height: 0.70, category: "prop" },
  fp_anvil:        { path: `${FP}/Anvil.gltf`,              height: 0.75, category: "prop" },
  fp_cauldron:     { path: `${FP}/Cauldron.gltf`,           height: 0.55, category: "prop" },
  fp_cabinet:      { path: `${FP}/Cabinet.gltf`,            height: 1.80, category: "prop" },
  fp_candelabrum:  { path: `${FP}/CandleStick_Triple.gltf`, height: 0.85, category: "light" },
};

export const VILLAGE_ASSETS: Record<string, DungeonAssetDef> = {
  inn: { path: "/models/village_quaternius/Inn.glb", height: 8, category: "structural" },
  blacksmith: { path: "/models/village_quaternius/Blacksmith.glb", height: 6, category: "structural" },
  house1: { path: "/models/village_quaternius/House_1.glb", height: 5, category: "structural" },
  house2: { path: "/models/village_quaternius/House_2.glb", height: 5, category: "structural" },
  house3: { path: "/models/village_quaternius/House_3.glb", height: 5, category: "structural" },
  house4: { path: "/models/village_quaternius/House_4.glb", height: 4, category: "structural" },
  mill: { path: "/models/village_quaternius/Mill.glb", height: 8, category: "structural" },
  sawmill: { path: "/models/village_quaternius/Sawmill.glb", height: 5, category: "structural" },
  stable: { path: "/models/village_quaternius/Stable.glb", height: 4, category: "structural" },
  bell_tower: { path: "/models/village_quaternius/Bell_Tower.glb", height: 10, category: "structural" },
  gazebo: { path: "/models/village_quaternius/Gazebo.glb", height: 4, category: "structural" },
  well: { path: "/models/village_quaternius/Well.glb", height: 1.5, category: "prop" },
  barrel: { path: "/models/village_quaternius/Barrel.glb", height: 0.8, category: "prop" },
  crate: { path: "/models/village_quaternius/Crate.glb", height: 0.6, category: "prop" },
  bonfire: { path: "/models/village_quaternius/Bonfire.glb", height: 0.8, category: "light" },
  bonfire_lit: { path: "/models/village_quaternius/Bonfire_Lit.glb", height: 1.0, category: "light" },
  bench1: { path: "/models/village_quaternius/Bench_1.glb", height: 0.5, category: "prop" },
  bench2: { path: "/models/village_quaternius/Bench_2.glb", height: 0.5, category: "prop" },
  cart: { path: "/models/village_quaternius/Cart.glb", height: 1.2, category: "prop" },
  fence: { path: "/models/village_quaternius/Fence.glb", height: 1.0, category: "structural" },
  market_stand1: { path: "/models/village_quaternius/MarketStand_1.glb", height: 2.5, category: "prop" },
  market_stand2: { path: "/models/village_quaternius/MarketStand_2.glb", height: 2.5, category: "prop" },
  cauldron: { path: "/models/village_quaternius/Cauldron.glb", height: 0.5, category: "prop" },
  hay: { path: "/models/village_quaternius/Hay.glb", height: 0.8, category: "decoration" },
  bag: { path: "/models/village_quaternius/Bag.glb", height: 0.4, category: "prop" },
  bag_open: { path: "/models/village_quaternius/Bag_Open.glb", height: 0.4, category: "prop" },
  bags: { path: "/models/village_quaternius/Bags.glb", height: 0.5, category: "prop" },
  rock1: { path: "/models/village_quaternius/Rock_1.glb", height: 0.6, category: "decoration" },
  rock2: { path: "/models/village_quaternius/Rock_2.glb", height: 0.8, category: "decoration" },
  rock3: { path: "/models/village_quaternius/Rock_3.glb", height: 0.5, category: "decoration" },
  path_straight: { path: "/models/village_quaternius/Path_Straight.glb", height: 0.1, category: "structural" },
  path_square: { path: "/models/village_quaternius/Path_Square.glb", height: 0.1, category: "structural" },
  stairs: { path: "/models/village_quaternius/Stairs.glb", height: 1, category: "structural" },
  door_straight: { path: "/models/village_quaternius/Door_Straight.glb", height: 2.5, category: "structural" },
  door_round: { path: "/models/village_quaternius/Door_Round.glb", height: 2.5, category: "structural" },
};

export const PIRATE_ASSETS = {
  ship_large: "/models/pirate_quaternius/Ship_Large.glb",
  ship_small: "/models/pirate_quaternius/Ship_Small.glb",
  dock: "/models/pirate_quaternius/Environment_Dock.glb",
  dock_broken: "/models/pirate_quaternius/Environment_Dock_Broken.glb",
  dock_pole: "/models/pirate_quaternius/Environment_Dock_Pole.glb",
  palm_tree1: "/models/pirate_quaternius/Environment_PalmTree_1.glb",
  palm_tree2: "/models/pirate_quaternius/Environment_PalmTree_2.glb",
  palm_tree3: "/models/pirate_quaternius/Environment_PalmTree_3.glb",
  cliff1: "/models/pirate_quaternius/Environment_Cliff1.glb",
  cliff2: "/models/pirate_quaternius/Environment_Cliff2.glb",
  cliff3: "/models/pirate_quaternius/Environment_Cliff3.glb",
  cliff4: "/models/pirate_quaternius/Environment_Cliff4.glb",
  rock1: "/models/pirate_quaternius/Environment_Rock_1.glb",
  rock2: "/models/pirate_quaternius/Environment_Rock_2.glb",
  rock3: "/models/pirate_quaternius/Environment_Rock_3.glb",
  rock4: "/models/pirate_quaternius/Environment_Rock_4.glb",
  rock5: "/models/pirate_quaternius/Environment_Rock_5.glb",
  house1: "/models/pirate_quaternius/Environment_House1.glb",
  house2: "/models/pirate_quaternius/Environment_House2.glb",
  house3: "/models/pirate_quaternius/Environment_House3.glb",
  sawmill: "/models/pirate_quaternius/Environment_Sawmill.glb",
  skulls: "/models/pirate_quaternius/Environment_Skulls.glb",
  large_bones: "/models/pirate_quaternius/Environment_LargeBones.glb",
  barrel: "/models/pirate_quaternius/Prop_Barrel.glb",
  cannon: "/models/pirate_quaternius/Prop_Cannon.glb",
  cannon_ball: "/models/pirate_quaternius/Prop_CannonBall.glb",
  chest_closed: "/models/pirate_quaternius/Prop_Chest_Closed.glb",
  chest_gold: "/models/pirate_quaternius/Prop_Chest_Gold.glb",
  anchor: "/models/pirate_quaternius/Prop_Anchor.glb",
  skull: "/models/pirate_quaternius/Prop_Skull.glb",
  bomb: "/models/pirate_quaternius/Prop_Bomb.glb",
  coins: "/models/pirate_quaternius/Prop_Coins.glb",
  gold_bag: "/models/pirate_quaternius/Prop_GoldBag.glb",
  bucket: "/models/pirate_quaternius/Prop_Bucket.glb",
  bucket_fishes: "/models/pirate_quaternius/Prop_Bucket_Fishes.glb",
  bottle1: "/models/pirate_quaternius/Prop_Bottle_1.glb",
  bottle2: "/models/pirate_quaternius/Prop_Bottle_2.glb",
  weapon_cutlass: "/models/pirate_quaternius/Weapon_Cutlass.glb",
  weapon_dagger: "/models/pirate_quaternius/Weapon_Dagger.glb",
  weapon_pistol: "/models/pirate_quaternius/Weapon_Pistol.glb",
  weapon_axe: "/models/pirate_quaternius/Weapon_Axe.glb",
  weapon_double_axe: "/models/pirate_quaternius/Weapon_DoubleAxe.glb",
  weapon_sword1: "/models/pirate_quaternius/Weapon_Sword_1.glb",
  weapon_sword2: "/models/pirate_quaternius/Weapon_Sword_2.glb",
  weapon_rifle: "/models/pirate_quaternius/Weapon_Rifle.glb",
  char_barbarossa: "/models/pirate_quaternius/Characters_Captain_Barbarossa.glb",
  char_henry: "/models/pirate_quaternius/Characters_Henry.glb",
  char_anne: "/models/pirate_quaternius/Characters_Anne.glb",
  char_mako: "/models/pirate_quaternius/Characters_Mako.glb",
  char_shark: "/models/pirate_quaternius/Characters_Shark.glb",
  char_sharky: "/models/pirate_quaternius/Characters_Sharky.glb",
  char_skeleton: "/models/pirate_quaternius/Characters_Skeleton.glb",
  char_skeleton_headless: "/models/pirate_quaternius/Characters_Skeleton_Headless.glb",
  char_tentacle: "/models/pirate_quaternius/Characters_Tentacle.glb",
  enemy_tentacle: "/models/pirate_quaternius/Enemy_Tentacle.glb",
};

export const DECOR_TO_DUNGEON_ASSET: Record<string, { asset: string; source: "kaykit" | "dungeon" | "furniture" | "fantasy_props"; height: number; hasLight?: boolean; lightColor?: string; lightIntensity?: number }> = {
  torch: { asset: "kk_torch", source: "kaykit", height: 1.2, hasLight: true, lightColor: "#ff6600", lightIntensity: 4 },
  pillar: { asset: "kk_pillar", source: "kaykit", height: 3.5 },
  // Hero containers/props upgraded to PBR Fantasy Props Mega Kit.
  chest: { asset: "fp_chest", source: "fantasy_props", height: 0.55 },
  armor: { asset: "kk_pillar_broken", source: "kaykit", height: 2 },
  door: { asset: "kk_door", source: "kaykit", height: 2.5 },
  brazier: { asset: "kk_torch", source: "kaykit", height: 1.2, hasLight: true, lightColor: "#ff8844", lightIntensity: 3 },
  barrel: { asset: "fp_barrel", source: "fantasy_props", height: 0.95 },
  bookshelf: { asset: "fp_bookshelf", source: "fantasy_props", height: 2.10 },
  cauldron: { asset: "fp_cauldron", source: "fantasy_props", height: 0.55, hasLight: true, lightColor: "#33cc55", lightIntensity: 2 },
  bed: { asset: "fp_bed", source: "fantasy_props", height: 0.70 },
  anvil: { asset: "fp_anvil", source: "fantasy_props", height: 0.75 },
  cabinet: { asset: "fp_cabinet", source: "fantasy_props", height: 1.80 },
  candelabrum: { asset: "fp_candelabrum", source: "fantasy_props", height: 0.85, hasLight: true, lightColor: "#ffcc66", lightIntensity: 2.5 },
  crate: { asset: "kk_crate", source: "kaykit", height: 0.6 },
  banner: { asset: "kk_banner", source: "kaykit", height: 3 },
  weapon_rack: { asset: "kk_weaponRack", source: "kaykit", height: 2 },
  statue: { asset: "kk_artifact", source: "kaykit", height: 1 },
  altar: { asset: "kk_chestTop_rare", source: "kaykit", height: 0.7 },
  table: { asset: "kk_tableMedium", source: "kaykit", height: 0.8 },
  chair: { asset: "kk_chair", source: "kaykit", height: 0.9 },
  bench: { asset: "kk_bench", source: "kaykit", height: 0.5 },
  stool: { asset: "kk_stool", source: "kaykit", height: 0.5 },
  pots: { asset: "kk_pots", source: "kaykit", height: 0.4 },
  bucket: { asset: "kk_bucket", source: "kaykit", height: 0.4 },
  coins: { asset: "kk_coinsSmall", source: "kaykit", height: 0.15 },
  loot_sack: { asset: "kk_lootSackA", source: "kaykit", height: 0.4 },
  spellbook: { asset: "kk_spellBook", source: "kaykit", height: 0.3 },
  potion: { asset: "kk_potionRed", source: "kaykit", height: 0.3 },
  scaffold: { asset: "kk_scaffold_low", source: "kaykit", height: 1.5 },
};

export function resolveAssetDef(assetKey: string, source?: "kaykit" | "dungeon" | "furniture" | "fantasy_props"): DungeonAssetDef | undefined {
  if (source === "fantasy_props" || assetKey.startsWith("fp_")) {
    return FANTASY_PROP_ASSETS[assetKey];
  }
  if (source === "kaykit" || assetKey.startsWith("kk_")) {
    return KAYKIT_DUNGEON_ASSETS[assetKey];
  }
  return (
    DUNGEON_ASSETS[assetKey] ||
    FURNITURE_ASSETS[assetKey] ||
    KAYKIT_DUNGEON_ASSETS[assetKey] ||
    FANTASY_PROP_ASSETS[assetKey]
  );
}

export function getRandomPotion(seed: number): string {
  const potions = ["kk_potionRed", "kk_potionBlue", "kk_potionGreen", "kk_potionSmallRed", "kk_potionSmallBlue", "kk_potionSmallGreen"];
  return potions[Math.abs(seed) % potions.length];
}

export function getRandomRock(seed: number): string {
  const rocks = ["rock1", "rock2", "rock3", "rock4", "rock5"];
  return rocks[Math.abs(seed) % rocks.length];
}

export function getRandomBones(seed: number): string {
  return seed % 2 === 0 ? "bones" : "bones2";
}

export function getRandomBook(seed: number): string {
  const books = ["kk_bookA", "kk_bookB", "kk_bookOpen", "kk_spellBook"];
  return books[Math.abs(seed) % books.length];
}

export function getRandomChest(seed: number): string {
  const chests = ["kk_chest_common", "kk_chest_uncommon", "kk_chest_rare"];
  const weights = [0.6, 0.3, 0.1];
  const roll = (Math.abs(seed * 7919) % 100) / 100;
  if (roll < weights[0]) return chests[0];
  if (roll < weights[0] + weights[1]) return chests[1];
  return chests[2];
}

export function getRandomTable(seed: number): string {
  const tables = ["kk_tableLarge", "kk_tableMedium", "kk_tableSmall"];
  return tables[Math.abs(seed) % tables.length];
}

export function getRandomWallDecor(seed: number): string {
  const decor = ["kk_wallSingle_decorationA", "kk_wallSingle_decorationB", "kk_torchWall"];
  return decor[Math.abs(seed) % decor.length];
}
