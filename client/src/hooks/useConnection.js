import { useCallback, useEffect, useRef, useState } from 'react';
import { getHealth } from '../api.js';

const POLL_MS = 20_000;

// Tracks whether the Express API answers /api/health. Calls onReconnect when it comes back.
export function useConnection(onReconnect) {
  const [status, setStatus] = useState('checking'); // checking | online | offline
  const previous = useRef('checking');
  const reconnectRef = useRef(onReconnect);
  reconnectRef.current = onReconnect;

  const check = useCallback(async () => {
    let next;
    try {
      await getHealth({ signal: AbortSignal.timeout(5000) });
      next = 'online';
    } catch {
      next = 'offline';
    }
    if (previous.current === 'offline' && next === 'online') reconnectRef.current?.();
    previous.current = next;
    setStatus(next);
  }, []);

  useEffect(() => {
    check();
    const id = setInterval(check, POLL_MS);
    return () => clearInterval(id);
  }, [check]);

  return { status, recheck: check };
}
