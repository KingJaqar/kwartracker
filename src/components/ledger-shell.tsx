import { useCallback, useEffect, useRef, useState } from 'react';
import { router, type ErrorBoundaryProps } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from './foundation-screen';
import { BottomSheet, GhostButton, IconButton, Screen, useOverlay, ui } from './ui';
import { icons } from '@/theme/icons';
import { useAppTheme } from '@/theme/provider';
import { layout, metrics, motion, spacing } from '@/theme/tokens';

export function useDrawer() {
  const { show } = useOverlay();
  return useCallback(() => show({ title: 'Kwartracker', kind: 'drawer', content: close => <BottomSheet>
    <GhostButton label="Preferences" onPress={() => close(() => router.push('/preferences'))} />
    <GhostButton label="Data Management" onPress={() => close(() => router.push('/data'))} />
    <GhostButton label="Recurring Rules" onPress={() => close(() => router.push('/recurring-rules'))} />
    <GhostButton label="Close menu" onPress={close} />
  </BottomSheet> }), [show]);
}

export function DrawerEdge() {
  const open = useDrawer();
  const gesture = Gesture.Pan().runOnJS(true).activeOffsetX(spacing.s4).onEnd(event => { if (event.translationX > layout.sheetDismiss) open(); });
  return <GestureDetector gesture={gesture}><View style={styles.drawerEdge} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" /></GestureDetector>;
}

type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: { navigate: (name: string) => void; preload: (name: string) => void; isFocused: () => boolean; emit: (event: { type: 'tabPress'; target: string; canPreventDefault: true }) => { defaultPrevented: boolean } };
};
const tabs = {
  index: { label: 'Records', icon: icons.records }, analysis: { label: 'Analysis', icon: icons.analysis },
  budgets: { label: 'Budgets', icon: icons.budgets }, accounts: { label: 'Accounts', icon: icons.wallet }, categories: { label: 'Categories', icon: icons.categories },
};
/** NFR-11(a): the pressed tab's indicator commits first; the screen switch follows on the next frame. */
export function LedgerTabBar({ state, navigation }: TabBarProps) {
  const { colors } = useAppTheme(); const { fontScale } = useWindowDimensions(); const insets = useSafeAreaInsets();
  const [pending, setPending] = useState<{ key: string; from: number } | null>(null);
  const frame = useRef<number | null>(null);
  useEffect(() => () => { if (frame.current !== null) cancelAnimationFrame(frame.current); }, []);
  const overlay = useOverlay();
  const mounted = useRef(new Set<string>());
  const focusedKey = state.routes[state.index]?.key;
  // NFR-11(c): mount one unvisited tab per idle period, never while a sheet is open, a touch is recent or a screen covers the tabs,
  // so a first visit shows an already-built screen instead of mounting it during the tap.
  useEffect(() => {
    if (focusedKey) mounted.current.add(focusedKey);
    let idle: number | null = null; let wait: ReturnType<typeof setTimeout> | null = null;
    const step = () => {
      idle = null;
      const next = state.routes.find(route => Object.hasOwn(tabs, route.name) && !mounted.current.has(route.key));
      if (!next) return;
      if (!overlay.settled() || !navigation.isFocused()) { wait = setTimeout(() => { wait = null; idle = requestIdleCallback(step); }, motion.touchSettle); return; }
      mounted.current.add(next.key);
      navigation.preload(next.name);
      idle = requestIdleCallback(step);
    };
    idle = requestIdleCallback(step);
    return () => { if (idle !== null) cancelIdleCallback(idle); if (wait !== null) clearTimeout(wait); };
  }, [focusedKey, navigation, overlay, state.routes]);
  const activeKey = pending?.from === state.index ? pending.key : state.routes[state.index]?.key;
  return <View style={[styles.tabBar, { backgroundColor: colors.surface1, borderTopColor: colors.divider, paddingBottom: insets.bottom }]}>
    {state.routes.map(route => {
      if (!Object.hasOwn(tabs, route.name)) return null;
      const tab = tabs[route.name as keyof typeof tabs]; const selected = route.key === activeKey; const Glyph = tab.icon;
      return <Pressable key={route.key} accessibilityRole="tab" accessibilityLabel={tab.label} accessibilityState={{ selected }} style={styles.tab} onPress={() => {
        const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
        if (selected || event.defaultPrevented) return;
        setPending({ key: route.key, from: state.index });
        if (frame.current !== null) cancelAnimationFrame(frame.current);
        frame.current = requestAnimationFrame(() => { frame.current = null; navigation.navigate(route.name); });
      }}><View style={[styles.indicator, { backgroundColor: selected ? colors.accent : colors.surface1 }]} /><Glyph color={selected ? colors.accent : colors.textSecondary} size={metrics.icon} strokeWidth={metrics.iconStroke} />
        {fontScale < layout.tabIconOnlyScale ? <AppText variant="caption" style={{ color: selected ? colors.accent : colors.textSecondary }}>{tab.label}</AppText> : null}
      </Pressable>;
    })}
  </View>;
}

export function RouteFailure({ retry }: ErrorBoundaryProps) {
  const drawer = useDrawer();
  return <Screen title="Kwartracker" menu={drawer}><View style={ui.content}><AppText>This screen could not be displayed. Your saved data is kept.</AppText><GhostButton label="Try again" onPress={() => { void retry(); }} /><GhostButton label="Records" onPress={() => router.replace('/')} /></View></Screen>;
}

export function MonthSelector({ month, previous, next, select }: { month: string; previous: () => void; next: () => void; select: () => void }) {
  return <View style={ui.inline}><IconButton label="Previous month" icon="back" onPress={previous} disabled={month === '1900-01'} /><GhostButton label={month} onPress={select} /><IconButton label="Next month" icon="next" onPress={next} disabled={month === '9999-12'} /></View>;
}

const styles = StyleSheet.create({
  tabBar: { flexDirection: 'row', borderTopWidth: metrics.hairline },
  tab: { flex: 1, minHeight: layout.tabHeight, minWidth: metrics.minTouch, alignItems: 'center', justifyContent: 'center', gap: spacing.s1 },
  indicator: { height: layout.activeTabBar, width: metrics.icon },
  drawerEdge: { position: 'absolute', left: 0, top: 0, bottom: 0, width: layout.drawerEdge },
});
