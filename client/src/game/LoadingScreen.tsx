import { useState, useEffect, useRef, useCallback } from "react";
import { useGame } from "@/lib/stores/useGame";
import { useGrudge } from "@/lib/stores/useGrudge";
import { getSharedLoader, getLoadStats } from "./systems/AssetLoader";

const FONTS = {
  title: "'MorkDungeon', 'Cinzel', serif",
  header: "'Cinzel', serif",
  body: "'Crimson Text', serif",
  mono: "'JetBrains Mono', monospace",
};

const TIPS = [
  "Hold Shift to sprint — cover ground faster but drain stamina.",
  "Press E to block incoming attacks and reduce damage.",
  "Gather resources from nodes scattered across the world.",
  "Use 1-5 keys for powerful special abilities in combat.",
  "Explore dungeons for rare loot and tough enemies.",
  "Craft better equipment at the crafting station.",
  "Keep an eye on your hunger and thirst bars.",
  "Different weapon types have unique attack animations.",
  "Combo attacks deal bonus damage — chain hits quickly!",
  "Tab targets nearby enemies for focused combat.",
  "Higher waves spawn stronger enemies with better drops.",
  "Visit the dock to sail between islands.",
  "Press C to open the combat panel, B for inventory.",
  "Archers excel at range, casters deal area damage.",
  "Rolling with Ctrl grants brief invincibility frames.",
  "Left click chains into combos — attack1 → attack2 → attack3 → uppercut!",
  "Right-click during a combo for heavy finishers like spin slash.",
  "Press Shift+direction to dash, then click for a dash attack.",
  "Jump and click to perform a devastating ground slam.",
  "F1-F4 commands your allies: Follow, Patrol, Hold, Attack.",
];

const LOADING_PHASES = [
  { label: "Initializing game engine", weight: 5 },
  { label: "Loading terrain & ocean", weight: 15 },
  { label: "Loading character model", weight: 20 },
  { label: "Loading enemy models", weight: 20 },
  { label: "Preparing combat systems", weight: 10 },
  { label: "Loading weapons & items", weight: 10 },
  { label: "Spawning world entities", weight: 10 },
  { label: "Preparing UI & HUD", weight: 5 },
  { label: "Entering world", weight: 5 },
];

const CRITICAL_MODELS = [
  "/models/characters/undead_grave_knight-male.glb",
  "/models/characters/goblin_backstabber-male.glb",
  "/models/characters/night_stalker-male.glb",
  "/models/characters/human_battle_mage-male.glb",
  "/models/monsters/big/Orc.glb",
  "/models/monsters/big/Demon.glb",
  "/models/monsters/big/BlueDemon.glb",
  "/models/monsters/flying/Ghost.glb",
  "/models/monsters/blob/GreenBlob.glb",
];

const MIN_DISPLAY_MS = 5000;

const GOLD = "#c9950a";
const GOLD_DIM = "rgba(201,149,10,0.5)";
const GOLD_GLOW = "rgba(201,149,10,0.3)";

