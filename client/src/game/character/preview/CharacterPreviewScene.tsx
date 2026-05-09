import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  ALL_SLOTS, applyVisibility, classifyHeads, classifyMesh,
  emptySlots, HeadCat, isCarryVariant, loadoutSlotKeys, pickBareSkin,
  selectionFromLoadout, SlotKey, totalVerts, unionGeometryBox, VariantRefs,
} from './classifier';
import { loadingOverlayStyle, presetBtnStyle, SlotPanel } from './SlotPanel';

const B = import.meta.env.BASE_URL.replace(/\/$/, '');

const SLOT_LABELS: Record<SlotKey, { label: string; exclusive: boolean }> = {
  body:         { label: 'Body',      exclusive: true  },
  head:         { label: 'Head',      exclusive: true  },
  arms:         { label: 'Arms',      exclusive: true  },
  legs:         { label: 'Legs',      exclusive: true  },
  shoulderpads: { label: 'Shoulders', exclusive: true  },
  weapon:       { label: 'Weapon',    exclusive: true  },
  shield:       { label: 'Shield',    exclusive: true  },
  xtra:         { label: 'Xtra',      exclusive: false },
};

interface Props {
  raceId: string;
  /** Multiplicative tint applied to the rim light for race flavour. */
  tint?: number;
  width?: number;
  height?: number;
  /** Fires whenever the user's loadout selection changes (parent stamps it
   *  onto the CharacterConfig at confirm time). */
  onSelectionChange?: (loadout: Record<string, string[]>) => void;
  /** Optional saved loadout to hydrate the previewer on mount. When provided
   *  (e.g. user already customized this race on a previous step) the previewer
   *  uses it instead of computing fresh defaults — preventing mount-time
   *  defaults from overwriting the user's prior picks. */
  initialLoadout?: Record<string, string[]>;
  /** When true, hides the loadout editor side-panel (slot pickers, presets,
   *  skeleton/hierarchy debug toggles) so the previewer is purely a 3D
   *  showcase of the already-selected character. */
  readOnly?: boolean;
  /** Hands the freshly-loaded GLB scene root up to a parent (e.g. the
   *  standalone Builder page) so it can read the live, currently-visible
   *  meshes for export. Re-fires whenever the race changes. */
  onSceneReady?: (root: THREE.Object3D, raceId: string) => void;
}

