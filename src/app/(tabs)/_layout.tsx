import { Tabs } from 'expo-router/js-tabs';
import { DrawerEdge, LedgerTabBar } from '@/components/ledger-shell';

export { RouteFailure as ErrorBoundary } from '@/components/ledger-shell';
// Tabs are preloaded at idle by LedgerTabBar and stay live while hidden (no freeze), so neither a first visit nor the first
// visit after an appearance change re-renders a whole screen at once; hidden tabs reload data only when focused.
export default function TabLayout() {
  return <><Tabs tabBar={props => <LedgerTabBar {...props} />} screenOptions={{ headerShown: false, animation: 'none', freezeOnBlur: false, lazy: true }}>
    <Tabs.Screen name="index" options={{ title: 'Records' }} />
    <Tabs.Screen name="analysis" options={{ title: 'Analysis' }} />
    <Tabs.Screen name="budgets" options={{ title: 'Budgets' }} />
    <Tabs.Screen name="accounts" options={{ title: 'Accounts' }} />
    <Tabs.Screen name="categories" options={{ title: 'Categories' }} />
  </Tabs><DrawerEdge /></>;
}