export default function LoadingScreen() {
  const { finishLoading, selectedCharacter } = useGame();
  const [progress, setProgress] = useState(0);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [tipIdx, setTipIdx] = useState(() => Math.floor(Math.random() * TIPS.length));
  const [fadeOut, setFadeOut] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const startTime = useRef(Date.now());
  const completeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeDelayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const assetsLoaded = useRef(false);
  const minTimeElapsed = useRef(false);
  const hasFinished = useRef(false);
  const cancelled = useRef(false);

  const tryFinish = useCallback(() => {
    if (hasFinished.current || cancelled.current) return;
    if (!assetsLoaded.current || !minTimeElapsed.current) return;
    hasFinished.current = true;
    setProgress(1);
    setPhaseIndex(LOADING_PHASES.length - 1);
    fadeDelayTimer.current = setTimeout(() => {
      if (cancelled.current) return;
      setFadeOut(true);
      completeTimer.current = setTimeout(() => {
        if (!cancelled.current) finishLoading();
      }, 800);
    }, 400);
  }, [finishLoading]);

  useEffect(() => {
    const t = setTimeout(() => setShowContent(true), 100);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const tipInterval = setInterval(() => {
      setTipIdx(prev => (prev + 1) % TIPS.length);
    }, 4000);
    return () => clearInterval(tipInterval);
  }, []);

  useEffect(() => {
    const minTimer = setTimeout(() => {
      minTimeElapsed.current = true;
      tryFinish();
    }, MIN_DISPLAY_MS);
    return () => clearTimeout(minTimer);
  }, [tryFinish]);

  useEffect(() => {
    const loader = getSharedLoader();
    let isMounted = true;
    const modelsToLoad = [
      selectedCharacter.modelPath,
      ...CRITICAL_MODELS,
    ].filter(Boolean);

    let loaded = 0;
    const total = modelsToLoad.length;
    const totalWeight = LOADING_PHASES.reduce((s, p) => s + p.weight, 0);

    const updatePhaseFromProgress = (pct: number) => {
      if (!isMounted) return;
      let accumulated = 0;
      for (let i = 0; i < LOADING_PHASES.length; i++) {
        accumulated += LOADING_PHASES[i].weight / totalWeight;
        if (pct < accumulated) {
          setPhaseIndex(i);
          break;
        }
      }
    };

    const bytesPerModel = new Map<string, { loaded: number; total: number }>();

    const updateByteProgress = () => {
      if (!isMounted) return;
      let sumLoaded = 0;
      let sumTotal = 0;
      bytesPerModel.forEach((v) => {
        sumLoaded += v.loaded;
        sumTotal += v.total;
      });

      const filePct = loaded / total;
      const bytePct = sumTotal > 0 ? sumLoaded / sumTotal : filePct;
      const blended = filePct * 0.6 + bytePct * 0.4;
      const pct = Math.min(blended, 0.95);
      setProgress(pct);
      updatePhaseFromProgress(pct);
    };

    const onModelDone = () => {
      if (!isMounted) return;
      loaded++;
      updateByteProgress();
    };

    const loadModel = (path: string) => {
      return new Promise<void>((resolve) => {
        bytesPerModel.set(path, { loaded: 0, total: 0 });
        loader.load(
          path,
          () => { onModelDone(); resolve(); },
          (xhr) => {
            if (xhr.lengthComputable) {
              bytesPerModel.set(path, { loaded: xhr.loaded, total: xhr.total });
              updateByteProgress();
            }
          },
          () => { onModelDone(); resolve(); },
        );
      });
    };

    const grudgeFetch = useGrudge.getState().fetchAll().catch(() => {});
    Promise.all([...modelsToLoad.map(loadModel), grudgeFetch]).then(() => {
      if (!isMounted) return;
      assetsLoaded.current = true;
      tryFinish();
    });

    return () => { isMounted = false; };
  }, [selectedCharacter.modelPath, tryFinish]);

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime.current;
      const timePct = Math.min(elapsed / MIN_DISPLAY_MS, 0.95);
      setProgress(prev => Math.max(prev, timePct * 0.5));
    }, 100);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    return () => {
      cancelled.current = true;
      if (completeTimer.current) clearTimeout(completeTimer.current);
      if (fadeDelayTimer.current) clearTimeout(fadeDelayTimer.current);
    };
  }, []);

  const pct = Math.floor(progress * 100);
  const currentPhase = LOADING_PHASES[Math.min(phaseIndex, LOADING_PHASES.length - 1)];

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 9999,
      background: "linear-gradient(180deg, #0a0705 0%, #0f0a06 50%, #0a0705 100%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: FONTS.body,
      color: "#fff",
      opacity: fadeOut ? 0 : 1,
      transition: "opacity 0.7s ease-out",
      overflow: "hidden",
    }}>
      <div style={{
        position: "absolute",
        inset: 0,
        background: "radial-gradient(ellipse at 50% 35%, rgba(201,149,10,0.03) 0%, transparent 50%)",
        pointerEvents: "none",
      }} />

      <div style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 2,
        background: "rgba(201,149,10,0.1)",
      }}>
        <div style={{
          height: "100%",
          width: `${pct}%`,
          background: `linear-gradient(90deg, ${GOLD}, #e8c868, ${GOLD})`,
          transition: "width 0.3s ease-out",
          boxShadow: `0 0 20px ${GOLD_GLOW}`,
        }} />
      </div>

      <div style={{
        position: "relative",
        textAlign: "center",
        maxWidth: 520,
        padding: "0 32px",
        opacity: showContent ? 1 : 0,
        transform: showContent ? "translateY(0)" : "translateY(20px)",
        transition: "opacity 0.8s ease-out, transform 0.8s ease-out",
      }}>
        <div style={{
          fontSize: "clamp(56px, 10vw, 80px)",
          fontFamily: FONTS.title,
          color: "#f0d68a",
          textShadow: `0 0 40px ${GOLD_GLOW}, 0 2px 8px rgba(0,0,0,0.8)`,
          letterSpacing: 4,
          lineHeight: 1,
          margin: "0 0 4px",
          animation: "loadPulse 3s ease-in-out infinite",
        }}>
          GRUDGE
        </div>

        <p style={{
          fontSize: 12,
          color: GOLD_DIM,
          margin: "0 0 10px",
          letterSpacing: 6,
          textTransform: "uppercase",
          fontFamily: FONTS.header,
        }}>
          Fight &middot; Gather &middot; Survive
        </p>

        <div style={{
          fontSize: 14,
          color: "#c9a86c",
          marginBottom: 36,
          fontFamily: FONTS.body,
        }}>
          Preparing <span style={{ color: "#f0d68a", fontWeight: 600 }}>{selectedCharacter.name}</span> for adventure...
        </div>

        <div style={{
          width: "100%",
          height: 4,
          background: "rgba(201,149,10,0.1)",
          borderRadius: 2,
          overflow: "hidden",
          marginBottom: 10,
          border: "1px solid rgba(201,149,10,0.15)",
        }}>
          <div style={{
            height: "100%",
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${GOLD}, #e8c868)`,
            borderRadius: 2,
            transition: "width 0.3s ease-out",
            boxShadow: `0 0 10px ${GOLD_GLOW}`,
          }} />
        </div>

        <div style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 11,
          color: GOLD_DIM,
          marginBottom: 6,
          fontFamily: FONTS.mono,
        }}>
          <span style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}>
            <span style={{
              display: "inline-block",
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: GOLD,
              animation: "dotPulse 1s ease-in-out infinite",
            }} />
            {currentPhase.label}
          </span>
          <span style={{ fontVariantNumeric: "tabular-nums", color: GOLD_DIM }}>{pct}%</span>
        </div>

        <div style={{
          display: "flex",
          gap: 3,
          justifyContent: "center",
          marginBottom: 40,
        }}>
          {LOADING_PHASES.map((_, i) => (
            <div key={i} style={{
              flex: 1,
              height: 2,
              borderRadius: 1,
              background: i <= phaseIndex ? GOLD_DIM : "rgba(201,149,10,0.1)",
              transition: "background 0.3s ease",
            }} />
          ))}
        </div>

        <div style={{
          padding: "18px 22px",
          background: "rgba(201,149,10,0.04)",
          borderRadius: 8,
          border: "1px solid rgba(201,149,10,0.12)",
          minHeight: 70,
        }}>
          <div style={{
            fontSize: 9,
            color: GOLD_DIM,
            textTransform: "uppercase",
            letterSpacing: 3,
            marginBottom: 8,
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontFamily: FONTS.header,
          }}>
            <span style={{ opacity: 0.6 }}>&#9733;</span>
            Tip
          </div>
          <div style={{
            fontSize: 13,
            color: "#c9a86c",
            lineHeight: 1.6,
            transition: "opacity 0.3s ease",
            fontFamily: FONTS.body,
          }}>
            {TIPS[tipIdx]}
          </div>
        </div>
      </div>

      <div style={{
        position: "absolute",
        bottom: 48,
        fontSize: 10,
        color: "rgba(201,149,10,0.3)",
        letterSpacing: 1,
        fontVariantNumeric: "tabular-nums",
        fontFamily: FONTS.mono,
        opacity: showContent ? 0.7 : 0,
        transition: "opacity 1s ease-out 0.3s",
      }}>
        {(() => {
          const stats = getLoadStats();
          if (stats.totalLoaded > 0) {
            const mb = (stats.totalBytes / (1024 * 1024)).toFixed(1);
            return `${stats.totalLoaded} assets loaded (${mb} MB) \u2022 ${stats.cacheHits} cached`;
          }
          return '';
        })()}
      </div>

      <div style={{
        position: "absolute",
        bottom: 28,
        fontSize: 10,
        color: "rgba(201,149,10,0.2)",
        letterSpacing: 3,
        textTransform: "uppercase",
        fontFamily: FONTS.header,
        opacity: showContent ? 0.7 : 0,
        transition: "opacity 1s ease-out 0.5s",
      }}>
        Version 1.0
      </div>

      <style>{`
        @keyframes loadPulse {
          0%, 100% { text-shadow: 0 0 40px rgba(201,149,10,0.3), 0 2px 8px rgba(0,0,0,0.8); }
          50% { text-shadow: 0 0 60px rgba(201,149,10,0.5), 0 2px 8px rgba(0,0,0,0.8); }
        }
        @keyframes dotPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
