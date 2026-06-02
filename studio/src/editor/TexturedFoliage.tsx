/**
 * Procedural foliage components for the Grudge Studio map editor.
 *
 * Tree rendering — FluffyTree3D  (replaces the old billboard CardTree)
 * ────────────────────────────────────────────────────────────────────
 * Implementation follows https://leoawen.github.io/fluffytree-threejs/
 * (MIT, 2025 Leonardo Soares Gonçalves).
 *
 * Technique: cluster of 14 sphere geometries (1 centre + 8 ring + 5 top
 * cap) with a custom MeshLambertMaterial.onBeforeCompile that injects:
 *   • Fragment: worldY-based volumetric gradient
 *               shadow colour → lit colour → highlight colour
 *   • Vertex:   time-driven sinusoidal wind sway, stronger at the tips
 *
 * All trees share the same geometry set; colour variation is achieved
 * through per-species material instances cached in `_canopyMatCache`.
 * Seasonal tint (#d4650a autumn, #c8dff0 winter, …) is passed through
 * as the `lit` override, with shadow/highlight computed from it.
 *
 * Other foliage (ferns, flowers, mushrooms, grass, rocks) remain as
 * flat-card or procedural-mesh components unchanged.
 */
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import {
  FoliageTextures,
  flowerAtlasBySlug,
  fernTextureBySlug,
  mushroomTextureBySlug,
  leafTextureBySlug,
} from '../library/FoliageTextures';

// ============================================================================
// FluffyTree3D — sphere-cluster canopy with volumetric gradient shader
// ============================================================================

// ── Colour type used by both FluffyTree3D and CardTree ─────────────────────
export interface CanopyColors {
  lit:       string;   // main leaf colour (mid-height)
  shadow:    string;   // underside / base colour
  highlight: string;   // tip / top colour
}

// ── Species colour presets ──────────────────────────────────────────────────
// Tuned to match the reference site's palette (leoawen.github.io/fluffytree).
const SPECIES_COLORS: Record<string, CanopyColors & { trunk: string }> = {
  oak:    { lit: '#3ab81e', shadow: '#00210f', highlight: '#a8e030', trunk: '#3a2010' },
  pine:   { lit: '#2a8a18', shadow: '#001a0a', highlight: '#70c830', trunk: '#2c1a08' },
  birch:  { lit: '#62cc38', shadow: '#192c0e', highlight: '#c8f058', trunk: '#c8c4b8' },
  maple:  { lit: '#38b41c', shadow: '#00200c', highlight: '#9adc28', trunk: '#4a2c10' },
  palm:   { lit: '#4ab820', shadow: '#002618', highlight: '#b8f030', trunk: '#806020' },
  bush:   { lit: '#3ab81e', shadow: '#00210f', highlight: '#8ad420', trunk: '#2a1808' },
  normal: { lit: '#3ab81e', shadow: '#00210f', highlight: '#a8e030', trunk: '#3a2010' },
};

// ── Cluster geometry — 14 spheres, positions seeded deterministically ───────
const _cr = (() => {
  let s = 98765;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
})();

const CLUSTER_DEFS: { x: number; y: number; z: number; r: number }[] = [
  // Central large sphere
  { x: 0,                        y: 0,                   z: 0,                        r: 0.82 },
  // 8-sphere mid ring
  ...Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2;
    const d = 0.50 + _cr() * 0.24;
    return { x: Math.cos(a) * d, y: (_cr() - 0.5) * 0.46, z: Math.sin(a) * d, r: 0.46 + _cr() * 0.30 };
  }),
  // 5-sphere top cap
  ...Array.from({ length: 5 }, (_, i) => {
    const a = (i / 5) * Math.PI * 2;
    return { x: Math.cos(a) * 0.28, y: 0.60 + _cr() * 0.14, z: Math.sin(a) * 0.28, r: 0.40 + _cr() * 0.12 };
  }),
];

