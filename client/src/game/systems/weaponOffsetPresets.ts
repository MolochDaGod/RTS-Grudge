import { useEffect, useState } from "react";
import type { WeaponOffsetConfig } from "@/game/systems/BoneAliases";

export const WEAPON_OFFSET_PRESETS_STORAGE_KEY = "weapon_offset_presets";

export type WeaponOffsetComboPresets = {
  presets: Record<string, WeaponOffsetConfig>;
  active?: string;
};

export type WeaponOffsetPresetsStore = Record<string, WeaponOffsetComboPresets>;

export function weaponOffsetComboKey(
  characterId: string | undefined,
  weaponRight: string | null | undefined,
  weaponLeft: string | null | undefined,
): string {
  return `${characterId || "hero"}|${weaponRight || "none"}|${weaponLeft || "none"}`;
}

export function readWeaponOffsetPresetsStore(): WeaponOffsetPresetsStore {
  try {
    const raw = localStorage.getItem(WEAPON_OFFSET_PRESETS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as WeaponOffsetPresetsStore) : {};
  } catch {
    return {};
  }
}

export function writeWeaponOffsetPresetsStore(store: WeaponOffsetPresetsStore): void {
  try {
    localStorage.setItem(WEAPON_OFFSET_PRESETS_STORAGE_KEY, JSON.stringify(store));
  } catch {}
}

export function cloneWeaponOffset(o: WeaponOffsetConfig): WeaponOffsetConfig {
  return {
    rightPos: [...o.rightPos] as [number, number, number],
    rightRot: [...o.rightRot] as [number, number, number],
    rightScale: [...o.rightScale] as [number, number, number],
    leftPos: [...o.leftPos] as [number, number, number],
    leftRot: [...o.leftRot] as [number, number, number],
    leftScale: [...o.leftScale] as [number, number, number],
  };
}

/**
 * React hook that exposes the current weapon-offset preset library and keeps it
 * in sync with `localStorage` updates from other surfaces (e.g. the in-game
 * tuner saves while the character creator is mounted in another tab/route).
 */
export function useWeaponOffsetPresetsStore(): [
  WeaponOffsetPresetsStore,
  React.Dispatch<React.SetStateAction<WeaponOffsetPresetsStore>>,
] {
  const [store, setStore] = useState<WeaponOffsetPresetsStore>(() =>
    readWeaponOffsetPresetsStore(),
  );

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === WEAPON_OFFSET_PRESETS_STORAGE_KEY) {
        setStore(readWeaponOffsetPresetsStore());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return [store, setStore];
}
