import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppearanceProvider } from '@/theme/provider';

/** Isolated nonshipping prototype root. Never opens or mounts the application's financial DB. */
export default function FoundationProbeLayout() {
  return <GestureHandlerRootView style={{ flex: 1 }}><SafeAreaProvider><AppearanceProvider uiMode="system">
    <Stack screenOptions={{ headerShown: false }} />
  </AppearanceProvider></SafeAreaProvider></GestureHandlerRootView>;
}
