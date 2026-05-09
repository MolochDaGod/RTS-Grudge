/**
 * Mesh-name classification + bare-skin / head-subcategory heuristics for the
 * Toon RTS race GLBs. Pure data, no React, no Three side-effects beyond
 * reading geometry bounding boxes.
 */
import * as THREE from 'three';

export type SlotKey =
  | 'body' | 'head' | 'arms' | 'legs' | 'shoulderpads'
  | 'weapon' | 'shield' | 'xtra';

/** Toon RTS packs face / beard / helmet under one `*_head_*` mesh-name
 *  prefix. We split them apart at load-time using bounding-box geometry
 *  so the user can stack one of each (e.g. face + beard + helmet). */
export type HeadCat = 'face' | 'beard' | 'helmet';

export const ALL_SLOTS: SlotKey[] = [
  'body', 'head', 'arms', 'legs', 'shoulderpads', 'weapon', 'shield', 'xtra',
];

/** Empty per-slot record (used as default state shape). */
export const emptySlots = <T,>(make: () => T): Record<SlotKey, T> => ({
  body: make(), head: make(), arms: make(), legs: make(),
  shoulderpads: make(), weapon: make(), shield: make(), xtra: make(),
});

/**
 * Categorise a Toon RTS mesh node name.
 *
 * Examples:
 *   "WK_Units_Body_A"  → { slot: 'body', variant: 'A' }
 *   "BRB_arms_C"       → { slot: 'arms', variant: 'C' }
 *   "DWF_weapon_AXE_B" → { slot: 'weapon', variant: 'AXE_B' }
 */
export function classifyMesh(name: string): { slot: SlotKey; variant: string } | null {
  const stripped = name.toLowerCase()
    .replace(/^[a-z]{2,4}_/, '')   // race prefix (wk_, brb_, dwf_, ...)
    .replace(/^units_/, '');        // optional sub-namespace
  const m = stripped.match(/^(body|head|arms|legs|shoulderpads|weapon|shield|xtra)[_-]?(.+)?$/);
  if (!m) return null;
  return {
    slot: m[1] as SlotKey,
    variant: (m[2] ?? 'A').toUpperCase(),
  };
}

// ── Head sub-classification ──────────────────────────────────────────────────

interface HeadVariant { variant: string; box: THREE.Box3 }

/**
 * Bucket each head variant into face / beard / helmet using bounding-box
 * geometry across the whole set, *not* a single reference variant.
 *
 * Why median-based? The previous version anchored on `Head_A`, but for races
 * whose A is a bare skull (humans, undead) every face-with-hair was pushed
 * into the helmet bucket and the Face panel showed empty. Using the median
 * of all variants gives a stable "typical head" baseline regardless of which
 * variant the artist happened to put first.
 *
 * Rules (vs the median head box):
 *   • beard   → small mesh whose top sits below the median head's top.
 *               Captures jaw / chin facial-hair pieces.
 *   • helmet  → top extends notably above median *or* bottom drapes notably
 *               below median (catches hoods that wrap down to the shoulders).
 *   • face    → everything else — full-coverage head meshes that share the
 *               typical head silhouette.
 */
export function classifyHeads(variants: HeadVariant[]): Map<string, HeadCat> {
  const out = new Map<string, HeadCat>();
  if (variants.length === 0) return out;

  const tops  = variants.map(v => v.box.max.y).sort((a, b) => a - b);
  const bots  = variants.map(v => v.box.min.y).sort((a, b) => a - b);
  const sizes = variants.map(v => v.box.max.y - v.box.min.y).sort((a, b) => a - b);
  const med = (arr: number[]) => arr[Math.floor(arr.length / 2)];
  const medTop  = med(tops);
  const medBot  = med(bots);
  const medSize = med(sizes);

  for (const { variant, box } of variants) {
    const top  = box.max.y;
    const bot  = box.min.y;
    const size = top - bot;

    // BEARD: small, sits below the median's crown.
    if (size < medSize * 0.65 && top < medTop - medSize * 0.05) {
      out.set(variant, 'beard');
      continue;
    }
    // HELMET / HOOD: top notably above median (hat) OR bottom notably
    // below median (hood drape onto shoulders).
    if (top > medTop + medSize * 0.06 || bot < medBot - medSize * 0.10) {
      out.set(variant, 'helmet');
      continue;
    }
    out.set(variant, 'face');
  }
  return out;
}

// ── Bare-skin detection ──────────────────────────────────────────────────────

interface BareCandidate { variant: string; verts: number }

/**
 * Pick the "barest" variant for a slot — the one with the fewest vertices,
 * which in the Toon RTS pack correlates with least clothing / armour detail.
 *
 * Returns `null` when the variants are *all* roughly the same vertex count
 * (within `15%` of the median). Toon RTS frequently ships arms and legs as
 * sleeve/boot *texture* variations on identical geometry — there's no
 * separately-modelled bare skin, and pretending one exists would mis-mark
 * a random variant with the bare-skin indicator dot.
 */
export function pickBareSkin(
  variants: BareCandidate[],
  threshold = 0.85,
): string | null {
  if (variants.length === 0) return null;
  if (variants.length === 1) return variants[0].variant;
  const sorted = [...variants].sort((a, b) => a.verts - b.verts);
  const median = sorted[Math.floor(sorted.length / 2)].verts;
  const lowest = sorted[0];
  return lowest.verts <= median * threshold ? lowest.variant : null;
}

// ── Mesh helpers ─────────────────────────────────────────────────────────────

