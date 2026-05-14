export type RoomType = "normal" | "spawn" | "boss" | "treasure" | "corridor" | "trap" | "shrine" | "armory" | "library" | "arena";
export type RoomShape = "rectangle" | "lshaped" | "circular" | "pillared" | "cross";
export type DungeonTheme = "crypt" | "mine" | "temple";

export const TILE_SIZE = 4;

export type TileFloorKind = "room" | "corridor" | "spawn" | "exit";

export interface DungeonTile {
  tx: number;
  tz: number;
  wx: number;
  wz: number;
  floorKind: TileFloorKind;
  roomType: RoomType;
  isRoomEdge: boolean;
  wallN: boolean;
  wallS: boolean;
  wallE: boolean;
  wallW: boolean;
  doorN: boolean;
  doorS: boolean;
  doorE: boolean;
  doorW: boolean;
  cornerNE: boolean;
  cornerNW: boolean;
  cornerSE: boolean;
  cornerSW: boolean;
}

export interface TileGrid {
  tiles: DungeonTile[];
  cellSize: number;
}

export interface DungeonRoom {
  x: number;
  z: number;
  width: number;
  depth: number;
  type: RoomType;
  shape: RoomShape;
  subRooms?: { x: number; z: number; width: number; depth: number }[];
}

export interface DungeonWall {
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  rotation: number;
}

export type DecorType = "torch" | "pillar" | "chest" | "armor" | "door"
  | "brazier" | "barrel" | "crate" | "banner" | "statue"
  | "bookshelf" | "cauldron" | "sarcophagus" | "minecart" | "crystal"
  | "water_pool" | "lava_pool" | "rubble" | "altar" | "weapon_rack"
  | "table" | "chair" | "bench" | "stool" | "pots" | "bucket"
  | "coins" | "loot_sack" | "spellbook" | "potion" | "scaffold"
  | "bed" | "anvil" | "cabinet" | "candelabrum";

export interface DungeonDecor {
  type: DecorType;
  x: number;
  z: number;
  rotation: number;
  scale?: number;
}

export interface DungeonEnemySpawn {
  x: number;
  z: number;
  type: string;
}

/**
 * A climbable surface emitted by the generator. `wall` is a tile-aligned
 * climbable wall face; `ladder` is a vertical ladder pressed against the
 * inside face of a tile wall. Both consume the existing
 * `<WallClimbable />` / `<LadderClimbable />` components.
 */
export interface DungeonClimbable {
  kind: "wall" | "ladder";
  position: [number, number, number];
  rotationY: number;
  /** Wall: width × height × thickness in metres. */
  size?: [number, number, number];
  /** Ladder: total height in metres. */
  height?: number;
  /** Ladder: width (rung length) in metres. */
  width?: number;
}

export interface DungeonLayout {
  rooms: DungeonRoom[];
  walls: DungeonWall[];
  decor: DungeonDecor[];
  enemySpawns: DungeonEnemySpawn[];
  climbables: DungeonClimbable[];
  spawnPoint: { x: number; z: number };
  exitPoint: { x: number; z: number };
  floorTiles: { x: number; z: number; width: number; depth: number }[];
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  theme: DungeonTheme;
  tileGrid: TileGrid;
}

export const THEME_FOR_LEVEL: Record<number, DungeonTheme> = {
  1: "crypt",
  2: "mine",
  3: "temple",
};

export const THEME_ENEMY_TYPES: Record<DungeonTheme, string[]> = {
  crypt: ["skeleton", "spider", "witch", "ghost", "blob"],
  mine: ["spider", "golem", "pirate", "orc", "cactoro"],
  temple: ["skeleton", "ninja", "witch", "golem", "tribal", "blue_demon"],
};

export const THEME_BOSS_TYPES: Record<DungeonTheme, string[]> = {
  crypt: ["mushroom_king", "demon", "ghost"],
  mine: ["yeti", "dino", "orc"],
  temple: ["dragon", "alien", "blue_demon"],
};

const THEME_SPECIAL_ROOMS: Record<DungeonTheme, RoomType[]> = {
  crypt: ["shrine", "library", "trap"],
  mine: ["armory", "trap", "arena"],
  temple: ["shrine", "arena", "library"],
};

class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 16807 + 0) % 2147483647;
    return this.seed / 2147483647;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  shuffle<T>(arr: T[]): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}

interface BSPNode {
  x: number;
  z: number;
  width: number;
  depth: number;
  left: BSPNode | null;
  right: BSPNode | null;
  room: DungeonRoom | null;
}

function splitBSP(node: BSPNode, rng: SeededRandom, minSize: number, depth: number): void {
  if (depth <= 0 || node.width < minSize * 2 || node.depth < minSize * 2) return;

  const splitHorizontal = node.width < node.depth ? true : node.depth < node.width ? false : rng.next() > 0.5;

  if (splitHorizontal) {
    const split = rng.range(node.z + minSize, node.z + node.depth - minSize);
    node.left = { x: node.x, z: node.z, width: node.width, depth: split - node.z, left: null, right: null, room: null };
    node.right = { x: node.x, z: split, width: node.width, depth: node.z + node.depth - split, left: null, right: null, room: null };
  } else {
    const split = rng.range(node.x + minSize, node.x + node.width - minSize);
    node.left = { x: node.x, z: node.z, width: split - node.x, depth: node.depth, left: null, right: null, room: null };
    node.right = { x: split, z: node.z, width: node.x + node.width - split, depth: node.depth, left: null, right: null, room: null };
  }

  splitBSP(node.left, rng, minSize, depth - 1);
  splitBSP(node.right, rng, minSize, depth - 1);
}

