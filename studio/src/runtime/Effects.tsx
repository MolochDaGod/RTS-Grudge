/**
 * Ambient effects for the editor canvas.
 *
 * Water:  GPU-shader-driven plane. The vertex shader sums two sine waves
 *         to displace Y; the fragment shader blends shallow + deep blues
 *         and lays a thin foam band on the wave crests. Normals are
 *         computed analytically in the vertex shader so lighting stays
 *         consistent with the displaced surface (the previous CPU version
 *         updated positions but never recomputed normals → flat-looking,
 *         flickery shading).
 *
 * Stability/quality choices (all tested for this scene):
 * - Opaque material, `transparent:false`. Transparency caused the editor
 *   grid lines under the surface to bleed through, looking like a
 *   "double" surface. Keeping it opaque also avoids per-pixel sort
 *   ordering issues at the shoreline.
 * - `polygonOffset` pushes water away from the camera by a hair so it
 *   never z-fights with terrain that slopes through sea level.
 * - `receiveShadow: false`. Moving water + projected shadows produced
 *   a constant shadow-acne shimmer; the lighting reads cleaner without.
 * - Wave amplitude is small (≤ 5 cm) and frequencies are low so the
 *   surface never pokes through the beach.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, SMAA } from '@react-three/postprocessing';
import * as THREE from 'three';
import { Water as ThreeWater } from 'three/examples/jsm/objects/Water.js';
import { SEA_LEVEL } from '../editor/IslandGenerator';

interface WaterProps {
  size?: number;
  /** Mesh subdivisions per side. 96 is plenty for the gentle waves we use. */
  segments?: number;
}

/**
 * Smooth, opaque water with GPU-displaced waves and analytic normals.
 *
 * The shader displaces vertices with two sin waves and computes the
 * tangent/bitangent of the surface analytically so the per-pixel
 * normal stays in sync — this is what eliminates the "rubbery" look
 * the CPU version had.
 */
/**
 * Calm, static ocean — no wave simulation or per-frame uniform updates.
 * Used in the map editor so edit mode stays lightweight.
 */
export function StillWater({ size = 600 }: WaterProps) {
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#06182e'),
        roughness: 0.12,
        metalness: 0.42,
        transparent: true,
        opacity: 0.96,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      }),
    [],
  );
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, SEA_LEVEL - 0.015, 0]}
      renderOrder={0}
      receiveShadow
      material={mat}
    >
      <planeGeometry args={[size + 400, size + 400, 1, 1]} />
    </mesh>
  );
}

/** Animated Three.js Water — play mode only (GPU cost each frame). */
export function Water({ size = 600 }: WaterProps) {
  const { scene } = useThree();
  const waterRef = useRef<ThreeWater | null>(null);

  useEffect(() => {
    const geo = new THREE.PlaneGeometry(size + 400, size + 400);
    const normalsTex = new THREE.TextureLoader().load(
      `${import.meta.env.BASE_URL}textures/waternormals.jpg`,
      (tex) => { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; },
    );
    // Match the <Sky sunPosition={[80, 40, -60]}/> in EditorCanvas so the
    // water specular highlight falls where the sky's sun *visibly* is.
    // Previously hardcoded (0.6, 0.8, 0.3) which pointed at nothing in the sky.
    const sunDir = new THREE.Vector3(80, 40, -60).normalize();
    const water = new ThreeWater(geo, {
      textureWidth:  512,
      textureHeight: 512,
      waterNormals: normalsTex,
      sunDirection: sunDir,
      sunColor:     0xffeedd,
      // Deeper water (20 ft / 6.1 m) reads as a dark ocean blue.
      waterColor:   0x06182e,
      distortionScale: 2.8,
      fog: false,
    });
    const wMat = water.material as THREE.ShaderMaterial;
    wMat.polygonOffset = true;
    wMat.polygonOffsetFactor = 1;
    wMat.polygonOffsetUnits = 1;
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, SEA_LEVEL, 0);
    water.renderOrder = 0;
    scene.add(water);
    waterRef.current = water;
    return () => {
      scene.remove(water);
      geo.dispose();
      wMat.dispose();
      normalsTex.dispose();
      waterRef.current = null;
    };
  }, [size, scene]);

  useFrame((_, delta) => {
    if (waterRef.current) {
      waterRef.current.material.uniforms['time']!.value += delta * 0.6;
    }
  });

  return null;
}

