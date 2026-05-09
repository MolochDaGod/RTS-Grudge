import React from 'react';
import { SlotKey } from './classifier';

/**
 * One slot's variant chooser — a row of variant pills + an optional
 * "✕" clear button (for exclusive slots that allow "no selection").
 */
export function SlotPanel({
  slot, label, variants, selected, exclusive, bareVariant, onToggle, onClear,
}: {
  slot: SlotKey;
  label: string;
  variants: string[];
  selected: Set<string>;
  exclusive: boolean;
  bareVariant?: string | null;
  onToggle: (v: string) => void;
  onClear: () => void;
}) {
  // Head sub-panels (Face / Beard / Helmet) own their own "no selection in
  // this sub-cat" semantics, so `selected` is for highlighting only here.
  const noneActive = exclusive && selected.size === 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 9, letterSpacing: '0.3em', color: '#7a6f62', textTransform: 'uppercase', marginBottom: 4 }}>
        {label} · {variants.length}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {exclusive && (
          <button
            onClick={onClear}
            title="Hide this slot entirely"
            style={{
              fontFamily: 'inherit', cursor: 'pointer',
              padding: '4px 8px',
              background: noneActive ? '#bda87133' : 'rgba(0,0,0,0.4)',
              border: `1px dashed ${noneActive ? '#bda871' : '#3a2820'}`,
              color: noneActive ? '#f2e6d0' : '#7a6f62',
              fontSize: 11, borderRadius: 2,
              minWidth: 28, textAlign: 'center',
            }}
          >
            ✕
          </button>
        )}
        {variants.map(v => {
          const active = selected.has(v);
          const isBare = bareVariant === v;
          return (
            <button
              key={`${slot}-${v}`}
              onClick={() => onToggle(v)}
              title={isBare ? 'Closest-to-bare variant (used by Naked preset)' : undefined}
              style={{
                position: 'relative',
                fontFamily: 'inherit', cursor: 'pointer',
                padding: '4px 8px',
                background: active ? '#bda87133' : 'rgba(0,0,0,0.4)',
                border: `1px solid ${active ? '#bda871' : '#2a2018'}`,
                color: active ? '#f2e6d0' : '#9a8f80',
                fontSize: 11, borderRadius: 2,
                minWidth: 28, textAlign: 'center',
              }}
            >
              {v}
              {isBare && (
                <span
                  aria-hidden
                  style={{
                    position: 'absolute', top: 2, right: 3,
                    width: 4, height: 4, borderRadius: '50%',
                    background: '#cf9a4a', boxShadow: '0 0 3px #cf9a4a',
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export const presetBtnStyle: React.CSSProperties = {
  background: 'none', border: '1px solid #2a2018', color: '#7a6f62',
  fontSize: 9, letterSpacing: '0.25em', textTransform: 'uppercase',
  padding: '3px 8px', cursor: 'pointer', borderRadius: 2, fontFamily: 'inherit',
};

export const loadingOverlayStyle: React.CSSProperties = {
  position: 'absolute', inset: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(5,6,12,0.7)', pointerEvents: 'none',
};
