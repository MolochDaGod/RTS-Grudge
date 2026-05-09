import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  RACES, CLASSES, buildCharacter, type RaceDef, type ClassDef, type CharacterConfig,
} from './CharacterConfig';
import { CharacterPreviewScene } from './preview/CharacterPreviewScene';

const B = import.meta.env.BASE_URL.replace(/\/$/, '');
const ui = (name: string) => `${B}/ui/${name}`;

interface Props {
  onSelect: (config: CharacterConfig) => void;
  onBack:   () => void;
}

type Step = 'race' | 'class' | 'confirm';

export function RaceClassSelect({ onSelect, onBack }: Props) {
  const [step,    setStep]    = useState<Step>('race');
  const [raceId,  setRaceId]  = useState<string>(RACES[0].id);
  const [classId, setClassId] = useState<string>(CLASSES[0].id);
  // Per-race loadouts captured live from the previewer. Survives race
  // switches so swapping back-and-forth doesn't wipe earlier picks.
  const [loadouts, setLoadouts] = useState<Record<string, Record<string, string[]>>>({});

  const race  = useMemo(() => RACES.find(r => r.id === raceId)   ?? RACES[0],   [raceId]);
  const klass = useMemo(() => CLASSES.find(c => c.id === classId) ?? CLASSES[0], [classId]);
  const built = useMemo(() => buildCharacter(raceId, classId),                   [raceId, classId]);

  // Stable callback so the previewer's effect doesn't fire infinitely.
  // Uses a ref-style closure on `raceId` via functional setState.
  const onLoadoutChange = useCallback((loadout: Record<string, string[]>) => {
    setLoadouts(prev => ({ ...prev, [raceId]: loadout }));
  }, [raceId]);

  // Build the final config: stamp UUID + freeze the user's loadout pick.
  const finalize = (): CharacterConfig => ({
    ...built,
    uuid: (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `char_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    loadout: loadouts[raceId],
  });

  return (
    <div style={{
      width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden',
      fontFamily: "'Cinzel', serif", color: '#c8b89a',
      background: 'linear-gradient(to bottom, #050714 0%, #0a0812 40%, #1a100c 80%, #050302 100%)',
    }}>
      <div style={{ position: 'absolute', inset: 0, opacity: 0.18, backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '4px 4px', mixBlendMode: 'overlay', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: 0, backgroundImage: `url('${ui('BigPanel.jpg')}')`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.06, pointerEvents: 'none' }} />

      {/* Top bar */}
      <div style={{ position: 'relative', zIndex: 5, padding: '24px 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="font-decorative" style={{ fontSize: 11, letterSpacing: '0.5em', color: '#7a6f62', textTransform: 'uppercase' }}>
          {step === 'race' ? '· Step 1 / 3 · Forge Bloodline' : step === 'class' ? '· Step 2 / 3 · Choose Path' : '· Step 3 / 3 · Enter the Rift'}
        </div>
        <button onClick={onBack} style={{ background: 'none', border: '1px solid #2a2018', padding: '8px 18px', color: '#7a6f62', fontFamily: 'inherit', letterSpacing: '0.25em', textTransform: 'uppercase', fontSize: 11, cursor: 'pointer', borderRadius: 3 }}>← Title</button>
      </div>

      {/* Persistent "currently building" banner — visible at every step */}
      <div style={{
        position: 'relative', zIndex: 5, margin: '4px auto 0', maxWidth: 720,
        padding: '8px 22px', background: 'rgba(8,6,12,0.7)',
        border: `1px solid ${klass.accentColor}55`, borderRadius: 3,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18,
      }}>
        <span style={{ fontSize: 10, letterSpacing: '0.35em', color: '#7a6f62', textTransform: 'uppercase' }}>Currently Building</span>
        <span className="font-decorative" style={{ fontSize: 16, color: race.accentColor, letterSpacing: '0.18em', textTransform: 'uppercase' }}>{race.name}</span>
        <span style={{ color: '#5a5048' }}>·</span>
        <span className="font-decorative" style={{ fontSize: 16, color: klass.accentColor, letterSpacing: '0.18em', textTransform: 'uppercase' }}>{klass.name}</span>
      </div>

      {/* Title */}
      <div style={{ position: 'relative', zIndex: 5, textAlign: 'center', marginTop: 8 }}>
        <div className="font-decorative" style={{
          fontSize: 56, fontWeight: 900, letterSpacing: '0.15em',
          background: 'linear-gradient(to bottom, #f2e6d0 0%, #bda871 40%, #7a6336 80%, #3a2a12 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.7))',
        }}>
          {step === 'race' ? 'CHOOSE YOUR RACE' : step === 'class' ? 'CHOOSE YOUR CLASS' : 'FORGING YOUR CHAMPION'}
        </div>
        <div style={{ width: 200, height: 2, background: 'linear-gradient(to right, transparent, rgba(189,168,113,0.7), transparent)', margin: '14px auto 0' }} />
      </div>

      {/* Step content */}
      <div style={{ position: 'relative', zIndex: 5, padding: '36px 48px 24px', display: 'flex', justifyContent: 'center' }}>
        {step === 'race'  && <RaceStep    race={race} selectedId={raceId} onPick={setRaceId} onLoadoutChange={onLoadoutChange} initialLoadout={loadouts[race.id]} />}
        {step === 'class' && (
          <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start' }}>
            <div>
              <div className="font-decorative" style={{ fontSize: 11, letterSpacing: '0.4em', color: '#7a6f62', textTransform: 'uppercase', marginBottom: 8, textAlign: 'center' }}>
                ⚔ Your Champion
              </div>
              {/* Read-only preview of the character forged in step 1 — no slot
               *  edits, the loadout is locked in. */}
              <CharacterPreviewScene
                raceId={race.id}
                tint={race.color}
                width={320}
                height={460}
                initialLoadout={loadouts[race.id]}
                readOnly
              />
            </div>
            <ClassGrid selectedId={classId} onPick={setClassId} race={race} />
          </div>
        )}
        {step === 'confirm' && (
          <LoadingStep
            race={race}
            klass={klass}
            built={built}
            onReady={() => onSelect(finalize())}
            onBack={() => setStep('class')}
          />
        )}
      </div>

      {/* Footer / nav */}
      <div style={{ position: 'absolute', bottom: 32, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 16, zIndex: 5 }}>
        {step === 'class' && (
          <NavButton onClick={() => setStep('race')} variant="secondary">← Back</NavButton>
        )}
        {step === 'race' && (
          <NavButton onClick={() => setStep('class')} variant="primary">Confirm Race →</NavButton>
        )}
        {step === 'class' && (
          <NavButton onClick={() => setStep('confirm')} variant="primary">Confirm Class →</NavButton>
        )}
        {/* Step 3 has no buttons — it auto-advances when the GLB preload
         *  resolves. Title-bar "← Title" still escapes if needed. */}
      </div>
    </div>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────────────

function RaceStep({ race, selectedId, onPick, onLoadoutChange, initialLoadout }: { race: RaceDef; selectedId: string; onPick: (id: string) => void; onLoadoutChange: (loadout: Record<string, string[]>) => void; initialLoadout?: Record<string, string[]> }) {
  return (
    <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start' }}>
      {/* Live 3D preview + loadout editor for the highlighted race */}
      <div>
        <div className="font-decorative" style={{ fontSize: 11, letterSpacing: '0.4em', color: '#7a6f62', textTransform: 'uppercase', marginBottom: 8, textAlign: 'center' }}>
          ⚔ {race.name} · Loadout Forge
        </div>
        <CharacterPreviewScene raceId={race.id} tint={race.color} width={360} height={500} onSelectionChange={onLoadoutChange} initialLoadout={initialLoadout} />
        <div style={{
          marginTop: 8, padding: '8px 12px', background: 'rgba(8,6,12,0.7)',
          border: `1px solid ${race.accentColor}44`, borderRadius: 3,
          fontSize: 10, color: race.accentColor, letterSpacing: '0.04em', textAlign: 'center',
        }}>
          ✦ {race.passive}
        </div>
      </div>

      {/* Race grid (2x3) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 240px)', gap: 14, alignContent: 'start' }}>
        {RACES.map(r => (
          <Card key={r.id} active={r.id === selectedId} accent={r.accentColor} onClick={() => onPick(r.id)}>
            <div className="font-decorative" style={{ fontSize: 20, color: r.accentColor, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{r.name}</div>
            <div style={{ fontSize: 9, letterSpacing: '0.3em', color: '#7a6f62', textTransform: 'uppercase', marginTop: 2 }}>{r.subtitle}</div>
            <div style={{ fontSize: 11, color: '#a8a090', lineHeight: 1.5, marginTop: 8, minHeight: 44 }}>{r.description}</div>
            <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 10px', fontSize: 10, color: '#9a8f80' }}>
              <span>HP {r.base.health}</span><span>SP {r.base.stamina}</span>
              <span>SPD {r.base.speed.toFixed(1)}</span><span>DMG {r.base.damage}</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ClassGrid({ selectedId, onPick, race }: { selectedId: string; onPick: (id: string) => void; race: RaceDef }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 240px)', gap: 16, maxWidth: 1040 }}>
      {CLASSES.map(c => {
        const final = buildCharacter(race.id, c.id);
        return (
          <Card key={c.id} active={c.id === selectedId} accent={c.accentColor} onClick={() => onPick(c.id)}>
            <div className="font-decorative" style={{ fontSize: 22, color: c.accentColor, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{c.name}</div>
            <div style={{ fontSize: 10, letterSpacing: '0.3em', color: '#7a6f62', textTransform: 'uppercase', marginTop: 2 }}>{c.subtitle}</div>
            <div style={{ fontSize: 12, color: '#a8a090', lineHeight: 1.5, marginTop: 12, minHeight: 64 }}>{c.description}</div>
            <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: 10, color: '#9a8f80' }}>
              <span>HP {final.maxHealth}</span><span>SP {final.maxStamina}</span>
              <span>SPD {final.speed.toFixed(1)}</span><span>DMG {final.damage}</span>
            </div>
            <div style={{ marginTop: 10, padding: '6px 10px', background: 'rgba(0,0,0,0.4)', border: '1px solid #2a2018', borderRadius: 3, fontSize: 10, color: '#a8956d', letterSpacing: '0.04em' }}>
              ⚒ {c.startingGear}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function ConfirmCard({ race, klass, built }: { race: RaceDef; klass: ClassDef; built: CharacterConfig }) {
  return (
    <div style={{
      width: 720, padding: '28px 36px', background: 'rgba(8,6,12,0.85)',
      border: `2px solid ${klass.accentColor}88`, borderRadius: 4,
      boxShadow: `0 0 60px ${klass.accentColor}33, 0 20px 40px rgba(0,0,0,0.7)`,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', borderBottom: '1px solid #2a2018', paddingBottom: 14, marginBottom: 18 }}>
        <div>
          <div className="font-decorative" style={{ fontSize: 30, color: '#f2e6d0', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{built.name}</div>
          <div style={{ fontSize: 11, letterSpacing: '0.35em', color: '#7a6f62', textTransform: 'uppercase', marginTop: 4 }}>{built.subtitle}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, letterSpacing: '0.3em', color: '#5a5048', textTransform: 'uppercase' }}>Bloodline · {race.name}</div>
          <div style={{ fontSize: 10, letterSpacing: '0.3em', color: '#5a5048', textTransform: 'uppercase' }}>Path · {klass.name}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 18 }}>
        <Stat label="HP"  v={built.maxHealth}  color={klass.accentColor} />
        <Stat label="SP"  v={built.maxStamina} color={klass.accentColor} />
        <Stat label="SPD" v={Number(built.speed.toFixed(1))} color={klass.accentColor} />
        <Stat label="DMG" v={built.damage}    color={klass.accentColor} />
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, letterSpacing: '0.3em', color: '#7a6f62', textTransform: 'uppercase', marginBottom: 6 }}>Skill Bar (1 — 5)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
          {klass.startingSkills.map((s, i) => (
            <div key={i} style={{ padding: '10px 8px', background: 'rgba(0,0,0,0.45)', border: '1px solid #3a3028', borderRadius: 3, textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: klass.accentColor, fontWeight: 700, fontFamily: 'sans-serif' }}>{i + 1}</div>
              <div style={{ fontSize: 11, color: '#c8b89a', marginTop: 4 }}>{s}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '10px 12px', background: 'rgba(0,0,0,0.4)', border: '1px solid #2a2018', borderRadius: 3, fontSize: 11, color: '#a8956d' }}>
        <span style={{ color: '#7a6f62' }}>STARTING GEAR · </span>{klass.startingGear}
      </div>
      <div style={{ marginTop: 8, padding: '10px 12px', background: 'rgba(0,0,0,0.4)', border: `1px solid ${race.accentColor}44`, borderRadius: 3, fontSize: 11, color: race.accentColor }}>
        <span style={{ color: '#7a6f62' }}>RACE PASSIVE · </span>{race.passive}
      </div>
    </div>
  );
}

/**
 * Step 3: pre-loads the chosen race's GLB into the GLTFLoader cache and shows
 * an animated "forging" progress bar. When both the network preload AND the
 * minimum hold-time elapse, auto-fires `onReady()` to enter the game.  The
 * cached GLB then resolves instantly when ToonCharacter pulls it in-engine,
 * so model + skeleton are in memory and ready to bind the moment the player
 * spawns.
 */
function LoadingStep({ race, klass, built, onReady, onBack }: { race: RaceDef; klass: ClassDef; built: CharacterConfig; onReady: () => void; onBack: () => void }) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Mirror the latest status into a ref so the rAF loop (which captures only
  // its initial closure) can read the live value without re-binding.
  const statusRef = useRef<'loading' | 'ready' | 'error'>('loading');
  useEffect(() => { statusRef.current = status; }, [status]);

  // Stash the latest onReady in a ref so the preload effect doesn't re-run
  // (and re-fetch the GLB) every time the parent re-renders with a fresh
  // inline arrow callback.
  const onReadyRef = useRef(onReady);
  useEffect(() => { onReadyRef.current = onReady; }, [onReady]);

  useEffect(() => {
    // Important: race.id (e.g. 'human','dwarf','undead') matches the on-disk
    // GLB filename. race.modelKey (e.g. 'wk','brb','ud') is a ModelLoader
    // alias and does NOT correspond to a file — using it would 404. The
    // in-engine ModelLoader resolves URLs via `${b}/models/toon_rts/characters/${raceId}.glb`
    // too, so this preload populates the browser's HTTP cache for the same URL.
    const url = `${B}/models/toon_rts/characters/${race.id}.glb`;
    const startedAt = performance.now();
    const minHoldMs = 1200; // floor so the progress bar feels intentional

    let disposed = false;
    let raf = 0;
    const handoffTimers: number[] = [];
    let firedReady = false;

    // Drive the progress bar toward a moving ceiling that depends on live
    // status (90% while loading, 100% once ready, frozen at last value on
    // error). Reads status via ref so the loop sees fresh state without
    // restarting the effect.
    const loop = () => {
      if (disposed) return;
      const live = statusRef.current;
      if (live === 'error') {
        // Stop animating; the error UI takes over.
        return;
      }
      const ceiling = live === 'ready' ? 100 : 90;
      let reached = false;
      setProgress(p => {
        const next = Math.min(ceiling, p + (ceiling - p) * 0.06 + 0.15);
        if (live === 'ready' && next >= 99.5) reached = true;
        return next;
      });
      if (live === 'ready' && reached) return; // bar is full, stop the loop
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const loader = new GLTFLoader();
    loader.loadAsync(url).then(() => {
      if (disposed) return;
      const wait = Math.max(0, minHoldMs - (performance.now() - startedAt));
      handoffTimers.push(window.setTimeout(() => {
        if (disposed) return;
        setStatus('ready');     // ref flips on next render via the mirror effect
        statusRef.current = 'ready';
        // Snap the bar to full and hand off shortly after so the UI paints
        // the completed progress before the page swaps.
        setProgress(100);
        handoffTimers.push(window.setTimeout(() => {
          if (disposed || firedReady) return;
          firedReady = true;
          onReadyRef.current();
        }, 320));
      }, wait));
    }).catch(err => {
      if (disposed) return;
      console.error('[LoadingStep] preload failed:', err);
      setStatus('error');
      statusRef.current = 'error';
      setErrorMsg(String(err?.message ?? err));
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      for (const t of handoffTimers) window.clearTimeout(t);
    };
    // Re-run only if the race actually changes (e.g. user back-navigates and
    // re-enters with a different bloodline). onReady is read via a ref so a
    // fresh inline arrow from the parent doesn't restart the GLB fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [race.id]);

  return (
    <div style={{
      width: 720, padding: '36px 44px', background: 'rgba(8,6,12,0.85)',
      border: `2px solid ${klass.accentColor}88`, borderRadius: 4,
      boxShadow: `0 0 60px ${klass.accentColor}33, 0 20px 40px rgba(0,0,0,0.7)`,
      textAlign: 'center',
    }}>
      <div className="font-decorative" style={{ fontSize: 30, color: '#f2e6d0', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{built.name}</div>
      <div style={{ fontSize: 11, letterSpacing: '0.35em', color: '#7a6f62', textTransform: 'uppercase', marginTop: 6 }}>{built.subtitle}</div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 22, fontSize: 11, color: '#9a8f80', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
        <span>HP {built.maxHealth}</span>
        <span style={{ color: '#5a5048' }}>·</span>
        <span>SP {built.maxStamina}</span>
        <span style={{ color: '#5a5048' }}>·</span>
        <span>SPD {built.speed.toFixed(1)}</span>
        <span style={{ color: '#5a5048' }}>·</span>
        <span>DMG {built.damage}</span>
      </div>

      <div style={{ marginTop: 32, fontSize: 11, letterSpacing: '0.35em', color: status === 'error' ? '#cc4444' : '#bda871', textTransform: 'uppercase' }}>
        {status === 'error' ? '✦ Forge Failed' : status === 'ready' ? '✦ Champion Ready · Entering the Rift' : '✦ Forging Champion · Binding Skeleton'}
      </div>

      {/* Progress bar */}
      <div style={{ marginTop: 14, height: 8, background: 'rgba(0,0,0,0.5)', border: '1px solid #2a2018', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          width: `${progress}%`, height: '100%',
          background: status === 'error'
            ? 'linear-gradient(to right, #663333, #cc4444)'
            : `linear-gradient(to right, ${klass.accentColor}88, ${klass.accentColor})`,
          boxShadow: `0 0 12px ${status === 'error' ? '#cc4444' : klass.accentColor}aa`,
          transition: 'width 0.12s linear',
        }} />
      </div>

      <div style={{ marginTop: 10, fontSize: 10, letterSpacing: '0.25em', color: '#5a5048', textTransform: 'uppercase' }}>
        {status === 'error' ? (errorMsg ?? 'unknown error') : `Loading ${race.id}.glb · ${Math.round(progress)}%`}
      </div>

      <div style={{ marginTop: 22, padding: '10px 14px', background: 'rgba(0,0,0,0.4)', border: `1px solid ${race.accentColor}44`, borderRadius: 3, fontSize: 11, color: race.accentColor, letterSpacing: '0.04em' }}>
        <span style={{ color: '#7a6f62' }}>RACE PASSIVE · </span>{race.passive}
      </div>

      {/* Recovery / cancel: always available so the user is never trapped on
       *  this step. On error this is the only way out (we don't auto-advance
       *  on a failed preload); during loading it's a graceful cancel. */}
      {status !== 'ready' && (
        <div style={{ marginTop: 22, display: 'flex', justifyContent: 'center' }}>
          <button onClick={onBack} style={{
            cursor: 'pointer', padding: '10px 22px',
            background: 'rgba(8,6,12,0.6)', border: '1px solid #2a2018',
            color: status === 'error' ? '#cc8888' : '#7a6f62',
            fontFamily: 'inherit', letterSpacing: '0.3em', textTransform: 'uppercase', fontSize: 11,
            borderRadius: 3,
          }}>← {status === 'error' ? 'Back to Class Select' : 'Cancel'}</button>
        </div>
      )}
    </div>
  );
}

function Stat({ label, v, color }: { label: string; v: number; color: string }) {
  return (
    <div style={{ padding: '10px 12px', background: 'rgba(0,0,0,0.45)', border: '1px solid #2a2018', borderRadius: 3, textAlign: 'center' }}>
      <div style={{ fontSize: 9, letterSpacing: '0.3em', color: '#7a6f62', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 22, color, fontWeight: 700, marginTop: 2, fontFamily: "'Cinzel', serif" }}>{v}</div>
    </div>
  );
}

function Card({ active, accent, onClick, children }: { active: boolean; accent: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      textAlign: 'left', cursor: 'pointer',
      padding: '18px 20px',
      background: active ? `linear-gradient(180deg, ${accent}22 0%, rgba(8,6,12,0.85) 100%)` : 'rgba(8,6,12,0.7)',
      border: `2px solid ${active ? accent : '#2a2018'}`,
      borderRadius: 4,
      boxShadow: active ? `0 0 24px ${accent}55, 0 8px 24px rgba(0,0,0,0.6)` : '0 4px 12px rgba(0,0,0,0.4)',
      transform: active ? 'translateY(-2px)' : 'translateY(0)',
      transition: 'transform 0.15s, box-shadow 0.2s, border-color 0.2s, background 0.2s',
      color: 'inherit', fontFamily: 'inherit',
    }}>
      {children}
    </button>
  );
}

function NavButton({ onClick, variant, children }: { onClick: () => void; variant: 'primary' | 'secondary'; children: React.ReactNode }) {
  const primary = variant === 'primary';
  return (
    <button onClick={onClick} style={{
      position: 'relative', overflow: 'hidden', cursor: 'pointer',
      padding: primary ? '16px 56px' : '12px 32px',
      backgroundImage: primary ? `url('${ui('Button01.png')}')` : 'none',
      backgroundSize: 'cover', backgroundPosition: 'center',
      background: primary ? undefined : 'rgba(8,6,12,0.6)',
      border: `2px solid ${primary ? '#4a3a2a' : '#2a2018'}`,
      boxShadow: primary ? '0 10px 30px rgba(0,0,0,0.8)' : 'none',
      borderRadius: 3,
      transition: 'transform 0.15s',
    }}
    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}>
      {primary && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} />}
      <span className="font-decorative" style={{ position: 'relative', color: primary ? '#bda871' : '#7a6f62', fontSize: primary ? 16 : 12, letterSpacing: '0.35em', textTransform: 'uppercase', textShadow: primary ? '0 2px 4px #000' : 'none' }}>
        {children}
      </span>
    </button>
  );
}
