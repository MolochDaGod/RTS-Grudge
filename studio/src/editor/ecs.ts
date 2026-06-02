/**
 * Tiny ECS layer (miniplex) for the runtime preview. The editor
 * authors plain JSON entities; we hydrate them into ECS components
 * here so a future game runtime can attach systems (movement, AI,
 * combat) without touching the editor's data model.
 *
 * Components are intentionally permissive — gameplay code only reads
 * the fields it knows about.
 */
import { World } from 'miniplex';
import type { PlacedEntity } from '../types';

export interface RuntimeComponents {
  id: string;
  kind: PlacedEntity['kind'];
  name: string;
  asset?: string;
  transform: {
    position: [number, number, number];
    rotation: [number, number, number];
    scale:    [number, number, number];
  };
  data: Record<string, unknown>;

  // Optional gameplay components — populated by future systems
  hp?:      { current: number; max: number };
  faction?: string;
  velocity?: [number, number, number];
}

export type RuntimeEntity = Partial<RuntimeComponents> & { id: string };

export function createWorld(entities: PlacedEntity[]): World<RuntimeEntity> {
  const world = new World<RuntimeEntity>();
  for (const e of entities) {
    world.add({
      id: e.id,
      kind: e.kind,
      name: e.name,
      asset: e.asset,
      transform: { position: e.position, rotation: e.rotation, scale: e.scale },
      data: e.data,
      ...(typeof e.data?.hp === 'number'
        ? { hp: { current: e.data.hp as number, max: e.data.hp as number } }
        : {}),
      ...(typeof e.data?.faction === 'string'
        ? { faction: e.data.faction as string }
        : {}),
    });
  }
  return world;
}