function pickRoomShape(rng: SeededRandom, nodeWidth: number, nodeDepth: number): RoomShape {
  const minDim = Math.min(nodeWidth, nodeDepth);
  if (minDim < 14) return "rectangle";

  const roll = rng.next();
  if (roll < 0.35) return "rectangle";
  if (roll < 0.55) return "lshaped";
  if (roll < 0.70) return "circular";
  if (roll < 0.85) return "pillared";
  return "cross";
}

function createLShapedSubRooms(x: number, z: number, w: number, d: number, rng: SeededRandom):
  { x: number; z: number; width: number; depth: number }[] {
  const halfW = w * rng.range(0.45, 0.65);
  const halfD = d * rng.range(0.45, 0.65);
  const corner = rng.int(0, 3);

  switch (corner) {
    case 0:
      return [
        { x, z, width: w, depth: halfD },
        { x, z: z + halfD, width: halfW, depth: d - halfD },
      ];
    case 1:
      return [
        { x, z, width: w, depth: halfD },
        { x: x + w - halfW, z: z + halfD, width: halfW, depth: d - halfD },
      ];
    case 2:
      return [
        { x, z: z + d - halfD, width: w, depth: halfD },
        { x, z, width: halfW, depth: d - halfD },
      ];
    default:
      return [
        { x, z: z + d - halfD, width: w, depth: halfD },
        { x: x + w - halfW, z, width: halfW, depth: d - halfD },
      ];
  }
}

function createCrossSubRooms(x: number, z: number, w: number, d: number, rng: SeededRandom):
  { x: number; z: number; width: number; depth: number }[] {
  const armW = w * rng.range(0.35, 0.5);
  const armD = d * rng.range(0.35, 0.5);
  const cxOff = (w - armW) / 2;
  const czOff = (d - armD) / 2;

  return [
    { x: x + cxOff, z, width: armW, depth: d },
    { x, z: z + czOff, width: w, depth: armD },
  ];
}

function createRooms(node: BSPNode, rng: SeededRandom, rooms: DungeonRoom[], padding: number): void {
  if (node.left && node.right) {
    createRooms(node.left, rng, rooms, padding);
    createRooms(node.right, rng, rooms, padding);
    return;
  }

  const roomWidth = Math.max(6, rng.range(node.width * 0.5, node.width - padding * 2));
  const roomDepth = Math.max(6, rng.range(node.depth * 0.5, node.depth - padding * 2));
  const roomX = rng.range(node.x + padding, Math.max(node.x + padding, node.x + node.width - roomWidth - padding));
  const roomZ = rng.range(node.z + padding, Math.max(node.z + padding, node.z + node.depth - roomDepth - padding));

  const shape = pickRoomShape(rng, roomWidth, roomDepth);

  let subRooms: { x: number; z: number; width: number; depth: number }[] | undefined;
  if (shape === "lshaped") {
    subRooms = createLShapedSubRooms(roomX, roomZ, roomWidth, roomDepth, rng);
  } else if (shape === "cross") {
    subRooms = createCrossSubRooms(roomX, roomZ, roomWidth, roomDepth, rng);
  }

  const room: DungeonRoom = {
    x: roomX,
    z: roomZ,
    width: roomWidth,
    depth: roomDepth,
    type: "normal",
    shape,
    subRooms,
  };

  node.room = room;
  rooms.push(room);
}

function getRoom(node: BSPNode): DungeonRoom | null {
  if (node.room) return node.room;
  if (node.left) {
    const r = getRoom(node.left);
    if (r) return r;
  }
  if (node.right) {
    const r = getRoom(node.right);
    if (r) return r;
  }
  return null;
}

function getRoomConnectionPoint(room: DungeonRoom): { cx: number; cz: number } {
  if (room.subRooms && room.subRooms.length > 0) {
    const largest = room.subRooms.reduce((a, b) => (a.width * a.depth > b.width * b.depth ? a : b));
    return { cx: largest.x + largest.width / 2, cz: largest.z + largest.depth / 2 };
  }
  return { cx: room.x + room.width / 2, cz: room.z + room.depth / 2 };
}

function connectRooms(node: BSPNode, rng: SeededRandom, corridors: DungeonRoom[]): void {
  if (!node.left || !node.right) return;

  connectRooms(node.left, rng, corridors);
  connectRooms(node.right, rng, corridors);

  const leftRoom = getRoom(node.left);
  const rightRoom = getRoom(node.right);
  if (!leftRoom || !rightRoom) return;

  const lPt = getRoomConnectionPoint(leftRoom);
  const rPt = getRoomConnectionPoint(rightRoom);
  const lCx = lPt.cx;
  const lCz = lPt.cz;
  const rCx = rPt.cx;
  const rCz = rPt.cz;

  const corridorWidth = rng.chance(0.3) ? 4 : 3;

  if (rng.next() > 0.5) {
    corridors.push({
      x: Math.min(lCx, rCx) - corridorWidth / 2,
      z: lCz - corridorWidth / 2,
      width: Math.abs(rCx - lCx) + corridorWidth,
      depth: corridorWidth,
      type: "corridor",
      shape: "rectangle",
    });
    corridors.push({
      x: rCx - corridorWidth / 2,
      z: Math.min(lCz, rCz) - corridorWidth / 2,
      width: corridorWidth,
      depth: Math.abs(rCz - lCz) + corridorWidth,
      type: "corridor",
      shape: "rectangle",
    });
  } else {
    corridors.push({
      x: lCx - corridorWidth / 2,
      z: Math.min(lCz, rCz) - corridorWidth / 2,
      width: corridorWidth,
      depth: Math.abs(rCz - lCz) + corridorWidth,
      type: "corridor",
      shape: "rectangle",
    });
    corridors.push({
      x: Math.min(lCx, rCx) - corridorWidth / 2,
      z: rCz - corridorWidth / 2,
      width: Math.abs(rCx - lCx) + corridorWidth,
      depth: corridorWidth,
      type: "corridor",
      shape: "rectangle",
    });
  }
}

