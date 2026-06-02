/**
 * Enhanced Model Converter & GLTF Editor.
 *
 * - Drop a .gltf/.glb/.fbx/.obj OR a .zip containing a model + textures
 * - ZIPs are unpacked in-browser via JSZip; a virtual filesystem is
 *   built and handed to a LoadingManager URL modifier so the GLTFLoader
 *   resolves sibling textures from blob URLs (no broken references).
 * - Scene graph tree on the left: select, toggle visibility, rename.
 * - Inspector on the right: live transform, material color/roughness/
 *   metalness/wireframe, geometry stats, animation timeline scrubber.
 * - Optional sync to the API server (POST /api/models) for persistent
 *   storage so the same upload can be re-used across sessions.
 */
import {
  useState, useRef, Suspense, useMemo, useEffect, useCallback,
} from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, Grid, Bounds, useBounds, useProgress } from '@react-three/drei';
import { LoadScreen } from '../components/LoadScreen';

function ConverterLoadOverlay() {
  const { active, progress } = useProgress();
  if (!active) return null;
  return <LoadScreen label={`Unpacking model… ${Math.round(progress)}%`} />;
}
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import * as THREE from 'three';
import JSZip from 'jszip';

interface ModelStats {
  meshes: number;
  skinnedMeshes: number;
  vertices: number;
  triangles: number;
  materials: number;
  textures: number;
  bones: number;
  bounds: { x: number; y: number; z: number };
}

interface LoadedModel {
  root: THREE.Object3D;
  animations: THREE.AnimationClip[];
  blobs: string[];
}

interface ServerModel {
  id: string;
  name: string;
  entry: string;
  files: string[];
  size: number;
  uploadedAt: number;
}

function inspectScene(root: THREE.Object3D): ModelStats {
  let meshes = 0, skinnedMeshes = 0, vertices = 0, triangles = 0;
  const mats = new Set<THREE.Material>();
  const texs = new Set<THREE.Texture>();
  const bones = new Set<THREE.Bone>();
  root.traverse((o) => {
    if ((o as THREE.Bone).isBone) bones.add(o as THREE.Bone);
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.geometry) return;
    meshes++;
    if ((m as THREE.SkinnedMesh).isSkinnedMesh) skinnedMeshes++;
    const pos = m.geometry.attributes.position;
    if (pos) vertices += pos.count;
    triangles += m.geometry.index
      ? m.geometry.index.count / 3
      : (pos?.count ?? 0) / 3;
    const list = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of list) {
      if (!mat) continue;
      mats.add(mat);
      for (const k of ['map','normalMap','roughnessMap','metalnessMap','emissiveMap','aoMap']) {
        const t = (mat as unknown as Record<string, THREE.Texture | null>)[k];
        if (t) texs.add(t);
      }
    }
  });
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3(); box.getSize(size);
  return {
    meshes, skinnedMeshes, vertices,
    triangles: Math.round(triangles),
    materials: mats.size, textures: texs.size, bones: bones.size,
    bounds: { x: +size.x.toFixed(2), y: +size.y.toFixed(2), z: +size.z.toFixed(2) },
  };
}

/** Build a Blob URL map from a JSZip — values are blob: URLs.
 *  Keyed by both basename and full lowercased path so GLTF references
 *  written with either style still resolve. */
async function unpackZipToBlobs(file: File): Promise<{ files: Map<string, string>; blobs: string[]; entry: string }> {
  const zip = await JSZip.loadAsync(file);
  const map = new Map<string, string>();
  const blobs: string[] = [];
  let entry = '';
  let entryPriority = -1;
  const PRI: Record<string, number> = { glb: 5, gltf: 4, fbx: 3, obj: 2 };
  await Promise.all(
    Object.values(zip.files).map(async (z) => {
      if (z.dir) return;
      const data = await z.async('blob');
      const url = URL.createObjectURL(data);
      blobs.push(url);
      const lower = z.name.toLowerCase();
      map.set(lower, url);
      const base = lower.split('/').pop()!;
      map.set(base, url);
      const ext = base.split('.').pop() ?? '';
      const p = PRI[ext] ?? 0;
      if (p > entryPriority) { entryPriority = p; entry = z.name; }
    }),
  );
  if (!entry) throw new Error('Zip is empty.');
  return { files: map, blobs, entry };
}

