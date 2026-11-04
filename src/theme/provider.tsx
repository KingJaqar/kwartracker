import { createContext, useContext, useEffect, type PropsWithChildren } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import { colors } from './tokens';
import { resolveAppearance } from './appearance';

const AppearanceContext = createContext<unknown>('system');
export function AppearanceProvider({ uiMode, children }: PropsWithChildren<{ uiMode: unknown }>) {
  useEffect(() => {
    // Native pickers and dialogs follow the same app preference as the React surfaces.
    Appearance.setColorScheme(uiMode === 'dark' || uiMode === 'light' ? uiMode : 'unspecified');
    return () => Appearance.setColorScheme('unspecified');
  }, [uiMode]);
  return <AppearanceContext.Provider value={uiMode}>{children}</AppearanceContext.Provider>;
}
export function useAppTheme() {
  const uiMode = useContext(AppearanceContext);
  const system = useColorScheme();
  const appearance = resolveAppearance(uiMode, system);
  return { appearance, colors: colors[appearance] };
}