function generateWalls(rooms: DungeonRoom[], corridors: DungeonRoom[]): DungeonWall[] {
  const walls: DungeonWall[] = [];
  const wallThickness = 0.5;
  const wallHeight = 4;

  const allSpaces: { x: number; z: number; width: number; depth: number }[] = [];
  for (const r of rooms) {
    if (r.subRooms) {
      allSpaces.push(...r.subRooms);
    } else {
      allSpaces.push(r);
    }
  }
  for (const c of corridors) {
    allSpaces.push(c);
  }

  const wallRects = allSpaces.filter(r => {
    const room = rooms.find(rm => rm === r || (rm.subRooms && rm.subRooms.includes(r)));
    return !room || room.type !== "corridor";
  });

  for (const rect of allSpaces) {
    const x = rect.x;
    const z = rect.z;
    const w = rect.width;
    const d = rect.depth;

    const sides = [
      { wx: x + w / 2, wz: z, ww: w + wallThickness, wd: wallThickness, rot: 0 },
      { wx: x + w / 2, wz: z + d, ww: w + wallThickness, wd: wallThickness, rot: 0 },
      { wx: x, wz: z + d / 2, ww: wallThickness, wd: d + wallThickness, rot: 0 },
      { wx: x + w, wz: z + d / 2, ww: wallThickness, wd: d + wallThickness, rot: 0 },
    ];

    for (const side of sides) {
      let hasOpening = false;
      for (const other of allSpaces) {
        if (other === rect) continue;
        const overlapX = side.wx - side.ww / 2 < other.x + other.width && side.wx + side.ww / 2 > other.x;
        const overlapZ = side.wz - side.wd / 2 < other.z + other.depth && side.wz + side.wd / 2 > other.z;
        if (overlapX && overlapZ) {
          hasOpening = true;
          break;
        }
      }

      if (!hasOpening) {
        walls.push({
          x: side.wx,
          z: side.wz,
          width: side.ww,
          depth: side.wd,
          height: wallHeight,
          rotation: side.rot,
        });
      }
    }
  }

  return walls;
}

