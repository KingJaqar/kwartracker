import { Stack, DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DbGate } from '@/db/db-gate';
import { LockGate } from '@/services/security/lock-gate';
import { useAppTheme } from '@/theme/provider';
import { LedgerProvider } from '@/services/ledger/provider';
import { OverlayProvider } from '@/components/ui';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  return <GestureHandlerRootView style={{ flex: 1 }}><SafeAreaProvider>
    <DbGate><LockGate><LedgerProvider><OverlayProvider><RootStack /></OverlayProvider></LedgerProvider></LockGate></DbGate>
  </SafeAreaProvider></GestureHandlerRootView>;
}

function RootStack() {
  const { appearance, colors } = useAppTheme();
  // The RN component also sends obsolete color/translucency setters on edge-to-edge Android.
  useEffect(() => { StatusBar.setStyle(appearance === 'dark' ? 'light' : 'dark'); }, [appearance]);
  const base = appearance === 'dark' ? DarkTheme : DefaultTheme;
  const theme = { ...base, colors: { ...base.colors, primary: colors.accent, background: colors.bg, card: colors.surface1, text: colors.textPrimary, border: colors.divider, notification: colors.warning } };
  return <ThemeProvider value={theme}>
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}><Stack.Screen name="(tabs)" /></Stack>
  </ThemeProvider>;
}
