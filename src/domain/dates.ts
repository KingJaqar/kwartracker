import { AppError } from './errors.ts';
import { yieldTask } from './tasks.ts';

export function accountingDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-02' || value > '9999-12-30') throw new AppError('INVALID_DATE');
  const parsed = new Date(`${value}T12:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new AppError('INVALID_DATE');
  return value;
}

export function timeZone(value: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 100 || /^[+-]/.test(value)) throw new AppError('INVALID_TIME_ZONE');
  try { new Intl.DateTimeFormat('en', { timeZone: value }).format(0); return value; }
  catch { throw new AppError('INVALID_TIME_ZONE'); }
}

function localParts(instant: number, formatter: Intl.DateTimeFormat) {
  const parts = formatter.formatToParts(new Date(instant));
  const get = (key: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === key)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`;
}

/** Enumerate every legal minute offset, validating candidates against the device IANA database. */
function* candidateBatches(date: string, zone: string, localTime = '12:00') {
  accountingDate(date);
  timeZone(zone);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(localTime)) throw new AppError('INVALID_DATE');
  const local = `${date}T${localTime}:00`;
  const asUtc = new Date(`${local}.000Z`).getTime();
  const matches: { occurredAtUtc: string; utcOffsetMinutes: number }[] = [];
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });
  const seen = new Set<string>();
  const check = (candidate: number, offset: number) => {
    const instant = new Date(candidate).toISOString();
    if (!seen.has(instant) && localParts(candidate, formatter) === local) {
      matches.push({ occurredAtUtc: instant, utcOffsetMinutes: offset });
      seen.add(instant);
    }
  };
  // Exactly 1,681 candidates; reuse one formatter and do not assume transition spacing.
  for (let offset = -840; offset <= 840; offset++) {
    const candidate = asUtc - offset * 60_000;
    const wall = localParts(candidate, formatter);
    if (wall === local) check(candidate, offset);
    // Historical IANA offsets can include seconds. They affect occurrence time, not creation metadata.
    const observedOffset = (new Date(`${wall}.000Z`).getTime() - candidate) / 60000;
    if (!Number.isInteger(observedOffset)) check(asUtc - observedOffset * 60000, observedOffset);
    if ((offset + 841) % 64 === 0) yield;
  }
  return matches.sort((a, b) => a.occurredAtUtc.localeCompare(b.occurredAtUtc));
}

export function localTimeCandidates(date: string, zone: string, localTime = '12:00') {
  const batches = candidateBatches(date, zone, localTime);
  for (let batch = 0; batch < 27; batch++) {
    const result = batches.next();
    if (result.done) return result.value;
  }
  throw new AppError('DEADLINE_EXCEEDED');
}

/** The same exhaustive 1,681 candidates in 27 finite batches, without one large UI-thread task. */
export async function localTimeCandidatesAsync(date: string, zone: string, localTime = '12:00') {
  const batches = candidateBatches(date, zone, localTime);
  for (let batch = 0; batch < 27; batch++) {
    const result = batches.next();
    if (result.done) return result.value;
    await yieldTask();
  }
  throw new AppError('DEADLINE_EXCEEDED');
}

export function resolveAccountingTime(date: string, zone: string, localTime?: string, chosenOffsetMinutes?: number) {
  return chooseAccountingTime(date, localTimeCandidates(date, zone, localTime), chosenOffsetMinutes);
}

export async function resolveAccountingTimeAsync(date: string, zone: string, localTime?: string, chosenOffsetMinutes?: number) {
  return chooseAccountingTime(date, await localTimeCandidatesAsync(date, zone, localTime), chosenOffsetMinutes);
}

function chooseAccountingTime(date: string, candidates: { occurredAtUtc: string; utcOffsetMinutes: number }[], chosenOffsetMinutes?: number) {
  if (candidates.length === 0) throw new AppError('NONEXISTENT_LOCAL_TIME');
  if (candidates.length > 1 && chosenOffsetMinutes === undefined) throw new AppError('AMBIGUOUS_LOCAL_TIME');
  const chosen = chosenOffsetMinutes === undefined ? candidates[0] : candidates.find(candidate => candidate.utcOffsetMinutes === chosenOffsetMinutes);
  if (!chosen) throw new AppError('INVALID_DATE');
  return { accountingDate: date, ...chosen };
}

/** Capture this separately at creation; an explicit date correction must never replace it. */
export function captureCreationMetadata(createdAtUtc: string, zone: string) {
  timeZone(zone);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(createdAtUtc)) throw new AppError('INVALID_DATE');
  const instant = new Date(createdAtUtc);
  if (!Number.isFinite(instant.getTime()) || instant.toISOString() !== createdAtUtc) throw new AppError('INVALID_DATE');
  const wholeSecond = Math.floor(instant.getTime() / 1000) * 1000;
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  const offset = (new Date(`${localParts(wholeSecond, formatter)}.000Z`).getTime() - wholeSecond) / 60000;
  if (!Number.isInteger(offset) || offset < -840 || offset > 840) throw new AppError('INVALID_DATE');
  return { createdAtUtc, createdTimeZoneId: zone, createdUtcOffsetMinutes: offset };
}