function generateDecor(rooms: DungeonRoom[], rng: SeededRandom, theme: DungeonTheme): DungeonDecor[] {
  const decor: DungeonDecor[] = [];

  for (const room of rooms) {
    if (room.type === "corridor") {
      if (rng.chance(0.4)) {
        const cx = room.x + room.width / 2;
        const cz = room.z + room.depth / 2;
        const lightType = theme === "mine" ? "torch" : "brazier";
        decor.push({ type: lightType as DecorType, x: cx, z: cz, rotation: 0 });
      }
      continue;
    }

    const cx = room.x + room.width / 2;
    const cz = room.z + room.depth / 2;

    const lightType: DecorType = theme === "crypt" ? "torch" : theme === "mine" ? "torch" : "brazier";
    decor.push({ type: lightType, x: room.x + 1, z: room.z + 1, rotation: 0 });
    decor.push({ type: lightType, x: room.x + room.width - 1, z: room.z + 1, rotation: Math.PI });
    decor.push({ type: lightType, x: room.x + 1, z: room.z + room.depth - 1, rotation: 0 });
    decor.push({ type: lightType, x: room.x + room.width - 1, z: room.z + room.depth - 1, rotation: Math.PI });

    if ((room.shape === "pillared" || room.width > 8 && room.depth > 8) && room.shape !== "circular") {
      const pillarInset = 2;
      decor.push({ type: "pillar", x: room.x + pillarInset, z: room.z + pillarInset, rotation: 0 });
      decor.push({ type: "pillar", x: room.x + room.width - pillarInset, z: room.z + pillarInset, rotation: 0 });
      decor.push({ type: "pillar", x: room.x + pillarInset, z: room.z + room.depth - pillarInset, rotation: 0 });
      decor.push({ type: "pillar", x: room.x + room.width - pillarInset, z: room.z + room.depth - pillarInset, rotation: 0 });

      if (room.shape === "pillared" && room.width > 12 && room.depth > 12) {
        const midX = cx;
        const midZ = cz;
        decor.push({ type: "pillar", x: midX, z: room.z + pillarInset, rotation: 0 });
        decor.push({ type: "pillar", x: midX, z: room.z + room.depth - pillarInset, rotation: 0 });
        decor.push({ type: "pillar", x: room.x + pillarInset, z: midZ, rotation: 0 });
        decor.push({ type: "pillar", x: room.x + room.width - pillarInset, z: midZ, rotation: 0 });
      }
    }

    switch (room.type) {
      case "treasure":
        decor.push({ type: "chest", x: cx, z: cz, rotation: rng.range(0, Math.PI * 2) });
        decor.push({ type: "chest", x: cx + rng.range(-2, 2), z: cz + rng.range(-2, 2), rotation: rng.range(0, Math.PI * 2) });
        if (rng.chance(0.5)) {
          decor.push({ type: "chest", x: cx + rng.range(-3, 3), z: cz + rng.range(-3, 3), rotation: rng.range(0, Math.PI * 2) });
        }
        decor.push({ type: "coins", x: cx + rng.range(-1, 1), z: cz + rng.range(1, 2), rotation: 0 });
        if (rng.chance(0.5)) {
          decor.push({ type: "loot_sack", x: cx + rng.range(-3, 3), z: cz + rng.range(-3, 3), rotation: rng.range(0, Math.PI) });
        }
        if (rng.chance(0.3)) {
          decor.push({ type: "potion", x: cx + rng.range(-2, 2), z: cz + rng.range(-2, 2), rotation: 0 });
        }
        break;

      case "shrine":
        decor.push({ type: "altar", x: cx, z: cz, rotation: 0, scale: 1.2 });
        if (theme === "crypt") {
          decor.push({ type: "sarcophagus", x: cx - 2, z: cz, rotation: 0 });
          decor.push({ type: "sarcophagus", x: cx + 2, z: cz, rotation: 0 });
        } else if (theme === "temple") {
          decor.push({ type: "statue", x: cx - 2.5, z: cz - 1, rotation: Math.PI / 4 });
          decor.push({ type: "statue", x: cx + 2.5, z: cz - 1, rotation: -Math.PI / 4 });
        }
        decor.push({ type: "crystal", x: cx, z: cz - 0.5, rotation: 0, scale: 0.6 });
        break;

      case "armory":
        decor.push({ type: "weapon_rack", x: room.x + 1.5, z: cz, rotation: Math.PI / 2 });
        decor.push({ type: "weapon_rack", x: room.x + room.width - 1.5, z: cz, rotation: -Math.PI / 2 });
        decor.push({ type: "armor", x: room.x + 1.5, z: cz - 3, rotation: Math.PI / 2 });
        decor.push({ type: "armor", x: room.x + room.width - 1.5, z: cz - 3, rotation: -Math.PI / 2 });
        if (rng.chance(0.6)) {
          decor.push({ type: "chest", x: cx, z: room.z + room.depth - 2, rotation: 0 });
        }
        if (rng.chance(0.4)) {
          decor.push({ type: "barrel", x: room.x + 1.5, z: room.z + 1.5, rotation: 0 });
        }
        if (rng.chance(0.3)) {
          decor.push({ type: "bench", x: cx, z: room.z + 1.5, rotation: 0 });
        }
        break;

      case "library":
        for (let bx = room.x + 1.5; bx < room.x + room.width - 1.5; bx += 3) {
          decor.push({ type: "bookshelf", x: bx, z: room.z + 1, rotation: 0 });
          if (rng.chance(0.5)) {
            decor.push({ type: "bookshelf", x: bx, z: room.z + room.depth - 1, rotation: Math.PI });
          }
        }
        decor.push({ type: "table", x: cx, z: cz, rotation: 0 });
        decor.push({ type: "chair", x: cx - 1.5, z: cz, rotation: Math.PI / 2 });
        if (rng.chance(0.6)) {
          decor.push({ type: "spellbook", x: cx + rng.range(-0.5, 0.5), z: cz + rng.range(-0.3, 0.3), rotation: rng.range(0, Math.PI) });
        }
        if (rng.chance(0.5)) {
          decor.push({ type: "cauldron", x: cx + rng.range(2, 3), z: cz + rng.range(1, 2), rotation: 0 });
        }
        if (rng.chance(0.4)) {
          decor.push({ type: "potion", x: room.x + rng.range(1, 2), z: cz + rng.range(-1, 1), rotation: 0 });
        }
        break;

      case "trap":
        if (theme === "mine") {
          decor.push({ type: "lava_pool", x: cx, z: cz, rotation: 0, scale: rng.range(2, 4) });
          decor.push({ type: "rubble", x: cx + rng.range(-3, 3), z: cz + rng.range(-3, 3), rotation: rng.range(0, Math.PI * 2) });
        } else {
          decor.push({ type: "water_pool", x: cx, z: cz, rotation: 0, scale: rng.range(2, 3.5) });
        }
        decor.push({ type: "rubble", x: cx + rng.range(-2, 2), z: cz + rng.range(-2, 2), rotation: rng.range(0, Math.PI * 2) });
        break;

      case "arena":
        if (room.shape === "circular" || rng.chance(0.5)) {
          const radius = Math.min(room.width, room.depth) / 2 - 2;
          const numPillars = rng.int(4, 8);
          for (let i = 0; i < numPillars; i++) {
            const angle = (i / numPillars) * Math.PI * 2;
            decor.push({ type: "pillar", x: cx + Math.cos(angle) * radius, z: cz + Math.sin(angle) * radius, rotation: 0 });
          }
        }
        if (theme === "temple") {
          decor.push({ type: "banner", x: room.x + 1, z: room.z + 1, rotation: 0 });
          decor.push({ type: "banner", x: room.x + room.width - 1, z: room.z + 1, rotation: 0 });
        }
        break;

      case "boss":
        if (theme === "crypt") {
          decor.push({ type: "sarcophagus", x: cx, z: cz - 3, rotation: 0, scale: 1.5 });
          decor.push({ type: "statue", x: room.x + 2, z: room.z + 2, rotation: Math.PI / 4, scale: 1.3 });
          decor.push({ type: "statue", x: room.x + room.width - 2, z: room.z + 2, rotation: -Math.PI / 4, scale: 1.3 });
        } else if (theme === "mine") {
          decor.push({ type: "crystal", x: cx - 3, z: cz, rotation: 0, scale: 1.5 });
          decor.push({ type: "crystal", x: cx + 3, z: cz, rotation: Math.PI / 3, scale: 1.2 });
          decor.push({ type: "lava_pool", x: cx, z: room.z + room.depth - 3, rotation: 0, scale: 3 });
        } else {
          decor.push({ type: "altar", x: cx, z: cz - 2, rotation: 0, scale: 1.5 });
          decor.push({ type: "statue", x: cx - 4, z: cz - 2, rotation: Math.PI / 6 });
          decor.push({ type: "statue", x: cx + 4, z: cz - 2, rotation: -Math.PI / 6 });
          decor.push({ type: "banner", x: room.x + 1, z: cz, rotation: 0 });
          decor.push({ type: "banner", x: room.x + room.width - 1, z: cz, rotation: 0 });
        }
        break;

      default:
        if (room.type === "normal" || room.type === "spawn") {
          if (theme === "crypt" && rng.chance(0.3)) {
            decor.push({ type: "sarcophagus", x: cx + rng.range(-2, 2), z: cz + rng.range(-2, 2), rotation: rng.range(0, Math.PI) });
          }
          if (theme === "mine") {
            if (rng.chance(0.5)) {
              decor.push({ type: "barrel", x: room.x + rng.range(1, 3), z: room.z + rng.range(1, 3), rotation: 0 });
            }
            if (rng.chance(0.4)) {
              decor.push({ type: "crate", x: room.x + room.width - rng.range(1, 3), z: room.z + rng.range(1, 3), rotation: rng.range(0, Math.PI / 2) });
            }
            if (rng.chance(0.25)) {
              decor.push({ type: "minecart", x: cx, z: cz, rotation: rng.range(0, Math.PI * 2) });
            }
            if (rng.chance(0.3)) {
              decor.push({ type: "scaffold", x: room.x + room.width - 2, z: cz, rotation: 0 });
            }
            if (rng.chance(0.18)) {
              decor.push({ type: "anvil", x: room.x + 2, z: room.z + room.depth - 2, rotation: rng.range(0, Math.PI * 2) });
            }
          }
          if ((theme === "crypt" || theme === "temple") && rng.chance(0.18)) {
            decor.push({ type: "bed", x: room.x + 1.5, z: room.z + room.depth - 1.5, rotation: 0 });
          }
          if (theme === "temple" && rng.chance(0.22)) {
            decor.push({ type: "cabinet", x: room.x + room.width - 1.5, z: room.z + 1.5, rotation: -Math.PI / 2 });
          }
          if (rng.chance(0.18)) {
            decor.push({ type: "candelabrum", x: cx + rng.range(-1.5, 1.5), z: cz + rng.range(-1.5, 1.5), rotation: rng.range(0, Math.PI * 2) });
          }
          if (theme === "temple" && rng.chance(0.35)) {
            decor.push({ type: "banner", x: room.x + 1, z: cz, rotation: Math.PI / 2 });
          }
          if (rng.chance(0.4)) {
            decor.push({ type: "chest", x: cx + rng.range(-2, 2), z: cz + rng.range(-2, 2), rotation: rng.range(0, Math.PI * 2) });
          }
          if (rng.chance(0.3)) {
            decor.push({ type: "armor", x: room.x + 1.5, z: cz, rotation: Math.PI / 2 });
          }
          if (rng.chance(0.35)) {
            decor.push({ type: "table", x: cx + rng.range(-1, 1), z: cz + rng.range(-1, 1), rotation: rng.range(0, Math.PI) });
            if (rng.chance(0.6)) {
              decor.push({ type: "chair", x: cx + rng.range(-2, -1), z: cz + rng.range(-1, 1), rotation: Math.PI / 2 });
            }
            if (rng.chance(0.4)) {
              decor.push({ type: "stool", x: cx + rng.range(1, 2), z: cz + rng.range(-1, 1), rotation: 0 });
            }
          }
          if (rng.chance(0.25)) {
            decor.push({ type: "barrel", x: room.x + rng.range(1, 2.5), z: room.z + room.depth - rng.range(1, 2.5), rotation: 0 });
            if (rng.chance(0.5)) {
              decor.push({ type: "barrel", x: room.x + rng.range(1, 2.5), z: room.z + room.depth - rng.range(2.5, 4), rotation: 0 });
            }
          }
          if (rng.chance(0.2)) {
            decor.push({ type: "pots", x: room.x + room.width - rng.range(1, 2), z: room.z + room.depth - rng.range(1, 2), rotation: rng.range(0, Math.PI) });
          }
          if (rng.chance(0.15)) {
            decor.push({ type: "coins", x: cx + rng.range(-2, 2), z: cz + rng.range(-2, 2), rotation: rng.range(0, Math.PI * 2) });
          }
          if (rng.chance(0.15)) {
            decor.push({ type: "potion", x: room.x + rng.range(1, 3), z: room.z + rng.range(1, 3), rotation: 0 });
          }
          if (rng.chance(0.1)) {
            decor.push({ type: "bucket", x: room.x + room.width - rng.range(1, 2), z: room.z + rng.range(1, 2), rotation: 0 });
          }
        }
        break;
    }
  }

  return decor;
}

