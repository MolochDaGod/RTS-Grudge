export type MeshyTaskType = "text-to-3d" | "image-to-3d" | "retexture" | "remesh" | "rig";
export type MeshyTaskStatus = "PENDING" | "IN_PROGRESS" | "SUCCEEDED" | "FAILED" | "CANCELED";

export interface MeshyArtStyle {
  value: string;
  label: string;
}

export const ART_STYLES: MeshyArtStyle[] = [
  { value: "realistic", label: "Realistic" },
  { value: "cartoon", label: "Cartoon" },
  { value: "low-poly", label: "Low Poly" },
  { value: "sculpture", label: "Sculpture" },
  { value: "pbr", label: "PBR" },
];

export interface MeshyTask {
  id: string;
  type: MeshyTaskType;
  status: MeshyTaskStatus;
  progress: number;
  prompt?: string;
  model_urls?: Record<string, string>;
  thumbnail_url?: string;
  texture_urls?: Array<{ base_color: string }>;
  created_at?: number;
  finished_at?: number;
  localPath?: string;
}

async function api<T = any>(path: string, options?: RequestInit): Promise<T> {
  const resp = await fetch(`/api/meshy${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error((data as any).error || `Request failed: ${resp.status}`);
  return data as T;
}

export async function checkMeshyStatus(): Promise<{ configured: boolean }> {
  return api("/status");
}

export async function createTextTo3D(params: {
  prompt: string;
  negativePrompt?: string;
  artStyle?: string;
  topology?: string;
  targetPolyCount?: number;
  aiModel?: string;
}): Promise<{ taskId: string }> {
  return api("/text-to-3d", { method: "POST", body: JSON.stringify(params) });
}

export async function refineTextTo3D(params: {
  previewTaskId: string;
  textureRichness?: string;
}): Promise<{ taskId: string }> {
  return api("/text-to-3d/refine", { method: "POST", body: JSON.stringify(params) });
}

export async function createImageTo3D(params: {
  imageUrl: string;
  topology?: string;
  targetPolyCount?: number;
  aiModel?: string;
}): Promise<{ taskId: string }> {
  return api("/image-to-3d", { method: "POST", body: JSON.stringify(params) });
}

export async function createRetexture(params: {
  modelUrl: string;
  prompt: string;
  negativePrompt?: string;
  artStyle?: string;
  resolution?: number;
  aiModel?: string;
}): Promise<{ taskId: string }> {
  return api("/retexture", { method: "POST", body: JSON.stringify(params) });
}

export async function createRemesh(params: {
  inputModelUrl: string;
  targetFormats?: string[];
  targetPolycount?: number;
}): Promise<{ taskId: string }> {
  return api("/remesh", { method: "POST", body: JSON.stringify(params) });
}

export async function createRig(params: {
  inputModelUrl: string;
  rigType?: string;
}): Promise<{ taskId: string }> {
  return api("/rig", { method: "POST", body: JSON.stringify(params) });
}

export async function getTask(type: MeshyTaskType, taskId: string): Promise<MeshyTask> {
  return api(`/task/${type}/${taskId}`);
}

export async function getTasks(type: MeshyTaskType, page?: number, limit?: number): Promise<MeshyTask[]> {
  const params = new URLSearchParams();
  if (page) params.set("page", String(page));
  if (limit) params.set("limit", String(limit));
  const qs = params.toString() ? `?${params.toString()}` : "";
  return api(`/tasks/${type}${qs}`);
}

export async function downloadModel(params: {
  modelUrl: string;
  filename: string;
  subfolder?: string;
}): Promise<{ success: boolean; path: string }> {
  return api("/download", { method: "POST", body: JSON.stringify(params) });
}

export async function getLibrary(): Promise<{
  items: Array<{ name: string; path: string; subfolder: string; size: number; created: number }>;
}> {
  return api("/library");
}

export async function deleteLibraryItem(subfolder: string, filename: string): Promise<void> {
  return api(`/library/${subfolder}/${filename}`, { method: "DELETE" });
}

export async function pollTask(
  type: MeshyTaskType,
  taskId: string,
  onProgress?: (task: MeshyTask) => void,
  intervalMs = 3000
): Promise<MeshyTask> {
  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        const task = await getTask(type, taskId);
        if (onProgress) onProgress(task);
        if (task.status === "SUCCEEDED") {
          resolve(task);
        } else if (task.status === "FAILED" || task.status === "CANCELED") {
          reject(new Error(`Task ${task.status}`));
        } else {
          setTimeout(poll, intervalMs);
        }
      } catch (e) {
        reject(e);
      }
    };
    poll();
  });
}

export async function fullPipeline(params: {
  prompt: string;
  artStyle?: string;
  negativePrompt?: string;
  filename: string;
  autoRefine?: boolean;
  autoRig?: boolean;
  onProgress?: (stage: string, progress: number) => void;
}): Promise<{ path: string; task: MeshyTask }> {
  const { prompt, artStyle, negativePrompt, filename, autoRefine, autoRig, onProgress } = params;

  onProgress?.("Generating preview...", 0);
  const { taskId: previewId } = await createTextTo3D({ prompt, artStyle, negativePrompt });
  const previewTask = await pollTask("text-to-3d", previewId, (t) => {
    onProgress?.("Generating preview...", t.progress || 0);
  });

  let finalTask = previewTask;

  if (autoRefine) {
    onProgress?.("Refining model...", 0);
    const { taskId: refineId } = await refineTextTo3D({ previewTaskId: previewId });
    finalTask = await pollTask("text-to-3d", refineId, (t) => {
      onProgress?.("Refining model...", t.progress || 0);
    });
  }

  const glbUrl = finalTask.model_urls?.glb;
  if (!glbUrl) throw new Error("No GLB URL in completed task");

  let downloadUrl = glbUrl;
  let finalFilename = filename.endsWith(".glb") ? filename : `${filename}.glb`;

  if (autoRig) {
    onProgress?.("Auto-rigging...", 0);
    const { taskId: rigId } = await createRig({ inputModelUrl: glbUrl });
    const rigTask = await pollTask("rig", rigId, (t) => {
      onProgress?.("Auto-rigging...", t.progress || 0);
    });
    if (rigTask.model_urls?.glb) downloadUrl = rigTask.model_urls.glb;
  }

  onProgress?.("Downloading...", 90);
  const result = await downloadModel({ modelUrl: downloadUrl, filename: finalFilename, subfolder: "generated" });
  onProgress?.("Complete!", 100);

  return { path: result.path, task: finalTask };
}