export interface VariantRefs {
  variant: string;
  meshes: THREE.Object3D[];
}

/** Compute a local-space bounding box from a list of mesh nodes. */
export function unionGeometryBox(meshes: THREE.Object3D[]): THREE.Box3 {
  const box = new THREE.Box3();
  for (const obj of meshes) {
    const sm = obj as THREE.Mesh;
    if (sm.geometry) {
      sm.geometry.computeBoundingBox();
      if (sm.geometry.boundingBox) box.union(sm.geometry.boundingBox);
    }
  }
  return box;
}

/** Sum of POSITION attribute counts across a list of mesh nodes. */
export function totalVerts(meshes: THREE.Object3D[]): number {
  let n = 0;
  for (const obj of meshes) {
    const sm = obj as THREE.Mesh;
    const pos = sm.geometry?.getAttribute?.('position');
    if (pos) n += pos.count;
  }
  return n;
}

/** Apply selection-driven visibility to all variant meshes. */
export function applyVisibility(
  refs: Record<SlotKey, VariantRefs[]>,
  selection: Record<SlotKey, Set<string>>,
) {
  for (const slot of ALL_SLOTS) {
    for (const { variant, meshes } of refs[slot]) {
      const visible = selection[slot].has(variant);
      for (const m of meshes) m.visible = visible;
    }
  }
}

/** Bag / wood / log xtra meshes embed their own holding hand + forearm. */
export const isCarryVariant = (v: string) => /bag|wood|log/i.test(v);

// ── Shared previewer/in-game character setup ─────────────────────────────────
// These helpers exist so the in-game ToonCharacter and the editor previewer
// produce IDENTICAL visibility for the same loadout. Drift here historically
// caused the in-game character to render as variant-A defaults while the
// previewer showed bare-skin defaults.

/**
 * Walk a loaded character scene, grouping meshes by slot+variant. Operates on
 * meshes only (never parent Object3D Groups) so we never accidentally hide a
 * Group that contains meshes the user wants visible.
 */
export function buildVariantRefs(root: THREE.Object3D): Record<SlotKey, VariantRefs[]> {
  const cat: Record<SlotKey, Map<string, THREE.Object3D[]>> = emptySlots(() => new Map());
  root.traverse(obj => {
    const m = obj as THREE.Mesh;
    if (!m.isMesh) return;
    const cm = classifyMesh(m.name);
    if (!cm) return;
    const list = cat[cm.slot].get(cm.variant) ?? [];
    list.push(m);
    cat[cm.slot].set(cm.variant, list);
  });

  const refs: Record<SlotKey, VariantRefs[]> = emptySlots(() => []);
  for (const slot of ALL_SLOTS) {
    const variants = [...cat[slot].keys()].sort();
    refs[slot] = variants.map(v => ({ variant: v, meshes: cat[slot].get(v) ?? [] }));
  }
  return refs;
}

/**
 * Compute the previewer's first-mount default selection: bare-skin body/arms/
 * legs (or A fallback), first-face head, no shoulderpads/weapon/shield/xtra.
 * Used by both the previewer's initial state and the in-game ToonCharacter so
 * defaults match perfectly.
 */
export function defaultSelection(refs: Record<SlotKey, VariantRefs[]>): Record<SlotKey, Set<string>> {
  const catalog: Record<SlotKey, string[]> = emptySlots(() => []);
  for (const slot of ALL_SLOTS) catalog[slot] = refs[slot].map(r => r.variant);

  const subcat = classifyHeads(
    refs.head.map(({ variant, meshes }) => ({ variant, box: unionGeometryBox(meshes) })),
  );
  const bareFor = (slot: SlotKey) =>
    pickBareSkin(refs[slot].map(({ variant, meshes }) => ({ variant, verts: totalVerts(meshes) })));
  const bare = { body: bareFor('body'), arms: bareFor('arms'), legs: bareFor('legs') };
  const firstFace = catalog.head.find(v => (subcat.get(v) ?? 'face') === 'face') ?? catalog.head[0];

  return {
    ...emptySlots<Set<string>>(() => new Set()),
    body: new Set([bare.body ?? catalog.body[0]].filter(Boolean) as string[]),
    head: new Set(firstFace ? [firstFace] : []),
    arms: new Set([bare.arms ?? catalog.arms[0]].filter(Boolean) as string[]),
    legs: new Set([bare.legs ?? catalog.legs[0]].filter(Boolean) as string[]),
  };
}

/**
 * Translate an emitted previewer loadout (slot → variant letters) into a
 * selection map. Accepts both `xtra` (previewer) and `extra` (legacy) keys
 * for the carry slot.
 */
export function selectionFromLoadout(
  loadout: Record<string, string[] | undefined>,
): Record<SlotKey, Set<string>> {
  const out = emptySlots<Set<string>>(() => new Set());
  for (const slot of ALL_SLOTS) {
    const vals = loadout[slot] ?? (slot === 'xtra' ? loadout['extra'] : undefined);
    if (vals) out[slot] = new Set(vals.map(v => v.toUpperCase()));
  }
  return out;
}

/**
 * Returns the set of slot keys present in the loadout (so callers can know
 * which slots to override vs leave at their existing selection).
 */
export function loadoutSlotKeys(loadout: Record<string, string[] | undefined>): Set<SlotKey> {
  const out = new Set<SlotKey>();
  for (const slot of ALL_SLOTS) {
    if (loadout[slot] !== undefined) out.add(slot);
    else if (slot === 'xtra' && loadout['extra'] !== undefined) out.add(slot);
  }
  return out;
}
