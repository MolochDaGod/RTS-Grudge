/**
 * WorldMap — full-screen map opened with [M].
 *
 * Renders the overhead reference image at `/maps/world_overhead.png`
 * as a pannable / zoomable backdrop, with island pins from
 * `IslandLayout` overlaid on top, plus user waypoints and the live
 * player position. Replaces the old canvas drawing that traced the
 * (now dormant) procedural island grid in `useIslandWorld`.
 *
 * Why we read playerPosition the way we do
 *   `useGame.playerPosition` is a `THREE.Vector3` that gets mutated
 *   in place every frame to avoid GC. A normal selector subscription
 *   only fires once. We grab the live state via `useGame.getState()`
 *   inside the rAF draw loop so the dot stays current — same trick
 *   the HUD minimap uses, see `Minimap` in HUD.tsx.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useWorldMap, WAYPOINT_COLORS, WAYPOINT_ICONS } from "@/lib/stores/useWorldMap";
import { useGame } from "@/lib/stores/useGame";
import {
  ISLAND_LAYOUT,
  WORLD_MAP_IMAGE_PATH,
  WORLD_MAP_IMAGE_W,
  WORLD_MAP_IMAGE_H,
  WORLD_PER_PIXEL,
  imageToWorld,
  worldToImage,
  type ResolvedIslandLayout,
} from "@/game/world/IslandLayout";

const LOCATION_ICONS: Record<string, { symbol: string; color: string; label: string }> = {
  spawn: { symbol: "🏠", color: "#4fc3f7", label: "Spawn" },
  village: { symbol: "🏘️", color: "#ffb74d", label: "Village" },
  dock: { symbol: "⚓", color: "#81d4fa", label: "Dock" },
  dungeon: { symbol: "💀", color: "#ef5350", label: "Dungeon" },
  shop: { symbol: "🛒", color: "#ffd54f", label: "Shop" },
  portal: { symbol: "🌀", color: "#ce93d8", label: "Portal" },
  landmark: { symbol: "🗿", color: "#a1887f", label: "Landmark" },
};

// Zoom values are in world-units-per-screen-pixel inverse (zoom=1 means
// "1 world unit drawn at 1 screen pixel"). With WORLD_PER_PIXEL=1.5 and
// the image being ~784 image-px wide, zoom=1 puts the whole world at
// ~1176 screen px wide, which fits a typical desktop viewport with
// breathing room. MIN/MAX bracket it generously for both overview and
// detail work.
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 6.0;

// World-space rectangle covered by the reference image. Used to draw
// the image with `drawImage(img, sx, sy, sw, sh)` and to clamp panning
// inside reasonable bounds.
const IMAGE_TOPLEFT_WORLD = imageToWorld(0, 0);
const IMAGE_WORLD_W = WORLD_MAP_IMAGE_W * WORLD_PER_PIXEL;
const IMAGE_WORLD_H = WORLD_MAP_IMAGE_H * WORLD_PER_PIXEL;

export default function WorldMap() {
  const {
    mapOpen, closeMap, waypoints, addWaypoint, removeWaypoint,
    trackingWaypointId, setTrackingWaypoint,
    selectedWaypointId, setSelectedWaypoint,
  } = useWorldMap();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);

  // Camera is { x, y, zoom } where x,y are world coords at screen
  // centre. Default opens centred on the tutorial island so the
  // player has context the moment they open the map.
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 0.6 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, camX: 0, camY: 0 });
  const [hoverIsland, setHoverIsland] = useState<ResolvedIslandLayout | null>(null);
  const [showWaypointDialog, setShowWaypointDialog] = useState<{ worldX: number; worldZ: number } | null>(null);
  const [waypointName, setWaypointName] = useState("Waypoint");
  const [waypointColor, setWaypointColor] = useState(WAYPOINT_COLORS[0]);
  const [waypointIcon, setWaypointIcon] = useState(WAYPOINT_ICONS[0]);
  const [showLegend, setShowLegend] = useState(true);
  const [showWaypointList, setShowWaypointList] = useState(false);
  const animFrame = useRef(0);

  // ----------------------------------------------------------------
  // Image preload. Cached by the browser after the first open so this
  // is essentially instant on subsequent opens.
  // ----------------------------------------------------------------
  useEffect(() => {
    if (imgRef.current) return;
    const img = new Image();
    img.src = WORLD_MAP_IMAGE_PATH;
    img.onload = () => {
      imgRef.current = img;
      setImgLoaded(true);
    };
    return () => { img.onload = null; };
  }, []);

  // ----------------------------------------------------------------
  // World <-> screen helpers. screenToWorld is also used by the click
  // handlers, which is why they live as plain functions instead of
  // closures inside the draw loop.
  // ----------------------------------------------------------------
  const worldToScreen = useCallback((wx: number, wz: number, w: number, h: number) => {
    return {
      x: (wx - camera.x) * camera.zoom + w / 2,
      y: (wz - camera.y) * camera.zoom + h / 2,
    };
  }, [camera]);

  const screenToWorld = useCallback((sx: number, sy: number, w: number, h: number) => {
    return {
      x: (sx - w / 2) / camera.zoom + camera.x,
      z: (sy - h / 2) / camera.zoom + camera.y,
    };
  }, [camera]);

  // ----------------------------------------------------------------
  // On open: centre the camera on the player if we have a position,
  // otherwise on the tutorial island (world origin).
  // ----------------------------------------------------------------
  useEffect(() => {
    if (!mapOpen) return;
    const pos = useGame.getState().playerPosition;
    if (pos) {
      setCamera((c) => ({ ...c, x: pos.x, y: pos.z }));
    } else {
      setCamera((c) => ({ ...c, x: 0, y: 0 }));
    }
  }, [mapOpen]);

  // ----------------------------------------------------------------
  // Resize the canvas to the viewport. Single source of truth for
  // canvas pixel dimensions; everything else reads w/h off the canvas.
  // ----------------------------------------------------------------
  useEffect(() => {
    if (!mapOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [mapOpen]);

  // ----------------------------------------------------------------
  // Draw loop. Backdrop image first, then pins, then waypoints, then
  // player. Runs continuously while open so the player dot tracks
  // even when the camera is idle.
  // ----------------------------------------------------------------
  useEffect(() => {
    if (!mapOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      const z = camera.zoom;

      // Deep-ocean background fill behind the image (the image is RGBA
      // but its blue ocean covers the islands; we only ever see this
      // backdrop in the corners when zoomed all the way out).
      ctx.fillStyle = "#0a1628";
      ctx.fillRect(0, 0, w, h);

      // Reference image. We draw it at its world rect so pan/zoom
      // happen for free. If the image hasn't loaded yet, skip and
      // rely on the backdrop colour — a sub-second placeholder.
      const img = imgRef.current;
      if (img) {
        const tl = worldToScreen(IMAGE_TOPLEFT_WORLD.x, IMAGE_TOPLEFT_WORLD.z, w, h);
        ctx.drawImage(img, tl.x, tl.y, IMAGE_WORLD_W * z, IMAGE_WORLD_H * z);
      }

      // Island pins. We rely on the image to convey shape; pins exist
      // mostly so islands have a name on hover and a clear click
      // target for "select / centre on this island" later.
      for (const isl of ISLAND_LAYOUT) {
        const p = worldToScreen(isl.worldX, isl.worldZ, w, h);
        const r = Math.max(3, isl.worldRadius * z * 0.3);
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fillStyle = isl.color + "cc";
        ctx.fill();
        ctx.strokeStyle = isl.isTutorial ? "#ffffff" : "rgba(0,0,0,0.55)";
        ctx.lineWidth = isl.isTutorial ? 2 : 1;
        ctx.stroke();

        // Name label (skipped on islets and when zoomed too far out
        // to avoid label spam over the world).
        if (!isl.isIslet && z > 0.45) {
          ctx.font = `${Math.max(11, 12 * Math.min(z, 1.2))}px 'Cinzel', serif`;
          ctx.textAlign = "center";
          ctx.fillStyle = "rgba(0,0,0,0.7)";
          ctx.fillText(isl.name, p.x + 1, p.y + r + 14 + 1);
          ctx.fillStyle = "#f4e6c0";
          ctx.fillText(isl.name, p.x, p.y + r + 14);
        }
      }

      // Discovered locations — auto-found landmarks from
      // LocationDiscovery. Drawn under user waypoints so the player's
      // own pins always sit on top.
      const discovered = useWorldMap.getState().discoveredLocations;
      for (const loc of discovered) {
        const p = worldToScreen(loc.worldX, loc.worldZ, w, h);
        const info = LOCATION_ICONS[loc.type] ?? LOCATION_ICONS.landmark;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = info.color + "dd";
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.6)";
        ctx.lineWidth = 1;
        ctx.stroke();
        if (z > 0.6) {
          ctx.font = "11px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(info.symbol, p.x, p.y + 1);
          ctx.textBaseline = "alphabetic";
        }
      }

      // User waypoints.
      for (const wp of waypoints) {
        const p = worldToScreen(wp.worldX, wp.worldZ, w, h);
        const isTracking = wp.id === trackingWaypointId;
        const isSelected = wp.id === selectedWaypointId;
        ctx.beginPath();
        ctx.arc(p.x, p.y, isTracking || isSelected ? 9 : 7, 0, Math.PI * 2);
        ctx.fillStyle = wp.color;
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();
        // Emoji inside the marker — small but readable when zoomed.
        ctx.font = "12px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(wp.icon, p.x, p.y + 1);
        ctx.textBaseline = "alphabetic";
        // Tracking ring.
        if (isTracking) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
          ctx.strokeStyle = wp.color;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // Live player position (read fresh from the store, NOT a closed-
      // over React value, because the Vector3 is mutated in place).
      const pos = useGame.getState().playerPosition;
      if (pos) {
        const p = worldToScreen(pos.x, pos.z, w, h);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
        ctx.fillStyle = "#e74c3c";
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();
        // Soft glow halo so the player is easy to spot at any zoom.
        ctx.beginPath();
        ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(231,76,60,0.5)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      animFrame.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animFrame.current); };
  }, [mapOpen, camera, waypoints, trackingWaypointId, selectedWaypointId, worldToScreen, imgLoaded]);

  // ----------------------------------------------------------------
  // Mouse handlers — pan, zoom, hover, double-click waypoint, right-
  // click waypoint delete, single-click select.
  // ----------------------------------------------------------------
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.stopPropagation();
    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    setCamera((c) => ({ ...c, zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, c.zoom * factor)) }));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      setDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY, camX: camera.x, camY: camera.y });
    }
  }, [camera]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragging) {
      const dx = (e.clientX - dragStart.x) / camera.zoom;
      const dy = (e.clientY - dragStart.y) / camera.zoom;
      setCamera((c) => ({ ...c, x: dragStart.camX - dx, y: dragStart.camY - dy }));
    }
    const canvas = canvasRef.current;
    if (canvas) {
      const wld = screenToWorld(e.clientX, e.clientY, canvas.width, canvas.height);
      let found: ResolvedIslandLayout | null = null;
      for (const isl of ISLAND_LAYOUT) {
        const dx = isl.worldX - wld.x;
        const dz = isl.worldZ - wld.z;
        if (Math.sqrt(dx * dx + dz * dz) < isl.worldRadius * 0.6) {
          found = isl;
          break;
        }
      }
      setHoverIsland(found);
    }
  }, [dragging, dragStart, camera, screenToWorld]);

  const handleMouseUp = useCallback(() => setDragging(false), []);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const wld = screenToWorld(e.clientX, e.clientY, canvas.width, canvas.height);
    setShowWaypointDialog({ worldX: Math.round(wld.x), worldZ: Math.round(wld.z) });
    setWaypointName(`Waypoint ${waypoints.length + 1}`);
  }, [screenToWorld, waypoints.length]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const wld = screenToWorld(e.clientX, e.clientY, canvas.width, canvas.height);
    const near = waypoints.find((wp) => {
      const dx = wp.worldX - wld.x;
      const dz = wp.worldZ - wld.z;
      return Math.sqrt(dx * dx + dz * dz) < 20 / camera.zoom;
    });
    if (near) removeWaypoint(near.id);
  }, [screenToWorld, waypoints, camera.zoom, removeWaypoint]);

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const wld = screenToWorld(e.clientX, e.clientY, canvas.width, canvas.height);
    const near = waypoints.find((wp) => {
      const dx = wp.worldX - wld.x;
      const dz = wp.worldZ - wld.z;
      return Math.sqrt(dx * dx + dz * dz) < 20 / camera.zoom;
    });
    if (near) {
      setSelectedWaypoint(near.id === selectedWaypointId ? null : near.id);
    } else {
      setSelectedWaypoint(null);
    }
  }, [screenToWorld, waypoints, camera.zoom, selectedWaypointId, setSelectedWaypoint]);

  const confirmWaypoint = useCallback(() => {
    if (!showWaypointDialog) return;
    addWaypoint({
      name: waypointName.trim() || "Waypoint",
      worldX: showWaypointDialog.worldX,
      worldZ: showWaypointDialog.worldZ,
      color: waypointColor,
      icon: waypointIcon,
    });
    setShowWaypointDialog(null);
  }, [showWaypointDialog, waypointName, waypointColor, waypointIcon, addWaypoint]);

  const centerOnPlayer = useCallback(() => {
    const pos = useGame.getState().playerPosition;
    if (pos) setCamera((c) => ({ ...c, x: pos.x, y: pos.z }));
  }, []);

  const centerOnIsland = useCallback((isl: ResolvedIslandLayout) => {
    setCamera((c) => ({ ...c, x: isl.worldX, y: isl.worldZ }));
  }, []);

  if (!mapOpen) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 99999,
      background: "rgba(0,0,0,0.85)", backdropFilter: "blur(4px)",
    }}>
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", inset: 0, cursor: dragging ? "grabbing" : "grab" }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        onClick={handleCanvasClick}
      />

      <div style={{
        position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
        display: "flex", alignItems: "center", gap: 12, pointerEvents: "none",
      }}>
        <h2 style={{
          color: "#c5a059", fontFamily: "'Cinzel', serif", fontSize: 22, margin: 0,
          textShadow: "0 2px 8px rgba(0,0,0,0.8)", letterSpacing: 2,
        }}>
          WORLD MAP
        </h2>
      </div>

      <div style={{
        position: "absolute", top: 12, right: 12,
        display: "flex", flexDirection: "column", gap: 6,
      }}>
        <MapButton onClick={closeMap} label="✕" title="Close (M)" />
        <MapButton onClick={centerOnPlayer} label="📍" title="Center on player" />
        <MapButton onClick={() => setCamera((c) => ({ ...c, zoom: Math.min(MAX_ZOOM, c.zoom * 1.3) }))} label="+" title="Zoom in" />
        <MapButton onClick={() => setCamera((c) => ({ ...c, zoom: Math.max(MIN_ZOOM, c.zoom * 0.77) }))} label="−" title="Zoom out" />
        <MapButton onClick={() => setShowLegend((s) => !s)} label="📋" title="Toggle legend" active={showLegend} />
        <MapButton onClick={() => setShowWaypointList((s) => !s)} label="📌" title="Waypoints list" active={showWaypointList} />
      </div>

      {hoverIsland && (
        <div style={{
          position: "absolute", bottom: 60, left: "50%", transform: "translateX(-50%)",
          background: "rgba(0,0,0,0.85)", border: "1px solid rgba(197,160,89,0.4)",
          borderRadius: 8, padding: "10px 18px", color: "#fff",
          fontFamily: "'Cinzel', serif", pointerEvents: "none",
        }}>
          <div style={{ color: "#c5a059", fontSize: 14, fontWeight: "bold" }}>
            {hoverIsland.name}
          </div>
          <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>
            {hoverIsland.isTutorial ? "Tutorial · " : ""}
            {hoverIsland.faction ? `${hoverIsland.faction.toUpperCase()} faction · ` : ""}
            ({Math.round(hoverIsland.worldX)}, {Math.round(hoverIsland.worldZ)})
          </div>
        </div>
      )}

      {showLegend && (
        <div style={{
          position: "absolute", bottom: 12, left: 12,
          background: "rgba(0,0,0,0.85)", border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 8, padding: 12, minWidth: 180,
        }}>
          <div style={{ color: "#c5a059", fontSize: 12, fontWeight: "bold", marginBottom: 8, fontFamily: "'Cinzel', serif" }}>
            Islands
          </div>
          {ISLAND_LAYOUT.filter((i) => !i.isIslet).map((isl) => (
            <div
              key={isl.id}
              onClick={() => centerOnIsland(isl)}
              style={{
                display: "flex", alignItems: "center", gap: 6, marginBottom: 4,
                cursor: "pointer", padding: "2px 4px", borderRadius: 3,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: isl.color, border: isl.isTutorial ? "1.5px solid #fff" : "1px solid rgba(0,0,0,0.4)" }} />
              <span style={{ color: "#ccc", fontSize: 10 }}>{isl.name}</span>
            </div>
          ))}
          <div style={{ fontSize: 10, color: "#aaa", marginBottom: 4, marginTop: 8 }}>Markers:</div>
          {Object.entries(LOCATION_ICONS).map(([type, info]) => (
            <div key={type} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
              <span style={{ fontSize: 11 }}>{info.symbol}</span>
              <span style={{ color: info.color, fontSize: 10 }}>{info.label}</span>
            </div>
          ))}
          <div style={{ fontSize: 10, color: "#aaa", marginTop: 8 }}>Controls:</div>
          <div style={{ fontSize: 9, color: "#888", lineHeight: 1.6 }}>
            Drag: Pan · Scroll: Zoom<br />
            Double-click: Add waypoint<br />
            Right-click marker: Remove<br />
            Click marker: Select/Track
          </div>
        </div>
      )}

      {showWaypointList && (
        <div style={{
          position: "absolute", top: 60, right: 12,
          background: "rgba(0,0,0,0.9)", border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 8, padding: 12, minWidth: 200, maxHeight: 400, overflowY: "auto",
        }}>
          <div style={{ color: "#c5a059", fontSize: 12, fontWeight: "bold", marginBottom: 8, fontFamily: "'Cinzel', serif" }}>
            Waypoints ({waypoints.length})
          </div>
          {waypoints.length === 0 ? (
            <div style={{ color: "#666", fontSize: 10 }}>No waypoints. Double-click the map to add one.</div>
          ) : waypoints.map((wp) => (
            <div
              key={wp.id}
              style={{
                display: "flex", alignItems: "center", gap: 8, padding: "4px 6px",
                borderRadius: 4, cursor: "pointer",
                background: wp.id === selectedWaypointId ? "rgba(255,255,255,0.08)" : "transparent",
                border: wp.id === trackingWaypointId ? `1px solid ${wp.color}44` : "1px solid transparent",
              }}
              onClick={() => {
                setSelectedWaypoint(wp.id);
                setCamera((c) => ({ ...c, x: wp.worldX, y: wp.worldZ }));
              }}
            >
              <span style={{ fontSize: 14 }}>{wp.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ color: wp.color, fontSize: 11, fontWeight: "bold" }}>{wp.name}</div>
                <div style={{ color: "#888", fontSize: 9 }}>({wp.worldX}, {wp.worldZ})</div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setTrackingWaypoint(wp.id === trackingWaypointId ? null : wp.id); }}
                style={{
                  background: wp.id === trackingWaypointId ? wp.color + "33" : "rgba(255,255,255,0.05)",
                  border: `1px solid ${wp.id === trackingWaypointId ? wp.color : "rgba(255,255,255,0.1)"}`,
                  color: wp.id === trackingWaypointId ? wp.color : "#888",
                  borderRadius: 3, padding: "2px 6px", fontSize: 9, cursor: "pointer",
                }}
                title="Track this waypoint"
              >
                🎯
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); removeWaypoint(wp.id); }}
                style={{
                  background: "rgba(239,83,80,0.1)", border: "1px solid rgba(239,83,80,0.3)",
                  color: "#ef5350", borderRadius: 3, padding: "2px 6px", fontSize: 9, cursor: "pointer",
                }}
                title="Remove waypoint"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {showWaypointDialog && (
        <div style={{
          position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
          background: "rgba(10,22,40,0.96)", border: "1px solid rgba(197,160,89,0.4)",
          borderRadius: 10, padding: 20, minWidth: 280, zIndex: 10,
        }}>
          <div style={{ color: "#c5a059", fontSize: 14, fontWeight: "bold", marginBottom: 12, fontFamily: "'Cinzel', serif" }}>
            Place Waypoint
          </div>
          <div style={{ fontSize: 10, color: "#888", marginBottom: 10 }}>
            Position: ({showWaypointDialog.worldX}, {showWaypointDialog.worldZ})
          </div>
          <input
            type="text"
            value={waypointName}
            onChange={(e) => setWaypointName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") confirmWaypoint(); }}
            autoFocus
            style={{
              width: "100%", padding: "6px 10px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(255,255,255,0.06)", color: "#fff", fontSize: 12, marginBottom: 10, outline: "none",
              boxSizing: "border-box",
            }}
            placeholder="Waypoint name..."
          />
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, color: "#aaa", marginBottom: 4 }}>Color:</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {WAYPOINT_COLORS.map((c) => (
                <div
                  key={c}
                  onClick={() => setWaypointColor(c)}
                  style={{
                    width: 20, height: 20, borderRadius: 3, background: c, cursor: "pointer",
                    border: c === waypointColor ? "2px solid #fff" : "2px solid transparent",
                  }}
                />
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: "#aaa", marginBottom: 4 }}>Icon:</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {WAYPOINT_ICONS.map((ic) => (
                <div
                  key={ic}
                  onClick={() => setWaypointIcon(ic)}
                  style={{
                    width: 28, height: 28, borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", fontSize: 16,
                    background: ic === waypointIcon ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)",
                    border: ic === waypointIcon ? "1px solid rgba(255,255,255,0.3)" : "1px solid transparent",
                  }}
                >
                  {ic}
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              onClick={() => setShowWaypointDialog(null)}
              style={{
                padding: "6px 14px", borderRadius: 4, cursor: "pointer", fontSize: 11,
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", color: "#aaa",
              }}
            >
              Cancel
            </button>
            <button
              onClick={confirmWaypoint}
              style={{
                padding: "6px 14px", borderRadius: 4, cursor: "pointer", fontSize: 11,
                background: "rgba(197,160,89,0.2)", border: "1px solid rgba(197,160,89,0.4)", color: "#c5a059",
              }}
            >
              Place Marker
            </button>
          </div>
        </div>
      )}

      <div style={{
        position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)",
        color: "#666", fontSize: 9, pointerEvents: "none",
      }}>
        Press M to close · Drag to pan · Scroll to zoom · Double-click to place waypoint
      </div>
    </div>
  );
}

function MapButton({ onClick, label, title, active }: {
  onClick: () => void; label: string; title: string; active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 34, height: 34, borderRadius: 6, cursor: "pointer",
        background: active ? "rgba(197,160,89,0.2)" : "rgba(0,0,0,0.7)",
        border: active ? "1px solid rgba(197,160,89,0.5)" : "1px solid rgba(255,255,255,0.15)",
        color: active ? "#c5a059" : "#ccc",
        fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      {label}
    </button>
  );
}

/**
 * Auto-discovers islands as the player walks (or sails) within range.
 * Each entry in `ISLAND_LAYOUT` becomes a discoverable "landmark"
 * waypoint the first time the player gets close enough. Mounted by
 * the active gameplay scene.
 *
 * Why landmark instead of dock/village/etc
 *   The layout itself doesn't yet record what's ON each island
 *   (vendors, docks, dungeons). Once the user starts placing those,
 *   IslandLayout will grow per-island feature lists and this tracker
 *   will discover them by type. For now the island itself is the
 *   discoverable thing.
 */
