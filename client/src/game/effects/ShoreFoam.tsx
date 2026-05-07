import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Animated foam ring rendered as a flat ring mesh at the waterline.
 *
 * Sits between the deep + shallow water sheets and the beach geometry,
 * masking the hard "island just stops at the water" edge that read as
 * pasted-on at small spawn islands. The shader fades alpha at the inner
 * AND outer edges of the ring (so it blends into both the beach and
 * the open sea) and animates a noise pattern so the foam crawls along
 * the shore instead of being a static decal.
 *
 * Cheap: one transparent quad mesh, no textures, one fragment shader.
 * Sized from the island's ground bounding box + a per-axis buffer.
 */
const VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = `
  uniform float uTime;
  uniform float uIntensity;
  uniform float uBandWidth;
  varying vec2 vUv;

  // Cheap value-noise. Good enough for a slow-crawling foam pattern;
  // we don't need anything physically motivated here.
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  void main() {
    // vUv.x runs around the ring (0..1), vUv.y across the ring band
    // (0 = inner edge / land side, 1 = outer edge / sea side).
    // Soft alpha falloff at both edges so the foam blends in.
    float edge = smoothstep(0.0, uBandWidth, vUv.y) *
                 smoothstep(0.0, uBandWidth, 1.0 - vUv.y);

    // Animated foam streaks: noise modulated by time, wrapping around
    // the ring so the seam isn't visible.
    vec2 p = vec2(vUv.x * 32.0, vUv.y * 8.0 + uTime * 0.18);
    float n = noise(p) * 0.6 + noise(p * 2.7) * 0.3 + noise(p * 5.3) * 0.1;
    float foam = smoothstep(0.45, 0.85, n);

    float alpha = edge * foam * uIntensity;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(vec3(0.95, 0.97, 1.0), alpha);
  }
`;

interface ShoreFoamProps {
  /** Island ground center in world XZ. */
  center: [number, number];
  /** Island ground half-extents in world XZ (radius in each axis). */
  halfExtent: [number, number];
  /** Water surface Y. The ring sits a hair above this so it isn't z-fought. */
  surfaceY: number;
  /** Foam alpha multiplier. */
  intensity?: number;
  /** Width of the foam band in metres (extends OUTSIDE the island bbox). */
  bandWidthMeters?: number;
}

export function ShoreFoam({
  center,
  halfExtent,
  surfaceY,
  intensity = 0.85,
  bandWidthMeters = 4.0,
}: ShoreFoamProps) {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  // Build a flat ring quad sized to wrap the island. Use a simple
  // rectangular band (outer rect minus inner rect) instead of a
  // round RingGeometry so the foam follows the island's actual
  // (non-circular) footprint.
  const geometry = useMemo(() => {
    const innerHX = halfExtent[0];
    const innerHZ = halfExtent[1];
    const outerHX = innerHX + bandWidthMeters;
    const outerHZ = innerHZ + bandWidthMeters;

    // 8 vertices: 4 inner corners + 4 outer corners. 8 triangles
    // forming the band (2 per side).
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    // Inner corners (clockwise from -X-Z)
    const inner = [
      [-innerHX, 0, -innerHZ],
      [+innerHX, 0, -innerHZ],
      [+innerHX, 0, +innerHZ],
      [-innerHX, 0, +innerHZ],
    ];
    const outer = [
      [-outerHX, 0, -outerHZ],
      [+outerHX, 0, -outerHZ],
      [+outerHX, 0, +outerHZ],
      [-outerHX, 0, +outerHZ],
    ];
    for (const v of inner) positions.push(...v);
    for (const v of outer) positions.push(...v);

    // UV: x runs around the perimeter (0..1 split into 4 sides), y
    // runs across the band (0 inner, 1 outer).
    for (let i = 0; i < 4; i++) {
      uvs.push(i / 4, 0);
    }
    for (let i = 0; i < 4; i++) {
      uvs.push(i / 4, 1);
    }

    // Triangulate the band: for each side i, connect inner[i],
    // inner[(i+1)%4], outer[(i+1)%4], outer[i].
    for (let i = 0; i < 4; i++) {
      const ni = (i + 1) % 4;
      const innerI = i;
      const innerNi = ni;
      const outerI = i + 4;
      const outerNi = ni + 4;
      indices.push(innerI, outerI, outerNi);
      indices.push(innerI, outerNi, innerNi);
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    return geom;
  }, [halfExtent, bandWidthMeters]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uIntensity: { value: intensity },
      uBandWidth: { value: 0.45 },
    }),
    [intensity],
  );

  useFrame((_, delta) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value += delta;
    }
  });

  return (
    <mesh
      geometry={geometry}
      position={[center[0], surfaceY + 0.04, center[1]]}
      renderOrder={3}
      frustumCulled={false}
    >
      <shaderMaterial
        ref={matRef}
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}
