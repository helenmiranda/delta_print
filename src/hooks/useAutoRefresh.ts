import { useEffect, useRef } from 'react';

const INTERVAL_MS = 60_000;

export function useAutoRefresh(callback: () => void) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const tick = () => {
      if (!document.hidden) {
        callbackRef.current();
      }
    };

    const interval = setInterval(tick, INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        callbackRef.current();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
}
