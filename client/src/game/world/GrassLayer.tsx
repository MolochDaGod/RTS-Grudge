import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CHUNK_SIZE, type WorldChunk } from "./WorldChunkManager";

const GRASS_VERT_SHADER = `
  uniform float uTime;
  uniform float uWindStrength;
  uniform float uWindFrequency;
  uniform vec2 uWindDirection;
  uniform vec3 uPlayerPos;
  uniform float uPlayerRadius;
  uniform float uPlayerPushStrength;

  attribute vec3 offset;
  attribute vec4 orientation;
  attribute float bladeHeight;
  attribute float bladePhase;
  attribute vec3 bladeColor;

  varying vec3 vColor;
  varying float vHeight;
  varying float vPlayerDist;

  vec3 applyQuaternion(vec3 v, vec4 q) {
    vec3 qv = vec3(q.x, q.y, q.z);
    vec3 uv = cross(qv, v);
    vec3 uuv = cross(qv, uv);
    return v + 2.0 * (q.w * uv + uuv);
  }

  void main() {
    float heightFraction = position.y;
    vHeight = heightFraction;
    vColor = bladeColor;

    vec3 pos = position;
    pos.y *= bladeHeight;
    pos.x *= 0.06;

    float windPhase = dot(offset.xz, uWindDirection * uWindFrequency) + bladePhase;
    float mainWave = sin(uTime * 2.5 + windPhase);
    float secondWave = sin(uTime * 1.7 + windPhase * 1.3) * 0.4;
    float gustWave = sin(uTime * 0.3 + windPhase * 0.2) * 0.5 + 0.5;
    float windWave = (mainWave * 0.5 + 0.5 + secondWave) * mix(0.6, 1.0, gustWave);

    float bendAmount = heightFraction * heightFraction;
    float windEffect = windWave * uWindStrength * bendAmount;

    pos.x += uWindDirection.x * windEffect * bladeHeight;
    pos.z += uWindDirection.y * windEffect * bladeHeight;

    float turbulence = sin(uTime * 4.0 + bladePhase * 3.0) * 0.02 * bendAmount;
    pos.x += turbulence;
    pos.z += turbulence * 0.7;

    pos = applyQuaternion(pos, orientation);
    pos += offset;

    vec4 worldPos4 = modelMatrix * vec4(pos, 1.0);
    vec2 toPlayer = worldPos4.xz - uPlayerPos.xz;
    float distToPlayer = length(toPlayer);
    vPlayerDist = distToPlayer;

    if (distToPlayer < uPlayerRadius && distToPlayer > 0.01) {
      float pushFactor = 1.0 - (distToPlayer / uPlayerRadius);
      pushFactor = pushFactor * pushFactor * pushFactor;
      vec2 pushDir = normalize(toPlayer);
      float pushAmount = pushFactor * uPlayerPushStrength * heightFraction * heightFraction * bladeHeight;
      pos.x += pushDir.x * pushAmount;
      pos.z += pushDir.y * pushAmount;
      pos.y -= pushFactor * 0.15 * heightFraction * bladeHeight;
    }

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const GRASS_FRAG_SHADER = `
  uniform vec3 uSunDirection;
  uniform vec3 uBaseColor;
  uniform vec3 uTipColor;

  varying vec3 vColor;
  varying float vHeight;
  varying float vPlayerDist;

  void main() {
    vec3 baseBlend = mix(uBaseColor, uTipColor, vHeight);
    vec3 col = vColor * baseBlend;

    float shadow = mix(0.35, 1.0, vHeight);
    col *= shadow;

    float ao = mix(0.5, 1.0, smoothstep(0.0, 0.35, vHeight));
    col *= ao;

    col += vec3(0.04, 0.07, 0.01) * vHeight * vHeight;

    float highlight = smoothstep(0.7, 1.0, vHeight) * 0.08;
    col += vec3(0.9, 1.0, 0.7) * highlight;

    gl_FragColor = vec4(col, 1.0);
  }
