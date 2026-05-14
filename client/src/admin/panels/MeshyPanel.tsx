import { useState, useEffect, useCallback, useRef } from "react";
import {
  checkMeshyStatus, createTextTo3D, refineTextTo3D, createImageTo3D,
  createRetexture, createRemesh, createRig, pollTask, downloadModel,
  getLibrary, deleteLibraryItem, fullPipeline,
  ART_STYLES, type MeshyTask, type MeshyTaskType,
} from "@/lib/meshyService";

const panelStyle: React.CSSProperties = {
  display: "flex", flexDirection: "column", height: "100%",
  color: "#e6edf3", fontFamily: "monospace", fontSize: 12,
  overflow: "hidden",
};

const tabBarStyle: React.CSSProperties = {
  display: "flex", gap: 2, padding: "4px 8px", borderBottom: "1px solid rgba(201,149,10,0.15)",
  flexShrink: 0,
};

const tabStyle = (active: boolean): React.CSSProperties => ({
  padding: "4px 10px", cursor: "pointer", borderRadius: "4px 4px 0 0",
  background: active ? "#1f2937" : "transparent",
  color: active ? "#c9950a" : "#7a6a50",
  border: active ? "1px solid rgba(201,149,10,0.15)" : "1px solid transparent",
  borderBottom: active ? "1px solid #1f2937" : "1px solid transparent",
  fontSize: 11, fontWeight: active ? 600 : 400,
});

const inputStyle: React.CSSProperties = {
  background: "#0a0705", border: "1px solid rgba(201,149,10,0.15)", color: "#e6edf3",
  padding: "6px 8px", borderRadius: 4, fontSize: 12, width: "100%",
  fontFamily: "monospace",
};

const selectStyle: React.CSSProperties = { ...inputStyle, cursor: "pointer" };

const btnStyle = (variant: "primary" | "default" | "danger" = "default"): React.CSSProperties => ({
  padding: "6px 14px", borderRadius: 4, border: "none", cursor: "pointer",
  fontSize: 11, fontWeight: 600,
  background: variant === "primary" ? "#238636" : variant === "danger" ? "#da3633" : "rgba(201,149,10,0.15)",
  color: "#e6edf3",
});

const sectionStyle: React.CSSProperties = {
  padding: "8px 12px", display: "flex", flexDirection: "column", gap: 6,
};

const labelStyle: React.CSSProperties = { fontSize: 10, color: "#7a6a50", textTransform: "uppercase" };

type PanelTab = "generate" | "texture" | "rig" | "library" | "pipeline";

interface ActiveJob {
  id: string;
  type: MeshyTaskType;
  stage: string;
  progress: number;
  status: string;
}

