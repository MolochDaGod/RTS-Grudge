/**
 * Runtime asset specs for ObjectStore models armed from the palette.
 */
import type { AssetSpec } from "./LandscapeAssets";
import type { ObjectStoreModelRecord } from "./ObjectStoreClient";
import { modelFileUrl } from "./ObjectStoreClient";

const dynamic = new Map<string, AssetSpec>();

export function objectStoreAssetId(modelId: string): string {
  return `os:${modelId}`;
}

export function registerObjectStoreAsset(model: ObjectStoreModelRecord): AssetSpec {
  const id = objectStoreAssetId(model.id);
  const kind = inferKind(model);
  const spec: AssetSpec = {
    id,
    label: model.filename.replace(/\.(glb|gltf|fbx)$/i, ""),
    category: "ObjectStore",
    kind,
    assetUrl: modelFileUrl(model),
    defaultScale: kind === "creature" || kind === "unit" ? 1 : 1.5,
    defaultData: { objectStoreId: model.id, category: model.category },
    hint: `${model.category} · ${(model.size / 1024).toFixed(0)} KB`,
  };
  dynamic.set(id, spec);
  return spec;
}

function inferKind(model: ObjectStoreModelRecord): AssetSpec["kind"] {
  const hay = `${model.category} ${model.tags?.join(" ") ?? ""} ${model.filename}`.toLowerCase();
  if (/creature|animal|monster|fish/.test(hay)) return "creature";
  if (/building|structure|house|tower/.test(hay)) return "building";
  if (/ship|boat|dock/.test(hay)) return "dock";
  if (/unit|character|hero|orc|elf/.test(hay)) return "unit";
  if (/rock|gem|crystal|boulder/.test(hay)) return "rock";
  if (/tree|foliage|plant/.test(hay)) return "tree";
  return "prop";
}

export function getDynamicAssetById(id: string): AssetSpec | undefined {
  return dynamic.get(id);
}