import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useGame } from "@/lib/stores/useGame";
import { StormClouds, RainOverlay, Lightning } from "../sky/WeatherPrimitives";

/**
 * Weather event overlay. Mounts the volumetric storm clouds, screen-space rain,
 * and a transient ambient-light boost driven by lightning strikes.
 *
 * Pure overlay — does NOT replace the base `Sky` component. Both should mount
 * together (see `GameScene.tsx`); the base sky paints the gradient + sun +
 * lensflare + day/night, and this component layers storm/rain/lightning on
 * top when `useGame.weather` flips off `"clear"`.
 *
 * The `weatherIntensity` value from the store maps to the Shadertoy `cloudy`
 * parameter via the same scale the original used: -0.4 = clear sky,
 * 0.0 = light overcast, 0.5 = thick storm clouds, 1.0 = heavy thunder.
 *
 * Smoothing: weather changes lerp `displayedIntensity` toward the target over
 * ~3 seconds so mode flips don't pop (matches the way the Shadertoy `cloudy`
 * value drifts via cosine).
 */
export default function WeatherEvents() {
  const { camera, scene } = useThree();
  const weather = useGame((s) => s.weather);
  const targetIntensity = useGame((s) => s.weatherIntensity);

  // Per-instance weather objects. Allocated once; React unmount disposes them.
  const { stormClouds, rainOverlay, lightning, ambient } = useMemo(() => {
    const sc = new StormClouds();
    const ro = new RainOverlay();
    const lt = new Lightning();
    // Dedicated ambient that pulses with lightning. Starts at 0; only the
    // lightning brightness drives it. Layered on top of the base AmbientLight
    // owned by `Skybox` so we don't fight that for control.
    const am = new THREE.AmbientLight(0xc8d4ff, 0);
    return { stormClouds: sc, rainOverlay: ro, lightning: lt, ambient: am };
  }, []);

  // Mount the lightning ambient at scene root (not under our component) so its
  // contribution survives any re-render that drops/recreates the JSX subtree.
  useEffect(() => {
    scene.add(ambient);
    return () => {
      scene.remove(ambient);
    };
  }, [scene, ambient]);

  useEffect(() => {
    return () => {
      stormClouds.dispose();
      rainOverlay.dispose();
    };
  }, [stormClouds, rainOverlay]);

  // Smoothed intensity. Tracked in a ref so frame updates don't trigger React
  // renders. Initialized to the current store value so first-frame matches.
  const displayedIntensity = useRef(targetIntensity);
  // Reusable scratch values to avoid per-frame allocations.
  const sunDir = useRef(new THREE.Vector3(0.35, 0.14, 0.3).normalize());
  const sunCol = useRef(new THREE.Color(1.0, 0.7, 0.55));

  useFrame((_, delta) => {
    // Lerp toward target intensity. Time constant ~3s gives a noticeable but
    // not-jarring transition when the player runs `setWeather('storm')`.
    const tau = 3.0;
    const k = 1 - Math.exp(-delta / tau);
    displayedIntensity.current += (targetIntensity - displayedIntensity.current) * k;
    const intensity = displayedIntensity.current;

    // Rain only flows in 'rain' or 'storm' modes — 'cloudy' is dry overcast.
    const rainIntensity = weather === "rain" || weather === "storm" ? intensity : 0;
    // Cloudy mapping: shader expects -1..1 with 0.2+ enabling rain & flashes.
    // intensity 0..1 → cloudy -0.5..0.5, so storm@1.0 → cloudy=0.5 (heavy).
    const cloudy = intensity - 0.5;

    // Lightning fires only in storm mode AND once intensity is past the storm
    // threshold; cloudy mode has zero flashes by design.
    const lightningInput = weather === "storm" ? intensity : 0;
    const flash = lightning.update(delta, lightningInput);

    // Try to find the scene's directional light (the sun from `Skybox`) so we
    // can illuminate clouds from the correct side. Fall back to the cached
    // default Shadertoy direction if we haven't located it yet.
    const sunLight = scene.children.find(
      (c): c is THREE.DirectionalLight => (c as THREE.DirectionalLight).isDirectionalLight === true
    );
    if (sunLight) {
      // Direction FROM the surface TO the sun (DirectionalLight.position is the
      // sun's world position relative to its target).
      sunDir.current
        .copy(sunLight.position)
        .sub(sunLight.target.position)
        .normalize();
      sunCol.current.copy(sunLight.color);
    }

    stormClouds.update(delta, camera.position, cloudy, sunDir.current, sunCol.current, flash.color);
    rainOverlay.update(delta, rainIntensity, flash.color);

    // Ambient lightning boost: scale by storm intensity so partial storms still
    // flash but at lower amplitude. Multiplied by 1.2 so peak strikes really
    // light up the world (the cloud uFlash uniform already handles sky pop).
    ambient.intensity = flash.brightness * 1.2 * Math.max(0, lightningInput);
  });

  return (
    <>
      <primitive object={stormClouds} />
      <primitive object={rainOverlay} />
    </>
  );
}
