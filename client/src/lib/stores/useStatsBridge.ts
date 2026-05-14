import { useCharacterStats, type SecondaryStats } from "./useCharacterStats";
import { useSurvival } from "./useSurvival";

let _cachedStats: SecondaryStats | null = null;
let _cachedStatsCharId = "";
let _cachedStatsVersion = -1;
let _subscriptionActive = false;

export function getCachedPlayerStats(characterId: string | null): SecondaryStats | null {
  if (!characterId) return null;
  const hero = useCharacterStats.getState().heroes[characterId];
  if (!hero) return null;

  const version = hero.attributePointsSpent + hero.level + Object.values(hero.skills).reduce((a, b) => a + b, 0);
  if (characterId === _cachedStatsCharId && version === _cachedStatsVersion && _cachedStats) {
    return _cachedStats;
  }

  _cachedStats = useCharacterStats.getState().getSecondaryStats(characterId);
  _cachedStatsCharId = characterId;
  _cachedStatsVersion = version;
  return _cachedStats;
}

export function getPlayerStatsForSync(characterId: string): { maxHP: number; staminaMax: number } | null {
  const stats = getCachedPlayerStats(characterId);
  if (!stats) return null;
  return { maxHP: stats.health, staminaMax: stats.stamina };
}

export function syncStatsToSurvivalNow() {
  const cid = useSurvival.getState().activeCharacterId;
  if (!cid) return;
  const sync = getPlayerStatsForSync(cid);
  if (!sync) return;
  const surv = useSurvival.getState();
  if (surv.maxHealth !== sync.maxHP || surv.maxStamina !== sync.staminaMax) {
    const hRatio = surv.maxHealth > 0 ? surv.health / surv.maxHealth : 1;
    const sRatio = surv.maxStamina > 0 ? surv.stamina / surv.maxStamina : 1;
    useSurvival.setState({
      maxHealth: sync.maxHP,
      health: Math.round(hRatio * sync.maxHP),
      maxStamina: sync.staminaMax,
      stamina: Math.round(sRatio * sync.staminaMax),
    });
  }
}

export function initStatsBridge() {
  if (_subscriptionActive) return;
  _subscriptionActive = true;
  useCharacterStats.subscribe(() => {
    resetStatsCache();
    syncStatsToSurvivalNow();
  });
}

export function resetStatsCache() {
  _cachedStats = null;
  _cachedStatsCharId = "";
  _cachedStatsVersion = -1;
}
