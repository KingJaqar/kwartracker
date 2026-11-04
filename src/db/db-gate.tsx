import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { FoundationScreen, AppText } from '@/components/foundation-screen';
import { AppearanceProvider, useAppTheme } from '@/theme/provider';
import { metrics, radius, spacing } from '@/theme/tokens';
import { errorMessage } from '@/domain/errors';
import { openAppDatabase, type OpenDatabase } from './native';

const DatabaseContext = createContext<OpenDatabase | null>(null);
export function useDatabase() {
  const context = useContext(DatabaseContext);
  if (!context) throw new Error('Database provider is unavailable.');
  return context.coordinator;
}

type GateState = { status: 'loading' } | { status: 'ready'; value: OpenDatabase } | { status: 'error'; error: unknown };
export function DbGate({ children, open = openAppDatabase }: PropsWithChildren<{ open?: typeof openAppDatabase }>) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<GateState>({ status: 'loading' });
  useEffect(() => {
    let active = true;
    open(attempt > 0).then(value => {
      if (active) setState({ status: 'ready', value });
    }, (error: unknown) => {
      if (active) setState({ status: 'error', error });
    });
    return () => { active = false; };
  }, [attempt, open]);
  useEffect(() => {
    if (state.status !== 'loading') SplashScreen.hideAsync().catch(() => undefined);
  }, [state.status]);
  if (state.status === 'loading') return null;
  if (state.status === 'error') return <GateFailure message={errorMessage(state.error)} retry={() => { setState({ status: 'loading' }); setAttempt(value => value + 1); }} />;
  return <DatabaseContext.Provider value={state.value}>
    <AppearanceProvider uiMode={state.value.uiMode}>{children}</AppearanceProvider>
  </DatabaseContext.Provider>;
}

function GateFailure({ message, retry }: { message: string; retry: () => void }) {
  const { colors } = useAppTheme();
  return <FoundationScreen title="Your data is protected" message={message}>
    <Pressable accessibilityRole="button" onPress={retry} style={[styles.retry, { backgroundColor: colors.surface2, borderColor: colors.controlBorder }]}>
      <AppText>Try again</AppText>
    </Pressable>
  </FoundationScreen>;
}
const styles = StyleSheet.create({ retry: { minHeight: metrics.minTouch, minWidth: metrics.minTouch, borderWidth: metrics.hairline, borderRadius: radius.rMd, padding: spacing.s3, justifyContent: 'center' } });