function generateEnemySpawns(rooms: DungeonRoom[], rng: SeededRandom, level: number, theme: DungeonTheme): DungeonEnemySpawn[] {
  const spawns: DungeonEnemySpawn[] = [];
  const baseTypes = [...THEME_ENEMY_TYPES[theme]];
  if (level >= 2) baseTypes.push("pirate");
  if (level >= 3) baseTypes.push("ninja");
  const uniqueTypes = Array.from(new Set(baseTypes));
  const bossTypes = THEME_BOSS_TYPES[theme];

  for (const room of rooms) {
    if (room.type === "spawn" || room.type === "corridor") continue;

    let numEnemies: number;
    if (room.type === "boss") {
      numEnemies = 3 + level;
    } else if (room.type === "arena") {
      numEnemies = 2 + level;
    } else if (room.type === "treasure") {
      numEnemies = 1;
    } else if (room.type === "trap") {
      numEnemies = rng.int(1, 2);
    } else if (room.type === "shrine") {
      numEnemies = rng.chance(0.5) ? 1 : 0;
    } else if (room.type === "library") {
      numEnemies = rng.chance(0.4) ? 1 : 0;
    } else {
      numEnemies = rng.int(1, 2 + Math.floor(level / 2));
    }

    for (let i = 0; i < numEnemies; i++) {
      spawns.push({
        x: room.x + rng.range(2, room.width - 2),
        z: room.z + rng.range(2, room.depth - 2),
        type: room.type === "boss" ? rng.pick(bossTypes) : rng.pick(uniqueTypes),
      });
    }
  }

  return spawns;
}

