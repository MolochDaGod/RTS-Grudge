import { useEffect } from 'react';
import { redirectToCanonicalHomeIsland } from '@/lib/fleetHomeIsland';

/**
 * /island — fleet alias for the canonical home island generator.
 * Shipwreck survival mode lives at /island-v2 and /survival.
 */
export default function HomeIslandRedirect() {
  useEffect(() => {
    redirectToCanonicalHomeIsland();
  }, []);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#05060c', color: '#6bdc8b', fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🏝️</div>
      <p style={{ fontSize: 14, letterSpacing: '2px', textTransform: 'uppercase' }}>
        Opening Home Island…
      </p>
      <p style={{ fontSize: 11, color: '#555', marginTop: 8 }}>
        Redirecting to your saved island on Grudge Warlords
      </p>
    </div>
  );
}