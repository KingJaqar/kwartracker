import { requireOptionalNativeModule } from 'expo-modules-core';

export type HapticEvent = 'key' | 'success' | 'error' | 'warning';
// SDK 57 ExpoHaptics native contract; no package wrapper is loaded in clients missing it.
type HapticEngine = { impactAsync: (style: 'light') => Promise<void>; notificationAsync: (type: Exclude<HapticEvent, 'key'>) => Promise<void> };

export function haptic(event: HapticEvent) {
  // The pinned development client has no haptics module. Do not load its wrapper there.
  const engine = requireOptionalNativeModule<HapticEngine>('ExpoHaptics');
  if (!engine) return;
  const result = event === 'key' ? engine.impactAsync('light') : engine.notificationAsync(event);
  // Optional device feedback must never change financial success/failure.
  void result.catch(() => undefined);
}
