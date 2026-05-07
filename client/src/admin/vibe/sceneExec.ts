import { useEditorStore } from "@/game/editor/EditorStore";
import {
  addCustomPrefab,
  removeCustomPrefab,
  type PrefabDef,
  type PrefabCategory,
} from "@/game/editor/PrefabRegistry";
import type { ParsedSceneAction, SceneApplyResult } from "./types";

export function executeSceneAction(action: ParsedSceneAction): SceneApplyResult {
  const store = useEditorStore.getState();
  try {
    if (action.action === "add-object") {
      const d = action.data;
      const before = store.objects.length;
      store.addObject({
        name: d.name || "AI Object",
        type: d.type || "primitive",
        modelPath: d.modelPath,
        position: d.position || [0, 0, 0],
        rotation: d.rotation || [0, 0, 0],
        scale: d.scale || [1, 1, 1],
        visible: true,
        locked: false,
        properties: d.properties || {},
      });
      // addObject() in the store auto-generates the id and pushes onto the
      // end of `objects`. Read it back so revert can target this exact one
      // instead of guessing by name.
      const created = useEditorStore.getState().objects[before];
      return {
        action: "add-object",
        name: d.name || "AI Object",
        status: "success",
        createdObjectId: created?.id,
      };
    }
    if (action.action === "add-prefab" || action.action === "save-prefab") {
      const d = action.data;
      const prefab: PrefabDef = {
        id: action.action === "save-prefab" ? `custom-${d.id || Date.now()}` : `prefab-ai-${Date.now()}`,
        name: d.name || "AI Prefab",
        category: (d.category || "item") as PrefabCategory,
        subcategory: d.subcategory || "custom",
        modelPath: d.modelPath || "",
        defaultScale: d.scale || [1, 1, 1],
        targetHeight: d.targetHeight || 1,
        collider: d.collider || { shape: "box", size: [1, 1, 1], offset: [0, 0.5, 0], isTrigger: false },
        physicsType: d.physicsType || "static",
        navMeshObstacle: d.navMeshObstacle ?? false,
        navMeshCarve: d.navMeshCarve ?? false,
        castShadow: true,
        receiveShadow: true,
        hasAnimations: d.hasAnimations ?? false,
        tags: d.tags || ["custom", "ai-generated"],
      };
      if (action.action === "save-prefab") {
        addCustomPrefab(prefab);
        return {
          action: "save-prefab", name: prefab.name, status: "success",
          message: "Saved to prefab library",
          createdPrefabId: prefab.id,
        };
      }
      const before = store.objects.length;
      store.addPrefab(prefab);
      const created = useEditorStore.getState().objects[before];
      return {
        action: "add-prefab", name: prefab.name, status: "success",
        createdObjectId: created?.id,
      };
    }
    return { action: action.action, name: action.data?.name || "?", status: "error", message: `Unknown action ${action.action}` };
  } catch (err: any) {
    return { action: action.action, name: action.data?.name || "?", status: "error", message: err?.message || String(err) };
  }
}

/**
 * True inverse of executeSceneAction. Uses ids tracked on the apply
 * result so revert is reliable even when many objects share a name.
 */
export function revertSceneAction(prev: SceneApplyResult): SceneApplyResult {
  const store = useEditorStore.getState();
  try {
    if (prev.createdObjectId) {
      store.removeObject(prev.createdObjectId);
      return { action: prev.action, name: prev.name, status: "success", message: "removed from scene" };
    }
    if (prev.createdPrefabId) {
      removeCustomPrefab(prev.createdPrefabId);
      return { action: prev.action, name: prev.name, status: "success", message: "removed from prefab library" };
    }
    return { action: prev.action, name: prev.name, status: "error", message: "no id tracked — cannot revert" };
  } catch (err: any) {
    return { action: prev.action, name: prev.name, status: "error", message: err?.message || String(err) };
  }
}