function assignSpecialRoomTypes(rooms: DungeonRoom[], rng: SeededRandom, theme: DungeonTheme): void {
  const normalRooms = rooms.filter(r => r.type === "normal");
  const specialTypes = THEME_SPECIAL_ROOMS[theme];

  const shuffled = rng.shuffle(normalRooms);
  const numSpecial = Math.min(shuffled.length, Math.max(1, Math.floor(normalRooms.length * 0.4)));

  for (let i = 0; i < numSpecial; i++) {
    shuffled[i].type = rng.pick(specialTypes);

    if (shuffled[i].type === "arena" && shuffled[i].width > 10 && shuffled[i].depth > 10) {
      shuffled[i].shape = "circular";
    }
  }
}

function buildTileGrid(rooms: DungeonRoom[], corridors: DungeonRoom[], spawnRoom: DungeonRoom, exitRoom: DungeonRoom): TileGrid {
  const cellMap = new Map<string, DungeonTile>();

  function rasterize(rect: { x: number; z: number; width: number; depth: number }, kind: TileFloorKind, roomType: RoomType, isRoomEdgeRect: boolean) {
    const tx0 = Math.floor(rect.x / TILE_SIZE);
    const tx1 = Math.ceil((rect.x + rect.width) / TILE_SIZE);
    const tz0 = Math.floor(rect.z / TILE_SIZE);
    const tz1 = Math.ceil((rect.z + rect.depth) / TILE_SIZE);
    for (let tx = tx0; tx < tx1; tx++) {
      for (let tz = tz0; tz < tz1; tz++) {
        const key = `${tx},${tz}`;
        const existing = cellMap.get(key);
        if (existing) {
          // Prefer room over corridor for visual styling
          if (existing.floorKind === "corridor" && (kind === "room" || kind === "spawn" || kind === "exit")) {
            existing.floorKind = kind;
            existing.roomType = roomType;
            existing.isRoomEdge = isRoomEdgeRect;
          }
          continue;
        }
        cellMap.set(key, {
          tx,
          tz,
          wx: tx * TILE_SIZE + TILE_SIZE / 2,
          wz: tz * TILE_SIZE + TILE_SIZE / 2,
          floorKind: kind,
          roomType,
          isRoomEdge: isRoomEdgeRect,
          wallN: false, wallS: false, wallE: false, wallW: false,
          doorN: false, doorS: false, doorE: false, doorW: false,
          cornerNE: false, cornerNW: false, cornerSE: false, cornerSW: false,
        });
      }
    }
  }

  for (const room of rooms) {
    const kind: TileFloorKind = room === spawnRoom ? "spawn" : room === exitRoom ? "exit" : "room";
    if (room.subRooms && room.subRooms.length > 0) {
      for (const sr of room.subRooms) rasterize(sr, kind, room.type, true);
    } else {
      rasterize(room, kind, room.type, true);
    }
  }
  for (const c of corridors) {
    rasterize(c, "corridor", "corridor", false);
  }

  // Compute walls + corners by checking neighbors
  const allTiles = Array.from(cellMap.values());
  for (const tile of allTiles) {
    const { tx, tz } = tile;
    const n = cellMap.get(`${tx},${tz - 1}`);
    const s = cellMap.get(`${tx},${tz + 1}`);
    const e = cellMap.get(`${tx + 1},${tz}`);
    const w = cellMap.get(`${tx - 1},${tz}`);

    tile.wallN = !n;
    tile.wallS = !s;
    tile.wallE = !e;
    tile.wallW = !w;

    // Doorways: where a corridor meets a room edge tile, mark a door instead of a wall
    // (We don't actually have walls at corridor-room joins because both are floor; but mark
    //  the room edge that faces a corridor neighbor as a doorway candidate so we can place
    //  arch/door pieces there.)
    if (tile.floorKind !== "corridor") {
      if (n && n.floorKind === "corridor") tile.doorN = true;
      if (s && s.floorKind === "corridor") tile.doorS = true;
      if (e && e.floorKind === "corridor") tile.doorE = true;
      if (w && w.floorKind === "corridor") tile.doorW = true;
    }

    // Corner pieces sit at the corner where two perpendicular walls meet on this tile.
    // To avoid double placement across diagonal neighbors, also require diagonal cell empty.
    const ne = cellMap.get(`${tx + 1},${tz - 1}`);
    const nw = cellMap.get(`${tx - 1},${tz - 1}`);
    const se = cellMap.get(`${tx + 1},${tz + 1}`);
    const sw = cellMap.get(`${tx - 1},${tz + 1}`);
    tile.cornerNE = tile.wallN && tile.wallE && !ne;
    tile.cornerNW = tile.wallN && tile.wallW && !nw;
    tile.cornerSE = tile.wallS && tile.wallE && !se;
    tile.cornerSW = tile.wallS && tile.wallW && !sw;
  }

  return { tiles: Array.from(cellMap.values()), cellSize: TILE_SIZE };
}

