import { useEffect, useRef, useState } from 'react';
import { AppError, errorMessage } from '../domain/errors';

let admitted = false;

/** One admitted operation; expiry never admits overlapping native work. */
export function useFiniteProbe() {
  const [busy, setBusy] = useState(false);
  const [expired, setExpired] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState('Synthetic data only. Each action runs once, with no automatic retry.');
  const running = useRef(false);
  const cancellation = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; cancellation.current?.abort(); if (timer.current !== null) clearTimeout(timer.current); }; }, []);
  async function run(operation: (signal: AbortSignal) => Promise<unknown>, timeout: 30000 | 180000 = 30000) {
    if (running.current) return;
    if (admitted) { setResult('A previous check is still finishing. Wait for it to return before running another.'); return; }
    admitted = true;
    running.current = true;
    setBusy(true);
    setExpired(false);
    setProgress('');
    const controller = new AbortController();
    cancellation.current = controller;
    const deadline = setTimeout(() => { controller.abort(); if (mounted.current) setExpired(true); }, timeout);
    timer.current = deadline;
    try {
      const value = await operation(controller.signal);
      if (controller.signal.aborted) throw new AppError('DEADLINE_EXCEEDED');
      if (mounted.current) setResult(JSON.stringify(value, null, 2));
    } catch (error) {
      const explanation = error instanceof AppError && ['INSUFFICIENT_STORAGE', 'CANCELLED', 'DEADLINE_EXCEEDED'].includes(error.code) ? error : new AppError('PROBE_FAILED');
      if (mounted.current) setResult(errorMessage(explanation));
    } finally {
      clearTimeout(deadline); timer.current = null; admitted = false; running.current = false; cancellation.current = null;
      if (mounted.current) setBusy(false);
    }
  }
  return { busy, run, progress: (value: string) => { if (mounted.current) setProgress(value); }, display: busy ? expired ? 'This check exceeded its time limit. Controls stay paused until native work returns. You can close this test app safely.' : progress || 'Running one synthetic check…' : result };
}