`;

let sharedBladeGeo: THREE.BufferGeometry | null = null;

function getSharedBladeGeometry(): THREE.BufferGeometry {
  if (sharedBladeGeo) return sharedBladeGeo;

  const geo = new THREE.BufferGeometry();
  const segments = 5;
  const verts = (segments + 1) * 2 + 1;
  const positions = new Float32Array(verts * 3);

  let vi = 0;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const width = 1.0 - t * t * 0.85;
    positions[vi++] = -width * 0.5;
    positions[vi++] = t;
    positions[vi++] = 0;
    positions[vi++] = width * 0.5;
    positions[vi++] = t;
    positions[vi++] = 0;
  }
  positions[vi++] = 0;
  positions[vi++] = 1;
  positions[vi++] = 0;

  const indices: number[] = [];
  for (let i = 0; i < segments; i++) {
    const bl = i * 2;
    const br = i * 2 + 1;
    const tl = (i + 1) * 2;
    const tr = (i + 1) * 2 + 1;
    indices.push(bl, br, tl);
    indices.push(br, tr, tl);
  }
  const topLeft = segments * 2;
  const topRight = segments * 2 + 1;
  const tip = segments * 2 + 2;
  indices.push(topLeft, topRight, tip);

  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  sharedBladeGeo = geo;
  return geo;
}

function createAxisAngleQuat(axis: THREE.Vector3, angle: number): [number, number, number, number] {
  const halfAngle = angle / 2;
  const s = Math.sin(halfAngle);
  return [axis.x * s, axis.y * s, axis.z * s, Math.cos(halfAngle)];
}

function buildGrassInstances(
  offsets: number[],
  orientations: number[],
  heights: number[],
  phases: number[],
  colors: number[],
  placed: number
): THREE.InstancedBufferGeometry {
  const bladeGeo = getSharedBladeGeometry();
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = bladeGeo.index;
  geo.attributes.position = bladeGeo.attributes.position;

  geo.setAttribute("offset", new THREE.InstancedBufferAttribute(new Float32Array(offsets), 3));
  geo.setAttribute("orientation", new THREE.InstancedBufferAttribute(new Float32Array(orientations), 4));
  geo.setAttribute("bladeHeight", new THREE.InstancedBufferAttribute(new Float32Array(heights), 1));
  geo.setAttribute("bladePhase", new THREE.InstancedBufferAttribute(new Float32Array(phases), 1));
  geo.setAttribute("bladeColor", new THREE.InstancedBufferAttribute(new Float32Array(colors), 3));

  geo.instanceCount = placed;

  const halfChunk = CHUNK_SIZE / 2 + 2;
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 2, 0), Math.sqrt(halfChunk * halfChunk + 4));

  return geo;
}

function createGrassMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uWindStrength: { value: 0.18 },
      uWindFrequency: { value: 0.08 },
      uWindDirection: { value: new THREE.Vector2(0.7, 0.3) },
      uPlayerPos: { value: new THREE.Vector3(0, -100, 0) },
      uPlayerRadius: { value: 2.5 },
      uPlayerPushStrength: { value: 0.6 },
      uSunDirection: { value: new THREE.Vector3(0.5, 1.0, 0.3).normalize() },
      uBaseColor: { value: new THREE.Color(0.85, 0.95, 0.8) },
      uTipColor: { value: new THREE.Color(1.1, 1.2, 0.9) },
    },
    vertexShader: GRASS_VERT_SHADER,
    fragmentShader: GRASS_FRAG_SHADER,
    side: THREE.DoubleSide,
    depthWrite: true,
  });
}

let _globalPlayerPos = new THREE.Vector3(0, -100, 0);

export function updateGrassPlayerPosition(x: number, y: number, z: number) {
  _globalPlayerPos.set(x, y, z);
}

export function getGrassPlayerPosition(): THREE.Vector3 {
  return _globalPlayerPos;
}

interface GrassChunkLayerProps {
  chunk: WorldChunk;
  islandSeed: number;
  heightSampler: (wx: number, wz: number) => number;
  density?: number;
}

export function GrassChunkLayer({
  chunk,
  islandSeed,
  heightSampler,
  density = 1.0,
}: GrassChunkLayerProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const grassGeometry = useMemo(() => {
    if (chunk.lod === "minimal") return null;

    let s = islandSeed + chunk.cx * 73856093 + chunk.cz * 19349663;
    const rng = () => {
      s = (s * 16807 + 123457) % 2147483647;
      return (s & 0x7fffffff) / 2147483647;
    };

    const baseDensity = chunk.lod === "full" ? 800 : 200;
    const count = Math.floor(baseDensity * density);

    const offsets: number[] = [];
    const orientations: number[] = [];
    const heights: number[] = [];
    const phases: number[] = [];
    const colors: number[] = [];

    const yAxis = new THREE.Vector3(0, 1, 0);
    let placed = 0;

    for (let i = 0; i < count * 2 && placed < count; i++) {
      const lx = rng() * CHUNK_SIZE;
      const lz = rng() * CHUNK_SIZE;
      const wx = chunk.worldX + lx;
      const wz = chunk.worldZ + lz;
      const h = heightSampler(wx, wz);

      if (h < 0.5 || h > 3.0) continue;

      offsets.push(lx - CHUNK_SIZE / 2, h, lz - CHUNK_SIZE / 2);

      const angle = rng() * Math.PI * 2;
      const [qx, qy, qz, qw] = createAxisAngleQuat(yAxis, angle);
      orientations.push(qx, qy, qz, qw);

      const bladeH = 0.3 + rng() * 0.5;
      heights.push(bladeH);
      phases.push(rng() * Math.PI * 2);

      const baseGreen = 0.3 + rng() * 0.25;
      const r = 0.15 + rng() * 0.1;
      const g = baseGreen;
      const b = 0.08 + rng() * 0.08;
      colors.push(r, g, b);

      placed++;
    }

    if (placed === 0) return null;

    return buildGrassInstances(offsets, orientations, heights, phases, colors, placed);
  }, [chunk.cx, chunk.cz, chunk.worldX, chunk.worldZ, chunk.lod, islandSeed, heightSampler, density]);

  const material = useMemo(() => createGrassMaterial(), []);

  useFrame((_, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value += delta;
      const pp = getGrassPlayerPosition();
      materialRef.current.uniforms.uPlayerPos.value.copy(pp);
    }
  });

  useEffect(() => {
    return () => {
      grassGeometry?.dispose();
    };
  }, [grassGeometry]);

  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

  if (!grassGeometry) return null;

  return (
    <mesh
      ref={meshRef}
      geometry={grassGeometry}
      material={material}
      position={[chunk.worldX + CHUNK_SIZE / 2, 0, chunk.worldZ + CHUNK_SIZE / 2]}
      frustumCulled={false}
    >
      <primitive object={material} ref={materialRef} attach="material" />
    </mesh>
  );
}

interface TerrainGrassLayerProps {
  heightData: Float32Array;
  worldSize: number;
  terrainResolution: number;
  maxHeight: number;
  density?: number;
}

export function TerrainGrassLayer({
  heightData,
  worldSize,
  terrainResolution,
  maxHeight,
  density = 1.0,
}: TerrainGrassLayerProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  function sampleHeight(wx: number, wz: number): number {
    const mapX = ((wx / worldSize) + 0.5) * (terrainResolution - 1);
    const mapZ = ((wz / worldSize) + 0.5) * (terrainResolution - 1);
    const ix = Math.floor(mapX);
    const iz = Math.floor(mapZ);
    const fx = mapX - ix;
    const fz = mapZ - iz;
    const cl = (v: number, mn: number, mx: number) => Math.max(mn, Math.min(mx, v));
    const cix = cl(ix, 0, terrainResolution - 1);
    const ciz = cl(iz, 0, terrainResolution - 1);
    const cix1 = cl(ix + 1, 0, terrainResolution - 1);
    const ciz1 = cl(iz + 1, 0, terrainResolution - 1);
    const h00 = heightData[ciz * terrainResolution + cix];
    const h10 = heightData[ciz * terrainResolution + cix1];
    const h01 = heightData[ciz1 * terrainResolution + cix];
    const h11 = heightData[ciz1 * terrainResolution + cix1];
    return (h00 * (1 - fx) + h10 * fx) * (1 - fz) + (h01 * (1 - fx) + h11 * fx) * fz;
  }

  const grassGeometry = useMemo(() => {
    const baseCount = Math.floor(12000 * density);

    let s = 42 * 73856093 + 7 * 19349663;
    const rng = () => {
      s = (s * 16807 + 123457) % 2147483647;
      return (s & 0x7fffffff) / 2147483647;
    };

    const offsets: number[] = [];
    const orientations: number[] = [];
    const heights: number[] = [];
    const phases: number[] = [];
    const colors: number[] = [];

    const yAxis = new THREE.Vector3(0, 1, 0);
    const halfWorld = worldSize / 2;
    let placed = 0;

    for (let i = 0; i < baseCount * 3 && placed < baseCount; i++) {
      const wx = (rng() - 0.5) * worldSize;
      const wz = (rng() - 0.5) * worldSize;
      const h = sampleHeight(wx, wz);
      const normalizedH = h / maxHeight;

      if (normalizedH < 0.15 || normalizedH > 0.5) continue;
      if (Math.abs(wx) > halfWorld * 0.95 || Math.abs(wz) > halfWorld * 0.95) continue;

      const distFromCenter = Math.sqrt(wx * wx + wz * wz);
      if (distFromCenter < 15) continue;

      offsets.push(wx, h, wz);

      const angle = rng() * Math.PI * 2;
      const [qx, qy, qz, qw] = createAxisAngleQuat(yAxis, angle);
      orientations.push(qx, qy, qz, qw);

      const bladeH = 0.25 + rng() * 0.55;
      heights.push(bladeH);
      phases.push(rng() * Math.PI * 2);

      const baseGreen = 0.3 + rng() * 0.25;
      const r = 0.15 + rng() * 0.1;
      const g = baseGreen;
      const b = 0.08 + rng() * 0.08;
      colors.push(r, g, b);

      placed++;
    }

    if (placed === 0) return null;

    const geo = buildGrassInstances(offsets, orientations, heights, phases, colors, placed);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 5, 0), worldSize * 0.7);
    return geo;
  }, [heightData, worldSize, terrainResolution, maxHeight, density]);

  const material = useMemo(() => createGrassMaterial(), []);

  useFrame((_, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value += delta;
      const pp = getGrassPlayerPosition();
      materialRef.current.uniforms.uPlayerPos.value.copy(pp);
    }
  });

  useEffect(() => {
    return () => {
      grassGeometry?.dispose();
    };
  }, [grassGeometry]);

  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

  if (!grassGeometry) return null;

  return (
    <mesh
      ref={meshRef}
      geometry={grassGeometry}
      material={material}
      frustumCulled={false}
    >
      <primitive object={material} ref={materialRef} attach="material" />
    </mesh>
  );
}