function makeManager(blobMap: Map<string, string>, entryDir: string): THREE.LoadingManager {
  const mgr = new THREE.LoadingManager();
  mgr.setURLModifier((url) => {
    if (url.startsWith('blob:') || url.startsWith('data:')) return url;
    // Resolve relative to entry dir
    const cleaned = url.replace(/^\.\//, '');
    const candidates = [
      cleaned.toLowerCase(),
      (entryDir ? `${entryDir}/${cleaned}` : cleaned).toLowerCase(),
      cleaned.split('/').pop()!.toLowerCase(),
    ];
    for (const c of candidates) {
      const hit = blobMap.get(c);
      if (hit) return hit;
    }
    return url;
  });
  return mgr;
}

async function loadFromBlobMap(
  blobMap: Map<string, string>, entry: string, blobs: string[],
): Promise<LoadedModel> {
  const ext = entry.toLowerCase().split('.').pop() ?? '';
  const url = blobMap.get(entry.toLowerCase()) ?? blobMap.get(entry.split('/').pop()!.toLowerCase());
  if (!url) throw new Error(`Entry file ${entry} missing in zip.`);
  const entryDir = entry.includes('/') ? entry.substring(0, entry.lastIndexOf('/')).toLowerCase() : '';
  const mgr = makeManager(blobMap, entryDir);
  if (ext === 'gltf' || ext === 'glb') {
    const gltf = await new GLTFLoader(mgr).loadAsync(url);
    return { root: gltf.scene, animations: gltf.animations ?? [], blobs };
  }
  if (ext === 'fbx') {
    const fbx = await new FBXLoader(mgr).loadAsync(url);
    return { root: fbx, animations: fbx.animations ?? [], blobs };
  }
  if (ext === 'obj') return { root: await new OBJLoader(mgr).loadAsync(url), animations: [], blobs };
  throw new Error(`Unsupported extension .${ext}`);
}

async function loadAny(file: File): Promise<LoadedModel> {
  const ext = file.name.toLowerCase().split('.').pop() ?? '';
  if (ext === 'zip') {
    const { files, blobs, entry } = await unpackZipToBlobs(file);
    return loadFromBlobMap(files, entry, blobs);
  }
  const url = URL.createObjectURL(file);
  const blobs = [url];
  try {
    if (ext === 'gltf' || ext === 'glb') {
      const gltf = await new GLTFLoader().loadAsync(url);
      return { root: gltf.scene, animations: gltf.animations ?? [], blobs };
    }
    if (ext === 'fbx') {
      const fbx = await new FBXLoader().loadAsync(url);
      return { root: fbx, animations: fbx.animations ?? [], blobs };
    }
    if (ext === 'obj') return { root: await new OBJLoader().loadAsync(url), animations: [], blobs };
    throw new Error(`Unsupported file extension .${ext}`);
  } catch (e) {
    blobs.forEach((b) => URL.revokeObjectURL(b));
    throw e;
  }
}

function FitToView({ children }: { children: React.ReactNode }) {
  const api = useBounds();
  return (
    <group onUpdate={() => api.refresh().clip().fit()}>{children}</group>
  );
}

function AnimatedRoot({
  root, clip, showSkeleton, scrub, paused, onTick,
}: {
  root: THREE.Object3D;
  clip: THREE.AnimationClip | null;
  showSkeleton: boolean;
  scrub: number | null;
  paused: boolean;
  onTick: (time: number, duration: number) => void;
}) {
  const mixer = useMemo(() => new THREE.AnimationMixer(root), [root]);
  const actionRef = useRef<THREE.AnimationAction | null>(null);

  useEffect(() => {
    mixer.stopAllAction();
    actionRef.current = null;
    if (clip) {
      const a = mixer.clipAction(clip);
      a.reset().play();
      actionRef.current = a;
    }
    return () => { mixer.stopAllAction(); };
  }, [mixer, clip]);

  useEffect(() => () => { mixer.stopAllAction(); mixer.uncacheRoot(root); }, [mixer, root]);

  useFrame((_, dt) => {
    const a = actionRef.current;
    if (!a) return;
    if (scrub !== null) {
      a.time = scrub;
      mixer.update(0);
    } else if (!paused) {
      mixer.update(dt);
    }
    if (clip) onTick(a.time % clip.duration, clip.duration);
  });

  return (
    <group>
      <primitive object={root} />
      {showSkeleton && <SkeletonOverlay root={root} />}
    </group>
  );
}

function SkeletonOverlay({ root }: { root: THREE.Object3D }) {
  const helper = useMemo(() => {
    const h = new THREE.SkeletonHelper(root);
    (h.material as THREE.LineBasicMaterial).depthTest = false;
    (h.material as THREE.LineBasicMaterial).transparent = true;
    return h;
  }, [root]);
  return <primitive object={helper} />;
}

function applyOverrides(
  root: THREE.Object3D | null,
  overrides: { wireframe: boolean },
) {
  if (!root) return;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const list = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of list) {
      if (!mat) continue;
      const hasWire = mat as THREE.Material & { wireframe?: boolean };
      if ('wireframe' in hasWire) hasWire.wireframe = overrides.wireframe;
    }
  });
}