// Shared sphere geometries — one per cluster entry, 7×5 segments looks good
// without blowing draw-call vertex count.
const CLUSTER_GEOS = CLUSTER_DEFS.map(d => new THREE.SphereGeometry(d.r, 7, 5));

// Shared trunk geometry
const FLUFFY_TRUNK_GEO = new THREE.CylinderGeometry(0.12, 0.22, 1.3, 8);
FLUFFY_TRUNK_GEO.translate(0, 0.65, 0);

// ── Volumetric gradient shader ──────────────────────────────────────────────
// One MeshLambertMaterial per unique colour combo, cached forever.
const _canopyMatCache = new Map<string, THREE.MeshLambertMaterial>();

function makeCanopyMaterial(c: CanopyColors): THREE.MeshLambertMaterial {
  const key = `${c.lit}|${c.shadow}|${c.highlight}`;
  const cached = _canopyMatCache.get(key);
  if (cached) return cached;

  const mat = new THREE.MeshLambertMaterial({ color: new THREE.Color(c.lit) });

  mat.onBeforeCompile = (shader) => {
    // Uniforms
    shader.uniforms.uTime    = { value: 0 };
    shader.uniforms.uWindStr = { value: 0.06 };
    shader.uniforms.uLit     = { value: new THREE.Color(c.lit)       };
    shader.uniforms.uShadow  = { value: new THREE.Color(c.shadow)    };
    shader.uniforms.uHi      = { value: new THREE.Color(c.highlight) };
    // Gradient range (model-space Y). Cluster spheres span roughly
    // y = -0.82 (bottom of centre sphere) to y = +0.74 (top cap).
    // shadow: anything below 0  → darkened underside
    // lit:    0 to 0.5          → main canopy colour
    // highlight: 0.5 to 0.8    → bright sunlit tips
    shader.uniforms.uGStart  = { value: -0.9 };
    shader.uniforms.uGEnd    = { value:  0.5 };
    shader.uniforms.uHStart  = { value:  0.3 };
    shader.uniforms.uHEnd    = { value:  0.75 };

    // ── Vertex: expose LOCAL model-space Y + gentle wind sway ───────────
    // IMPORTANT: use position.y (model space) NOT worldPosition.y.
    // worldPosition.y fails the moment a tree sits on terrain above sea
    // level — the entire canopy is beyond uGEnd=1.8 and renders as a
    // flat lit blob with zero gradient. Model-space Y is always
    // relative to the sphere cluster's own origin, so the gradient
    // shadow→lit→highlight is consistent regardless of terrain height.
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `
        #include <common>
        uniform float uTime;
        uniform float uWindStr;
        varying float vWorldY;
      `)
      .replace('#include <worldpos_vertex>', `
        #include <worldpos_vertex>
        vWorldY = position.y;  // model-space Y — always works on hills
        // Height-weighted sway: tips move more than the base.
        float hFac = clamp(position.y * 0.55 + 0.45, 0.0, 1.0);
        transformed.x += sin(worldPosition.x * 2.8 + uTime * 2.1) * uWindStr * hFac;
        transformed.z += cos(worldPosition.z * 2.5 + uTime * 1.7) * uWindStr * hFac * 0.85;
      `);

    // ── Fragment: volumetric gradient ─────────────────────────────────────
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `
        #include <common>
        uniform vec3  uLit;
        uniform vec3  uShadow;
        uniform vec3  uHi;
        uniform float uGStart;
        uniform float uGEnd;
        uniform float uHStart;
        uniform float uHEnd;
        varying float vWorldY;
      `)
      .replace('#include <color_fragment>', `
        float t = smoothstep(uGStart, uGEnd,  vWorldY);
        float h = smoothstep(uHStart, uHEnd,  vWorldY);
        vec3 leafCol  = mix(uShadow, uLit, t);
        leafCol       = mix(leafCol, uHi, h * 0.38);
        diffuseColor.rgb = leafCol;
      `);

    mat.userData.shader = shader; // store live ref for useFrame updates
  };

  _canopyMatCache.set(key, mat);
  return mat;
}

