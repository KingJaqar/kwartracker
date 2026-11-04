import { createContext, startTransition, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { useFocusEffect } from 'expo-router';
import { uuid } from 'expo-modules-core';
import { useDatabase } from '@/db/db-gate';
import { LedgerRepository } from '@/repositories/ledger';
import type { PreferencesPortable } from '@/domain/portable';
import { AppearanceProvider } from '@/theme/provider';
import { FoundationScreen, AppText } from '@/components/foundation-screen';
import { errorMessage } from '@/domain/errors';
import { Pressable, View } from 'react-native';
import { metrics, spacing } from '@/theme/tokens';

class Changes {
  private listeners = new Set<() => void>();
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  publish = () => { for (const listener of this.listeners) listener(); };
}
type LedgerServices = { repository: LedgerRepository; changes: Changes };
const LedgerContext = createContext<LedgerServices | null>(null);
const PreferencesContext = createContext<PreferencesPortable | null>(null);

export function LedgerProvider({ children }: PropsWithChildren) {
  const coordinator = useDatabase();
  const services = useMemo(() => ({ repository: new LedgerRepository(coordinator), changes: new Changes() }), [coordinator]);
  const [preferences, setPreferences] = useState<PreferencesPortable | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [attempt, retry] = useState(0);
  useEffect(() => {
    let active = true;
    let generation = 0;
    const load = () => {
      const current = ++generation;
      services.repository.preferences().then(next => {
        if (active && current === generation) {
          // NFR-11(c): a preference change re-renders every screen, so it lands as an interruptible transition.
          startTransition(() => setPreferences(old => old && JSON.stringify(old) === JSON.stringify(next) ? old : next)); setError(null);
        }
      }, (cause: unknown) => { if (active && current === generation) setError(cause); });
    };
    load();
    const unsubscribe = services.changes.subscribe(load);
    return () => { active = false; unsubscribe(); };
  }, [services, attempt]);
  if (!preferences) return <FoundationScreen title="Kwartracker" message={error ? errorMessage(error) : 'Opening your preferences…'}>
    {error ? <PreferenceRetry retry={() => retry(value => value + 1)} /> : null}
  </FoundationScreen>;
  return <LedgerContext.Provider value={services}><PreferencesContext.Provider value={preferences}>
    <AppearanceProvider uiMode={preferences.uiMode}><View style={{ flex: 1 }}>
      <View style={{ flex: 1, display: error ? 'none' : 'flex' }} accessibilityElementsHidden={Boolean(error)} importantForAccessibility={error ? 'no-hide-descendants' : 'auto'}>{children}</View>
      {error ? <FoundationScreen title="Preferences need a refresh" message={errorMessage(error)}><PreferenceRetry retry={() => retry(value => value + 1)} /></FoundationScreen> : null}
    </View></AppearanceProvider>
  </PreferencesContext.Provider></LedgerContext.Provider>;
}

// Keep the gate independent of the product component catalogue's own ledger consumers.
function PreferenceRetry({ retry }: { retry: () => void }) {
  return <FoundationRetry onPress={retry} />;
}
function FoundationRetry({ onPress }: { onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={{ minHeight: metrics.minTouch, padding: spacing.s3 }}><AppText>Try again</AppText></Pressable>;
}

export function useLedger() {
  const value = useContext(LedgerContext);
  if (!value) throw new Error('Ledger provider is unavailable.');
  return value;
}
export function usePreferences() {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error('Preferences provider is unavailable.');
  return value;
}
export function newId() { return uuid.v4(); }

/** A token is retained on an unchanged retry; changing a failed request starts a fresh operation. */
export function useCommandIdentity() {
  const previous = useRef<{ signature: string; token: string } | null>(null);
  const token = useCallback((input: unknown) => {
    const signature = JSON.stringify(input);
    if (previous.current?.signature !== signature) previous.current = { signature, token: newId() };
    return previous.current.token;
  }, []);
  return { token, reset: () => { previous.current = null; } };
}

export function useLedgerQuery<T>(load: () => Promise<T>) {
  const { changes } = useLedger();
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: unknown }>({ data: null, loading: true, error: null });
  const [attempt, retry] = useState(0);
  const previousLoad = useRef(load);
  // Ledger data changes only through published writes, so a refocused screen reloads only when it missed one,
  // its input changed, or its last load failed or never finished; a clean tab switch renders nothing.
  const stale = useRef(true);
  const focused = useRef(false);
  const missed = useRef(0);
  useEffect(() => changes.subscribe(() => { if (!focused.current) { stale.current = true; missed.current += 1; } }), [changes]);
  useFocusEffect(useCallback(() => {
    let active = true;
    let generation = attempt;
    let pending = false;
    focused.current = true;
    const refresh = () => {
      const current = ++generation;
      const sameInput = previousLoad.current === load;
      previousLoad.current = load;
      stale.current = false; pending = true;
      setState(old => ({ data: sameInput ? old.data : null, loading: true, error: null }));
      load().then(data => {
        // NFR-11(c): loaded rows render as a transition, which React splits into short interruptible slices.
        if (active && current === generation) { pending = false; startTransition(() => setState({ data, loading: false, error: null })); }
      }, (error: unknown) => { if (active && current === generation) { pending = false; stale.current = true; setState(old => ({ ...old, loading: false, error })); } });
    };
    if (stale.current || previousLoad.current !== load) refresh();
    const unsubscribe = changes.subscribe(refresh);
    return () => { active = false; generation++; focused.current = false; if (pending) stale.current = true; unsubscribe(); };
  }, [load, changes, attempt]));
  // A tab preloaded while hidden loads once, so its first visit shows rows that are already mounted.
  // Declared after the focus effect, which has already run (and marked `focused`) for a screen that mounts focused.
  useEffect(() => {
    if (focused.current) return;
    let active = true;
    const seen = missed.current;
    load().then(data => {
      if (!active || focused.current) return;
      previousLoad.current = load; stale.current = missed.current !== seen;
      startTransition(() => setState({ data, loading: false, error: null }));
    }, () => undefined);
    return () => { active = false; };
  }, [load]);
  return { ...state, retry: useCallback(() => { stale.current = true; retry(value => value + 1); }, []) };
}

export function useLedgerMutation() {
  const { changes } = useLedger();
  const busy = useRef(false);
  const mounted = useRef(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const run = useCallback(async (write: () => Promise<unknown>, onCommit?: () => void) => {
    if (busy.current) return false;
    busy.current = true; setPending(true); setError(null);
    try {
      await write(); changes.publish(); if (mounted.current) onCommit?.(); return true;
    } catch (cause) { if (mounted.current) setError(cause); return false; }
    finally { busy.current = false; if (mounted.current) setPending(false); }
  }, [changes]);
  return { pending, error, run, clearError: () => setError(null) };
}
