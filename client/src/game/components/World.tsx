import { useMemo, Suspense } from "react";
import * as THREE from "three";
import { importFromScene } from "../systems/AssetPipeline";
import { getTerrainHeight, globalHeightData } from "./Terrain";
import { useAsset } from "../hooks/useAsset";

const glbNormalizedCache = new Map<string, THREE.Object3D>();

function GLBModel({ path, position, targetHeight = 2, rotation = [0, 0, 0] as [number, number, number], shadows = false }: {
  path: string;
  position: [number, number, number];
  targetHeight?: number;
  rotation?: [number, number, number];
  shadows?: boolean;
}) {
  const gltf = useAsset(path);
  const model = useMemo(() => {
    const cacheKey = `${path}_${targetHeight}_${shadows}`;
    let cached = glbNormalizedCache.get(cacheKey);
    if (!cached) {
      const source = gltf.scene.clone(true);
      const normalized = importFromScene(source, [], path, {
        targetHeight,
        sanitizeBones: false,
        fixDarkMaterials: true,
        enableShadows: shadows,
      });
      const box = new THREE.Box3().setFromObject(normalized.scene);
      normalized.scene.position.y = -box.min.y;
      cached = normalized.scene;
      glbNormalizedCache.set(cacheKey, cached);
    }
    return cached.clone();
  }, [gltf, targetHeight, path, shadows]);

  return (
    <group position={position} rotation={rotation}>
      <primitive object={model} />
    </group>
  );
}

function PalmTree({ position, scale }: { position: [number, number, number]; scale: number }) {
  return (
    <Suspense fallback={
      <group position={position} scale={scale}>
        <mesh castShadow position={[0, 1.5, 0]}>
          <cylinderGeometry args={[0.15, 0.2, 3, 8]} />
          <meshStandardMaterial color="#5C4033" />
        </mesh>
        <mesh castShadow position={[0, 3.2, 0]}>
          <coneGeometry args={[1.2, 2.5, 8]} />
          <meshStandardMaterial color="#2d5a27" />
        </mesh>
      </group>
    }>
      <GLBModel path="/models/environment/palm_tree.glb" position={position} targetHeight={7 * scale} />
    </Suspense>
  );
}

function RockFBX({ position, scale }: { position: [number, number, number]; scale: number }) {
  return (
    <Suspense fallback={
      <mesh castShadow position={position} scale={scale}>
        <dodecahedronGeometry args={[0.6, 0]} />
        <meshStandardMaterial color="#777" roughness={0.95} />
      </mesh>
    }>
      <GLBModel path="/models/environment/rock.glb" position={position} targetHeight={1.5 * scale} />
    </Suspense>
  );
}

function ChestFBX({ position }: { position: [number, number, number] }) {
  return (
    <Suspense fallback={null}>
      <GLBModel path="/models/environment/chest.glb" position={position} targetHeight={0.8} />
    </Suspense>
  );
}

const ELF_BUILDINGS = [
  "/models/environment/tavern.glb",
  "/models/environment/smithy.glb",
  "/models/environment/bakery.glb",
  "/models/environment/prison.glb",
  "/models/environment/herbalist_shop.glb",
  "/models/environment/alchemist_house.glb",
];

function BuildingFBX({ position, rotation, index = 0 }: { position: [number, number, number]; rotation?: [number, number, number]; index?: number }) {
  const path = ELF_BUILDINGS[index % ELF_BUILDINGS.length];
  return (
    <Suspense fallback={
      <mesh castShadow position={[position[0], position[1] + 2, position[2]]}>
        <boxGeometry args={[3, 4, 3]} />
        <meshStandardMaterial color="#8B7355" roughness={0.9} />
      </mesh>
    }>
      <GLBModel path={path} position={position} targetHeight={10} rotation={rotation} />
    </Suspense>
  );
}

function MedievalGLB({ path, position, targetHeight, rotation }: {
  path: string; position: [number, number, number]; targetHeight: number; rotation?: [number, number, number];
}) {
  const useShadows = targetHeight >= 6;
  return (
    <Suspense fallback={
      <mesh castShadow={useShadows} position={[position[0], position[1] + targetHeight / 2, position[2]]}>
        <boxGeometry args={[2, targetHeight, 2]} />
        <meshStandardMaterial color="#8B6914" roughness={0.9} />
      </mesh>
    }>
      <GLBModel path={path} position={position} targetHeight={targetHeight} rotation={rotation} shadows={useShadows} />
    </Suspense>
  );
}