export function _LegacyWater({ size = 600, segments = 96 }: WaterProps) {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(size, size, segments, segments);
    g.rotateX(-Math.PI / 2);
    return g;
  }, [size, segments]);

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime:        { value: 0 },
        uShallow:     { value: new THREE.Color('#5fb6d8') },
        uDeep:        { value: new THREE.Color('#0f3a5b') },
        uFoam:        { value: new THREE.Color('#eaf6ff') },
        uSeaLevel:    { value: SEA_LEVEL },
        uWaveAmpA:    { value: 0.045 },
        uWaveAmpB:    { value: 0.035 },
        uWaveLenA:    { value: 22.0 },
        uWaveLenB:    { value: 9.0 },
        uWaveSpeed:   { value: 0.55 },
        uLightDir:    { value: new THREE.Vector3(0.6, 0.8, 0.3).normalize() },
        uSpecPower:   { value: 64.0 },
        uSpecStrength:{ value: 0.45 },
      },
      vertexShader: /* glsl */ `
        uniform float uTime;
        uniform float uWaveAmpA, uWaveAmpB;
        uniform float uWaveLenA, uWaveLenB;
        uniform float uWaveSpeed;

        varying vec3 vWorldPos;
        varying vec3 vNormal;
        varying float vDisplace;

        // Sample the wave height at any world (x,z). Two perpendicular
        // sin waves with different frequencies = stable, non-tiling motion.
        float waveHeight(vec2 p, float t) {
          float h  = sin(p.x / uWaveLenA + t * uWaveSpeed)        * uWaveAmpA;
                h += sin(p.y / uWaveLenB + t * uWaveSpeed * 1.3)  * uWaveAmpB;
          return h;
        }

        void main() {
          // Local plane vertex → world XZ
          vec3 worldXZ = (modelMatrix * vec4(position, 1.0)).xyz;
          float h = waveHeight(worldXZ.xz, uTime);

          // Analytic normal: take partial derivatives of waveHeight()
          float eps = 0.5;
          float hx = waveHeight(worldXZ.xz + vec2(eps, 0.0), uTime) - h;
          float hz = waveHeight(worldXZ.xz + vec2(0.0, eps), uTime) - h;
          // Normal = cross(tangent, bitangent), pointing +Y
          vec3 n = normalize(vec3(-hx / eps, 1.0, -hz / eps));

          vec3 displaced = position + vec3(0.0, h, 0.0);
          vec4 mvPos = modelViewMatrix * vec4(displaced, 1.0);
          gl_Position = projectionMatrix * mvPos;

          vWorldPos = (modelMatrix * vec4(displaced, 1.0)).xyz;
          // Plane is rotated -90°X so model normal Y maps to world Y already
          vNormal = normalize((modelMatrix * vec4(n, 0.0)).xyz);
          vDisplace = h;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uShallow, uDeep, uFoam;
        uniform vec3 uLightDir;
        uniform float uSpecPower, uSpecStrength;

        varying vec3 vWorldPos;
        varying vec3 vNormal;
        varying float vDisplace;

        void main() {
          // Depth tint: blend shallow→deep with distance from origin.
          // (We don't have a depth buffer read; this gives a similar look
          // since the island sits near the centre.)
          float dist = length(vWorldPos.xz);
          float depthMix = clamp(dist / 110.0, 0.0, 1.0);
          vec3 base = mix(uShallow, uDeep, depthMix);

          // Lambert diffuse + Blinn-Phong specular for that water sparkle
          vec3 N = normalize(vNormal);
          vec3 L = normalize(uLightDir);
          float diff = clamp(dot(N, L) * 0.5 + 0.5, 0.0, 1.0);
          vec3 V = normalize(cameraPosition - vWorldPos);
          vec3 H = normalize(L + V);
          float spec = pow(clamp(dot(N, H), 0.0, 1.0), uSpecPower) * uSpecStrength;

          // Thin foam highlight on the very tops of crests
          float foam = smoothstep(0.025, 0.045, vDisplace);
          vec3 col = base * diff + vec3(spec) + uFoam * foam * 0.55;

          gl_FragColor = vec4(col, 1.0);
        }
      `,
      transparent: false,
      depthWrite: true,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
  }, []);

  useFrame((state) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <mesh
      geometry={geometry}
      // Sit the water at sea level. Wave displacement happens *above*
      // and *below* this in the shader; the polygonOffset above keeps
      // it from z-fighting with terrain that slopes through y=0.
      position={[0, SEA_LEVEL, 0]}
      receiveShadow={false}
      castShadow={false}
      // Water surface only — back face culling, no double-render
      renderOrder={0}
    >
      <primitive object={material} ref={matRef} attach="material" />
    </mesh>
  );
}

/**
 * Soft foam ring at the water line. Sits on top of the water with a
 * tiny Y offset and `depthWrite:false` so it doesn't fight with waves.
 */
export function ShoreFoam({ radius = 102 }: { radius?: number }) {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, SEA_LEVEL + 0.02, 0]}
      renderOrder={1}
    >
      <ringGeometry args={[radius - 4, radius + 1, 128]} />
      <meshBasicMaterial color="#e8f5ff" transparent opacity={0.35} depthWrite={false} />
    </mesh>
  );
}

/** Pollen / firefly sparkles drifting over the island. */
export function AmbientSparkles() {
  return (
    <Sparkles
      count={80}
      size={4}
      speed={0.3}
      opacity={0.6}
      color="#fff5c2"
      scale={[180, 8, 180]}
      position={[0, 4, 0]}
    />
  );
}

/** Postprocessing — kept light so it runs on integrated GPUs. */
export function PostFX() {
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <SMAA />
      <Bloom intensity={0.5} luminanceThreshold={0.85} luminanceSmoothing={0.18} mipmapBlur />
      <Vignette eskil={false} offset={0.2} darkness={0.5} />
    </EffectComposer>
  );
}
