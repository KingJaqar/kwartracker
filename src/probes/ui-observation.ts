type ObservedEntry = { name: string; type: string; start: number; duration: number };

/** RN0.86 public Performance Timeline API; no polling, logging, or observer outside an explicit sample. */
export function beginUiObservation() {
  if (typeof PerformanceObserver !== 'function' || !['event', 'longtask'].every(type => PerformanceObserver.supportedEntryTypes.includes(type))) throw new Error('Required performance entry types unavailable');
  const started = performance.now();
  const entries: ObservedEntry[] = [];
  let dropped = 0;
  let overflow = 0;
  let invalid = 0;
  let stopped = false;
  function collect(values: PerformanceEntry[]) {
    for (const entry of values) {
      if (entry.startTime < started || !['event', 'longtask'].includes(entry.entryType)) continue;
      if (!Number.isFinite(entry.duration) || entry.duration < 0) { invalid++; continue; }
      if (entries.length >= 500) { overflow++; continue; }
      entries.push({ name: entry.name, type: entry.entryType, start: entry.startTime, duration: entry.duration });
    }
  }
  const receive = (list: PerformanceObserverEntryList, _observer: PerformanceObserver, options?: { droppedEntriesCount: number }) => {
    collect(list.getEntries()); dropped += options?.droppedEntriesCount ?? 0;
  };
  const eventObserver = new PerformanceObserver(receive);
  const taskObserver = new PerformanceObserver(receive);
  const disconnect = () => { eventObserver.disconnect(); taskObserver.disconnect(); };
  try {
    // RN0.86 stores one threshold per observer. A second observe() without an
    // explicit threshold resets it to 104ms, hiding normal responsive events.
    const eventOptions: PerformanceObserverInit & { durationThreshold: number } = { type: 'event', durationThreshold: 0 };
    eventObserver.observe(eventOptions);
    taskObserver.observe({ type: 'longtask' });
  } catch (error) { disconnect(); throw error; }
  return {
    stop() {
      if (stopped) throw new Error('Observation already stopped');
      stopped = true;
      try { collect(eventObserver.takeRecords()); collect(taskObserver.takeRecords()); } finally { disconnect(); }
      const durations = entries.filter(entry => entry.type === 'event').map(entry => entry.duration).sort((a, b) => a - b);
      const tasks = entries.filter(entry => entry.type === 'longtask');
      return {
        milliseconds: performance.now() - started, development: __DEV__,
        eventThresholdMs: 0, events: durations.length, dropped, overflow, invalid,
        conservativeEventP95Ms: durations.length ? durations[Math.ceil(durations.length * 0.95) - 1] : null,
        tasksAbove50ms: tasks.filter(entry => entry.duration > 50).length,
        maximumLongTaskMs: tasks.length ? Math.max(...tasks.map(entry => entry.duration)) : null,
        valid: dropped === 0 && overflow === 0 && invalid === 0 && durations.length > 0,
        frames: 'Use the same-window Android frame trace; JS event/task observations do not measure UI frame rate.',
        entries,
      };
    },
    disconnect() { if (!stopped) { stopped = true; disconnect(); } },
  };
}