function RTSBuilding({ path, position, targetHeight, rotation }: {
  path: string; position: [number, number, number]; targetHeight: number; rotation?: [number, number, number];
}) {
  const useShadows = targetHeight >= 6;
  return (
    <Suspense fallback={
      <mesh castShadow={useShadows} position={[position[0], position[1] + targetHeight / 2, position[2]]}>
        <boxGeometry args={[3, targetHeight, 3]} />
        <meshStandardMaterial color="#9B7653" roughness={0.9} />
      </mesh>
    }>
      <GLBModel path={path} position={position} targetHeight={targetHeight} rotation={rotation} shadows={useShadows} />
    </Suspense>
  );
}

function StatueFBX({ position, variant = 1 }: { position: [number, number, number]; variant?: number }) {
  return (
    <Suspense fallback={null}>
      <GLBModel path={`/models/environment/statue_${variant}.glb`} position={position} targetHeight={2.5} />
    </Suspense>
  );
}

function FountainFBX({ position, variant = 1 }: { position: [number, number, number]; variant?: number }) {
  return (
    <Suspense fallback={null}>
      <GLBModel path={`/models/environment/fountain_${variant}.glb`} position={position} targetHeight={2} />
    </Suspense>
  );
}

function BoatFBX({ position }: { position: [number, number, number] }) {
  return (
    <Suspense fallback={null}>
      <GLBModel path="/models/environment/boat.glb" position={position} targetHeight={3} />
    </Suspense>
  );
}

function BridgeFBX({ position, rotation }: { position: [number, number, number]; rotation?: [number, number, number] }) {
  return (
    <Suspense fallback={null}>
      <GLBModel path="/models/environment/elf_bridge.glb" position={position} targetHeight={3.5} rotation={rotation} />
    </Suspense>
  );
}

function ElfLampFBX({ position }: { position: [number, number, number] }) {
  return (
    <Suspense fallback={null}>
      <group>
        <GLBModel path="/models/environment/elf_lamp_1.glb" position={position} targetHeight={2} />
        <pointLight position={[position[0], position[1] + 2.5, position[2]]} color="#ffcc66" intensity={4} distance={12} />
      </group>
    </Suspense>
  );
}

function TentFBX({ position, variant = 1 }: { position: [number, number, number]; variant?: number }) {
  return (
    <Suspense fallback={null}>
      <GLBModel path={`/models/environment/tent_${variant}.glb`} position={position} targetHeight={4} />
    </Suspense>
  );
}

function SignpostFBX({ position }: { position: [number, number, number] }) {
  return (
    <Suspense fallback={null}>
      <GLBModel path="/models/environment/signpost.glb" position={position} targetHeight={2} />
    </Suspense>
  );
}

function CounterFBX({ position }: { position: [number, number, number] }) {
  return (
    <Suspense fallback={null}>
      <GLBModel path="/models/environment/counter.glb" position={position} targetHeight={1.2} />
    </Suspense>
  );
}

function PillarFBX({ position }: { position: [number, number, number] }) {
  return (
    <Suspense fallback={null}>
      <GLBModel path="/models/dungeon/pillar.glb" position={position} targetHeight={5} />
    </Suspense>
  );
}

function TorchFBX({ position }: { position: [number, number, number] }) {
  return (
    <Suspense fallback={null}>
      <group>
        <GLBModel path="/models/dungeon/torch.glb" position={position} targetHeight={1.2} />
        <pointLight position={[position[0], position[1] + 1.5, position[2]]} color="#ff6600" intensity={4} distance={10} />
      </group>
    </Suspense>
  );
}

function Campfire({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const angle = (i / 6) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(angle) * 0.4, 0.1, Math.sin(angle) * 0.4]} rotation={[0.3, angle, 0.2]}>
            <boxGeometry args={[0.15, 0.4, 0.1]} />
            <meshStandardMaterial color="#5C4033" />
          </mesh>
        );
      })}
      <pointLight position={[0, 0.8, 0]} color="#ff6600" intensity={4} distance={12} />
      <mesh position={[0, 0.5, 0]}>
        <coneGeometry args={[0.2, 0.6, 8]} />
        <meshStandardMaterial color="#ff4400" emissive="#ff4400" emissiveIntensity={2} transparent opacity={0.8} />
      </mesh>
      <mesh position={[0.1, 0.7, 0.05]}>
        <coneGeometry args={[0.1, 0.4, 6]} />
        <meshStandardMaterial color="#ffaa00" emissive="#ffaa00" emissiveIntensity={2} transparent opacity={0.6} />
      </mesh>
    </group>
  );
}

