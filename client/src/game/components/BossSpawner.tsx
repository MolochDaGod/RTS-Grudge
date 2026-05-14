import { useEffect, useRef } from "react";
import * as THREE from "three";
import { getTerrainHeight, globalHeightData } from "./Terrain";
import { useEnemyManager, type EnemyType } from "../systems/EnemyManager";
import { useCampaign } from "@/lib/stores/useCampaign";
import { useGame } from "@/lib/stores/useGame";

const BOSS_SPAWN_DISTANCE = 60;
const BOSS_SPAWN_ANGLE = Math.PI * 0.75;

const ISLAND_BOSS_TYPES: EnemyType[] = ["dragon", "dino", "trex"];

let _bossTypeForIsland: EnemyType | null = null;

export function getCampaignBossType(): EnemyType | null {
  return _bossTypeForIsland;
}

export default function BossSpawner() {
  const campaignActive = useCampaign((s) => s.active);
  const currentIslandId = useCampaign((s) => s.currentIslandId);
  const islands = useCampaign((s) => s.islands);
  const { spawnEnemy, enemies } = useEnemyManager();
  const { phase } = useGame();
  const bossSpawned = useRef(false);
  const lastIslandId = useRef("");

  useEffect(() => {
    if (!campaignActive || phase !== "playing") return;

    const island = islands.get(currentIslandId);
    if (!island || island.bossDefeated) return;

    if (currentIslandId !== lastIslandId.current) {
      bossSpawned.current = false;
      lastIslandId.current = currentIslandId;
    }

    if (bossSpawned.current) return;

    const bossIndex = Math.abs(island.seed) % ISLAND_BOSS_TYPES.length;
    const bossType = ISLAND_BOSS_TYPES[bossIndex];
    _bossTypeForIsland = bossType;

    const hasBossAlive = enemies.some(
      (e) => e.type === bossType && !e.isDying
    );
    if (hasBossAlive) {
      bossSpawned.current = true;
      return;
    }

    const bx = Math.cos(BOSS_SPAWN_ANGLE) * BOSS_SPAWN_DISTANCE;
    const bz = Math.sin(BOSS_SPAWN_ANGLE) * BOSS_SPAWN_DISTANCE;
    const by = getTerrainHeight(bx, bz, globalHeightData);
    const pos = new THREE.Vector3(bx, Math.max(by, 0.5), bz);

    spawnEnemy(bossType, pos);
    bossSpawned.current = true;
  }, [campaignActive, currentIslandId, phase, islands, spawnEnemy, enemies]);

  return null;
}
