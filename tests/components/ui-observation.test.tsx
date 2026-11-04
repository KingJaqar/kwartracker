import { beginUiObservation } from '../../src/probes/ui-observation';

const original = Object.getOwnPropertyDescriptor(globalThis, 'PerformanceObserver');
class SyntheticObserver {
  static supportedEntryTypes = ['event', 'longtask'];
  static instances: SyntheticObserver[] = [];
  static failTasks = false;
  type = '';
  threshold = 104;
  disconnected = false;
  records: PerformanceEntry[] = [];
  constructor() { SyntheticObserver.instances.push(this); }
  observe(options: PerformanceObserverInit & { durationThreshold?: number }) {
    this.type = options.type ?? '';
    this.threshold = options.durationThreshold ?? 104;
    if (this.type === 'longtask' && SyntheticObserver.failTasks) throw new Error('Unsupported task observation');
  }
  takeRecords() {
    return this.records.filter(entry => entry.entryType === this.type && (entry.entryType !== 'event' || entry.duration >= this.threshold));
  }
  disconnect() { this.disconnected = true; }
}
function entry(type: string, duration: number): PerformanceEntry {
  return { name: 'synthetic', entryType: type, startTime: performance.now() + 1, duration, toJSON: () => ({}) };
}
beforeEach(() => {
  SyntheticObserver.instances = [];
  SyntheticObserver.failTasks = false;
  Object.defineProperty(globalThis, 'PerformanceObserver', { configurable: true, value: SyntheticObserver });
});
afterEach(() => {
  if (original) Object.defineProperty(globalThis, 'PerformanceObserver', original);
  else Reflect.deleteProperty(globalThis, 'PerformanceObserver');
});

test('S3 records fast events independently of the native long-task default threshold', () => {
  const sample = beginUiObservation();
  for (const observer of SyntheticObserver.instances) observer.records = [entry('event', 9), entry('longtask', 61)];
  expect(sample.stop()).toMatchObject({ eventThresholdMs: 0, events: 1, conservativeEventP95Ms: 9, tasksAbove50ms: 1, valid: true });
  expect(SyntheticObserver.instances).toHaveLength(2);
  expect(SyntheticObserver.instances.every(observer => observer.disconnected)).toBe(true);
  expect(() => sample.stop()).toThrow('already stopped');
});

test('S3 disconnects both observers when setup fails and never treats an empty sample as passing', () => {
  SyntheticObserver.failTasks = true;
  expect(() => beginUiObservation()).toThrow('Unsupported task');
  expect(SyntheticObserver.instances.every(observer => observer.disconnected)).toBe(true);
  SyntheticObserver.failTasks = false;
  const empty = beginUiObservation();
  expect(empty.stop()).toMatchObject({ events: 0, conservativeEventP95Ms: null, valid: false });
});