// Shared trunk materials
const _trunkMatCache = new Map<string, THREE.MeshStandardMaterial>();
function getTrunkMat(color: string): THREE.MeshStandardMaterial {
  const c = _trunkMatCache.get(color);
  if (c) return c;
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.95 });
  _trunkMatCache.set(color, m);
  return m;
}

/** 3D volumetric fluffy tree — sphere cluster + gradient shader. */
export function FluffyTree3D({
  colors,
  trunkColor = '#4a2b0a',
  size = 1,
}: {
  colors: CanopyColors;
  trunkColor?: string;
  size?: number;
}) {
  const mat      = useMemo(() => makeCanopyMaterial(colors),  // eslint-disable-next-line react-hooks/exhaustive-deps
    [colors.lit, colors.shadow, colors.highlight]);
  const trunkMat = useMemo(() => getTrunkMat(trunkColor), [trunkColor]);

  // One useFrame per mounted tree is fine — all trees sharing the same material
  // instance just overwrite the same uniform value with the same clock value.
  useFrame(({ clock }) => {
    const sh = (mat as THREE.MeshLambertMaterial).userData.shader;
    if (sh) sh.uniforms.uTime.value = clock.elapsedTime;
  });

  return (
    <group>
      <mesh geometry={FLUFFY_TRUNK_GEO} material={trunkMat} castShadow receiveShadow />
      <group position={[0, 1.4 * size, 0]} scale={[size, size, size]}>
        {CLUSTER_DEFS.map((d, i) => (
          <mesh
            key={i}
            geometry={CLUSTER_GEOS[i]!}
            material={mat}
            position={[d.x, d.y, d.z]}
            castShadow
          />
        ))}
      </group>
    </group>
  );
}

// ── Shared non-tree geometries ───────────────────────────────────────────────
const QUAD_GEO = new THREE.PlaneGeometry(1, 1);

// Four rock geometry variants so the same texture looks different per rock
const ROCK_GEOS_PBR = (() => {
  const jitter = (g: THREE.BufferGeometry, amt: number) => {
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      pos.setXYZ(i,
        pos.getX(i) + (Math.random() - 0.5) * amt,
        pos.getY(i) + (Math.random() - 0.5) * amt,
        pos.getZ(i) + (Math.random() - 0.5) * amt);
    }
    g.computeVertexNormals();
    return g;
  };
  return [
    jitter(new THREE.IcosahedronGeometry(0.7, 1), 0.16),   // rounded boulder
    jitter(new THREE.DodecahedronGeometry(0.62, 0), 0.14), // angular lump
    jitter(new THREE.IcosahedronGeometry(0.55, 0), 0.11),  // small jagged stone
    jitter(new THREE.OctahedronGeometry(0.68, 1), 0.20),   // flat slab rock
  ];
})();

// ── PBR rock textures ──────────────────────────────────────────────────
let _rockPBR: { diff: THREE.Texture; norm: THREE.Texture; arm: THREE.Texture } | null = null;

function getRockPBR() {
  if (_rockPBR) return _rockPBR;
  const BASE    = import.meta.env.BASE_URL;
  const loader  = new THREE.TextureLoader();
  const loadTex = (path: string, srgb: boolean): THREE.Texture => {
    const t = loader.load(`${BASE}textures/terrain/${path}`);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 16;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    return t;
  };
  _rockPBR = {
    diff: loadTex('rock_diff.jpg',   true),   // albedo (sRGB)
    norm: loadTex('rock_nor_gl.jpg', false),  // GL normal map (linear)
    arm:  loadTex('rock_arm.jpg',    false),  // AO/Roughness/Metalness (linear)
  };
  return _rockPBR;
}

/** Build a MeshStandardMaterial with full PBR rock textures. */
function makeRockMat(tiling = 2.0): THREE.MeshStandardMaterial {
  const { diff, norm, arm } = getRockPBR();
  const clone = (t: THREE.Texture) => {
    const c = t.clone();
    c.needsUpdate = true;
    c.repeat.set(tiling, tiling);
    return c;
  };
  return new THREE.MeshStandardMaterial({
    map:          clone(diff),
    normalMap:    clone(norm),
    aoMap:        clone(arm),
    roughnessMap: clone(arm),
    metalnessMap: clone(arm),
    roughness:    0.88,
    metalness:    0.04,
    normalScale:  new THREE.Vector2(1.4, 1.4),
  });
}

