import { useState, useRef, useEffect, useCallback } from "react";
import { useGameConfig } from "@/lib/stores/useGameConfig";
import { useEditorStore, type SceneObject } from "@/game/editor/EditorStore";
import {
  addCustomPrefab,
  getCustomPrefabs,
  removeCustomPrefab,
  type PrefabDef,
  type PrefabCategory,
} from "@/game/editor/PrefabRegistry";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  edits?: EditResult[];
  sceneActions?: SceneActionResult[];
}

interface AIModel {
  id: string;
  name: string;
  provider: string;
}

interface EditResult {
  file: string;
  status: "created" | "modified" | "error";
  message?: string;
}

interface ParsedEdit {
  file: string;
  action: "replace" | "write";
  old?: string;
  new?: string;
  content?: string;
}

interface SceneActionResult {
  action: string;
  name: string;
  status: "success" | "error";
  message?: string;
}

interface ParsedSceneAction {
  action: "add-object" | "add-prefab" | "save-prefab";
  data: Record<string, any>;
}

const FALLBACK_MODELS: AIModel[] = [
  { id: "x-ai/grok-4.1-fast:free", name: "Grok 4.1 Fast", provider: "OpenRouter" },
  { id: "google/gemini-2.0-flash-exp:free", name: "Gemini Flash", provider: "OpenRouter" },
  { id: "deepseek/deepseek-chat-v3-0324:free", name: "DeepSeek V3", provider: "OpenRouter" },
];

function parseVibeEdits(content: string): ParsedEdit[] {
  const edits: ParsedEdit[] = [];
  const editBlockRegex = /```vibe-edit\n([\s\S]*?)```/g;
  let match;

  while ((match = editBlockRegex.exec(content)) !== null) {
    const block = match[1];
    const fileMatch = block.match(/FILE:\s*(.+)/);
    const actionMatch = block.match(/ACTION:\s*(\w+)/);

    if (!fileMatch || !actionMatch) continue;

    const file = fileMatch[1].trim();
    const action = actionMatch[1].trim() as "replace" | "write";

    if (action === "replace") {
      const oldMatch = block.match(/OLD:\s*\|([\s\S]*?)\|/);
      const newMatch = block.match(/NEW:\s*\|([\s\S]*?)\|/);
      if (oldMatch && newMatch) {
        edits.push({ file, action, old: oldMatch[1], new: newMatch[1] });
      }
    } else if (action === "write") {
      const contentMatch = block.match(/CONTENT:\s*\|([\s\S]*?)\|/);
      if (contentMatch) {
        edits.push({ file, action, content: contentMatch[1] });
      }
    }
  }

  return edits;
}

function parseSceneActions(content: string): ParsedSceneAction[] {
  const actions: ParsedSceneAction[] = [];
  const blockRegex = /```vibe-scene\n([\s\S]*?)```/g;
  let match;

  while ((match = blockRegex.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (parsed.action) {
        actions.push(parsed as ParsedSceneAction);
      }
    } catch {}
  }

  return actions;
}

