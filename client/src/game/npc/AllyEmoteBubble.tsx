import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Html } from "@react-three/drei";
import type { AllyEmote } from "../ai/AllyEmotes";

interface AllyEmoteBubbleProps {
  emote: AllyEmote | null;
  /** Remaining time on the emote (drives fade-out) */
  timer: number;
  /** Y offset above the ally model */
  yOffset: number;
}

/**
 * Floating chat bubble that appears above an ally's head.
 * Uses drei's <Html> for crisp DOM text rendering in 3D space.
 * Animates: scale pop-in → hold → fade-out.
 */
export default function AllyEmoteBubble({ emote, timer, yOffset }: AllyEmoteBubbleProps) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!groupRef.current || !emote) return;
    // Gentle bob
    groupRef.current.position.y = yOffset + Math.sin(performance.now() / 800) * 0.05;
  });

  if (!emote || timer <= 0) return null;

  // Opacity: full for most of the duration, fade in last 0.5s
  const fadeIn = Math.min(1, (emote.duration - timer) / 0.2); // quick pop-in
  const fadeOut = Math.min(1, timer / 0.5); // gentle fade-out
  const opacity = Math.min(fadeIn, fadeOut);
  const scale = 0.8 + fadeIn * 0.2; // slight pop effect

  return (
    <group ref={groupRef} position={[0, yOffset, 0]}>
      <Html
        center
        distanceFactor={8}
        style={{
          pointerEvents: "none",
          opacity,
          transform: `scale(${scale})`,
          transition: "transform 0.15s ease-out",
        }}
      >
        <div
          style={{
            background: "rgba(12, 8, 5, 0.92)",
            border: "1px solid rgba(197, 160, 89, 0.7)",
            borderRadius: 10,
            padding: "5px 10px",
            display: "flex",
            alignItems: "center",
            gap: 6,
            whiteSpace: "nowrap",
            boxShadow: "0 4px 12px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)",
            minWidth: 50,
          }}
        >
          <span style={{ fontSize: 16 }}>{emote.emoji}</span>
          <span
            style={{
              fontFamily: "'Crimson Text', serif",
              fontSize: 13,
              color: "#f5e2c1",
              fontWeight: 600,
              textShadow: "0 1px 2px rgba(0,0,0,0.8)",
            }}
          >
            {emote.text}
          </span>
        </div>
        {/* Speech bubble tail */}
        <div
          style={{
            width: 0,
            height: 0,
            margin: "0 auto",
            borderLeft: "6px solid transparent",
            borderRight: "6px solid transparent",
            borderTop: "8px solid rgba(12, 8, 5, 0.92)",
          }}
        />
      </Html>
    </group>
  );
}
