import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { useCharacterAPI } from '@/lib/characters/useCharacterAPI';
import { getPlayerId } from '@/lib/save/playerId';
import { buildLoginUrl } from '@/lib/auth/authRedirect';
import {
  confirmHomeIsland,
  fetchHomeIsland,
  openHostedHomeIsland,
  HOME_ISLAND_HOST_URL,
} from '@/lib/fleetHomeIsland';
import { saveHomeIslandSession, loadHomeIslandSession } from '@/lib/homeIslandSession';
import {
  generateHomeIslandTerrain,
  isValidCampCell,
  TERRAIN_COLORS,
} from '@/lib/homeIslandTerrain';

const FONTS = {
  title: "'MorkDungeon', 'Cinzel', serif",
  header: "'Cinzel', serif",
  body: "'Crimson Text', serif",
};

type Step = 'loading' | 'existing' | 'create' | 'confirm' | 'saving' | 'error';

const DEFAULT_WIDTH = 130;
const DEFAULT_HEIGHT = 105;
const CELL_PX = 5;

export default function HomeIslandCreatePage() {
  const [, navigate] = useLocation();
  const playerId = getPlayerId();
  const { active, status: charStatus, refresh } = useCharacterAPI(playerId);

  const [step, setStep] = useState<Step>('loading');
  const [error, setError] = useState<string | null>(null);
  const [seed, setSeed] = useState(() => Date.now() + Math.floor(Math.random() * 1e6));
  const [camp, setCamp] = useState<{ x: number; y: number } | null>(null);
  const [islandName, setIslandName] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const terrain = useMemo(
    () => generateHomeIslandTerrain(DEFAULT_WIDTH, DEFAULT_HEIGHT, seed),
    [seed],
  );

  const drawTerrain = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < DEFAULT_HEIGHT; y++) {
      for (let x = 0; x < DEFAULT_WIDTH; x++) {
        const t = terrain[y][x];
        ctx.fillStyle = TERRAIN_COLORS[t as keyof typeof TERRAIN_COLORS] ?? '#333';
        ctx.fillRect(x * CELL_PX, y * CELL_PX, CELL_PX, CELL_PX);
      }
    }
    if (camp) {
      ctx.fillStyle = '#f6c945';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(
        camp.x * CELL_PX + CELL_PX / 2,
        camp.y * CELL_PX + CELL_PX / 2,
        CELL_PX * 1.5,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.stroke();
    }
  }, [terrain, camp]);

  useEffect(() => { drawTerrain(); }, [drawTerrain]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (charStatus === 'idle') await refresh();
      if (cancelled) return;
      if (!active) {
        setStep('error');
        setError('Create a hero in Hero Forge before claiming your home island.');
        return;
      }
      setIslandName(`${active.name}'s Island`);
      try {
        const data = await fetchHomeIsland(active.character_id, playerId);
        if (cancelled) return;
        if (data.hasHomeIsland && data.island) {
          saveHomeIslandSession({
            id: data.island.id,
            seed: data.island.seed,
            name: data.island.name,
          });
          setStep('existing');
          return;
        }
        if (data.seed) setSeed(data.seed);
        setStep('create');
      } catch (e) {
        if (cancelled) return;
        const cached = loadHomeIslandSession();
        if (cached) {
          setStep('existing');
          return;
        }
        setStep('create');
        setError(e instanceof Error ? e.message : 'Could not reach island API — preview only');
      }
    })();
    return () => { cancelled = true; };
  }, [active, charStatus, playerId, refresh]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (step !== 'create') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / CELL_PX);
    const y = Math.floor((e.clientY - rect.top) / CELL_PX);
    if (!isValidCampCell(terrain, x, y)) return;
    setCamp({ x, y });
  };

  const handleReroll = () => {
    setSeed(Date.now() + Math.floor(Math.random() * 1e6));
    setCamp(null);
  };

  const handleConfirm = async () => {
    if (!active || !camp) return;
    setStep('saving');
    setError(null);
    try {
      const result = await confirmHomeIsland(
        {
          characterId: active.character_id,
          islandName,
          campPosition: camp,
          seed,
          width: DEFAULT_WIDTH,
          height: DEFAULT_HEIGHT,
        },
        playerId,
      );
      if (!result.island?.id) throw new Error('Server did not return island id');
      saveHomeIslandSession({
        id: result.island.id,
        seed: result.island.seed,
        name: result.island.name,
      });
      openHostedHomeIsland();
    } catch (e) {
      setStep('confirm');
      setError(e instanceof Error ? e.message : 'Failed to save island');
    }
  };

  const btn: React.CSSProperties = {
    padding: '10px 22px', fontSize: 12, fontWeight: 700, borderRadius: 8,
    fontFamily: FONTS.header, letterSpacing: '2px', cursor: 'pointer',
  };

  return (
    <div style={{
      minHeight: '100vh', width: '100vw',
      background: 'linear-gradient(135deg, #05060c 0%, #0a1a14 50%, #05060c 100%)',
      fontFamily: FONTS.body, color: '#fff',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
    }}>
      <nav style={{
        width: '100%', padding: '12px 20px', display: 'flex', gap: 8, alignItems: 'center',
        borderBottom: '1px solid rgba(107,220,139,.15)',
      }}>
        <button onClick={() => navigate('/home')} style={{
          ...btn, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.12)',
          color: '#9aa3c7',
        }}>← HUB</button>
        <button onClick={() => navigate('/character')} style={{
          ...btn, background: 'rgba(246,201,69,.08)', border: '1px solid rgba(246,201,69,.25)',
          color: '#f6c945',
        }}>HERO FORGE</button>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 9, color: '#555', fontFamily: 'monospace' }}>/island · create</span>
      </nav>

      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '24px', maxWidth: 720, textAlign: 'center',
      }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🏝️</div>
        <div style={{
          fontFamily: FONTS.title, fontWeight: 900, letterSpacing: '3px', fontSize: 28,
          background: 'linear-gradient(90deg,#6bdc8b,#a8f0c0 50%,#6bdc8b)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>HOME ISLAND FORGE</div>
        <p style={{ fontSize: 12, color: '#6a9a7a', marginTop: 6, marginBottom: 20, lineHeight: 1.5 }}>
          Design your island here on RTS-Grudge. After you confirm, it is saved to your Grudge UUID
          and hosted on <strong style={{ color: '#f6c945' }}>grudgewarlords.com/home-island</strong>.
        </p>

        {step === 'loading' && (
          <p style={{ color: '#6bdc8b', letterSpacing: '2px', fontSize: 11 }}>LOADING…</p>
        )}

        {step === 'existing' && (
          <div style={{
            padding: 20, borderRadius: 12, border: '1px solid rgba(246,201,69,.3)',
            background: 'rgba(246,201,69,.06)', maxWidth: 400,
          }}>
            <p style={{ fontSize: 14, marginBottom: 16 }}>
              You already have a home island linked to your account.
            </p>
            <button onClick={openHostedHomeIsland} style={{
              ...btn, width: '100%',
              background: 'linear-gradient(135deg, #2a8a4a, #1a6a3a)',
              border: '1px solid #4aaa6a', color: '#fff',
            }}>
              OPEN ON GRUDGE WARLORDS
            </button>
            <p style={{ fontSize: 10, color: '#555', marginTop: 10 }}>{HOME_ISLAND_HOST_URL}</p>
          </div>
        )}

        {(step === 'create' || step === 'confirm' || step === 'saving') && (
          <>
            <input
              value={islandName}
              onChange={e => setIslandName(e.target.value)}
              style={{
                marginBottom: 12, padding: '8px 12px', borderRadius: 6, width: '100%', maxWidth: 340,
                background: 'rgba(0,0,0,.4)', border: '1px solid rgba(107,220,139,.25)',
                color: '#fff', fontFamily: FONTS.body, fontSize: 14,
              }}
              placeholder="Island name"
            />
            <canvas
              ref={canvasRef}
              width={DEFAULT_WIDTH * CELL_PX}
              height={DEFAULT_HEIGHT * CELL_PX}
              onClick={handleCanvasClick}
              style={{
                border: '2px solid rgba(107,220,139,.35)', borderRadius: 8, cursor: 'crosshair',
                maxWidth: '100%', imageRendering: 'pixelated',
              }}
            />
            <p style={{ fontSize: 10, color: '#6a9a7a', marginTop: 8 }}>
              Click a <span style={{ color: '#6bdc8b' }}>green</span> buildable tile to place your camp.
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button onClick={handleReroll} disabled={step === 'saving'} style={{
                ...btn, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.15)',
                color: '#9aa3c7',
              }}>REROLL TERRAIN</button>
              <button
                disabled={!camp || step === 'saving'}
                onClick={() => camp && setStep('confirm')}
                style={{
                  ...btn,
                  background: camp ? 'rgba(107,220,139,.15)' : 'rgba(255,255,255,.04)',
                  border: `1px solid ${camp ? 'rgba(107,220,139,.4)' : 'rgba(255,255,255,.1)'}`,
                  color: camp ? '#6bdc8b' : '#555',
                }}
              >
                {step === 'saving' ? 'SAVING…' : 'REVIEW & CONFIRM'}
              </button>
            </div>
          </>
        )}

        {step === 'confirm' && camp && (
          <div style={{
            marginTop: 20, padding: 20, borderRadius: 12,
            border: '1px solid rgba(246,201,69,.4)', background: 'rgba(0,0,0,.35)', maxWidth: 400,
          }}>
            <p style={{ fontSize: 13, marginBottom: 12 }}>
              Claim <strong>{islandName}</strong> at camp ({camp.x}, {camp.y})?
              This saves to your Grudge account and hosts the island on Grudge Warlords.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setStep('create')} style={{
                ...btn, background: 'transparent', border: '1px solid rgba(255,255,255,.2)', color: '#9aa3c7',
              }}>BACK</button>
              <button onClick={handleConfirm} style={{
                ...btn,
                background: 'linear-gradient(135deg, #2a8a4a, #1a6a3a)',
                border: '1px solid #4aaa6a', color: '#fff',
              }}>CLAIM ISLAND</button>
            </div>
          </div>
        )}

        {step === 'error' && (
          <div style={{ maxWidth: 400 }}>
            <p style={{ color: '#ff8a7a', marginBottom: 16 }}>{error}</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => navigate('/character')} style={{
                ...btn, background: 'rgba(246,201,69,.12)', border: '1px solid rgba(246,201,69,.3)',
                color: '#f6c945',
              }}>HERO FORGE</button>
              <button onClick={() => { window.location.href = buildLoginUrl(); }} style={{
                ...btn, background: 'rgba(107,220,139,.1)', border: '1px solid rgba(107,220,139,.3)',
                color: '#6bdc8b',
              }}>SIGN IN</button>
            </div>
          </div>
        )}

        {error && step !== 'error' && (
          <p style={{ color: '#ff8a7a', fontSize: 11, marginTop: 12 }}>{error}</p>
        )}
      </div>
    </div>
  );
}