function executeSceneActions(actions: ParsedSceneAction[]): SceneActionResult[] {
  const results: SceneActionResult[] = [];
  const store = useEditorStore.getState();

  for (const action of actions) {
    try {
      if (action.action === "add-object") {
        const d = action.data;
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
        results.push({ action: "add-object", name: d.name || "AI Object", status: "success" });
      } else if (action.action === "add-prefab") {
        const d = action.data;
        const prefab: PrefabDef = {
          id: `prefab-ai-${Date.now()}`,
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
        store.addPrefab(prefab);
        results.push({ action: "add-prefab", name: prefab.name, status: "success" });
      } else if (action.action === "save-prefab") {
        const d = action.data;
        const prefab: PrefabDef = {
          id: `custom-${d.id || Date.now()}`,
          name: d.name || "Custom Prefab",
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
        addCustomPrefab(prefab);
        results.push({ action: "save-prefab", name: prefab.name, status: "success", message: "Saved to prefab library" });
      }
    } catch (err: any) {
      results.push({ action: action.action, name: action.data?.name || "unknown", status: "error", message: err.message });
    }
  }

  return results;
}

function groupModelsByProvider(models: AIModel[]): Map<string, AIModel[]> {
  const grouped = new Map<string, AIModel[]>();
  for (const m of models) {
    const existing = grouped.get(m.provider) || [];
    existing.push(m);
    grouped.set(m.provider, existing);
  }
  return grouped;
}

function getSceneContext(): string {
  const store = useEditorStore.getState();
  const { objects, selectedId, selectedIds } = store;
  const selected = selectedId ? objects.find(o => o.id === selectedId) : null;

  const summary: string[] = [];
  summary.push(`Scene: ${objects.length} objects`);

  const typeCounts: Record<string, number> = {};
  for (const o of objects) {
    typeCounts[o.type] = (typeCounts[o.type] || 0) + 1;
  }
  summary.push(`Types: ${Object.entries(typeCounts).map(([t, c]) => `${c} ${t}`).join(", ")}`);

  if (selected) {
    summary.push(`\nSelected: "${selected.name}" (${selected.type})`);
    summary.push(`  Position: [${selected.position.join(", ")}]`);
    summary.push(`  Rotation: [${selected.rotation.join(", ")}]`);
    summary.push(`  Scale: [${selected.scale.join(", ")}]`);
    if (selected.modelPath) summary.push(`  Model: ${selected.modelPath}`);
    if (selected.parentId) {
      const parent = objects.find(o => o.id === selected.parentId);
      summary.push(`  Parent: ${parent?.name || selected.parentId}`);
    }
    const children = objects.filter(o => o.parentId === selected.id);
    if (children.length > 0) summary.push(`  Children: ${children.map(c => c.name).join(", ")}`);
  }

  if (selectedIds.length > 1) {
    summary.push(`\nMulti-selected (${selectedIds.length}): ${selectedIds.map(id => objects.find(o => o.id === id)?.name).filter(Boolean).join(", ")}`);
  }

  const rootObjects = objects.filter(o => !o.parentId).slice(0, 20);
  summary.push(`\nRoot objects (up to 20):`);
  for (const o of rootObjects) {
    const childCount = objects.filter(c => c.parentId === o.id).length;
    summary.push(`  - "${o.name}" (${o.type}) at [${o.position.map(v => v.toFixed(1)).join(",")}]${childCount > 0 ? ` [${childCount} children]` : ""}`);
  }

  const custom = getCustomPrefabs();
  if (custom.length > 0) {
    summary.push(`\nCustom prefabs (${custom.length}): ${custom.map(p => p.name).join(", ")}`);
  }

  return summary.join("\n");
}

const SCENE_SYSTEM_PROMPT = `You are VIBE, an AI assistant for the GGE (Grudge Game Engine) 3D editor. You can:

1. **Create scene objects** — Add objects directly to the 3D scene
2. **Create and save prefabs** — Define reusable prefab templates saved to the library
3. **Edit source code** — Make live code edits to game files

To add objects to the scene, use a vibe-scene block:
\`\`\`vibe-scene
{
  "action": "add-object",
  "data": {
    "name": "My Box",
    "type": "primitive",
    "position": [0, 1, 0],
    "rotation": [0, 0, 0],
    "scale": [2, 2, 2],
    "properties": { "shape": "box", "color": "#ff6600" }
  }
}
\`\`\`

Available object types: primitive, model, light, group, spawn, trigger, empty, prefab
Primitive shapes: box, sphere, cylinder, cone, torus, plane
Light types (set in properties.lightType): point, spot, directional, hemisphere, ambient

To save a reusable prefab to the library:
\`\`\`vibe-scene
{
  "action": "save-prefab",
  "data": {
    "id": "my-custom-enemy",
    "name": "Custom Enemy",
    "category": "character",
    "modelPath": "/models/characters/undead_grave_knight-male.glb",
    "scale": [1, 1, 1],
    "targetHeight": 1.8,
    "collider": { "shape": "capsule", "size": [0.4, 1.8, 0.4], "offset": [0, 0.9, 0], "isTrigger": false },
    "physicsType": "kinematic",
    "tags": ["enemy", "custom"]
  }
}
\`\`\`

Categories: character, animal, building, weapon, vehicle, nature, ship, item, primitive, effect
Physics types: static, dynamic, kinematic, none
Collider shapes: box, sphere, capsule, mesh, none

You can also make code edits with vibe-edit blocks (for modifying source files).

Always explain what you're doing before placing scene blocks.`;

export default function VibeChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "I'm VIBE, your AI game editor assistant. I can:\n\n- Add objects directly to your 3D scene\n- Create and save custom prefabs to your library\n- Edit game code, systems, and configs live\n- Debug animations, models, and gameplay\n\nI'm aware of your current scene — I can see what's selected and what objects exist.\n\nTry: \"Add a ring of torches\" or \"Save a custom enemy prefab\" or \"Make enemies faster\"",
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [availableModels, setAvailableModels] = useState<AIModel[]>(FALLBACK_MODELS);
  const [selectedModel, setSelectedModel] = useState(FALLBACK_MODELS[0].id);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [includeConfig, setIncludeConfig] = useState(true);
  const [includeScene, setIncludeScene] = useState(true);
  const [autoApplyEdits, setAutoApplyEdits] = useState(false);
  const [autoApplyScene, setAutoApplyScene] = useState(true);
  const [activeTab, setActiveTab] = useState<"chat" | "prefabs">("chat");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const config = useGameConfig((s) => s.config);

  useEffect(() => {
    fetch("/api/ai-models")
      .then(r => r.json())
      .then(data => {
        if (data.models?.length) {
          setAvailableModels(data.models);
          setSelectedModel(prev => data.models.some((m: AIModel) => m.id === prev) ? prev : data.models[0].id);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const applyEdits = useCallback(async (edits: ParsedEdit[], messageId: string) => {
    try {
      const response = await fetch("/api/ai-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ edits }),
      });
      const data = await response.json();

      setMessages(prev => prev.map(m =>
        m.id === messageId ? { ...m, edits: data.results } : m
      ));
    } catch (err: any) {
      setMessages(prev => prev.map(m =>
        m.id === messageId ? { ...m, edits: [{ file: "error", status: "error" as const, message: err.message }] } : m
      ));
    }
  }, []);

  const applySceneActions = useCallback((actions: ParsedSceneAction[], messageId: string) => {
    const results = executeSceneActions(actions);
    setMessages(prev => prev.map(m =>
      m.id === messageId ? { ...m, sceneActions: results } : m
    ));
    return results;
  }, []);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const chatMessages = messages
        .filter((m) => m.role !== "system" && m.id !== "welcome")
        .map((m) => ({ role: m.role, content: m.content }));
      chatMessages.push({ role: "user", content: input.trim() });

      const body: any = {
        messages: chatMessages,
        model: selectedModel,
        includeSource: true,
        systemPrompt: SCENE_SYSTEM_PROMPT,
      };
      if (includeConfig) {
        body.gameConfig = config;
      }
      if (includeScene) {
        body.sceneContext = getSceneContext();
      }

      const response = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (data.error) {
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: "assistant",
            content: `Error: ${data.error}`,
            timestamp: Date.now(),
          },
        ]);
      } else {
        const assistantContent = data.choices?.[0]?.message?.content || "No response received.";
        const msgId = `ai-${Date.now()}`;

        setMessages((prev) => [
          ...prev,
          {
            id: msgId,
            role: "assistant",
            content: assistantContent,
            timestamp: Date.now(),
          },
        ]);

        const codeEdits = parseVibeEdits(assistantContent);
        if (codeEdits.length > 0 && autoApplyEdits) {
          await applyEdits(codeEdits, msgId);
        }

        const sceneActions = parseSceneActions(assistantContent);
        if (sceneActions.length > 0 && autoApplyScene) {
          applySceneActions(sceneActions, msgId);
        }
      }
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: `Connection error: ${error.message}`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, selectedModel, includeConfig, includeScene, config, autoApplyEdits, autoApplyScene, applyEdits, applySceneActions]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: "Chat cleared. How can I help with your game?",
        timestamp: Date.now(),
      },
    ]);
  };

  const groupedModels = groupModelsByProvider(availableModels);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#0a0705" }}>
      {/* Header */}
      <div style={{ padding: "6px 12px", borderBottom: "1px solid rgba(201,149,10,0.15)", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span style={{ color: "#c9950a", fontWeight: 700, fontSize: 14 }}>VIBE AI</span>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, marginLeft: 8 }}>
          {(["chat", "prefabs"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "3px 10px",
                fontSize: 10,
                fontWeight: 600,
                border: "none",
                borderBottom: activeTab === tab ? "2px solid #c9950a" : "2px solid transparent",
                background: "none",
                color: activeTab === tab ? "#c9950a" : "#7a6a50",
                cursor: "pointer",
                textTransform: "uppercase",
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {activeTab === "chat" && (
          <>
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setShowModelPicker(!showModelPicker)}
                style={{ background: "#130e08", border: "1px solid rgba(201,149,10,0.15)", color: "#7a6a50", padding: "3px 8px", borderRadius: 4, fontSize: 10, cursor: "pointer", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              >
                {availableModels.find((m) => m.id === selectedModel)?.name || "Model"}
              </button>
              {showModelPicker && (
                <>
                  <div style={{ position: "fixed", inset: 0, zIndex: 100 }} onClick={() => setShowModelPicker(false)} />
                  <div style={{ position: "absolute", top: "100%", right: 0, background: "#0f0a06", border: "1px solid rgba(201,149,10,0.15)", borderRadius: 6, zIndex: 101, minWidth: 240, maxHeight: 350, overflowY: "auto", marginTop: 4 }}>
                    {Array.from(groupedModels.entries()).map(([provider, models]) => (
                      <div key={provider}>
                        <div style={{ padding: "4px 12px", color: "#c9950a", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, borderBottom: "1px solid #130e08", background: "#0a0705" }}>
                          {provider}
                        </div>
                        {models.map((m) => (
                          <div
                            key={m.id}
                            onClick={() => { setSelectedModel(m.id); setShowModelPicker(false); }}
                            style={{ padding: "5px 12px", cursor: "pointer", color: selectedModel === m.id ? "#c9950a" : "#c9a86c", fontSize: 11, borderBottom: "1px solid #130e08" }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "#130e08")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          >
                            {m.name}
                            {selectedModel === m.id && <span style={{ marginLeft: 6, color: "#3fb950", fontSize: 10 }}>*</span>}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <ToggleChip label="Config" active={includeConfig} onChange={setIncludeConfig} />
              <ToggleChip label="Scene" active={includeScene} onChange={setIncludeScene} color="#7ee787" />
              <ToggleChip label="Auto-Edit" active={autoApplyEdits} onChange={setAutoApplyEdits} color="#f0883e" />
              <ToggleChip label="Auto-Scene" active={autoApplyScene} onChange={setAutoApplyScene} color="#d2a8ff" />
              <button onClick={clearChat} style={{ background: "none", border: "none", color: "#484f58", cursor: "pointer", fontSize: 10, padding: "3px 6px" }}>
                Clear
              </button>
            </div>
          </>
        )}
      </div>

      {activeTab === "chat" ? (
        <>
          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {messages.map((msg) => (
              <div key={msg.id}>
                <div
                  style={{
                    alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                    maxWidth: "90%",
                    marginLeft: msg.role === "user" ? "auto" : 0,
                    padding: "8px 12px",
                    borderRadius: 8,
                    background: msg.role === "user" ? "linear-gradient(135deg, #c9950a, #9b7520)" : "#130e08",
                    color: "#c9a86c",
                    fontSize: 12,
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  <MessageContent content={msg.content} messageId={msg.id} onApplyEdits={applyEdits} onApplyScene={applySceneActions} autoApplyCode={autoApplyEdits} autoApplyScene={autoApplyScene} />
                </div>
                {msg.edits && msg.edits.length > 0 && (
                  <div style={{ marginTop: 4, marginLeft: msg.role === "user" ? "auto" : 0, maxWidth: "90%" }}>
                    {msg.edits.map((edit, i) => (
                      <StatusPill key={i} ok={edit.status !== "error"} label={`${edit.file} - ${edit.status}`} detail={edit.message} />
                    ))}
                  </div>
                )}
                {msg.sceneActions && msg.sceneActions.length > 0 && (
                  <div style={{ marginTop: 4, marginLeft: msg.role === "user" ? "auto" : 0, maxWidth: "90%" }}>
                    {msg.sceneActions.map((sa, i) => (
                      <StatusPill key={i} ok={sa.status === "success"} label={`${sa.action}: ${sa.name}`} detail={sa.message} color="#d2a8ff" />
                    ))}
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div style={{ alignSelf: "flex-start", padding: "8px 12px", borderRadius: 8, background: "#130e08", color: "#7a6a50", fontSize: 12 }}>
                <span style={{ display: "inline-block", animation: "pulse 1.5s infinite" }}>Thinking...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{ padding: "8px 12px", borderTop: "1px solid rgba(201,149,10,0.15)" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask VIBE... (scene-aware, can add objects & save prefabs)"
                disabled={isLoading}
                rows={1}
                style={{
                  flex: 1,
                  background: "#0a0705",
                  border: "1px solid rgba(201,149,10,0.15)",
                  borderRadius: 6,
                  color: "#c9a86c",
                  padding: "8px 12px",
                  fontSize: 12,
                  resize: "none",
                  outline: "none",
                  fontFamily: "inherit",
                  minHeight: 36,
                  maxHeight: 120,
                }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = "auto";
                  target.style.height = Math.min(target.scrollHeight, 120) + "px";
                }}
              />
              <button
                onClick={sendMessage}
                disabled={isLoading || !input.trim()}
                style={{
                  background: isLoading || !input.trim() ? "#130e08" : "#238636",
                  border: "none",
                  color: isLoading || !input.trim() ? "#484f58" : "#fff",
                  padding: "8px 16px",
                  borderRadius: 6,
                  cursor: isLoading || !input.trim() ? "default" : "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                Send
              </button>
            </div>

            {/* Quick actions */}
            <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
              {[
                "Add a spotlight at [0,5,0]",
                "Create a ring of 8 boxes",
                "Save selected as prefab",
                "What's in my scene?",
              ].map(q => (
                <button
                  key={q}
                  onClick={() => { setInput(q); }}
                  style={{
                    padding: "2px 8px",
                    fontSize: 9,
                    background: "#130e08",
                    border: "1px solid rgba(201,149,10,0.15)",
                    borderRadius: 10,
                    color: "#7a6a50",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(201,149,10,0.15)"; e.currentTarget.style.color = "#c9a86c"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "#130e08"; e.currentTarget.style.color = "#7a6a50"; }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </>
      ) : (
        <CustomPrefabsPanel />
      )}
    </div>
  );
}

function CustomPrefabsPanel() {
  const [prefabs, setPrefabs] = useState(getCustomPrefabs());
  const addPrefab = useEditorStore((s) => s.addPrefab);

  const refresh = () => setPrefabs(getCustomPrefabs());

  const CATEGORY_COLORS: Record<string, string> = {
    character: "#d2a8ff",
    animal: "#7ee787",
    building: "#f0883e",
    weapon: "#f85149",
    vehicle: "#c9a86c",
    nature: "#56d364",
    ship: "#3fb950",
    item: "#c9950a",
    primitive: "#7a6a50",
    effect: "#d29922",
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
      <div style={{ color: "#7a6a50", fontSize: 10, marginBottom: 8 }}>
        Custom prefabs saved by VIBE AI. These persist in your browser and appear in the asset browser.
      </div>

      {prefabs.length === 0 ? (
        <div style={{ color: "#484f58", fontSize: 11, textAlign: "center", padding: 20 }}>
          No custom prefabs yet. Ask VIBE AI to create and save prefabs for you.
        </div>
      ) : (
        prefabs.map(p => (
          <div
            key={p.id}
            style={{
              padding: "8px 10px",
              background: "#0f0a06",
              borderRadius: 6,
              border: "1px solid #130e08",
              marginBottom: 6,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: CATEGORY_COLORS[p.category] || "#7a6a50",
              }} />
              <span style={{ color: "#c9a86c", fontSize: 11, fontWeight: 600, flex: 1 }}>{p.name}</span>
              <span style={{ fontSize: 8, color: "#484f58" }}>{p.category}</span>
            </div>
            {p.modelPath && (
              <div style={{ fontSize: 9, color: "#484f58", fontFamily: "monospace", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {p.modelPath}
              </div>
            )}
            <div style={{ display: "flex", gap: 4 }}>
              <button
                onClick={() => addPrefab(p)}
                style={{
                  padding: "3px 8px",
                  fontSize: 9,
                  background: "#23863610",
                  border: "1px solid #23863630",
                  borderRadius: 3,
                  color: "#3fb950",
                  cursor: "pointer",
                }}
              >
                Add to Scene
              </button>
              <button
                onClick={() => {
                  removeCustomPrefab(p.id);
                  refresh();
                }}
                style={{
                  padding: "3px 8px",
                  fontSize: 9,
                  background: "#f8514910",
                  border: "1px solid #f8514930",
                  borderRadius: 3,
                  color: "#f85149",
                  cursor: "pointer",
                }}
              >
                Delete
              </button>
            </div>
          </div>
        ))
      )}

      <div style={{ marginTop: 12, padding: 8, background: "#0f0a06", borderRadius: 6, border: "1px solid #130e08" }}>
        <div style={{ color: "#7a6a50", fontSize: 10, fontWeight: 600, marginBottom: 6 }}>QUICK ACTIONS</div>
        <button
          onClick={() => {
            const json = JSON.stringify(prefabs, null, 2);
            const blob = new Blob([json], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `custom-prefabs-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          disabled={prefabs.length === 0}
          style={{
            width: "100%",
            padding: "5px 10px",
            fontSize: 10,
            background: prefabs.length > 0 ? "#c9950a10" : "#130e08",
            border: "1px solid rgba(201,149,10,0.15)",
            borderRadius: 4,
            color: prefabs.length > 0 ? "#c9950a" : "#484f58",
            cursor: prefabs.length > 0 ? "pointer" : "default",
            marginBottom: 4,
          }}
        >
          Export Custom Prefabs
        </button>
        <button
          onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".json";
            input.onchange = (e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = (ev) => {
                try {
                  const imported = JSON.parse(ev.target?.result as string);
                  if (Array.isArray(imported)) {
                    for (const p of imported) {
                      if (p.id && p.name && p.category) {
                        addCustomPrefab(p);
                      }
                    }
                    refresh();
                  }
                } catch {}
              };
              reader.readAsText(file);
            };
            input.click();
          }}
          style={{
            width: "100%",
            padding: "5px 10px",
            fontSize: 10,
            background: "#7ee78710",
            border: "1px solid rgba(201,149,10,0.15)",
            borderRadius: 4,
            color: "#7ee787",
            cursor: "pointer",
          }}
        >
          Import Custom Prefabs
        </button>
      </div>
    </div>
  );
}

function ToggleChip({ label, active, onChange, color }: { label: string; active: boolean; onChange: (v: boolean) => void; color?: string }) {
  const c = color || "#c9950a";
  return (
    <label style={{
      display: "flex",
      alignItems: "center",
      gap: 3,
      cursor: "pointer",
      fontSize: 9,
      color: active ? c : "#484f58",
      padding: "2px 6px",
      borderRadius: 10,
      background: active ? `${c}10` : "transparent",
      border: `1px solid ${active ? `${c}30` : "transparent"}`,
      transition: "all 0.15s",
    }}>
      <input
        type="checkbox"
        checked={active}
        onChange={(e) => onChange(e.target.checked)}
        style={{ display: "none" }}
      />
      <span style={{
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: active ? c : "rgba(201,149,10,0.15)",
      }} />
      {label}
    </label>
  );
}

function StatusPill({ ok, label, detail, color }: { ok: boolean; label: string; detail?: string; color?: string }) {
  return (
    <div style={{
      padding: "3px 8px",
      borderRadius: 4,
      background: ok ? (color ? `${color}15` : "#1a2e1a") : "#3d1f1f",
      color: ok ? (color || "#3fb950") : "#f85149",
      fontSize: 10,
      marginBottom: 2,
      fontFamily: "'JetBrains Mono', monospace",
    }}>
      {ok ? "+" : "x"} {label}{detail ? ` - ${detail}` : ""}
    </div>
  );
}

function MessageContent({
  content,
  messageId,
  onApplyEdits,
  onApplyScene,
  autoApplyCode,
  autoApplyScene,
}: {
  content: string;
  messageId: string;
  onApplyEdits: (edits: ParsedEdit[], messageId: string) => void;
  onApplyScene: (actions: ParsedSceneAction[], messageId: string) => void;
  autoApplyCode: boolean;
  autoApplyScene: boolean;
}) {
  const codeEdits = parseVibeEdits(content);
  const sceneActions = parseSceneActions(content);
  const hasActions = codeEdits.length > 0 || sceneActions.length > 0;

  if (!hasActions) return <>{content}</>;

  const cleanContent = content
    .replace(/```vibe-edit[\s\S]*?```/g, "[[CODE_EDIT]]")
    .replace(/```vibe-scene[\s\S]*?```/g, "[[SCENE_ACTION]]");

  const parts = cleanContent.split(/\[\[(?:CODE_EDIT|SCENE_ACTION)\]\]/);
  const actionBlocks: { type: "code" | "scene"; index: number }[] = [];
  const allMatches = cleanContent.match(/\[\[(?:CODE_EDIT|SCENE_ACTION)\]\]/g) || [];
  let codeIdx = 0;
  let sceneIdx = 0;
  for (const m of allMatches) {
    if (m === "[[CODE_EDIT]]") {
      actionBlocks.push({ type: "code", index: codeIdx++ });
    } else {
      actionBlocks.push({ type: "scene", index: sceneIdx++ });
    }
  }

  return (
    <>
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < actionBlocks.length && (
            <div style={{
              margin: "8px 0",
              padding: "8px 10px",
              borderRadius: 6,
              background: "#0f0a06",
              border: `1px solid ${actionBlocks[i].type === "scene" ? "#d2a8ff30" : "rgba(201,149,10,0.15)"}`,
              fontSize: 10,
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {actionBlocks[i].type === "code" && codeEdits[actionBlocks[i].index] && (
                <>
                  <div style={{ color: "#f0883e", fontWeight: 600, marginBottom: 4 }}>
                    Code Edit: {codeEdits[actionBlocks[i].index].file}
                  </div>
                  <div style={{ color: "#7a6a50", fontSize: 9 }}>
                    Action: {codeEdits[actionBlocks[i].index].action}
                  </div>
                  {!autoApplyCode && (
                    <button
                      onClick={() => onApplyEdits([codeEdits[actionBlocks[i].index]], messageId)}
                      style={{ marginTop: 6, padding: "3px 10px", background: "#238636", border: "none", borderRadius: 4, color: "#fff", fontSize: 10, cursor: "pointer", fontWeight: 600 }}
                    >
                      Apply Edit
                    </button>
                  )}
                </>
              )}
              {actionBlocks[i].type === "scene" && sceneActions[actionBlocks[i].index] && (
                <>
                  <div style={{ color: "#d2a8ff", fontWeight: 600, marginBottom: 4 }}>
                    Scene: {sceneActions[actionBlocks[i].index].action}
                  </div>
                  <div style={{ color: "#7a6a50", fontSize: 9 }}>
                    {JSON.stringify(sceneActions[actionBlocks[i].index].data?.name || sceneActions[actionBlocks[i].index].data)}
                  </div>
                  {!autoApplyScene && (
                    <button
                      onClick={() => onApplyScene([sceneActions[actionBlocks[i].index]], messageId)}
                      style={{ marginTop: 6, padding: "3px 10px", background: "#6e40c9", border: "none", borderRadius: 4, color: "#fff", fontSize: 10, cursor: "pointer", fontWeight: 600 }}
                    >
                      Apply to Scene
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </span>
      ))}
    </>
  );
}