/**
 * Geometry constants for climbable placement. Must agree with the wall
 * height / thickness used by `TileGridColliders` in `DungeonScene.tsx`
 * so the climbables sit flush with the rendered walls.
 */
const CLIMB_WALL_HEIGHT = 4;
const CLIMB_WALL_THICKNESS = 0.4;
const CLIMB_LADDER_HEIGHT = 5;
const CLIMB_LADDER_WIDTH = 0.9;
/** How far the ladder is inset from the wall face into the room, in metres. */
const CLIMB_LADDER_INSET = 0.25;
/** Fraction of room (non-corridor, non-spawn) wall edges to convert into
 *  climbable wall faces. Kept low so climbing remains a notable gameplay
 *  beat rather than the default traversal mode. */
const CLIMB_WALL_FRACTION = 0.06;
/** Probability per eligible larger room of dropping a ladder against one
 *  of its interior wall edges. */
const CLIMB_LADDER_PROBABILITY = 0.45;

type ClimbEdge = { tile: DungeonTile; side: "N" | "S" | "E" | "W" };

/** Convert a tile/side wall edge into a climbable wall placement. */
function makeWallClimbable(edge: ClimbEdge): DungeonClimbable {
  const half = TILE_SIZE / 2;
  const { tile, side } = edge;
  const size: [number, number, number] = [TILE_SIZE, CLIMB_WALL_HEIGHT, CLIMB_WALL_THICKNESS];
  const yc = CLIMB_WALL_HEIGHT / 2;
  switch (side) {
    case "N":
      return { kind: "wall", position: [tile.wx, yc, tile.wz - half], rotationY: 0, size };
    case "S":
      return { kind: "wall", position: [tile.wx, yc, tile.wz + half], rotationY: Math.PI, size };
    case "E":
      return { kind: "wall", position: [tile.wx + half, yc, tile.wz], rotationY: -Math.PI / 2, size };
    case "W":
      return { kind: "wall", position: [tile.wx - half, yc, tile.wz], rotationY: Math.PI / 2, size };
  }
}

/** Convert a tile/side wall edge into a ladder placement that sits against
 *  the inside face of that wall, inset slightly into the room so the
 *  player capsule has clearance. */
function makeLadderClimbable(edge: ClimbEdge): DungeonClimbable {
  const half = TILE_SIZE / 2;
  const { tile, side } = edge;
  const inset = CLIMB_LADDER_INSET;
  const base = {
    kind: "ladder" as const,
    height: CLIMB_LADDER_HEIGHT,
    width: CLIMB_LADDER_WIDTH,
  };
  switch (side) {
    case "N":
      return { ...base, position: [tile.wx, 0, tile.wz - half + inset], rotationY: 0 };
    case "S":
      return { ...base, position: [tile.wx, 0, tile.wz + half - inset], rotationY: Math.PI };
    case "E":
      return { ...base, position: [tile.wx + half - inset, 0, tile.wz], rotationY: -Math.PI / 2 };
    case "W":
      return { ...base, position: [tile.wx - half + inset, 0, tile.wz], rotationY: Math.PI / 2 };
  }
}

/**
 * Pick climbable surfaces from the tile grid: a small fraction of room
 * wall edges become climbable wall faces, and a few larger rooms get a
 * ladder pressed against one of their interior walls.
 *
 * Spawn-room and corridor walls are intentionally skipped so the very
 * start of the level stays focused on orientation, and so corridors —
 * which are tight and pass-through — don't get cluttered.
 */