export default function MeshyPanel() {
  const [tab, setTab] = useState<PanelTab>("pipeline");
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [activeJobs, setActiveJobs] = useState<ActiveJob[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [library, setLibrary] = useState<Array<{ name: string; path: string; subfolder: string; size: number }>>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((msg: string) => {
    setLogs((prev) => [...prev.slice(-100), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  useEffect(() => {
    checkMeshyStatus().then((s) => setConfigured(s.configured)).catch(() => setConfigured(false));
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const refreshLibrary = useCallback(async () => {
    try {
      const lib = await getLibrary();
      setLibrary(lib.items);
    } catch (e: any) { addLog(`Library error: ${e.message}`); }
  }, [addLog]);

  useEffect(() => { if (tab === "library") refreshLibrary(); }, [tab, refreshLibrary]);

  if (configured === null) return <div style={panelStyle}><div style={sectionStyle}>Checking Meshy API...</div></div>;
  if (!configured) return <div style={panelStyle}><div style={sectionStyle}>Meshy API key not configured. Add MESHY_API_KEY to secrets.</div></div>;

  return (
    <div style={panelStyle}>
      <div style={tabBarStyle}>
        {(["pipeline", "generate", "texture", "rig", "library"] as PanelTab[]).map((t) => (
          <div key={t} style={tabStyle(tab === t)} onClick={() => setTab(t)}>
            {t === "pipeline" ? "Full Pipeline" : t === "generate" ? "Text/Image to 3D" : t === "texture" ? "Retexture" : t === "rig" ? "Rig & Remesh" : "Library"}
          </div>
        ))}
      </div>

      <div style={{ flex: 1, overflow: "auto" }}>
        {tab === "pipeline" && <PipelineTab addLog={addLog} activeJobs={activeJobs} setActiveJobs={setActiveJobs} />}
        {tab === "generate" && <GenerateTab addLog={addLog} activeJobs={activeJobs} setActiveJobs={setActiveJobs} />}
        {tab === "texture" && <RetextureTab addLog={addLog} activeJobs={activeJobs} setActiveJobs={setActiveJobs} />}
        {tab === "rig" && <RigRemeshTab addLog={addLog} activeJobs={activeJobs} setActiveJobs={setActiveJobs} />}
        {tab === "library" && <LibraryTab library={library} refreshLibrary={refreshLibrary} addLog={addLog} />}
      </div>

      {activeJobs.length > 0 && (
        <div style={{ borderTop: "1px solid rgba(201,149,10,0.15)", padding: "6px 12px", flexShrink: 0 }}>
          <div style={labelStyle}>Active Jobs</div>
          {activeJobs.map((job) => (
            <div key={job.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, padding: "2px 0" }}>
              <span style={{ color: "#c9950a" }}>{job.stage}</span>
              <div style={{ flex: 1, height: 4, background: "#130e08", borderRadius: 2 }}>
                <div style={{ width: `${job.progress}%`, height: "100%", background: "#238636", borderRadius: 2, transition: "width 0.3s" }} />
              </div>
              <span style={{ color: "#7a6a50" }}>{job.progress}%</span>
            </div>
          ))}
        </div>
      )}

      {logs.length > 0 && (
        <div style={{ borderTop: "1px solid rgba(201,149,10,0.15)", maxHeight: 80, overflow: "auto", padding: "4px 8px", flexShrink: 0 }}>
          {logs.map((l, i) => <div key={i} style={{ fontSize: 10, color: "#7a6a50", whiteSpace: "nowrap" }}>{l}</div>)}
          <div ref={logsEndRef} />
        </div>
      )}
    </div>
  );
}

interface TabProps {
  addLog: (msg: string) => void;
  activeJobs: ActiveJob[];
  setActiveJobs: React.Dispatch<React.SetStateAction<ActiveJob[]>>;
}

function PipelineTab({ addLog, setActiveJobs }: TabProps) {
  const [prompt, setPrompt] = useState("");
  const [filename, setFilename] = useState("");
  const [artStyle, setArtStyle] = useState("realistic");
  const [negPrompt, setNegPrompt] = useState("");
  const [autoRefine, setAutoRefine] = useState(true);
  const [autoRig, setAutoRig] = useState(true);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const run = async () => {
    if (!prompt.trim() || !filename.trim()) return;
    setRunning(true);
    setResult(null);
    const jobId = Date.now().toString();
    addLog(`Pipeline started: "${prompt}"`);

    try {
      const res = await fullPipeline({
        prompt: prompt.trim(),
        artStyle,
        negativePrompt: negPrompt || undefined,
        filename: filename.trim(),
        autoRefine,
        autoRig,
        onProgress: (stage, progress) => {
          setActiveJobs((prev) => {
            const existing = prev.find((j) => j.id === jobId);
            if (existing) return prev.map((j) => j.id === jobId ? { ...j, stage, progress } : j);
            return [...prev, { id: jobId, type: "text-to-3d", stage, progress, status: "IN_PROGRESS" }];
          });
        },
      });
      setResult(res.path);
      addLog(`Pipeline complete! Model at: ${res.path}`);
    } catch (e: any) {
      addLog(`Pipeline failed: ${e.message}`);
    } finally {
      setActiveJobs((prev) => prev.filter((j) => j.id !== jobId));
      setRunning(false);
    }
  };

  return (
    <div style={sectionStyle}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#c9950a" }}>Full Asset Pipeline</div>
      <div style={{ fontSize: 10, color: "#7a6a50" }}>Text prompt → 3D Model → Refine → Auto-Rig → Download</div>
      <div style={{ marginTop: 4 }}>
        <div style={labelStyle}>Prompt</div>
        <textarea style={{ ...inputStyle, height: 60, resize: "vertical" }} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="A medieval knight in full plate armor, detailed, game-ready..." />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <div>
          <div style={labelStyle}>Filename</div>
          <input style={inputStyle} value={filename} onChange={(e) => setFilename(e.target.value)} placeholder="knight_warrior" />
        </div>
        <div>
          <div style={labelStyle}>Art Style</div>
          <select style={selectStyle} value={artStyle} onChange={(e) => setArtStyle(e.target.value)}>
            {ART_STYLES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>
      <div>
        <div style={labelStyle}>Negative Prompt (optional)</div>
        <input style={inputStyle} value={negPrompt} onChange={(e) => setNegPrompt(e.target.value)} placeholder="blurry, low quality, deformed" />
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, cursor: "pointer" }}>
          <input type="checkbox" checked={autoRefine} onChange={(e) => setAutoRefine(e.target.checked)} /> Auto-Refine
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, cursor: "pointer" }}>
          <input type="checkbox" checked={autoRig} onChange={(e) => setAutoRig(e.target.checked)} /> Auto-Rig
        </label>
      </div>
      <button style={btnStyle("primary")} onClick={run} disabled={running || !prompt.trim() || !filename.trim()}>
        {running ? "Running Pipeline..." : "Generate Asset"}
      </button>
      {result && (
        <div style={{ background: "#0d2818", border: "1px solid #238636", borderRadius: 4, padding: 8, fontSize: 11 }}>
          Model saved to: <span style={{ color: "#7ee787" }}>{result}</span>
        </div>
      )}
    </div>
  );
}

function GenerateTab({ addLog, setActiveJobs }: TabProps) {
  const [mode, setMode] = useState<"text" | "image">("text");
  const [prompt, setPrompt] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [artStyle, setArtStyle] = useState("realistic");
  const [polyCount, setPolyCount] = useState(30000);
  const [running, setRunning] = useState(false);
  const [completedTask, setCompletedTask] = useState<MeshyTask | null>(null);

  const generate = async () => {
    setRunning(true);
    setCompletedTask(null);
    const jobId = Date.now().toString();

    try {
      let taskId: string;
      let taskType: MeshyTaskType;
      if (mode === "text") {
        addLog(`Creating text-to-3D: "${prompt}"`);
        const res = await createTextTo3D({ prompt, artStyle, targetPolyCount: polyCount });
        taskId = res.taskId;
        taskType = "text-to-3d";
      } else {
        addLog(`Creating image-to-3D from URL`);
        const res = await createImageTo3D({ imageUrl, targetPolyCount: polyCount });
        taskId = res.taskId;
        taskType = "image-to-3d";
      }

      setActiveJobs((prev) => [...prev, { id: jobId, type: taskType, stage: "Generating...", progress: 0, status: "IN_PROGRESS" }]);
      const task = await pollTask(taskType, taskId, (t) => {
        setActiveJobs((prev) => prev.map((j) => j.id === jobId ? { ...j, progress: t.progress || 0 } : j));
      });
      setCompletedTask(task);
      addLog(`Generation complete! Task ID: ${taskId}`);
    } catch (e: any) {
      addLog(`Generation failed: ${e.message}`);
    } finally {
      setActiveJobs((prev) => prev.filter((j) => j.id !== jobId));
      setRunning(false);
    }
  };

  const handleDownload = async () => {
    if (!completedTask?.model_urls?.glb) return;
    try {
      const name = prompt.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30) + ".glb";
      const res = await downloadModel({ modelUrl: completedTask.model_urls.glb, filename: name });
      addLog(`Downloaded to: ${res.path}`);
    } catch (e: any) { addLog(`Download failed: ${e.message}`); }
  };

  const handleRefine = async () => {
    if (!completedTask) return;
    setRunning(true);
    const jobId = Date.now().toString();
    try {
      addLog("Refining model...");
      const res = await refineTextTo3D({ previewTaskId: completedTask.id });
      setActiveJobs((prev) => [...prev, { id: jobId, type: "text-to-3d", stage: "Refining...", progress: 0, status: "IN_PROGRESS" }]);
      const task = await pollTask("text-to-3d", res.taskId, (t) => {
        setActiveJobs((prev) => prev.map((j) => j.id === jobId ? { ...j, progress: t.progress || 0 } : j));
      });
      setCompletedTask(task);
      addLog("Refinement complete!");
    } catch (e: any) { addLog(`Refine failed: ${e.message}`); }
    finally {
      setActiveJobs((prev) => prev.filter((j) => j.id !== jobId));
      setRunning(false);
    }
  };

  return (
    <div style={sectionStyle}>
      <div style={{ display: "flex", gap: 8 }}>
        <button style={btnStyle(mode === "text" ? "primary" : "default")} onClick={() => setMode("text")}>Text to 3D</button>
        <button style={btnStyle(mode === "image" ? "primary" : "default")} onClick={() => setMode("image")}>Image to 3D</button>
      </div>
      {mode === "text" ? (
        <div>
          <div style={labelStyle}>Prompt</div>
          <textarea style={{ ...inputStyle, height: 50, resize: "vertical" }} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe the 3D model..." />
        </div>
      ) : (
        <div>
          <div style={labelStyle}>Image URL</div>
          <input style={inputStyle} value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://example.com/image.png" />
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <div>
          <div style={labelStyle}>Art Style</div>
          <select style={selectStyle} value={artStyle} onChange={(e) => setArtStyle(e.target.value)}>
            {ART_STYLES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <div style={labelStyle}>Target Polycount</div>
          <input style={inputStyle} type="number" value={polyCount} onChange={(e) => setPolyCount(Number(e.target.value))} />
        </div>
      </div>
      <button style={btnStyle("primary")} onClick={generate} disabled={running}>
        {running ? "Generating..." : "Generate"}
      </button>
      {completedTask && (
        <div style={{ background: "#0d2818", border: "1px solid #238636", borderRadius: 4, padding: 8 }}>
          <div style={{ fontSize: 11, marginBottom: 4 }}>Generation complete!</div>
          {completedTask.thumbnail_url && (
            <img src={completedTask.thumbnail_url} alt="Preview" style={{ width: 120, height: 120, objectFit: "contain", borderRadius: 4, marginBottom: 4 }} />
          )}
          <div style={{ display: "flex", gap: 6 }}>
            <button style={btnStyle("primary")} onClick={handleDownload}>Download GLB</button>
            {mode === "text" && <button style={btnStyle("default")} onClick={handleRefine} disabled={running}>Refine</button>}
          </div>
        </div>
      )}
    </div>
  );
}

function RetextureTab({ addLog, setActiveJobs }: TabProps) {
  const [modelUrl, setModelUrl] = useState("");
  const [prompt, setPrompt] = useState("");
  const [artStyle, setArtStyle] = useState("realistic");
  const [resolution, setResolution] = useState(2048);
  const [running, setRunning] = useState(false);
  const [completedTask, setCompletedTask] = useState<MeshyTask | null>(null);

  const retexture = async () => {
    if (!modelUrl.trim() || !prompt.trim()) return;
    setRunning(true);
    setCompletedTask(null);
    const jobId = Date.now().toString();
    addLog(`Retexturing: "${prompt}"`);

    try {
      const res = await createRetexture({ modelUrl, prompt, artStyle, resolution });
      setActiveJobs((prev) => [...prev, { id: jobId, type: "retexture", stage: "Retexturing...", progress: 0, status: "IN_PROGRESS" }]);
      const task = await pollTask("retexture", res.taskId, (t) => {
        setActiveJobs((prev) => prev.map((j) => j.id === jobId ? { ...j, progress: t.progress || 0 } : j));
      });
      setCompletedTask(task);
      addLog("Retexture complete!");
    } catch (e: any) { addLog(`Retexture failed: ${e.message}`); }
    finally {
      setActiveJobs((prev) => prev.filter((j) => j.id !== jobId));
      setRunning(false);
    }
  };

  const handleDownload = async () => {
    if (!completedTask?.model_urls?.glb) return;
    try {
      const name = "retextured_" + prompt.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 25) + ".glb";
      const res = await downloadModel({ modelUrl: completedTask.model_urls.glb, filename: name });
      addLog(`Downloaded to: ${res.path}`);
    } catch (e: any) { addLog(`Download failed: ${e.message}`); }
  };

  return (
    <div style={sectionStyle}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#d2a8ff" }}>AI Retexture</div>
      <div style={{ fontSize: 10, color: "#7a6a50" }}>Apply new AI-generated textures to any 3D model</div>
      <div>
        <div style={labelStyle}>Model URL (GLB/FBX/OBJ)</div>
        <input style={inputStyle} value={modelUrl} onChange={(e) => setModelUrl(e.target.value)} placeholder="https://... or paste from Library" />
      </div>
      <div>
        <div style={labelStyle}>Texture Prompt</div>
        <textarea style={{ ...inputStyle, height: 50, resize: "vertical" }} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Battle-worn samurai armor with gold trim..." />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <div>
          <div style={labelStyle}>Art Style</div>
          <select style={selectStyle} value={artStyle} onChange={(e) => setArtStyle(e.target.value)}>
            {ART_STYLES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <div style={labelStyle}>Resolution</div>
          <select style={selectStyle} value={resolution} onChange={(e) => setResolution(Number(e.target.value))}>
            <option value={1024}>1024</option>
            <option value={2048}>2048</option>
            <option value={4096}>4096</option>
          </select>
        </div>
      </div>
      <button style={btnStyle("primary")} onClick={retexture} disabled={running || !modelUrl.trim() || !prompt.trim()}>
        {running ? "Retexturing..." : "Retexture Model"}
      </button>
      {completedTask && (
        <div style={{ background: "#0d2818", border: "1px solid #238636", borderRadius: 4, padding: 8 }}>
          <div style={{ fontSize: 11 }}>Retexture complete!</div>
          <button style={btnStyle("primary")} onClick={handleDownload}>Download GLB</button>
        </div>
      )}
    </div>
  );
}

function RigRemeshTab({ addLog, setActiveJobs }: TabProps) {
  const [mode, setMode] = useState<"rig" | "remesh">("rig");
  const [modelUrl, setModelUrl] = useState("");
  const [rigType, setRigType] = useState("biped");
  const [targetPoly, setTargetPoly] = useState(10000);
  const [running, setRunning] = useState(false);
  const [completedTask, setCompletedTask] = useState<MeshyTask | null>(null);

  const execute = async () => {
    if (!modelUrl.trim()) return;
    setRunning(true);
    setCompletedTask(null);
    const jobId = Date.now().toString();

    try {
      let taskId: string;
      if (mode === "rig") {
        addLog(`Rigging model (${rigType})...`);
        const res = await createRig({ inputModelUrl: modelUrl, rigType });
        taskId = res.taskId;
        setActiveJobs((prev) => [...prev, { id: jobId, type: "rig", stage: "Rigging...", progress: 0, status: "IN_PROGRESS" }]);
        const task = await pollTask("rig", taskId, (t) => {
          setActiveJobs((prev) => prev.map((j) => j.id === jobId ? { ...j, progress: t.progress || 0 } : j));
        });
        setCompletedTask(task);
      } else {
        addLog(`Remeshing to ${targetPoly} polys...`);
        const res = await createRemesh({ inputModelUrl: modelUrl, targetPolycount: targetPoly });
        taskId = res.taskId;
        setActiveJobs((prev) => [...prev, { id: jobId, type: "remesh", stage: "Remeshing...", progress: 0, status: "IN_PROGRESS" }]);
        const task = await pollTask("remesh", taskId, (t) => {
          setActiveJobs((prev) => prev.map((j) => j.id === jobId ? { ...j, progress: t.progress || 0 } : j));
        });
        setCompletedTask(task);
      }
      addLog(`${mode === "rig" ? "Rigging" : "Remeshing"} complete!`);
    } catch (e: any) { addLog(`${mode} failed: ${e.message}`); }
    finally {
      setActiveJobs((prev) => prev.filter((j) => j.id !== jobId));
      setRunning(false);
    }
  };

  const handleDownload = async () => {
    if (!completedTask?.model_urls?.glb) return;
    try {
      const prefix = mode === "rig" ? "rigged_" : "remeshed_";
      const name = prefix + Date.now() + ".glb";
      const res = await downloadModel({ modelUrl: completedTask.model_urls.glb, filename: name });
      addLog(`Downloaded to: ${res.path}`);
    } catch (e: any) { addLog(`Download failed: ${e.message}`); }
  };

  return (
    <div style={sectionStyle}>
      <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
        <button style={btnStyle(mode === "rig" ? "primary" : "default")} onClick={() => setMode("rig")}>Auto-Rig</button>
        <button style={btnStyle(mode === "remesh" ? "primary" : "default")} onClick={() => setMode("remesh")}>Remesh</button>
      </div>
      <div style={{ fontSize: 10, color: "#7a6a50" }}>
        {mode === "rig" ? "Add a humanoid skeleton to any 3D model for animation" : "Optimize mesh topology and reduce polygon count"}
      </div>
      <div>
        <div style={labelStyle}>Model URL</div>
        <input style={inputStyle} value={modelUrl} onChange={(e) => setModelUrl(e.target.value)} placeholder="https://... GLB/FBX/OBJ URL" />
      </div>
      {mode === "rig" ? (
        <div>
          <div style={labelStyle}>Rig Type</div>
          <select style={selectStyle} value={rigType} onChange={(e) => setRigType(e.target.value)}>
            <option value="biped">Biped (Humanoid)</option>
            <option value="quadruped">Quadruped</option>
          </select>
        </div>
      ) : (
        <div>
          <div style={labelStyle}>Target Polycount</div>
          <input style={inputStyle} type="number" value={targetPoly} onChange={(e) => setTargetPoly(Number(e.target.value))} />
        </div>
      )}
      <button style={btnStyle("primary")} onClick={execute} disabled={running || !modelUrl.trim()}>
        {running ? "Processing..." : mode === "rig" ? "Rig Model" : "Remesh Model"}
      </button>
      {completedTask && (
        <div style={{ background: "#0d2818", border: "1px solid #238636", borderRadius: 4, padding: 8 }}>
          <div style={{ fontSize: 11 }}>{mode === "rig" ? "Rigging" : "Remeshing"} complete!</div>
          <button style={btnStyle("primary")} onClick={handleDownload}>Download GLB</button>
        </div>
      )}
    </div>
  );
}

function LibraryTab({ library, refreshLibrary, addLog }: { library: Array<{ name: string; path: string; subfolder: string; size: number }>; refreshLibrary: () => void; addLog: (msg: string) => void }) {
  const handleDelete = async (subfolder: string, name: string) => {
    try {
      await deleteLibraryItem(subfolder, name);
      addLog(`Deleted: ${name}`);
      refreshLibrary();
    } catch (e: any) { addLog(`Delete failed: ${e.message}`); }
  };

  return (
    <div style={sectionStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#7ee787" }}>Model Library</div>
        <button style={btnStyle("default")} onClick={refreshLibrary}>Refresh</button>
      </div>
      <div style={{ fontSize: 10, color: "#7a6a50" }}>Downloaded Meshy models in /models/meshy/</div>
      {library.length === 0 ? (
        <div style={{ fontSize: 11, color: "#7a6a50", padding: 20, textAlign: "center" }}>No models yet. Use the pipeline to generate some!</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {library.map((item) => (
            <div key={item.path} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", background: "#0f0a06", borderRadius: 4 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: "#e6edf3" }}>{item.name}</div>
                <div style={{ fontSize: 9, color: "#7a6a50" }}>{item.subfolder} — {(item.size / 1024).toFixed(0)} KB</div>
              </div>
              <div style={{ fontSize: 9, color: "#c9950a", cursor: "pointer" }} onClick={() => navigator.clipboard.writeText(item.path)}>
                Copy Path
              </div>
              <div style={{ fontSize: 9, color: "#da3633", cursor: "pointer" }} onClick={() => handleDelete(item.subfolder, item.name)}>
                Delete
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
