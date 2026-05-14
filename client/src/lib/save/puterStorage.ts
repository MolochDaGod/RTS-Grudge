import { puterReady } from "@/lib/auth/puter";

// Puter KV-backed cloud save layer. Lives ALONGSIDE the existing
// Postgres-backed `/api/saves/...` flow, not in place of it. The PG copy
// remains the source of truth for cross-device play; the Puter copy is a
// user-owned cloud backup so signed-in players can pull their save from
// any browser/device that signs into the same Puter account, even if the
// game backend is offline.
//
// Storage layout: one KV entry per slot under `grudge.save.<slot>`. Value
// is the JSON-serialized save record. Puter KV values are limited to
// ~400KB which is plenty for our save payload.

const KEY_PREFIX = "grudge.save.";

function key(slot: number): string {
  return `${KEY_PREFIX}${slot}`;
}

export async function putCloudSave(slot: number, save: unknown): Promise<boolean> {
  const sdk = await puterReady();
  if (!sdk) return false;
  try {
    return await sdk.kv.set(key(slot), save);
  } catch (e: any) {
    console.warn("[puter-save] write failed:", e?.message || e);
    return false;
  }
}

export async function getCloudSave<T = unknown>(slot: number): Promise<T | null> {
  const sdk = await puterReady();
  if (!sdk) return null;
  try {
    const v = await sdk.kv.get(key(slot));
    return (v ?? null) as T | null;
  } catch (e: any) {
    console.warn("[puter-save] read failed:", e?.message || e);
    return null;
  }
}

export async function deleteCloudSave(slot: number): Promise<boolean> {
  const sdk = await puterReady();
  if (!sdk) return false;
  try {
    return await sdk.kv.del(key(slot));
  } catch (e: any) {
    console.warn("[puter-save] delete failed:", e?.message || e);
    return false;
  }
}

export async function listCloudSaves(): Promise<number[]> {
  const sdk = await puterReady();
  if (!sdk) return [];
  try {
    const keys = (await sdk.kv.list(`${KEY_PREFIX}*`)) as string[];
    return keys
      .map((k) => Number.parseInt(k.slice(KEY_PREFIX.length), 10))
      .filter((n) => Number.isFinite(n));
  } catch (e: any) {
    console.warn("[puter-save] list failed:", e?.message || e);
    return [];
  }
}