const DISCOVERY_RADIUS_FACTOR = 1.2;
const DISCOVERY_INTERVAL = 2000;

export function LocationDiscovery() {
  const discoverLocation = useWorldMap((s) => s.discoverLocation);
  const isLocationDiscovered = useWorldMap((s) => s.isLocationDiscovered);

  useEffect(() => {
    const check = () => {
      const pos = useGame.getState().playerPosition;
      if (!pos) return;
      for (const isl of ISLAND_LAYOUT) {
        if (isLocationDiscovered(isl.name, isl.id)) continue;
        const dx = pos.x - isl.worldX;
        const dz = pos.z - isl.worldZ;
        const radius = isl.worldRadius * DISCOVERY_RADIUS_FACTOR;
        if (Math.sqrt(dx * dx + dz * dz) < radius) {
          discoverLocation({
            name: isl.name,
            type: "landmark",
            islandId: isl.id,
            worldX: isl.worldX,
            worldZ: isl.worldZ,
          });
        }
      }
    };
    const timer = setInterval(check, DISCOVERY_INTERVAL);
    check();
    return () => clearInterval(timer);
  }, [discoverLocation, isLocationDiscovered]);

  return null;
}

// `worldToImage`/`imageToWorld` aren't used by the canvas draw loop
// (which works directly in world space) but are re-exported here so
// other UI code can convert between world coords and the reference
// image's pixel coords without depending on the layout module.
export { worldToImage, imageToWorld };