interface NodeRowProps {
  node: THREE.Object3D;
  depth: number;
  selectedId: number | null;
  onSelect: (n: THREE.Object3D) => void;
  onChange: () => void;
}

function NodeRow({ node, depth, selectedId, onSelect, onChange }: NodeRowProps) {
  const [open, setOpen] = useState(depth < 2);
  const isSel = node.id === selectedId;
  const kind = (node as THREE.SkinnedMesh).isSkinnedMesh
    ? 'SkinnedMesh'
    : (node as THREE.Mesh).isMesh ? 'Mesh'
    : (node as THREE.Bone).isBone ? 'Bone'
    : node.type;
  return (
    <>
      <div
        className={`flex items-center gap-1 text-xs py-0.5 px-1 cursor-pointer rounded ${isSel ? 'bg-primary/20 text-primary' : 'hover:bg-muted/50'}`}
        style={{ paddingLeft: 4 + depth * 12 }}
        onClick={() => onSelect(node)}
      >
        {node.children.length > 0 ? (
          <button
            className="w-3 text-muted-foreground"
            onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
          >{open ? '▾' : '▸'}</button>
        ) : <span className="w-3" />}
        <input
          type="checkbox"
          className="w-3 h-3"
          checked={node.visible}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => { node.visible = e.target.checked; onChange(); }}
        />
        <span className="truncate flex-1">{node.name || `<${kind}>`}</span>
        <span className="text-[10px] text-muted-foreground">{kind}</span>
      </div>
      {open && node.children.map((c) => (
        <NodeRow key={c.id} node={c} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} onChange={onChange} />
      ))}
    </>
  );
}

