import { useClaimArea } from "@/lib/stores/useClaimArea";
import { ClaimAreaProp } from "./ClaimAreaProp";

/** Renders log rings + flags for every registered claim area. */
export function ClaimAreaVisuals() {
  const areas = useClaimArea((s) => s.areas);
  const list = [...areas.values()];
  if (list.length === 0) return null;

  return (
    <group name="claim-areas">
      {list.map((claim) => (
        <ClaimAreaProp key={claim.id} claim={claim} />
      ))}
    </group>
  );
}