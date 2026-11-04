import { useEffect } from 'react';
import { BackHandler } from 'react-native';
import { router } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useOverlay } from '@/components/ui';

export function goBack() { if (router.canGoBack()) router.back(); else router.replace('/'); }

export function useSaveNavigationGuard(pending: boolean) {
  usePreventRemove(pending, () => undefined);
  useOverlayWriteGuard(pending);
}

export function useOverlayWriteGuard(pending: boolean) {
  const { lock } = useOverlay();
  useEffect(() => {
    lock(pending);
    const listener = BackHandler.addEventListener('hardwareBackPress', () => pending);
    return () => { listener.remove(); lock(false); };
  }, [pending, lock]);
}
