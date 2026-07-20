/**
 * ObjectStore model browser — TanStack Query + placeable GLB tiles.
 */
import { useState } from "react";
import { useEditor } from "./store";
import { useObjectStoreModels, useObjectStoreHealth } from "../hooks/useObjectStoreModels";
import { registerObjectStoreAsset, objectStoreAssetId } from "../library/dynamicAssets";
import type { ObjectStoreModelRecord } from "../library/ObjectStoreClient";

const CATEGORIES = [
  { id: "", label: "All" },
  { id: "cubeworld-animals", label: "Animals" },
  { id: "monsters", label: "Monsters" },
  { id: "characters", label: "Characters" },
  { id: "buildings", label: "Buildings" },
  { id: "props", label: "Props" },
];

export function ObjectStorePalette() {
  const armedAssetId = useEditor((s) => s.armedAssetId);
  const armAsset = useEditor((s) => s.armAsset);
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");

  const health = useObjectStoreHealth();
  const { data, isLoading, isError, refetch } = useObjectStoreModels({
    limit: 32,
    offset: 0,
    category: category || undefined,
    search: search.trim() || undefined,
  });

  const onArm = (model: ObjectStoreModelRecord) => {
    const spec = registerObjectStoreAsset(model);
    const id = objectStoreAssetId(model.id);
    armAsset(armedAssetId === id ? null : spec.id);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[10px]">
        <span
          className={`inline-block w-2 h-2 rounded-full ${
            health.data?.ok ? "bg-green-500" : "bg-red-500"
          }`}
          title={health.data?.ok ? "ObjectStore online" : "ObjectStore unreachable"}
        />
        <span className="text-muted-foreground">
          {data?.total ?? "…"} models on CDN
        </span>
        <button
          type="button"
          onClick={() => refetch()}
          className="ml-auto text-primary hover:underline"
        >
          refresh
        </button>
      </div>

      <input
        type="search"
        placeholder="Search models…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded border border-border bg-secondary/40 px-2 py-1 text-[11px]"
      />

      <div className="flex flex-wrap gap-1">
        {CATEGORIES.map((c) => (
          <button
            key={c.id || "all"}
            type="button"
            onClick={() => setCategory(c.id)}
            className={`px-2 py-0.5 rounded-sm text-[10px] ${
              category === c.id
                ? "bg-primary text-primary-foreground"
                : "bg-secondary/60 text-muted-foreground"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {isLoading && (
        <p className="text-muted-foreground italic text-center py-4">Loading ObjectStore…</p>
      )}
      {isError && (
        <p className="text-destructive text-center py-4 text-[10px]">
          Could not reach ObjectStore. Check network / CORS.
        </p>
      )}

      <ul className="grid grid-cols-2 gap-1.5 max-h-[42vh] overflow-y-auto">
        {data?.models.map((m) => {
          const id = objectStoreAssetId(m.id);
          const armed = armedAssetId === id;
          return (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => onArm(m)}
                title={m.filename}
                className={`w-full text-left px-2 py-2 rounded-md border transition-all ${
                  armed
                    ? "border-primary bg-primary/20"
                    : "border-border bg-secondary/30 hover:bg-secondary/60"
                }`}
              >
                <div className="font-semibold truncate text-[11px]">{m.filename}</div>
                <div className="text-[9px] text-muted-foreground truncate">
                  {m.category} · {(m.size / 1024).toFixed(0)} KB
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}