function generateClimbables(
  grid: TileGrid,
  rooms: DungeonRoom[],
  rng: SeededRandom,
): DungeonClimbable[] {
  const climbables: DungeonClimbable[] = [];

  // Collect every eligible wall edge across all non-corridor, non-spawn tiles.
  const edges: ClimbEdge[] = [];
  for (const tile of grid.tiles) {
    if (tile.floorKind === "corridor" || tile.floorKind === "spawn") continue;
    if (tile.wallN) edges.push({ tile, side: "N" });
    if (tile.wallS) edges.push({ tile, side: "S" });
    if (tile.wallE) edges.push({ tile, side: "E" });
    if (tile.wallW) edges.push({ tile, side: "W" });
  }
  if (edges.length === 0) return climbables;

  // Reserve a pool for climbable wall faces. Use a Set of "tx,tz,side"
  // keys so ladders later don't double up on the same edge.
  const usedKeys = new Set<string>();
  const keyOf = (e: ClimbEdge) => `${e.tile.tx},${e.tile.tz},${e.side}`;

  const shuffled = rng.shuffle(edges);
  const numClimbable = Math.max(1, Math.floor(edges.length * CLIMB_WALL_FRACTION));
  let cursor = 0;
  for (let i = 0; i < numClimbable && cursor < shuffled.length; i++, cursor++) {
    const e = shuffled[cursor];
    climbables.push(makeWallClimbable(e));
    usedKeys.add(keyOf(e));
  }

  // Ladders: per eligible "larger" room, roll the dice and place a
  // ladder against one of its interior wall edges. Ladders extend
  // CLIMB_LADDER_HEIGHT (slightly above the wall top) so the climb
  // controller can fire its top-out transition.
  //
  // To guarantee the level always offers a ladder somewhere when the
  // geometry can support one, we first build the eligible-room list
  // and force the first one to receive a ladder regardless of the
  // probability roll. Subsequent eligible rooms still respect the
  // CLIMB_LADDER_PROBABILITY dice so ladders don't blanket every room.
  const eligibleRooms = rooms.filter(
    (r) =>
      r.type !== "spawn" &&
      r.type !== "corridor" &&
      r.width >= 8 &&
      r.depth >= 8,
  );
  let placedLadder = false;
  for (let ri = 0; ri < eligibleRooms.length; ri++) {
    const room = eligibleRooms[ri];
    const force = !placedLadder && ri === eligibleRooms.length - 1;
    if (!force && !rng.chance(CLIMB_LADDER_PROBABILITY)) continue;

    const roomEdges = edges.filter((e) => {
      if (usedKeys.has(keyOf(e))) return false;
      const t = e.tile;
      const inRect = (r: { x: number; z: number; width: number; depth: number }) =>
        t.wx >= r.x && t.wx <= r.x + r.width && t.wz >= r.z && t.wz <= r.z + r.depth;
      return room.subRooms ? room.subRooms.some(inRect) : inRect(room);
    });
    if (roomEdges.length === 0) continue;

    const e = rng.pick(roomEdges);
    climbables.push(makeLadderClimbable(e));
    usedKeys.add(keyOf(e));
    placedLadder = true;
  }

  return climbables;
}

function getRoomFloorTiles(room: DungeonRoom): { x: number; z: number; width: number; depth: number }[] {
  if (room.subRooms && room.subRooms.length > 0) {
    return room.subRooms.map(sr => ({
      x: sr.x + sr.width / 2,
      z: sr.z + sr.depth / 2,
      width: sr.width,
      depth: sr.depth,
    }));
  }
  return [{
    x: room.x + room.width / 2,
    z: room.z + room.depth / 2,
    width: room.width,
    depth: room.depth,
  }];
}

export function generateDungeon(seed: number, level: number = 1): DungeonLayout {
  const rng = new SeededRandom(seed);
  const theme = THEME_FOR_LEVEL[level] || (["crypt", "mine", "temple"] as DungeonTheme[])[level % 3];

  const dungeonWidth = 60 + level * 10;
  const dungeonDepth = 60 + level * 10;
  const minRoomSize = 10;

  const root: BSPNode = {
    x: 0,
    z: 0,
    width: dungeonWidth,
    depth: dungeonDepth,
    left: null,
    right: null,
    room: null,
  };

  const splitDepth = 3 + Math.min(level, 3);
  splitBSP(root, rng, minRoomSize, splitDepth);

  const rooms: DungeonRoom[] = [];
  createRooms(root, rng, rooms, 2);

  if (rooms.length === 0) {
    rooms.push({
      x: 5, z: 5,
      width: dungeonWidth - 10,
      depth: dungeonDepth - 10,
      type: "spawn",
      shape: "rectangle",
    });
  }

  rooms[0].type = "spawn";
  rooms[0].shape = "rectangle";

  if (rooms.length > 1) {
    rooms[rooms.length - 1].type = "boss";
    if (rooms[rooms.length - 1].width > 12 && rooms[rooms.length - 1].depth > 12) {
      rooms[rooms.length - 1].shape = rng.chance(0.5) ? "pillared" : "circular";
    }
  }

  const treasureIdx = Math.floor(rooms.length / 2);
  if (rooms.length > 2 && rooms[treasureIdx].type === "normal") {
    rooms[treasureIdx].type = "treasure";
  }

  assignSpecialRoomTypes(rooms, rng, theme);

  const corridors: DungeonRoom[] = [];
  connectRooms(root, rng, corridors);

  const allRooms = [...rooms, ...corridors];
  const walls = generateWalls(rooms, corridors);
  const decor = generateDecor(allRooms, rng, theme);
  const enemySpawns = generateEnemySpawns(rooms, rng, level, theme);

  const spawnRoom = rooms[0];
  const spawnPt = getRoomConnectionPoint(spawnRoom);
  const spawnPoint = { x: spawnPt.cx, z: spawnPt.cz };

  const exitRoom = rooms.length > 1 ? rooms[rooms.length - 1] : rooms[0];
  const exitPt = getRoomConnectionPoint(exitRoom);
  const exitPoint = { x: exitPt.cx, z: exitPt.cz };

  const floorTiles: { x: number; z: number; width: number; depth: number }[] = [];
  for (const r of allRooms) {
    floorTiles.push(...getRoomFloorTiles(r));
  }

  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const r of allRooms) {
    minX = Math.min(minX, r.x);
    maxX = Math.max(maxX, r.x + r.width);
    minZ = Math.min(minZ, r.z);
    maxZ = Math.max(maxZ, r.z + r.depth);
  }

  const tileGrid = buildTileGrid(rooms, corridors, spawnRoom, exitRoom);
  const climbables = generateClimbables(tileGrid, rooms, rng);

  return {
    rooms,
    walls,
    decor,
    enemySpawns,
    climbables,
    spawnPoint,
    exitPoint,
    floorTiles,
    bounds: { minX, maxX, minZ, maxZ },
    theme,
    tileGrid,
  };
}