// ── Shared billboard tree geometry ───────────────────────────────────────
// Single quad re-used for all leaf cards (scale/position per instance).
const BILL_QUAD = new THREE.PlaneGeometry(1, 1);
// Tapered trunk shared across all trees
const BILL_TRUNK_GEO = (() => {
  const g = new THREE.CylinderGeometry(0.08, 0.22, 1.55, 7);
  g.translate(0, 0.775, 0);
  return g;
})();

// Per-species leaf layer definitions:
// y   — world Y of this tier (before overall size scale)
// n   — number of crossing card pairs in this tier
// w,h — width/height of each card in this tier
const BILL_LAYERS: Record<string, { y: number; n: number; w: number; h: number }[]> = {
  normal: [
    { y: 1.30, n: 4, w: 1.85, h: 1.40 },
    { y: 1.85, n: 4, w: 1.50, h: 1.25 },
    { y: 2.30, n: 3, w: 1.10, h: 1.05 },
    { y: 2.65, n: 2, w: 0.70, h: 0.85 },
  ],
  oak: [
    { y: 1.20, n: 5, w: 2.00, h: 1.55 },
    { y: 1.80, n: 4, w: 1.65, h: 1.30 },
    { y: 2.30, n: 3, w: 1.20, h: 1.10 },
    { y: 2.70, n: 2, w: 0.80, h: 0.90 },
  ],
  pine: [
    { y: 0.90, n: 4, w: 1.40, h: 1.70 },
    { y: 1.50, n: 4, w: 1.10, h: 1.50 },
    { y: 2.05, n: 3, w: 0.80, h: 1.30 },
    { y: 2.50, n: 3, w: 0.55, h: 1.05 },
    { y: 2.85, n: 2, w: 0.30, h: 0.80 },
  ],
  birch: [
    { y: 1.20, n: 4, w: 1.45, h: 1.25 },
    { y: 1.75, n: 4, w: 1.15, h: 1.10 },
    { y: 2.20, n: 3, w: 0.85, h: 0.90 },
    { y: 2.55, n: 2, w: 0.55, h: 0.75 },
  ],
  maple: [
    { y: 1.25, n: 5, w: 1.95, h: 1.45 },
    { y: 1.82, n: 4, w: 1.55, h: 1.25 },
    { y: 2.28, n: 3, w: 1.10, h: 1.05 },
    { y: 2.65, n: 2, w: 0.70, h: 0.85 },
  ],
  palm: [
    { y: 1.60, n: 3, w: 1.70, h: 0.90 },  // palm frond spread
    { y: 2.20, n: 3, w: 1.30, h: 0.75 },
    { y: 2.70, n: 2, w: 0.90, h: 0.60 },
  ],
  bush: [
    { y: 0.60, n: 4, w: 1.10, h: 0.90 },
    { y: 0.95, n: 3, w: 0.85, h: 0.75 },
  ],
};

// Shared leaf materials keyed by slug+tint
const _billMatCache = new Map<string, THREE.MeshStandardMaterial>();
function getBillMat(leafSlug: string, tex: THREE.Texture | null, tint?: string): THREE.MeshStandardMaterial {
  const key = `${leafSlug}|${tint ?? ''}`;
  const cached = _billMatCache.get(key);
  if (cached) return cached;
  const sp = SPECIES_COLORS[leafSlug] ?? SPECIES_COLORS['normal']!;
  const baseCol = new THREE.Color(tint ?? sp.lit);
  const m = new THREE.MeshStandardMaterial({
    map:         tex ?? undefined,
    color:       tex ? (tint ? baseCol : 0xffffff) : baseCol,
    transparent: true,
    alphaTest:   0.38,
    side:        THREE.DoubleSide,
    roughness:   0.88,
    depthWrite:  false,
  });
  _billMatCache.set(key, m);
  return m;
}

