import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { create } from 'zustand';

export interface DamageNumberEntry {
  id: number;
  value: number;
  position: [number, number, number];
  type: 'damage' | 'player_damage' | 'crit' | 'heal' | 'xp' | 'combo' | 'poison' | 'burn' | 'magic' | 'block' | 'dodge' | 'mastery';
  timestamp: number;
  driftX: number;
  driftZ: number;
}

let nextId = 0;

interface DamageNumberStore {
  numbers: DamageNumberEntry[];
  spawn: (value: number, position: [number, number, number], type: DamageNumberEntry['type']) => void;
  remove: (id: number) => void;
}

export const useDamageNumbers = create<DamageNumberStore>((set) => ({
  numbers: [],
  spawn: (value, position, type) => {
    const id = nextId++;
    const angle = Math.random() * Math.PI * 2;
    const spread = 0.4 + Math.random() * 0.6;
    const offset: [number, number, number] = [
      position[0] + Math.cos(angle) * spread * 0.3,
      position[1] + 1.5 + Math.random() * 0.5,
      position[2] + Math.sin(angle) * spread * 0.3,
    ];
    set((s) => ({
      numbers: [...s.numbers.slice(-30), {
        id,
        value,
        position: offset,
        type,
        timestamp: Date.now(),
        driftX: Math.cos(angle) * spread,
        driftZ: Math.sin(angle) * spread,
      }],
    }));
    const lifetime = type === 'crit' ? 1800 : type === 'xp' ? 1600 : 1400;
    setTimeout(() => {
      set((s) => ({ numbers: s.numbers.filter((n) => n.id !== id) }));
    }, lifetime);
  },
  remove: (id) => set((s) => ({ numbers: s.numbers.filter((n) => n.id !== id) })),
}));

function FloatingNumber({ entry }: { entry: DamageNumberEntry }) {
  const groupRef = useRef<THREE.Group>(null);
  const startY = useRef(entry.position[1]);
  const startX = useRef(entry.position[0]);
  const startZ = useRef(entry.position[2]);

  const config = useMemo(() => {
    switch (entry.type) {
      case 'crit':
        return { color: '#ffdd00', outlineColor: '#cc4400', fontSize: 0.6, prefix: '', suffix: '!', duration: 1.6 };
      case 'heal':
        return { color: '#44ff66', outlineColor: '#006622', fontSize: 0.38, prefix: '+', suffix: '', duration: 1.2 };
      case 'xp':
        return { color: '#aa88ff', outlineColor: '#332266', fontSize: 0.3, prefix: '+', suffix: ' XP', duration: 1.4 };
      case 'combo':
        return { color: '#ff8844', outlineColor: '#662200', fontSize: 0.5, prefix: '', suffix: 'x COMBO', duration: 1.2 };
      case 'poison':
        return { color: '#88ff44', outlineColor: '#224400', fontSize: 0.35, prefix: '', suffix: '', duration: 1.2 };
      case 'burn':
        return { color: '#ff6622', outlineColor: '#441100', fontSize: 0.35, prefix: '', suffix: '', duration: 1.2 };
      case 'magic':
        return { color: '#6688ff', outlineColor: '#112266', fontSize: 0.4, prefix: '', suffix: '', duration: 1.2 };
      case 'block':
        return { color: '#88aacc', outlineColor: '#223344', fontSize: 0.35, prefix: '', suffix: ' BLOCKED', duration: 1.0 };
      case 'dodge':
        return { color: '#aaaaaa', outlineColor: '#333333', fontSize: 0.35, prefix: '', suffix: ' DODGE', duration: 1.0 };
      case 'mastery':
        return { color: '#ffaa44', outlineColor: '#663300', fontSize: 0.42, prefix: '', suffix: '', duration: 1.2 };
      case 'player_damage':
        return { color: '#ff5555', outlineColor: '#330000', fontSize: 0.5, prefix: '-', suffix: '', duration: 1.4 };
      default:
        return { color: '#ff4444', outlineColor: '#440000', fontSize: 0.35, prefix: '', suffix: '', duration: 1.2 };
    }
  }, [entry.type]);

  useFrame((state) => {
    if (!groupRef.current) return;
    const elapsed = (Date.now() - entry.timestamp) / 1000;
    const duration = config.duration;
    const t = Math.min(1, elapsed / duration);

    const isCrit = entry.type === 'crit';
    const isCombo = entry.type === 'combo';

    const driftMult = isCrit ? 1.3 : 1.0;
    groupRef.current.position.x = startX.current + entry.driftX * t * driftMult;
    groupRef.current.position.z = startZ.current + entry.driftZ * t * driftMult;

    const riseHeight = isCrit ? 3.0 : isCombo ? 2.8 : 2.2;
    const gravity = isCrit ? 0.8 : 0.6;
    groupRef.current.position.y = startY.current + t * riseHeight - t * t * gravity;

    let popScale: number;
    const popDuration = isCrit ? 0.12 : 0.15;
    if (elapsed < popDuration) {
      const popT = elapsed / popDuration;
      const easeOut = 1 - Math.pow(1 - popT, 3);
      popScale = 0.1 + easeOut * (isCrit ? 1.8 : 1.4);
    } else if (elapsed < popDuration * 2) {
      const shrinkT = (elapsed - popDuration) / popDuration;
      const peak = isCrit ? 1.9 : 1.5;
      popScale = peak - shrinkT * (peak - 1.0);
    } else {
      popScale = 1.0;
    }

    let pulseScale = 1.0;
    if (isCrit) {
      pulseScale = 1.0 + Math.sin(elapsed * 12) * 0.15;
    } else if (isCombo) {
      pulseScale = 1.0 + Math.sin(elapsed * 8) * 0.08;
    }

    const fadeStart = 0.6;
    const fadeScale = t > fadeStart ? Math.pow(1 - (t - fadeStart) / (1 - fadeStart), 2) : 1.0;

    groupRef.current.scale.setScalar(popScale * pulseScale * fadeScale);
    groupRef.current.quaternion.copy(state.camera.quaternion);
  });

  const displayText = entry.type === 'dodge'
    ? 'DODGED'
    : entry.type === 'block'
    ? `${Math.round(entry.value)} BLOCKED`
    : `${config.prefix}${Math.round(entry.value)}${config.suffix}`;

  return (
    <group ref={groupRef} position={[entry.position[0], entry.position[1], entry.position[2]]}>
      <Text
        fontSize={config.fontSize}
        color={config.color}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.06}
        outlineColor={config.outlineColor}
        fontWeight="bold"
      >
        {displayText}
      </Text>
    </group>
  );
}

export function DamageNumbersRenderer() {
  const numbers = useDamageNumbers((s) => s.numbers);

  return (
    <>
      {numbers.map((entry) => (
        <FloatingNumber key={entry.id} entry={entry} />
      ))}
    </>
  );
}
