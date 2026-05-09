import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { SkillData, ItemData } from './MainGamePanel';

interface HotbarSlot {
  type: 'skill' | 'item' | 'empty';
  data: SkillData | ItemData | null;
  hotkey: string;
}

interface GameHotbarProps {
  slots?: HotbarSlot[];
  onUseSlot?: (index: number) => void;
  onDropSlot?: (index: number, item: SkillData | ItemData) => void;
}

const DEFAULT_SLOTS: HotbarSlot[] = Array.from({ length: 10 }, (_, i) => ({
  type: 'empty',
  data: null,
  hotkey: i === 9 ? '0' : String(i + 1),
}));

function HotbarSlotComponent({
  slot,
  index,
  isActive,
  onUse,
  onDrop,
}: {
  slot: HotbarSlot;
  index: number;
  isActive: boolean;
  onUse: () => void;
  onDrop: (item: SkillData | ItemData) => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const isEmpty = slot.type === 'empty' || !slot.data;
  
  const cooldownPercent = slot.type === 'skill' && slot.data
    ? ((slot.data as SkillData).cooldownRemaining / (slot.data as SkillData).cooldown) || 0
    : slot.type === 'item' && slot.data
      ? ((slot.data as ItemData).cooldownRemaining || 0) / ((slot.data as ItemData).cooldown || 1)
      : 0;

  const isOnCooldown = cooldownPercent > 0;

  return (
    <motion.div
      className={cn(
        'relative w-12 h-12 rounded-lg border-2 flex items-center justify-center cursor-pointer transition-all',
        isEmpty
          ? 'border-slate-700 bg-slate-800/50'
          : 'border-amber-500/50 bg-slate-800',
        isActive && 'ring-2 ring-amber-400 scale-105',
        isDragOver && 'border-amber-400 bg-amber-900/30'
      )}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onUse}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
      }}
      data-testid={`hotbar-slot-${index}`}
    >
      {!isEmpty && slot.data && (
        <div className="relative w-full h-full p-1">
          {'icon' in slot.data && slot.data.icon ? (
            <img
              src={slot.data.icon}
              alt={slot.data.name}
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-amber-600 to-amber-800 rounded" />
          )}
          
          {slot.type === 'item' && (slot.data as ItemData).amount > 1 && (
            <span className="absolute bottom-0 right-0 text-xs font-bold text-white bg-black/80 px-1 rounded">
              {(slot.data as ItemData).amount}
            </span>
          )}
        </div>
      )}

      {isOnCooldown && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg overflow-hidden">
          <div
            className="absolute inset-0 bg-black/60"
            style={{
              clipPath: `polygon(50% 50%, 50% 0%, ${50 + 50 * Math.sin(cooldownPercent * 2 * Math.PI)}% ${50 - 50 * Math.cos(cooldownPercent * 2 * Math.PI)}%, 50% 50%)`,
            }}
          />
          <span className="relative text-xs font-bold text-white z-10">
            {Math.ceil(
              slot.type === 'skill'
                ? (slot.data as SkillData).cooldownRemaining
                : (slot.data as ItemData).cooldownRemaining || 0
            )}
          </span>
        </div>
      )}

      <span className="absolute -top-1 -left-1 w-4 h-4 bg-slate-900 border border-slate-600 rounded text-xs font-bold text-slate-400 flex items-center justify-center">
        {slot.hotkey}
      </span>
    </motion.div>
  );
}

export function GameHotbar({
  slots = DEFAULT_SLOTS,
  onUseSlot,
  onDropSlot,
}: GameHotbarProps) {
  const [activeSlot, setActiveSlot] = useState<number | null>(null);

  const handleUseSlot = useCallback((index: number) => {
    const slot = slots[index];
    if (slot.type !== 'empty' && slot.data) {
      setActiveSlot(index);
      onUseSlot?.(index);
      
      setTimeout(() => setActiveSlot(null), 200);
    }
  }, [slots, onUseSlot]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      if (activeElement) {
        const tagName = activeElement.tagName.toLowerCase();
        if (tagName === 'input' || tagName === 'textarea') return;
      }

      const key = e.key;
      const slotIndex = key === '0' ? 9 : parseInt(key, 10) - 1;

      if (slotIndex >= 0 && slotIndex < slots.length) {
        e.preventDefault();
        handleUseSlot(slotIndex);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [slots, handleUseSlot]);

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40" data-testid="game-hotbar">
      <div className="flex items-center gap-1 p-2 bg-slate-900/90 border-2 border-amber-500/30 rounded-lg backdrop-blur-sm">
        {slots.map((slot, index) => (
          <HotbarSlotComponent
            key={index}
            slot={slot}
            index={index}
            isActive={activeSlot === index}
            onUse={() => handleUseSlot(index)}
            onDrop={(item) => onDropSlot?.(index, item)}
          />
        ))}
      </div>
      
      <div className="flex justify-center mt-2 gap-4 text-xs text-slate-500">
        <span>Press 1-0 to use abilities</span>
      </div>
    </div>
  );
}

export function MiniResourceBars({
  health,
  maxHealth,
  mana,
  maxMana,
  stamina,
  maxStamina,
}: {
  health: number;
  maxHealth: number;
  mana: number;
  maxMana: number;
  stamina: number;
  maxStamina: number;
}) {
  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 w-64" data-testid="resource-bars">
      <div className="space-y-1 p-2 bg-slate-900/80 rounded-lg border border-slate-700">
        <ResourceBar label="HP" current={health} max={maxHealth} color="red" />
        <ResourceBar label="MP" current={mana} max={maxMana} color="blue" />
        <ResourceBar label="SP" current={stamina} max={maxStamina} color="green" />
      </div>
    </div>
  );
}

function ResourceBar({
  label,
  current,
  max,
  color,
}: {
  label: string;
  current: number;
  max: number;
  color: string;
}) {
  const percent = max > 0 ? (current / max) * 100 : 0;

  return (
    <div className="flex items-center gap-2">
      <span className="w-6 text-xs font-bold text-slate-400">{label}</span>
      <div className="flex-1 h-3 bg-slate-700 rounded-full overflow-hidden">
        <motion.div
          className={cn('h-full', `bg-${color}-500`)}
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
      <span className="w-16 text-xs text-right text-slate-400">
        {Math.floor(current)}/{max}
      </span>
    </div>
  );
}
