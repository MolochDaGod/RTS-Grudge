/**
 * useClaimArea — canonical registry for claim / camp / base / flag anchors.
 */
import { create } from "zustand";
import type { ClaimArea, ClaimAreaLabel, ClaimOwnerKind } from "@/game/claims/claimAreaTypes";
import { CLAIM_AREA_DEFAULTS, normaliseClaimLabels } from "@/game/claims/claimAreaTypes";

export type { ClaimArea, ClaimAreaLabel, ClaimOwnerKind };

export interface UpsertClaimInput {
  id: string;
  position: [number, number, number];
  radius?: number;
  ownerId: string;
  ownerKind: ClaimOwnerKind;
  labels?: string | string[];
  lit?: boolean;
  fireSeed?: number;
  fireScale?: number;
}

interface ClaimAreaState {
  areas: Map<string, ClaimArea>;

  upsertClaim: (input: UpsertClaimInput) => void;
  removeClaim: (id: string) => void;
  setLit: (id: string, lit: boolean) => void;
  getByOwner: (ownerId: string) => ClaimArea[];
  getLitClaims: () => ClaimArea[];
  /** @deprecated use upsertClaim — camp === claim */
  placeCamp: (input: UpsertClaimInput) => void;
  /** @deprecated use removeClaim */
  removeCamp: (id: string) => void;
}

function toClaimArea(input: UpsertClaimInput): ClaimArea {
  const labels = normaliseClaimLabels(input.labels ?? ["camp"]);
  const radius =
    input.radius ??
    (input.ownerKind === "hero"
      ? CLAIM_AREA_DEFAULTS.heroCampRadius
      : input.ownerKind === "world"
        ? CLAIM_AREA_DEFAULTS.worldCampRadius
        : CLAIM_AREA_DEFAULTS.playerCampRadius);

  return {
    id: input.id,
    position: [...input.position],
    radius,
    ownerId: input.ownerId,
    ownerKind: input.ownerKind,
    labels,
    lit: input.lit ?? true,
    fireSeed: input.fireSeed ?? Math.random(),
    fireScale:
      input.fireScale ??
      CLAIM_AREA_DEFAULTS.fireScaleMin +
        Math.random() *
          (CLAIM_AREA_DEFAULTS.fireScaleMax - CLAIM_AREA_DEFAULTS.fireScaleMin),
  };
}

export const useClaimArea = create<ClaimAreaState>((set, get) => ({
  areas: new Map(),

  upsertClaim: (input) => {
    set((s) => {
      const next = new Map(s.areas);
      next.set(input.id, toClaimArea(input));
      return { areas: next };
    });
  },

  placeCamp: (input) => get().upsertClaim(input),

  removeClaim: (id) => {
    set((s) => {
      if (!s.areas.has(id)) return s;
      const next = new Map(s.areas);
      next.delete(id);
      return { areas: next };
    });
  },

  removeCamp: (id) => get().removeClaim(id),

  setLit: (id, lit) => {
    set((s) => {
      const existing = s.areas.get(id);
      if (!existing) return s;
      const next = new Map(s.areas);
      next.set(id, { ...existing, lit });
      return { areas: next };
    });
  },

  getByOwner: (ownerId) => [...get().areas.values()].filter((a) => a.ownerId === ownerId),

  getLitClaims: () => [...get().areas.values()].filter((a) => a.lit),
}));