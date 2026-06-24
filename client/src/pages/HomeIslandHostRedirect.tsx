import { useEffect } from 'react';
import { openHostedHomeIsland } from '@/lib/fleetHomeIsland';

/** RTS /home-island → grudgewarlords hosted play (never loops back). */
export default function HomeIslandHostRedirect() {
  useEffect(() => {
    openHostedHomeIsland();
  }, []);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#05060c', color: '#f6c945', fontFamily: 'system-ui',
    }}>
      Opening your hosted island on Grudge Warlords…
    </div>
  );
}