function Bush({ position }: { position: [number, number, number] }) {
  return (
    <mesh castShadow position={position}>
      <sphereGeometry args={[0.6, 8, 8]} />
      <meshStandardMaterial color="#3a6a30" />
    </mesh>
  );
}

function th(x: number, z: number): number {
  return getTerrainHeight(x, z, globalHeightData);
}

interface PlacedObj {
  pos: [number, number, number];
  rot?: [number, number, number];
  height?: number;
  path?: string;
  variant?: number;
  scale?: number;
}

export default function World() {
  const worldObjects = useMemo(() => {
    const rng = (seed: number) => {
      let s = seed;
      return () => {
        s = (s * 16807 + 0) % 2147483647;
        return s / 2147483647;
      };
    };
    const rand = rng(42);

    const trees: { pos: [number, number, number]; scale: number }[] = [];
    const rocks: { pos: [number, number, number]; scale: number }[] = [];
    const bushes: [number, number, number][] = [];
    const campfires: [number, number, number][] = [];
    const chests: [number, number, number][] = [];
    const elfBuildings: { pos: [number, number, number]; rot: [number, number, number]; index: number }[] = [];
    const lanterns: [number, number, number][] = [];
    const boats: [number, number, number][] = [];
    const bridges: PlacedObj[] = [];
    const pillars: [number, number, number][] = [];
    const torches: [number, number, number][] = [];
    const statues: { pos: [number, number, number]; variant: number }[] = [];
    const fountains: { pos: [number, number, number]; variant: number }[] = [];
    const tents: { pos: [number, number, number]; variant: number }[] = [];
    const signposts: [number, number, number][] = [];
    const counters: [number, number, number][] = [];
    const medievalBuildings: PlacedObj[] = [];
    const rtsBuildings: PlacedObj[] = [];
    const structureBuildings: PlacedObj[] = [];

    const SPAWN_X = 0, SPAWN_Z = -5, SPAWN_CLEAR = 12;
    const inSpawnZone = (x: number, z: number) =>
      Math.sqrt((x - SPAWN_X) ** 2 + (z - SPAWN_Z) ** 2) < SPAWN_CLEAR;

    for (let i = 0; i < 15; i++) {
      const x = (rand() - 0.5) * 190;
      const z = (rand() - 0.5) * 190;
      if (Math.abs(x) < 8 && Math.abs(z) < 8) continue;
      if (inSpawnZone(x, z)) continue;
      trees.push({ pos: [x, th(x, z), z], scale: 0.6 + rand() * 0.8 });
    }
    for (let i = 0; i < 12; i++) {
      const x = (rand() - 0.5) * 190;
      const z = (rand() - 0.5) * 190;
      if (Math.abs(x) < 5 && Math.abs(z) < 5) continue;
      if (inSpawnZone(x, z)) continue;
      rocks.push({ pos: [x, th(x, z), z], scale: 0.3 + rand() * 1.0 });
    }
    for (let i = 0; i < 10; i++) {
      const x = (rand() - 0.5) * 180;
      const z = (rand() - 0.5) * 180;
      if (inSpawnZone(x, z)) continue;
      bushes.push([x, th(x, z) + 0.3, z]);
    }

    const cfCoords: [number,number][] = [[18,-18],[-15,18],[25,-25],[-40,-40],[70,-30]];
    cfCoords.forEach(([x,z]) => campfires.push([x, th(x, z), z]));

    const chCoords: [number,number][] = [[12,6],[-18,-12],[30,25],[-35,35],[55,-20]];
    chCoords.forEach(([x,z]) => chests.push([x, th(x, z), z]));

    const elfBuildCoords: [number,number,number,number][] = [
      [20,-30,0.5,0],[-25,25,1.2,1],[40,15,2.5,2],[-55,-30,0.8,3],
    ];
    elfBuildCoords.forEach(([x,z,r,idx]) => elfBuildings.push({ pos: [x, th(x,z), z], rot: [0, r, 0], index: idx }));

    const laCoords: [number,number][] = [
      [14,-10],[-20,20],[28,-22],[45,10],
    ];
    laCoords.forEach(([x,z]) => lanterns.push([x, th(x, z), z]));

    boats.push(
      ...([[-40,-80],[85,-70]] as [number,number][]).map(
        ([x,z]) => [x, th(x, z) + 0.2, z] as [number,number,number]
      )
    );
    bridges.push(
      { pos: [0, th(0,-50), -50], rot: [0, 0, 0] },
      { pos: [50, th(50,0), 0], rot: [0, Math.PI / 2, 0] },
    );

    const piCoords: [number,number][] = [[22,-32],[-27,23],[42,13],[67,-52]];
    piCoords.forEach(([x,z]) => pillars.push([x, th(x, z), z]));
    const toCoords: [number,number][] = [[20,-30],[-25,25],[40,15]];
    toCoords.forEach(([x,z]) => torches.push([x, th(x, z), z]));

    statues.push(
      { pos: [-15, th(-15, -18), -18], variant: 1 },
      { pos: [35, th(35, 20), 20], variant: 2 },
    );
    fountains.push(
      { pos: [14, th(14, 15), 15], variant: 1 },
    );
    tents.push(
      { pos: [-10, th(-10, -40), -40], variant: 1 },
      { pos: [45, th(45, -35), -35], variant: 2 },
    );
    const spCoords: [number,number][] = [[18, -20], [-12, 15], [60, 30]];
    spCoords.forEach(([x,z]) => signposts.push([x, th(x, z), z]));
    const ctCoords: [number,number][] = [[22, -28], [-24, 27]];
    ctCoords.forEach(([x,z]) => counters.push([x, th(x, z), z]));

    const medData: { path: string; x: number; z: number; h: number; r: number }[] = [
      { path: "/models/medieval/Tavern.glb", x: -15, z: -25, h: 10, r: 0.8 },
      { path: "/models/medieval/Fantasy Inn.glb", x: 15, z: -20, h: 11, r: 2.2 },
      { path: "/models/medieval/Blacksmith.glb", x: -12, z: 20, h: 8, r: 1.5 },
      { path: "/models/medieval/Mill.glb", x: -30, z: -10, h: 12, r: 0.3 },
      { path: "/models/medieval/Windmill.glb", x: 30, z: -40, h: 14, r: 1.0 },
      { path: "/models/medieval/Fantasy Barracks.glb", x: -35, z: 15, h: 9, r: 2.1 },
      { path: "/models/medieval/Bell Tower.glb", x: 0, z: -30, h: 14, r: 0 },
      { path: "/models/medieval/Wishing Well.glb", x: 18, z: 5, h: 2.5, r: 0 },
      { path: "/models/medieval/Gate - Game Asset.glb", x: 0, z: -40, h: 8, r: 0 },
      { path: "/models/medieval/Fantasy House.glb", x: -40, z: -35, h: 10, r: 0.4 },
      { path: "/models/medieval/FantasyHouse2.glb", x: 50, z: -30, h: 10, r: 2.8 },
      { path: "/models/medieval/FantasyHouse3.glb", x: -50, z: 10, h: 10, r: 1.6 },
    ];
    medData.forEach(({ path, x, z, h, r }) => {
      medievalBuildings.push({ path, pos: [x, th(x, z), z], height: h, rot: [0, r, 0] });
    });

    const rtsData: { path: string; x: number; z: number; h: number; r: number }[] = [
      { path: "/models/rts/Castle.glb", x: -60, z: -60, h: 18, r: 0.5 },
      { path: "/models/rts/Watch Tower.glb", x: 60, z: -60, h: 12, r: 1.0 },
      { path: "/models/rts/Temple.glb", x: 70, z: 55, h: 12, r: 3.0 },
      { path: "/models/rts/Market Stalls.glb", x: -10, z: 35, h: 4, r: 0 },
      { path: "/models/rts/Farm.glb", x: 45, z: 30, h: 5, r: 0.8 },
      { path: "/models/rts/Mine.glb", x: -75, z: -40, h: 7, r: 1.2 },
      { path: "/models/rts/Fortress.glb", x: 75, z: -35, h: 15, r: 2.0 },
      { path: "/models/rts/Town Center.glb", x: 0, z: 55, h: 10, r: 0 },
      { path: "/models/rts/House.glb", x: -30, z: 50, h: 8, r: 0.8 },
      { path: "/models/rts/Farm.glb", x: 50, z: 25, h: 5, r: 0 },
    ];
    rtsData.forEach(({ path, x, z, h, r }) => {
      rtsBuildings.push({ path, pos: [x, th(x, z), z], height: h, rot: [0, r, 0] });
    });

    const structData: { path: string; x: number; z: number; h: number; r: number }[] = [
      { path: "/models/structures/Cabin_Shed.glb", x: -38, z: -15, h: 6, r: 0.6 },
      { path: "/models/structures/Camp_fire.glb", x: -5, z: 10, h: 1.5, r: 0 },
      { path: "/models/structures/Forge.glb", x: -10, z: 22, h: 6, r: 2.8 },
      { path: "/models/structures/Castle_Tower.glb", x: -58, z: -65, h: 15, r: 0.4 },
      { path: "/models/structures/Fantasy_Barracks.glb", x: 68, z: -28, h: 10, r: 1.8 },
      { path: "/models/structures/Crypt.glb", x: -62, z: -58, h: 8, r: 0.3 },
      { path: "/models/structures/Coliseum.glb", x: 85, z: 70, h: 16, r: 0 },
    ];
    structData.forEach(({ path, x, z, h, r }) => {
      structureBuildings.push({ path, pos: [x, th(x, z), z], height: h, rot: [0, r, 0] });
    });

    return {
      trees, rocks, bushes, campfires, chests, elfBuildings, lanterns, boats, bridges,
      pillars, torches, statues, fountains, tents, signposts, counters,
      medievalBuildings, rtsBuildings, structureBuildings,
    };
  }, []);

  return (
    <group>
      {worldObjects.trees.map((t, i) => (
        <PalmTree key={`tree_${i}`} position={t.pos} scale={t.scale} />
      ))}
      {worldObjects.rocks.map((r, i) => (
        <RockFBX key={`rock_${i}`} position={r.pos} scale={r.scale} />
      ))}
      {worldObjects.bushes.map((b, i) => (
        <Bush key={`bush_${i}`} position={b} />
      ))}
      {worldObjects.campfires.map((c, i) => (
        <Campfire key={`camp_${i}`} position={c} />
      ))}
      {worldObjects.chests.map((c, i) => (
        <ChestFBX key={`chest_${i}`} position={c} />
      ))}
      {worldObjects.elfBuildings.map((b, i) => (
        <BuildingFBX key={`elfbuild_${i}`} position={b.pos} rotation={b.rot} index={b.index} />
      ))}
      {worldObjects.lanterns.map((l, i) => (
        <ElfLampFBX key={`lantern_${i}`} position={l} />
      ))}
      {worldObjects.boats.map((b, i) => (
        <BoatFBX key={`boat_${i}`} position={b} />
      ))}
      {worldObjects.bridges.map((b, i) => (
        <BridgeFBX key={`bridge_${i}`} position={b.pos} rotation={b.rot} />
      ))}
      {worldObjects.pillars.map((p, i) => (
        <PillarFBX key={`pillar_${i}`} position={p} />
      ))}
      {worldObjects.torches.map((t, i) => (
        <TorchFBX key={`torch_${i}`} position={t} />
      ))}
      {worldObjects.statues.map((s, i) => (
        <StatueFBX key={`statue_${i}`} position={s.pos} variant={s.variant} />
      ))}
      {worldObjects.fountains.map((f, i) => (
        <FountainFBX key={`fountain_${i}`} position={f.pos} variant={f.variant} />
      ))}
      {worldObjects.tents.map((t, i) => (
        <TentFBX key={`tent_${i}`} position={t.pos} variant={t.variant} />
      ))}
      {worldObjects.signposts.map((s, i) => (
        <SignpostFBX key={`sign_${i}`} position={s} />
      ))}
      {worldObjects.counters.map((c, i) => (
        <CounterFBX key={`counter_${i}`} position={c} />
      ))}
      {worldObjects.medievalBuildings.map((b, i) => (
        <MedievalGLB key={`med_${i}`} path={b.path!} position={b.pos} targetHeight={b.height || 5} rotation={b.rot} />
      ))}
      {worldObjects.rtsBuildings.map((b, i) => (
        <RTSBuilding key={`rts_${i}`} path={b.path!} position={b.pos} targetHeight={b.height || 5} rotation={b.rot} />
      ))}
      {worldObjects.structureBuildings.map((b, i) => (
        <MedievalGLB key={`struct_${i}`} path={b.path!} position={b.pos} targetHeight={b.height || 5} rotation={b.rot} />
      ))}
    </group>
  );
}
