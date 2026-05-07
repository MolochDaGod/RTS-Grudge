/**
 * Fill lighting only. The primary sun directional light + ambient is now
 * provided by the Sky system (see ./Sky.tsx -> sky/SkyPrimitives Skybox.sun).
 * This component just adds a subtle hemisphere bounce so undersides of
 * objects don't go pitch-black.
 */
export default function Lighting() {
  return <hemisphereLight args={["#87CEEB", "#3a5a27", 0.25]} />;
}