/**
 * CardTree — layered cross-quad billboard tree.
 *
 * Each species has a pyramid of leaf card tiers (BILL_LAYERS).  Every tier
 * is N crossing PlaneGeometry quads rotated evenly around Y so the tree
 * reads as a full canopy from any angle.  The actual leaf PNG textures
 * (BirchTree_Leaves, PineTree_Leaves, etc.) are used so the tree has real
 * leaf detail rather than a solid-colour blob.
 *
 * Replaces the old FluffyTree3D sphere-cluster approach.
 */
export function CardTree({
  leafSlug,
  trunkScale = 1,
  foliageScale = 1.6,
  tint,
}: {
  leafSlug?: string;
  trunkScale?: number;
  foliageScale?: number;
  foliageY?: number;  // API compat, unused
  tint?: string;
}) {
  const slug = leafSlug ?? 'normal';
  const sp   = SPECIES_COLORS[slug] ?? SPECIES_COLORS['normal']!;
  const size = (foliageScale / 1.6) * trunkScale;

  const tex    = useMemo(() => leafTextureBySlug(slug), [slug]);
  const leafMat  = useMemo(() => getBillMat(slug, tex, tint), [slug, tex, tint]);
  const trunkMat = useMemo(() => getTrunkMat(sp.trunk), [sp.trunk]);

  const layers = (BILL_LAYERS[slug] ?? BILL_LAYERS['normal']!);

  return (
    <Sway amount={0.04}>
      {/* Bark trunk */}
      <mesh geometry={BILL_TRUNK_GEO} material={trunkMat}
        scale={[trunkScale, trunkScale, trunkScale]}
        castShadow receiveShadow
      />

      {/* Leaf tiers */}
      {layers.map((l, li) =>
        Array.from({ length: l.n }, (_, ci) => {
          // Spread cards evenly: 180° / n per step so they cross fully
          const rot = (ci / l.n) * Math.PI;
          return (
            <mesh
              key={`${li}_${ci}`}
              geometry={BILL_QUAD}
              material={leafMat}
              position={[0, l.y * size, 0]}
              rotation={[0, rot, 0]}
              scale={[l.w * size, l.h * size, 1]}
              castShadow
            />
          );
        })
      )}
    </Sway>
  );
}

/**
 * A single double-sided quad with a leaf / fern / mushroom atlas. Used
 * for things that read fine as a flat card (low ferns, undergrowth, etc.).
 */
export function FoliageCard({
  texture, scale = 1, height = 0.5,
}: { texture: THREE.Texture | null; scale?: number; height?: number }) {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({
    map: texture ?? undefined,
    color: texture ? 0xffffff : 0x3f8c4a,
    transparent: true,
    alphaTest: 0.35,
    side: THREE.DoubleSide,
    roughness: 0.9,
  }), [texture]);
  return (
    <group>
      <mesh geometry={QUAD_GEO} material={mat}
        position={[0, height, 0]} scale={[scale, scale, 1]} castShadow />
      <mesh geometry={QUAD_GEO} material={mat}
        position={[0, height, 0]} rotation={[0, Math.PI / 2, 0]}
        scale={[scale, scale, 1]} castShadow />
    </group>
  );
}

export function TexturedFern({ slug }: { slug?: string }) {
  return <FoliageCard texture={fernTextureBySlug(slug)} scale={1.2} height={0.6} />;
}

export function TexturedMushroom({ slug }: { slug?: string }) {
  return <FoliageCard texture={mushroomTextureBySlug(slug)} scale={0.5} height={0.25} />;
}

export function TexturedBush({ slug }: { slug?: string }) {
  return <FoliageCard texture={leafTextureBySlug(slug ?? 'bush')} scale={0.9} height={0.45} />;
}

/**
 * Flower cluster — 5 small upright cards arranged in a tight ring,
 * each sampling one cell of the atlas via per-mesh UV transform.
 */
