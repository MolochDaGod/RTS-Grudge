/**
 * HDR environment IBL.
 *
 * Loads `tree_lined_driveway_2k.hdr` from `attached_assets/` (resolved
 * via Vite's `?url` import) and feeds it into drei's `<Environment>`.
 *
 * Notes:
 * - We use Suspense at the call site so the lack of a loaded HDR
 *   doesn't blank the canvas.
 * - `background={false}` — we keep the procedural Sky for the dome
 *   colour; the HDR is just for reflections + ambient ground bounce.
 *   That stops the camera ever pointing into a giant 360° photo.
 * - The HDR file is large (~5MB) — only fetched when the env toggle
 *   is on.
 */
import { Environment } from '@react-three/drei';
// HDR file shipped in the artifact's public/ folder.
const hdrUrl = `${import.meta.env.BASE_URL}hdr/tree_lined_driveway_2k.hdr`;

export function HdrEnvironment() {
  return (
    <Environment
      files={hdrUrl}
      background={false}
      environmentIntensity={0.7}
    />
  );
}