function NodeInspector({
  node, onChange,
}: {
  node: THREE.Object3D;
  onChange: () => void;
}) {
  const [, setTick] = useState(0);
  const bump = () => { setTick((t) => t + 1); onChange(); };

  const mesh = node as THREE.Mesh;
  const mat = mesh.isMesh
    ? (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as
        (THREE.MeshStandardMaterial & { color?: THREE.Color }) | undefined
    : undefined;

  return (
    <div className="space-y-3 text-xs">
      <div>
        <label className="block text-muted-foreground mb-0.5">Name</label>
        <input
          className="w-full bg-input border border-border rounded px-2 py-1"
          value={node.name}
          onChange={(e) => { node.name = e.target.value; bump(); }}
        />
      </div>

      <Section title="Transform">
        <Vec3Row label="pos" v={node.position} onChange={bump} />
        <Vec3Row label="rot" v={node.rotation as unknown as THREE.Vector3} onChange={bump} euler />
        <Vec3Row label="scl" v={node.scale} onChange={bump} step={0.05} />
      </Section>

      {mat && 'color' in mat && (
        <Section title="Material">
          <div className="flex items-center gap-2">
            <label className="text-muted-foreground w-16">color</label>
            <input
              type="color"
              value={`#${(mat.color as THREE.Color).getHexString()}`}
              onChange={(e) => { (mat.color as THREE.Color).set(e.target.value); bump(); }}
              className="h-6 w-10 bg-transparent border border-border rounded"
            />
          </div>
          {'roughness' in mat && (
            <Slider label="roughness" value={(mat as THREE.MeshStandardMaterial).roughness} min={0} max={1} step={0.01}
              onChange={(v) => { (mat as THREE.MeshStandardMaterial).roughness = v; bump(); }} />
          )}
          {'metalness' in mat && (
            <Slider label="metalness" value={(mat as THREE.MeshStandardMaterial).metalness} min={0} max={1} step={0.01}
              onChange={(v) => { (mat as THREE.MeshStandardMaterial).metalness = v; bump(); }} />
          )}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={(mat as { wireframe?: boolean }).wireframe ?? false}
              onChange={(e) => { (mat as { wireframe?: boolean }).wireframe = e.target.checked; bump(); }}
            />
            wireframe
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={mat.transparent ?? false}
              onChange={(e) => { mat.transparent = e.target.checked; mat.needsUpdate = true; bump(); }}
            />
            transparent
          </label>
        </Section>
      )}

      {mesh.isMesh && mesh.geometry && (
        <Section title="Geometry">
          <Stat label="vertices" value={mesh.geometry.attributes.position?.count ?? 0} />
          <Stat label="indexed"  value={mesh.geometry.index ? 'yes' : 'no'} />
          <Stat label="groups"   value={mesh.geometry.groups.length} />
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-border/40 rounded p-2 space-y-1.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}

function Vec3Row({
  label, v, onChange, step = 0.1, euler = false,
}: { label: string; v: THREE.Vector3 | THREE.Euler; onChange: () => void; step?: number; euler?: boolean }) {
  const get = (axis: 'x'|'y'|'z') => euler
    ? THREE.MathUtils.radToDeg((v as THREE.Euler)[axis])
    : (v as THREE.Vector3)[axis];
  const set = (axis: 'x'|'y'|'z', val: number) => {
    if (euler) (v as THREE.Euler)[axis] = THREE.MathUtils.degToRad(val);
    else (v as THREE.Vector3)[axis] = val;
    onChange();
  };
  return (
    <div className="flex items-center gap-1">
      <label className="text-muted-foreground w-10">{label}</label>
      {(['x','y','z'] as const).map((a) => (
        <input
          key={a}
          type="number"
          step={step}
          value={+get(a).toFixed(3)}
          onChange={(e) => set(a, parseFloat(e.target.value) || 0)}
          className="w-full bg-input border border-border rounded px-1 py-0.5 font-mono"
        />
      ))}
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-muted-foreground w-16">{label}</label>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1"
      />
      <span className="font-mono w-10 text-right">{value.toFixed(2)}</span>
    </div>
  );
}

const ENV_PRESETS = ['city','sunset','dawn','night','warehouse','forest','apartment','studio','park','lobby'] as const;
type EnvPreset = typeof ENV_PRESETS[number];

export function ModelConverter() {
  const [model, setModel] = useState<LoadedModel | null>(null);
  const [stats, setStats] = useState<ModelStats | null>(null);
  const [filename, setFilename] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [activeClipIdx, setActiveClipIdx] = useState(0);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [bg, setBg] = useState('#0d1117');
  const [envPreset, setEnvPreset] = useState<EnvPreset>('city');
  const [wireframe, setWireframe] = useState(false);
  const [selected, setSelected] = useState<THREE.Object3D | null>(null);
  const [paused, setPaused] = useState(false);
  const [scrub, setScrub] = useState<number | null>(null);
  const [clipTime, setClipTime] = useState(0);
  const [clipDuration, setClipDuration] = useState(0);
  const [serverList, setServerList] = useState<ServerModel[]>([]);
  const [serverConnected, setServerConnected] = useState<boolean | null>(null);
  const [, forceTick] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);

  const refreshTree = useCallback(() => forceTick((t) => t + 1), []);

  const refreshServer = useCallback(async () => {
    try {
      const r = await fetch('/api/models');
      if (!r.ok) throw new Error(String(r.status));
      const j = await r.json() as { models: ServerModel[] };
      setServerList(j.models ?? []);
      setServerConnected(true);
    } catch {
      setServerConnected(false);
    }
  }, []);

  useEffect(() => { void refreshServer(); }, [refreshServer]);

  // Apply view overrides whenever model or wireframe toggles change
  useEffect(() => { applyOverrides(model?.root ?? null, { wireframe }); }, [model, wireframe]);

  // Cleanup blob URLs when model is replaced
  useEffect(() => () => { model?.blobs.forEach((b) => URL.revokeObjectURL(b)); }, [model]);

  const onFile = async (f: File) => {
    setError(''); setBusy(true); setSelected(null);
    try {
      const m = await loadAny(f);
      setModel(m);
      setStats(inspectScene(m.root));
      setFilename(f.name);
      setActiveClipIdx(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setModel(null); setStats(null);
    } finally { setBusy(false); }
  };

  const uploadToServer = async () => {
    if (!model || !filename) return;
    // Re-export current state to glb so server stores the *edited* model
    setBusy(true);
    try {
      const out = await new GLTFExporter().parseAsync(model.root, {
        binary: true, animations: model.animations,
      }) as ArrayBuffer;
      const blob = new Blob([out], { type: 'model/gltf-binary' });
      const fd = new FormData();
      const baseName = filename.replace(/\.(gltf|glb|fbx|obj|zip)$/i, '') + '.glb';
      fd.append('file', blob, baseName);
      const r = await fetch('/api/models', { method: 'POST', body: fd });
      if (!r.ok) throw new Error(`upload failed: ${r.status}`);
      await refreshServer();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };

  const loadFromServer = async (sm: ServerModel) => {
    setBusy(true); setError('');
    try {
      const url = `/api/models/${sm.id}/file/${sm.entry}`;
      const r = await fetch(url);
      if (!r.ok) throw new Error(String(r.status));
      const blob = await r.blob();
      const file = new File([blob], sm.name, { type: blob.type });
      await onFile(file);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };

  const deleteFromServer = async (id: string) => {
    try {
      const r = await fetch(`/api/models/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error(`delete failed: ${r.status}`);
      await refreshServer();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const exportGLB = async () => {
    if (!model) return;
    setBusy(true);
    try {
      const result = await new GLTFExporter().parseAsync(model.root, {
        binary: true, animations: model.animations,
      });
      const blob = result instanceof ArrayBuffer
        ? new Blob([result], { type: 'model/gltf-binary' })
        : new Blob([JSON.stringify(result)], { type: 'model/gltf+json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename.replace(/\.(gltf|glb|fbx|obj|zip)$/i, '') + '.glb';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 30_000);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };

  const previewRoot = model?.root ?? null;
  const previewClip = model && model.animations[activeClipIdx]
    ? model.animations[activeClipIdx]
    : null;

  return (
    <div className="flex h-full relative">
      <ConverterLoadOverlay />
      <aside className="w-[300px] shrink-0 border-r border-border p-3 space-y-3 overflow-y-auto">
        <div>
          <h2 className="text-base font-semibold">Model Converter</h2>
          <p className="text-[11px] text-muted-foreground leading-tight">
            Drop .gltf / .glb / .fbx / .obj — or a .zip with model + textures. Inspect, edit, and re-export as binary .glb.
          </p>
        </div>

        <div
          className="border-2 border-dashed border-border rounded-md p-4 text-center text-sm text-muted-foreground hover:border-primary cursor-pointer transition-colors"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files[0];
            if (f) onFile(f);
          }}
        >
          {busy ? 'Working…' : 'Drop file here, or click'}
          <input
            ref={inputRef}
            type="file"
            accept=".gltf,.glb,.fbx,.obj,.zip"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
          />
        </div>

        {error && (
          <div className="text-xs text-destructive bg-destructive/10 border border-destructive/40 rounded p-2">
            {error}
          </div>
        )}

        {stats && (
          <div className="space-y-1 text-xs">
            <h3 className="text-sm font-semibold truncate" title={filename}>{filename}</h3>
            <Stat label="Meshes"    value={stats.meshes} />
            <Stat label="Skinned"   value={stats.skinnedMeshes} />
            <Stat label="Bones"     value={stats.bones} />
            <Stat label="Vertices"  value={stats.vertices.toLocaleString()} />
            <Stat label="Triangles" value={stats.triangles.toLocaleString()} />
            <Stat label="Materials" value={stats.materials} />
            <Stat label="Textures"  value={stats.textures} />
            <Stat label="Animations" value={model?.animations.length ?? 0} />
            <Stat label="Bounds (m)" value={`${stats.bounds.x} × ${stats.bounds.y} × ${stats.bounds.z}`} />
          </div>
        )}

        {model && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={exportGLB}
                disabled={busy}
                className="bg-primary text-primary-foreground rounded py-1.5 text-xs font-medium hover:opacity-90 disabled:opacity-50"
              >
                Download .glb
              </button>
              <button
                onClick={uploadToServer}
                disabled={busy || serverConnected !== true}
                className="bg-secondary text-secondary-foreground rounded py-1.5 text-xs font-medium hover:opacity-90 disabled:opacity-50"
                title={serverConnected ? 'Save to server' : 'Server offline'}
              >
                Save to server
              </button>
            </div>
          </>
        )}

        <Section title={`Server${serverConnected === false ? ' (offline)' : serverConnected === true ? ' ●' : '…'}`}>
          {serverList.length === 0 ? (
            <div className="text-[11px] text-muted-foreground">No models stored.</div>
          ) : serverList.map((sm) => (
            <div key={sm.id} className="flex items-center gap-1 text-[11px]">
              <button
                onClick={() => loadFromServer(sm)}
                className="flex-1 text-left truncate hover:text-primary"
                title={sm.name}
              >{sm.name}</button>
              <span className="text-muted-foreground font-mono">{(sm.size/1024).toFixed(0)}k</span>
              <button
                onClick={() => deleteFromServer(sm.id)}
                className="text-destructive hover:bg-destructive/10 rounded px-1"
                title="Delete"
              >✕</button>
            </div>
          ))}
        </Section>

        <Section title="View">
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={wireframe} onChange={(e) => setWireframe(e.target.checked)} />
            wireframe
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} />
            grid
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={showSkeleton} onChange={(e) => setShowSkeleton(e.target.checked)} />
            skeleton
          </label>
          <div className="flex items-center gap-2 text-xs">
            <label className="text-muted-foreground w-12">bg</label>
            <input type="color" value={bg} onChange={(e) => setBg(e.target.value)}
                   className="h-6 w-10 bg-transparent border border-border rounded" />
          </div>
          <div className="flex items-center gap-2 text-xs">
            <label className="text-muted-foreground w-12">env</label>
            <select className="flex-1 bg-input border border-border rounded px-1 py-0.5"
                    value={envPreset} onChange={(e) => setEnvPreset(e.target.value as EnvPreset)}>
              {ENV_PRESETS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </Section>
      </aside>

      <div className="flex-1 relative flex flex-col">
        <div className="flex-1 relative">
          <Canvas
            camera={{ position: [4, 3, 4], fov: 50 }}
            shadows
            gl={{ antialias: true, powerPreference: 'high-performance' }}
            dpr={[1, 2]}
          >
            <color attach="background" args={[bg]} />
            <ambientLight intensity={0.5} />
            <directionalLight position={[5, 8, 5]} intensity={1.2} castShadow />
            <Suspense fallback={null}>
              <Environment preset={envPreset} />
            </Suspense>
            {showGrid && (
              <Grid args={[20, 20]} cellSize={0.5} cellColor="#1b2230"
                    sectionSize={5} sectionColor="#2a3548" infiniteGrid fadeDistance={50} />
            )}
            {previewRoot && (
              <Bounds fit clip observe margin={1.2}>
                <FitToView>
                  <AnimatedRoot
                    root={previewRoot}
                    clip={previewClip}
                    showSkeleton={showSkeleton && (stats?.bones ?? 0) > 0}
                    scrub={scrub}
                    paused={paused}
                    onTick={(t, d) => { setClipTime(t); setClipDuration(d); }}
                  />
                </FitToView>
              </Bounds>
            )}
            <OrbitControls makeDefault />
          </Canvas>
          {!model && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-muted-foreground text-sm">
              No model loaded — drop one in the sidebar.
            </div>
          )}
        </div>

        {model && previewClip && (
          <div className="border-t border-border bg-card/50 px-3 py-2 flex items-center gap-3 text-xs">
            <button
              className="bg-primary text-primary-foreground rounded px-2 py-1 font-medium w-16"
              onClick={() => { setPaused((p) => !p); setScrub(null); }}
            >{paused ? '▶ Play' : '❚❚ Pause'}</button>
            <select
              className="bg-input border border-border rounded px-2 py-1"
              value={activeClipIdx}
              onChange={(e) => { setActiveClipIdx(Number(e.target.value)); setScrub(null); }}
            >
              {model.animations.map((c, i) => (
                <option key={i} value={i}>{c.name || `clip_${i}`}</option>
              ))}
            </select>
            <input
              type="range"
              min={0} max={clipDuration || previewClip.duration}
              step={0.01}
              value={scrub ?? clipTime}
              onChange={(e) => { setScrub(parseFloat(e.target.value)); setPaused(true); }}
              onMouseUp={() => setScrub(null)}
              className="flex-1"
            />
            <span className="font-mono w-24 text-right">
              {(scrub ?? clipTime).toFixed(2)}s / {(clipDuration || previewClip.duration).toFixed(2)}s
            </span>
          </div>
        )}
      </div>

      {model && (
        <aside className="w-[320px] shrink-0 border-l border-border flex flex-col">
          <div className="p-2 border-b border-border">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Scene Graph</div>
            <div className="max-h-[40vh] overflow-y-auto text-xs">
              <NodeRow node={model.root} depth={0} selectedId={selected?.id ?? null}
                       onSelect={(n) => setSelected(n)} onChange={refreshTree} />
            </div>
          </div>
          <div className="p-2 flex-1 overflow-y-auto">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Inspector</div>
            {selected ? (
              <NodeInspector node={selected} onChange={refreshTree} />
            ) : (
              <div className="text-xs text-muted-foreground">Select a node in the tree.</div>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex justify-between border-b border-border/40 pb-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
