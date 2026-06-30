/**
 * ClaimArea — the single world anchor for territory ownership.
 *
 * Synonyms (same thing, different UI labels):
 *   claim · claim flag · camp · base · home camp · outpost · fire pit
 *
 * Every anchor has a lit campfire at its centre (volumetric fire via
 * CampfireFireSystem). Players, NPC heroes, and world scatter all
 * register here; gameplay systems query by id or owner, not by label.
 */

export type ClaimOwnerKind = "player" | "hero" | "faction" | "crew" | "world";

/** UI-facing labels — all map to one ClaimArea record. */
export type ClaimAreaLabel =
  | "claim"
  | "flag"
  | "camp"
  | "base"
  | "home"
  | "outpost"
  | "fire_pit";

export interface ClaimArea {
  id: string;
  /** World-space centre (y = terrain surface). */
  position: [number, number, number];
  /** Patrol / contest / build footprint radius in world units. */
  radius: number;
  ownerId: string;
  ownerKind: ClaimOwnerKind;
  /** Synonym tags for queries — always includes "claim". */
  labels: ClaimAreaLabel[];
  /** When false the log ring stays but volumetric fire is hidden. */
  lit: boolean;
  /** Per-instance fire variation (0–1). */
  fireSeed: number;
  fireScale: number;
}

export const CLAIM_AREA_DEFAULTS = {
  /** Hero field camp patrol radius (matches FactionHeroNPC CAMP_RADIUS). */
  heroCampRadius: 18,
  /** Player survival campfire interaction radius. */
  playerCampRadius: 10,
  /** World scatter / POI camps. */
  worldCampRadius: 12,
  /** Home island clearing from fleet create flow. */
  homeCampRadius: 24,
  fireScaleMin: 0.55,
  fireScaleMax: 1.05,
} as const;

/** Normalise legacy strings into canonical claim labels. */
export function normaliseClaimLabels(
  input: string | string[],
): ClaimAreaLabel[] {
  const raw = Array.isArray(input) ? input : [input];
  const out = new Set<ClaimAreaLabel>(["claim"]);
  for (const s of raw) {
    const k = s.toLowerCase().replace(/[\s-]+/g, "_");
    if (k.includes("flag")) out.add("flag");
    else if (k.includes("home")) out.add("home");
    else if (k.includes("base")) out.add("base");
    else if (k.includes("outpost")) out.add("outpost");
    else if (k.includes("fire") || k.includes("pit")) out.add("fire_pit");
    else if (k.includes("camp")) out.add("camp");
  }
  return [...out];
}

export function isCampfireRecipe(recipeId: string): boolean {
  const id = recipeId.toLowerCase();
  return id.includes("campfire") || id.includes("fire_pit") || id === "camp";
}