export function TexturedFlowerCluster({ slug }: { slug?: string }) {
  const atlas = flowerAtlasBySlug(slug);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({
    map: atlas ?? undefined,
    color: atlas ? 0xffffff : 0xff5d8f,
    transparent: true,
    alphaTest: 0.4,
    side: THREE.DoubleSide,
    roughness: 0.85,
  }), [atlas]);
  const positions = useMemo(() => {
    const out: { x: number; z: number; r: number; s: number }[] = [];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      out.push({ x: Math.cos(a) * 0.25, z: Math.sin(a) * 0.25, r: a, s: 0.35 + Math.random() * 0.15 });
    }
    return out;
  }, []);
  return (
    <group>
      {positions.map((p, i) => (
        <mesh key={i} geometry={QUAD_GEO} material={mat}
          position={[p.x, p.s * 0.5, p.z]}
          rotation={[0, p.r, 0]}
          scale={[p.s, p.s, 1]} castShadow />
      ))}
    </group>
  );
}

/**
 * Grass clump: ~14 instanced narrow blades, each randomly rotated.
 * Uses InstancedMesh so the 200-grass-per-island case doesn't murder
 * the framerate.
 */
const GRASS_BLADE_GEO = new THREE.PlaneGeometry(0.18, 0.5);
GRASS_BLADE_GEO.translate(0, 0.25, 0);
export function TexturedGrass({ count = 14 }: { count?: number }) {
  const tex = FoliageTextures.grass();
  const mat = useMemo(() => new THREE.MeshStandardMaterial({
    map: tex ?? undefined,
    color: tex ? 0xffffff : 0x6caa4a,
    transparent: true,
    alphaTest: 0.25,
    side: THREE.DoubleSide,
    roughness: 0.95,
  }), [tex]);
  const ref = useRef<THREE.InstancedMesh>(null);
  // Lay out N blades inside a ~1m disc, each with random scale + rotation
  useMemo(() => {
    if (!ref.current) return;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * 0.5;
      dummy.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
      const s = 0.7 + Math.random() * 0.6;
      dummy.scale.set(s, s, 1);
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  }, [count]);
  return (
    <instancedMesh ref={ref} args={[GRASS_BLADE_GEO, mat, count]} castShadow />
  );
}

/**
 * PBR rock — procedural geometry with full diffuse + normal + ARM texture.
 * Uses biome terrain textures from public/textures/terrain/ for realistic
 * weathered-stone look. variant 0-3 picks a different base geometry.
 */
export function TexturedRock({ variant = 0 }: { variant?: number }) {
  const geo = ROCK_GEOS_PBR[variant % ROCK_GEOS_PBR.length]!;
  const mat = useMemo(() => makeRockMat(2.0), []);
  return <mesh geometry={geo} material={mat} castShadow receiveShadow />;
}

/**
 * PBR rock using a Kenney GLB shape — applies the same terrain rock textures
 * over the GLB mesh so the Kenney rocks have proper weathered stone instead
 * of their default white/untextured appearance.
 */
export function PBRRockGLTF({ url }: { url: string }) {
  const { scene } = useGLTF(url) as unknown as { scene: THREE.Group };
  const mat = useMemo(() => makeRockMat(2.5), []);
  const clone = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (m.isMesh) {
        m.material = mat;
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    return c;
  }, [scene, mat]);
  return <primitive object={clone} />;
}

/**
 * Light wind sway wrapper. Same idea as StylizedProps' WindSway but
 * exported here so we can wrap any TexturedFoliage primitive without
 * importing the legacy module.
 */
export function Sway({ amount = 0.04, children }: { amount?: number; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const t = useRef(Math.random() * 100);
  useFrame((_, dt) => {
    if (!ref.current) return;
    t.current += dt;
    ref.current.rotation.z = Math.sin(t.current * 0.8) * amount;
    ref.current.rotation.x = Math.cos(t.current * 0.6) * amount * 0.6;
  });
  return <group ref={ref}>{children}</group>;
}