export function CharacterPreviewScene({
  raceId, tint = 0xffffff, width = 360, height = 480,
  onSelectionChange, initialLoadout, readOnly = false, onSceneReady,
}: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const meshesRef = useRef<Record<SlotKey, VariantRefs[]>>(emptySlots(() => []));

  // ── Debug visualisation refs (skeleton helper + hierarchy dump) ─────────
  const sceneRef         = useRef<THREE.Scene | null>(null);
  const rootRef          = useRef<THREE.Object3D | null>(null);
  const skelHelpersRef   = useRef<THREE.SkeletonHelper[]>([]);
  const [showSkeleton,  setShowSkeleton]  = useState(false);
  const [showHierarchy, setShowHierarchy] = useState(false);
  const [hierarchyText, setHierarchyText] = useState<string>('');

  const [catalog, setCatalog] = useState<Record<SlotKey, string[]>>(emptySlots(() => []));
  const [headSubcat, setHeadSubcat] = useState<Map<string, HeadCat>>(new Map());
  const [bareIds, setBareIds] = useState<{ body: string|null; arms: string|null; legs: string|null }>({
    body: null, arms: null, legs: null,
  });
  const [selection, setSelection] = useState<Record<SlotKey, Set<string>>>(() => ({
    ...emptySlots<Set<string>>(() => new Set()),
    body: new Set(['A']), head: new Set(['A']),
    arms: new Set(['A']), legs: new Set(['A']),
  }));
  const [loadingState, setLoadingState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ── Three.js scene setup (per raceId) ──────────────────────────────────────
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let disposed = false;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x05060c, 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x05060c, 6, 18);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(2.4, 2.0, 3.6);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.1, 0);
    controls.enableDamping = true;
    controls.minDistance = 2.0;
    controls.maxDistance = 7.0;
    controls.minPolarAngle = Math.PI * 0.2;
    controls.maxPolarAngle = Math.PI * 0.55;
    controls.update();

    // Three-point lighting + race-tinted rim
    const key = new THREE.DirectionalLight(0xffe6c8, 1.6);
    key.position.set(4, 6, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5; key.shadow.camera.far = 18;
    key.shadow.camera.left = -3;  key.shadow.camera.right = 3;
    key.shadow.camera.top = 3;    key.shadow.camera.bottom = -3;
    scene.add(key);

    const fill = new THREE.DirectionalLight(0x8aa6c8, 0.6);
    fill.position.set(-4, 3, 2);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(tint, 0.85);
    rim.position.set(0, 4, -5);
    scene.add(rim);

    scene.add(new THREE.AmbientLight(0x404868, 0.45));

    // Ground disc + glowing rune ring
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(3, 48),
      new THREE.MeshStandardMaterial({ color: 0x14111a, roughness: 1, metalness: 0 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.3, 1.45, 64),
      new THREE.MeshBasicMaterial({ color: 0xbda871, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.005;
    scene.add(ring);

    const pivot = new THREE.Group();
    scene.add(pivot);

    // Load the per-race GLB
    const loader = new GLTFLoader();
    const url = `${B}/models/toon_rts/characters/${raceId}.glb`;
    setLoadingState('loading');
    setErrorMsg(null);

    loader.loadAsync(url).then(gltf => {
      if (disposed) return;
      const root = gltf.scene;

      // ── Auto-scale + recentre so all races share the same ground anchor ──
      //
      // The previous implementation used `Box3.setFromObject(root)` to derive
      // the model's height. That is unreliable for these GLBs because:
      //   1. Bip001 (3ds Max Biped) has a baked-in 2.54 root-bone scale (the
      //      inch→cm unit conversion). Skinned meshes here are parented INSIDE
      //      the bone hierarchy (e.g. `WK_Units_Body_A` lives under
      //      `Bip001 L Hand`, not at root), so their geometry vertices are in
      //      a "skin space" frame whose extents (~14 cm) only become real-world
      //      sized after the 2.54× propagates down. Three.js's Box3 traversal
      //      multiplies vertex extents by `mesh.matrixWorld`, but for skinned
      //      meshes that math doesn't reproduce the actually-rendered bind
      //      pose — so the resulting box is centred on a hand, off-axis, and
      //      the wrong height. End result: character placed too low (feet
      //      below the ground plane → buried up to the shoulders) and scaled
      //      to the wrong size.
      //
      //   2. Even when the box is roughly the right height, `box.min.y` can
      //      be biased by long T-pose weapons or shoulder pads, which makes
      //      "feet at y=0" land somewhere mid-thigh.
      //
      // Bone positions are explicit and reliable: we use the foot bone → head
      // bone span as the height reference, and the lower of the two ankle
      // bones (minus a 10 cm ankle→sole offset) to land the soles at y=0.
      // This matches what the in-game `ToonCharacter._normaliseMesh` does, so
      // the preview and the game render the character at identical scale.
      const findBone = (patterns: string[]): THREE.Object3D | null => {
        let found: THREE.Object3D | null = null;
        root.traverse(o => {
          if (found) return;
          const n = o.name.toLowerCase().replace(/[\s.-]/g, '_');
          if (patterns.some(p => n === p || n.endsWith('_' + p) || n.includes(p))) found = o;
        });
        return found;
      };
      const lFoot = findBone(['l_foot','foot_l','leftfoot','lfoot']);
      const rFoot = findBone(['r_foot','foot_r','rightfoot','rfoot']);
      const head  = findBone(['bip001_head','mixamorig_head','head']);

      root.updateMatrixWorld(true);
      const fp = new THREE.Vector3(); (lFoot ?? rFoot)?.getWorldPosition(fp);
      const hp = new THREE.Vector3(); head?.getWorldPosition(hp);

      const targetH = 2.0;
      // Foot bone is the ankle (~10 cm above the sole) and head bone is the
      // chin (~10 cm below the crown), so add 20 cm for true silhouette height.
      const skeletonH = (lFoot || rFoot) && head ? Math.max(0.1, (hp.y - fp.y) + 0.20) : 0;
      const bboxH     = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3()).y;
      const heightRef = skeletonH > 0 ? skeletonH : bboxH;
      if (heightRef > 0.001) root.scale.setScalar(targetH / heightRef);

      // After scaling, recompute the bone positions and place the soles at y=0.
      // We measure from the lowest foot bone, then subtract the 10 cm
      // ankle→sole offset. XZ centring stays bbox-driven (it's only used to
      // keep the camera framing consistent across races).
      root.updateMatrixWorld(true);
      const a = new THREE.Vector3(); lFoot?.getWorldPosition(a);
      const b = new THREE.Vector3(); rFoot?.getWorldPosition(b);
      const ankleY = Math.min(lFoot ? a.y : Infinity, rFoot ? b.y : Infinity);
      const soleY  = (isFinite(ankleY) ? ankleY : new THREE.Box3().setFromObject(root).min.y) - 0.10;
      const c = new THREE.Box3().setFromObject(root).getCenter(new THREE.Vector3());
      root.position.set(-c.x, -soleY, -c.z);
      pivot.add(root);
      rootRef.current = root;
      // Hand the live root up so parent pages (the standalone Builder, etc.)
      // can export only the currently-visible meshes without re-loading the GLB.
      onSceneReady?.(root, raceId);

      // Group meshes by slot/variant and clone materials per-mount so style
      // tweaks here don't bleed across re-mounts.
      const cat: Record<SlotKey, Map<string, THREE.Object3D[]>> = emptySlots(() => new Map());
      root.traverse(obj => {
        const m = obj as THREE.Mesh;
        if (!m.isMesh) return;
        m.castShadow = true;
        m.receiveShadow = true;
        const cloneMat = (mat: THREE.Material) => {
          const std = (mat as THREE.MeshStandardMaterial).clone();
          // Atlases ship as sRGB but fbx2gltf doesn't always tag them.
          if (std.map) std.map.colorSpace = THREE.SRGBColorSpace;
          if (typeof std.metalness === 'number') std.metalness = 0.05;
          if (typeof std.roughness === 'number') std.roughness = 0.85;
          return std;
        };
        m.material = Array.isArray(m.material) ? m.material.map(cloneMat) : cloneMat(m.material);

        const cm = classifyMesh(m.name);
        if (!cm) return;
        const list = cat[cm.slot].get(cm.variant) ?? [];
        list.push(m);
        cat[cm.slot].set(cm.variant, list);
      });

      const newCatalog: Record<SlotKey, string[]> = emptySlots(() => []);
      const newRefs: Record<SlotKey, VariantRefs[]> = emptySlots(() => []);
      for (const slot of ALL_SLOTS) {
        const variants = [...cat[slot].keys()].sort();
        newCatalog[slot] = variants;
        newRefs[slot] = variants.map(v => ({ variant: v, meshes: cat[slot].get(v) ?? [] }));
      }
      meshesRef.current = newRefs;
      setCatalog(newCatalog);

      // Head subcat + bare-skin detection (pure geometry-driven helpers).
      const subcat = classifyHeads(
        newRefs.head.map(({ variant, meshes }) => ({ variant, box: unionGeometryBox(meshes) })),
      );
      setHeadSubcat(subcat);

      const bareFor = (slot: SlotKey) =>
        pickBareSkin(newRefs[slot].map(({ variant, meshes }) => ({ variant, verts: totalVerts(meshes) })));
      const bare = { body: bareFor('body'), arms: bareFor('arms'), legs: bareFor('legs') };
      setBareIds(bare);

      // Default selection: prefer first 'face' variant + barest body/arms/legs
      // (falling back to A when no meaningful bare exists).
      const firstFace = newCatalog.head.find(v => (subcat.get(v) ?? 'face') === 'face')
        ?? newCatalog.head[0];
      const defaultSel: Record<SlotKey, Set<string>> = {
        ...emptySlots<Set<string>>(() => new Set()),
        body: new Set([bare.body ?? newCatalog.body[0]].filter(Boolean) as string[]),
        head: new Set(firstFace ? [firstFace] : []),
        arms: new Set([bare.arms ?? newCatalog.arms[0]].filter(Boolean) as string[]),
        legs: new Set([bare.legs ?? newCatalog.legs[0]].filter(Boolean) as string[]),
      };

      // If the parent passed a saved loadout (e.g. the user already customized
      // this race on a previous step), hydrate from it so we don't overwrite
      // their picks with mount-time defaults. Filter against the catalog so a
      // stale variant from a different race can't sneak in.
      let initSel: Record<SlotKey, Set<string>> = defaultSel;
      if (initialLoadout && Object.keys(initialLoadout).length > 0) {
        const presentKeys = loadoutSlotKeys(initialLoadout);
        const fromLoadout = selectionFromLoadout(initialLoadout);
        const hydrated: Record<SlotKey, Set<string>> = emptySlots<Set<string>>(() => new Set());
        for (const slot of ALL_SLOTS) {
          if (presentKeys.has(slot)) {
            const valid = newCatalog[slot];
            const filtered = [...fromLoadout[slot]].filter(v => valid.includes(v));
            hydrated[slot] = new Set(filtered);
          } else {
            hydrated[slot] = defaultSel[slot];
          }
        }
        initSel = hydrated;
      }
      setSelection(initSel);
      applyVisibility(newRefs, initSel);

      setLoadingState('ready');
    }).catch(err => {
      if (disposed) return;
      console.error('[CharacterPreview] load failed:', err);
      setLoadingState('error');
      setErrorMsg(String(err?.message ?? err));
    });

    // Animation loop
    let raf = 0;
    const tick = () => {
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      controls.dispose();
      // Walk + dispose geometry, materials, AND material-owned textures.
      const TEX_KEYS = ['map','normalMap','roughnessMap','metalnessMap','emissiveMap','aoMap','alphaMap','bumpMap','displacementMap'] as const;
      scene.traverse(obj => {
        const m = obj as THREE.Mesh;
        if (!m.isMesh) return;
        m.geometry?.dispose();
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mt of mats) {
          if (!mt) continue;
          for (const k of TEX_KEYS) {
            const t = (mt as unknown as Record<string, THREE.Texture | null>)[k];
            if (t && typeof t.dispose === 'function') t.dispose();
          }
          (mt as THREE.Material).dispose();
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      meshesRef.current = emptySlots(() => []);
      // Drop debug helpers + refs
      for (const h of skelHelpersRef.current) {
        h.parent?.remove(h);
        (h.material as THREE.LineBasicMaterial)?.dispose?.();
        (h.geometry as THREE.BufferGeometry)?.dispose?.();
      }
      skelHelpersRef.current = [];
      sceneRef.current = null;
      rootRef.current  = null;
    };
  }, [raceId, tint, width, height]);

  // ── Skeleton-helper toggle ────────────────────────────────────────────────
  // Walks every SkinnedMesh under the loaded model, attaches a SkeletonHelper
  // to the scene for each, and disposes them all when toggled off (or when
  // the character changes — handled by the cleanup in the main effect above).
  useEffect(() => {
    const scene = sceneRef.current;
    const root  = rootRef.current;
    if (!scene || !root) return;

    if (showSkeleton) {
      const seen = new Set<THREE.Skeleton>();
      root.traverse(obj => {
        const sm = obj as THREE.SkinnedMesh;
        if (!sm.isSkinnedMesh || seen.has(sm.skeleton)) return;
        seen.add(sm.skeleton);
        const helper = new THREE.SkeletonHelper(sm);
        // Bright high-contrast colour so it pops against the dark scene.
        (helper.material as THREE.LineBasicMaterial).color.setHex(0xff7733);
        (helper.material as THREE.LineBasicMaterial).depthTest = false;
        (helper.material as THREE.LineBasicMaterial).transparent = true;
        helper.renderOrder = 999;
        scene.add(helper);
        skelHelpersRef.current.push(helper);
      });
    }

    return () => {
      for (const h of skelHelpersRef.current) {
        h.parent?.remove(h);
        (h.material as THREE.LineBasicMaterial)?.dispose?.();
        (h.geometry as THREE.BufferGeometry)?.dispose?.();
      }
      skelHelpersRef.current = [];
    };
  }, [showSkeleton, raceId, loadingState]);

  // ── Hierarchy dump (computed lazily on toggle) ───────────────────────────
  // Walks the scene graph and produces an indented tree showing each node's
  // name, type (Bone / SkinnedMesh / Mesh / Object3D), and bone/vertex count.
  // Recomputed whenever the panel is opened so it reflects the current model.
  useEffect(() => {
    if (!showHierarchy) return;
    const root = rootRef.current;
    if (!root) { setHierarchyText('(no model loaded)'); return; }

    const lines: string[] = [];
    const dump = (obj: THREE.Object3D, depth: number) => {
      const sm = obj as THREE.SkinnedMesh;
      const m  = obj as THREE.Mesh;
      let tag = obj.type;
      let extra = '';
      if (sm.isSkinnedMesh) {
        tag = 'SkinnedMesh';
        extra = ` [bones=${sm.skeleton?.bones.length ?? 0}, verts=${sm.geometry?.attributes?.position?.count ?? 0}]`;
      } else if (m.isMesh) {
        tag = 'Mesh';
        extra = ` [verts=${m.geometry?.attributes?.position?.count ?? 0}]`;
      } else if ((obj as THREE.Bone).isBone) {
        tag = 'Bone';
      }
      lines.push(`${'  '.repeat(depth)}${tag}: ${obj.name || '(unnamed)'}${extra}`);
      for (const child of obj.children) dump(child, depth + 1);
    };
    dump(root, 0);
    setHierarchyText(lines.join('\n'));
  }, [showHierarchy, raceId, loadingState]);

  // Push selection up so RaceClassSelect can stamp it onto the CharacterConfig.
  useEffect(() => {
    if (!onSelectionChange) return;
    const out: Record<string, string[]> = {};
    for (const slot of ALL_SLOTS) out[slot] = Array.from(selection[slot]).sort();
    onSelectionChange(out);
  }, [selection, onSelectionChange]);

  // Re-apply visibility on every selection change.
  useEffect(() => { applyVisibility(meshesRef.current, selection); }, [selection]);

  const toggle = (slot: SlotKey, variant: string) => {
    setSelection(prev => {
      const next: Record<SlotKey, Set<string>> = { ...prev };
      const s = new Set(prev[slot]);

      if (slot === 'head') {
        // Subcat-aware exclusivity: clicking face/beard/helmet only replaces
        // others in the same sub-category. Lets the user stack one of each.
        const cat = headSubcat.get(variant) ?? 'face';
        if (s.has(variant)) s.delete(variant);
        else {
          for (const v of [...s]) {
            if ((headSubcat.get(v) ?? 'face') === cat) s.delete(v);
          }
          s.add(variant);
        }
      } else if (SLOT_LABELS[slot].exclusive) {
        if (s.has(variant) && s.size === 1) s.clear();
        else { s.clear(); s.add(variant); }
      } else {
        if (s.has(variant)) s.delete(variant); else s.add(variant);
      }
      next[slot] = s;

      // Tied-asset rule: bag / wood / log xtra meshes embed their own hand,
      // so we hide the arms slot entirely while one is held, and restore the
      // bare-skin default once they're cleared.
      if (slot === 'xtra') {
        const carrying = [...s].some(isCarryVariant);
        if (carrying) next.arms = new Set();
        else {
          const armSet = new Set<string>();
          if (bareIds.arms) armSet.add(bareIds.arms);
          else if (catalog.arms.includes('A')) armSet.add('A');
          next.arms = armSet;
        }
      }
      // Reverse lock: re-enabling an arm variant while carrying drops the
      // carry items so we don't end up with two forearms fused together.
      if (slot === 'arms' && s.size > 0) {
        const xtra = new Set(prev.xtra);
        for (const v of [...xtra]) if (isCarryVariant(v)) xtra.delete(v);
        next.xtra = xtra;
      }
      return next;
    });
  };

  // First face variant — used as the default head when stripping.
  const firstFaceVariant = useMemo(() => {
    for (const v of catalog.head) {
      if ((headSubcat.get(v) ?? 'face') === 'face') return v;
    }
    return catalog.head[0] ?? null;
  }, [catalog.head, headSubcat]);

  // Bare = clothed baseline (Body_A / Face_A / Arms_A / Legs_A, no equipment).
  const stripToBare = () => {
    setSelection({
      ...emptySlots<Set<string>>(() => new Set()),
      body: new Set(catalog.body.includes('A') ? ['A'] : catalog.body.slice(0, 1)),
      head: new Set(firstFaceVariant ? [firstFaceVariant] : []),
      arms: new Set(catalog.arms.includes('A') ? ['A'] : catalog.arms.slice(0, 1)),
      legs: new Set(catalog.legs.includes('A') ? ['A'] : catalog.legs.slice(0, 1)),
    });
  };

  // Naked = barest body / arms / legs the asset pack ships, plus a face.
  // (Toon RTS doesn't include true skin meshes — picks the lowest-vert variant
  // when one stands out, otherwise falls back to A.)
  const stripToNaked = () => {
    setSelection({
      ...emptySlots<Set<string>>(() => new Set()),
      body: new Set([bareIds.body ?? catalog.body[0]].filter(Boolean) as string[]),
      head: new Set(firstFaceVariant ? [firstFaceVariant] : []),
      arms: new Set([bareIds.arms ?? catalog.arms[0]].filter(Boolean) as string[]),
      legs: new Set([bareIds.legs ?? catalog.legs[0]].filter(Boolean) as string[]),
    });
  };

  // Future ability hook: full invisibility (for a "Vanish" skill etc.).
  // Hides everything visually without changing the loadout state.
  // Wire from skill code via:
  //   window.dispatchEvent(new CustomEvent('souls:invisible', { detail: { on: true } }));
  useEffect(() => {
    const handler = (e: Event) => {
      const on = (e as CustomEvent<{ on: boolean }>).detail?.on ?? false;
      const refs = meshesRef.current;
      for (const slot of ALL_SLOTS) {
        for (const { meshes } of refs[slot]) {
          for (const m of meshes) m.visible = on ? false : m.visible;
        }
      }
      if (!on) applyVisibility(refs, selection);
    };
    window.addEventListener('souls:invisible', handler as EventListener);
    return () => window.removeEventListener('souls:invisible', handler as EventListener);
  }, [selection]);

  // Slots in the main loop — head is rendered as 3 sub-panels separately.
  const slotsWithContent = useMemo(
    () => ALL_SLOTS.filter(k => k !== 'head' && catalog[k].length > 0),
    [catalog],
  );

  // Head variants split by sub-category.
  const headByCat: Record<HeadCat, string[]> = useMemo(() => {
    const out: Record<HeadCat, string[]> = { face: [], beard: [], helmet: [] };
    for (const v of catalog.head) out[headSubcat.get(v) ?? 'face'].push(v);
    return out;
  }, [catalog.head, headSubcat]);

  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
      {/* 3D viewport */}
      <div style={{
        position: 'relative', width, height,
        border: '1px solid #2a2018', borderRadius: 4,
        boxShadow: '0 8px 24px rgba(0,0,0,0.6), inset 0 0 60px rgba(189,168,113,0.08)',
        overflow: 'hidden', background: '#05060c',
      }}>
        <div ref={mountRef} style={{ width, height }} />
        {loadingState === 'loading' && (
          <div style={loadingOverlayStyle}>
            <div style={{ color: '#bda871', fontSize: 11, letterSpacing: '0.3em' }}>SUMMONING…</div>
          </div>
        )}
        {loadingState === 'error' && (
          <div style={loadingOverlayStyle}>
            <div style={{ color: '#cc4444', fontSize: 11, letterSpacing: '0.2em', textAlign: 'center', padding: 12 }}>
              FAILED TO LOAD<br/><span style={{ fontSize: 9, color: '#7a4040' }}>{errorMsg}</span>
            </div>
          </div>
        )}
        <div style={{
          position: 'absolute', left: 8, bottom: 8, fontSize: 9, color: '#5a5048',
          letterSpacing: '0.3em', textTransform: 'uppercase', pointerEvents: 'none',
        }}>
          drag · rotate
        </div>
      </div>

      {/* Hierarchy panel — shows bone/mesh tree of the loaded model */}
      {showHierarchy && (
        <div style={{
          width: 320, maxHeight: height, overflow: 'auto',
          background: 'rgba(8,6,12,0.92)', border: '1px solid #bda871', borderRadius: 4,
          padding: '10px 12px',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: 10, lineHeight: 1.45, color: '#c8b890',
          whiteSpace: 'pre',
        }}>
          <div style={{ color: '#bda871', fontSize: 11, letterSpacing: '0.25em', marginBottom: 8, textTransform: 'uppercase' }}>
            Hierarchy
          </div>
          {hierarchyText || '(loading…)'}
        </div>
      )}

      {/* Equipment editor (hidden in read-only previews — e.g. the class-pick
       *  step shows the character we already built but doesn't let the user
       *  re-edit slot variants). */}
      {!readOnly && (
      <div style={{
        width: 240, maxHeight: height, overflowY: 'auto',
        background: 'rgba(8,6,12,0.85)', border: '1px solid #2a2018', borderRadius: 4,
        padding: '12px 14px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <div className="font-decorative" style={{ fontSize: 12, color: '#bda871', letterSpacing: '0.25em', textTransform: 'uppercase' }}>
            Loadout
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button onClick={stripToBare} style={presetBtnStyle}>Bare</button>
            <button onClick={stripToNaked} style={presetBtnStyle}>Naked</button>
            <button
              onClick={() => setShowSkeleton(s => !s)}
              style={{
                ...presetBtnStyle,
                background: showSkeleton ? 'rgba(255,119,51,0.25)' : presetBtnStyle.background,
                borderColor: showSkeleton ? '#ff7733' : (presetBtnStyle as any).borderColor,
                color: showSkeleton ? '#ff9966' : (presetBtnStyle as any).color,
              }}
              title="Overlay the bind-pose skeleton on the character"
            >
              Skeleton
            </button>
            <button
              onClick={() => setShowHierarchy(s => !s)}
              style={{
                ...presetBtnStyle,
                background: showHierarchy ? 'rgba(189,168,113,0.25)' : presetBtnStyle.background,
                borderColor: showHierarchy ? '#bda871' : (presetBtnStyle as any).borderColor,
                color: showHierarchy ? '#e0c890' : (presetBtnStyle as any).color,
              }}
              title="Dump the scene-graph node tree (bones + meshes)"
            >
              Hierarchy
            </button>
          </div>
        </div>

        {loadingState !== 'ready' && (
          <div style={{ fontSize: 10, color: '#5a5048', letterSpacing: '0.2em', padding: '20px 0', textAlign: 'center' }}>
            {loadingState === 'loading' ? '…' : 'no parts'}
          </div>
        )}

        {loadingState === 'ready' && (
          <>
            {/* Head sub-panels split via bbox heuristic. */}
            {(['face','beard','helmet'] as HeadCat[]).map(cat => (
              headByCat[cat].length > 0 && (
                <SlotPanel
                  key={`head-${cat}`}
                  slot="head"
                  label={cat === 'face' ? 'Face' : cat === 'beard' ? 'Beard' : 'Helmet / Hood'}
                  variants={headByCat[cat]}
                  selected={selection.head}
                  exclusive
                  onToggle={v => toggle('head', v)}
                  onClear={() => setSelection(prev => {
                    const s = new Set(prev.head);
                    for (const v of [...s]) {
                      if ((headSubcat.get(v) ?? 'face') === cat) s.delete(v);
                    }
                    return { ...prev, head: s };
                  })}
                />
              )
            ))}
            {slotsWithContent.map(slot => (
              <SlotPanel
                key={slot}
                slot={slot}
                label={SLOT_LABELS[slot].label}
                variants={catalog[slot]}
                selected={selection[slot]}
                exclusive={SLOT_LABELS[slot].exclusive}
                bareVariant={slot === 'body' ? bareIds.body : slot === 'arms' ? bareIds.arms : slot === 'legs' ? bareIds.legs : null}
                onToggle={v => toggle(slot, v)}
                onClear={() => setSelection(prev => ({ ...prev, [slot]: new Set() }))}
              />
            ))}
          </>
        )}
      </div>
      )}
    </div>
  );
}
