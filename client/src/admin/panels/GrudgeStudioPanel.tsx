// Read-only Grudge Studio integration panel for the admin UI.
//
// Purpose: surface the live state of the central platform integration so the
// game-dev can sanity-check token plumbing without leaving the game. No
// writes happen here — every action is a fetch.

import { useEffect, useState, useCallback } from "react";
import { useGrudgeSession } from "@/lib/grudge/useGrudgeSession";
import { grudgeApi, GRUDGE_API_URL, GRUDGE_AUTH_URL } from "@/lib/grudge/api";

const T = {
  bg: "#0f0a06",
  border: "rgba(201,149,10,0.15)",
  gold: "#c9950a",
  goldLight: "#f0d68a",
  text: "#c9a86c",
  textMuted: "#7a6a50",
  ok: "#7ed88a",
  bad: "#e8534a",
};

interface IntegrationStatus {
  api: { url: string; ok: boolean; status?: number; error?: string };
  auth: { url: string; ok: boolean; status?: number; error?: string };
  pvp: { rooms: Array<{ matchId: string; count: number; players: any[] }> };
  flags: { jwtSecretConfigured: boolean; allowGuests: boolean };
}

export default function GrudgeStudioPanel() {
  const session = useGrudgeSession();
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [games, setGames] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [s, g] = await Promise.all([
        fetch("/api/grudge/integration-status").then((r) => r.json()),
        grudgeApi.getGames().catch((e) => ({ __err: e.message })),
      ]);
      setStatus(s);
      setGames(Array.isArray(g) ? g : (g as any)?.games ?? null);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const Row = ({ label, value, color }: { label: string; value: string; color?: string }) => (
    <div style={{ display: "flex", gap: 12, padding: "6px 0", borderBottom: `1px dashed ${T.border}` }}>
      <span style={{ color: T.textMuted, minWidth: 180, fontSize: 12 }}>{label}</span>
      <span style={{ color: color ?? T.goldLight, fontSize: 12, fontFamily: "monospace" }}>{value}</span>
    </div>
  );

  return (
    <div style={{ padding: 16, color: T.text, fontFamily: "Inter, sans-serif", overflow: "auto", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h2 style={{ color: T.goldLight, fontFamily: "Cinzel, serif", fontSize: 18, margin: 0 }}>
          Grudge Studio Integration
        </h2>
        <button onClick={refresh} disabled={loading} style={{
          background: T.gold, color: "#0a0705", border: "none",
          padding: "6px 14px", borderRadius: 4, cursor: "pointer",
          fontWeight: 700, fontSize: 12, letterSpacing: 1,
        }}>{loading ? "..." : "REFRESH"}</button>
      </div>
      {error && <div style={{ color: T.bad, marginBottom: 12 }}>error: {error}</div>}

      <section style={{ marginBottom: 20 }}>
        <h3 style={{ color: T.gold, fontSize: 13, letterSpacing: 2, margin: "0 0 8px" }}>SESSION</h3>
        <Row label="user.id" value={session.user?.id ?? "(none)"} />
        <Row label="user.role" value={session.role} color={session.isAdmin ? T.ok : T.text} />
        <Row label="initialized" value={String(session.initialized)} />
        <Row label="error" value={session.error ?? "—"} color={session.error ? T.bad : T.text} />
        <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
          {!session.user && <button onClick={session.login} style={btn(T.gold)}>LOGIN</button>}
          {session.user && <button onClick={() => session.logout()} style={btn(T.bad)}>LOGOUT</button>}
          <button onClick={() => session.refresh()} style={btn(T.goldLight, true)}>REFRESH /me</button>
        </div>
      </section>

      <section style={{ marginBottom: 20 }}>
        <h3 style={{ color: T.gold, fontSize: 13, letterSpacing: 2, margin: "0 0 8px" }}>UPSTREAM</h3>
        <Row label="VITE_GRUDGE_API_URL" value={GRUDGE_API_URL} />
        <Row label="VITE_GRUDGE_AUTH_URL" value={GRUDGE_AUTH_URL} />
        {status && (
          <>
            <Row label="api /api/health" value={status.api.ok ? `ok ${status.api.status}` : `down ${status.api.error ?? status.api.status}`} color={status.api.ok ? T.ok : T.bad} />
            <Row label="auth /api/health" value={status.auth.ok ? `ok ${status.auth.status}` : `down ${status.auth.error ?? status.auth.status}`} color={status.auth.ok ? T.ok : T.bad} />
            <Row label="server JWT secret" value={status.flags.jwtSecretConfigured ? "configured" : "not configured (network fallback)"} />
            <Row label="guest sockets" value={status.flags.allowGuests ? "ALLOWED" : "blocked"} color={status.flags.allowGuests ? T.bad : T.ok} />
          </>
        )}
      </section>

      <section style={{ marginBottom: 20 }}>
        <h3 style={{ color: T.gold, fontSize: 13, letterSpacing: 2, margin: "0 0 8px" }}>PvP ROOMS</h3>
        {!status || status.pvp.rooms.length === 0 ? (
          <div style={{ color: T.textMuted, fontSize: 12 }}>no active rooms</div>
        ) : status.pvp.rooms.map((r) => (
          <Row key={r.matchId} label={r.matchId} value={`${r.count} player(s)`} />
        ))}
      </section>

      <section>
        <h3 style={{ color: T.gold, fontSize: 13, letterSpacing: 2, margin: "0 0 8px" }}>CATALOG</h3>
        {!games ? <div style={{ color: T.textMuted, fontSize: 12 }}>loading…</div>
          : games.length === 0 ? <div style={{ color: T.textMuted, fontSize: 12 }}>(empty)</div>
          : games.slice(0, 12).map((g, i) => (
            <Row key={g.id ?? i} label={g.slug ?? g.id ?? `#${i}`} value={g.name ?? "(unnamed)"} />
          ))}
      </section>
    </div>
  );
}

function btn(color: string, ghost = false): React.CSSProperties {
  return {
    background: ghost ? "transparent" : color,
    color: ghost ? color : "#0a0705",
    border: ghost ? `1px solid ${color}` : "none",
    padding: "5px 12px", borderRadius: 4, cursor: "pointer",
    fontWeight: 700, fontSize: 11, letterSpacing: 1,
  };
}
