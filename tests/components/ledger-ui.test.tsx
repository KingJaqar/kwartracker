import { Profiler, useCallback, type Context } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Appearance, BackHandler, KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { haptic } from '../../src/services/ledger/haptics';
import { AmountDisplay, AmountKeypad, AmountState } from '../../src/components/amount-keypad';
import { GhostButton, ListRowToggle, OverlayProvider, PopButton, ScreenBoundary, TransactionRow, useOverlay } from '../../src/components/ui';
import * as iconRegistry from '../../src/theme/icons';
import { LedgerProvider, useLedgerMutation, useLedgerQuery } from '../../src/services/ledger/provider';
import { LedgerRepository } from '../../src/repositories/ledger';
import TransactionEntry from '../../src/screens/transaction';
import Preferences from '../../src/screens/preferences';
import Records, { MonthPicker } from '../../src/screens/records';
import { FlashList } from '@shopify/flash-list';
import { AppError } from '../../src/domain/errors';
import type { AccountBalance, CategoryRow, RecordsPage, TransactionInput, TransactionRow as StoredRow } from '../../src/repositories/ledger';
import type { PreferencesPortable } from '../../src/domain/portable';
import { AppearanceProvider } from '../../src/theme/provider';
import { LedgerTabBar } from '../../src/components/ledger-shell';

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
// When set, timing callbacks are held so a test can observe work before an animation finishes.
const mockHeldTimings: { callbacks: ((finished: boolean) => void)[] | null } = { callbacks: null };
jest.mock('react-native-reanimated', () => {
  const reanimated = require('react-native-reanimated/mock');
  return { ...reanimated, withTiming: (value: number, config: unknown, callback?: (finished: boolean) => void) => {
    if (callback && mockHeldTimings.callbacks) mockHeldTimings.callbacks.push(callback); else callback?.(true);
    return value;
  } };
});
jest.mock('react-native-gesture-handler', () => {
  const pan = { runOnJS: () => pan, onEnd: () => pan };
  return { Gesture: { Pan: () => pan }, GestureDetector: ({ children }: React.PropsWithChildren) => children, GestureHandlerRootView: ({ children }: React.PropsWithChildren) => children };
});
jest.mock('expo-font', () => ({ isLoaded: () => false }));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(() => Promise.resolve()), notificationAsync: jest.fn(() => Promise.resolve()), ImpactFeedbackStyle: { Light: 'light' }, NotificationFeedbackType: { Success: 'success', Error: 'error', Warning: 'warning' } }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const mockFocus = React.createContext(true);
  return { router: { canGoBack: () => false, replace: jest.fn(), dismissTo: jest.fn(), push: jest.fn(), navigate: jest.fn() }, useLocalSearchParams: jest.fn(() => ({})), Stack: { Screen: () => null }, useFocusEffect: (effect: () => void | (() => void)) => { const focused = React.useContext(mockFocus); React.useEffect(() => focused ? effect() : undefined, [effect, focused]); }, mockFocus };
});
jest.mock('expo-router/react-navigation', () => ({ usePreventRemove: jest.fn() }));
jest.mock('@react-native-community/datetimepicker', () => { throw new Error('The pinned APK has no date picker'); });
jest.mock('@shopify/flash-list', () => {
  const mockScrollToIndex = jest.fn(async () => undefined);
  return { mockScrollToIndex, FlashList: jest.fn((props: { ref?: { current: unknown } }) => {
    if (props.ref) props.ref.current = { scrollToIndex: mockScrollToIndex };
    return null;
  }) };
});
jest.mock('../../src/db/db-gate', () => { const coordinator = {}; return { useDatabase: () => coordinator }; });
jest.mock('../../src/repositories/ledger', () => ({ LedgerRepository: jest.fn() }));
jest.mock('expo-modules-core', () => { const actual = jest.requireActual<typeof import('expo-modules-core')>('expo-modules-core'); let sequence = 0; return { ...actual, requireOptionalNativeModule: jest.fn(() => ({})), uuid: { ...actual.uuid, v4: () => `10000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}` } }; });

// Jest has no idle callbacks (React Native provides them on device). Idle work is held until a test flushes it.
type IdleCallback = Parameters<typeof requestIdleCallback>[0];
const idleCallbacks = new Map<number, IdleCallback>(); let idleSequence = 0;
globalThis.requestIdleCallback = callback => { idleSequence += 1; idleCallbacks.set(idleSequence, callback); return idleSequence; };
globalThis.cancelIdleCallback = id => { idleCallbacks.delete(id); };
const flushIdle = () => { for (const [id, callback] of [...idleCallbacks]) { idleCallbacks.delete(id); callback({ didTimeout: false, timeRemaining: () => 50 }); } };

const preferences: PreferencesPortable = { currencySign: '₱', currencyPosition: 'prefix', displayDecimalPlaces: 2, notesVisibleInList: true, uiMode: 'dark', theme: 'kwartracker', dailyReminderTime: null };
const account: AccountBalance = { id: '20000000-0000-4000-8000-000000000001', name: 'Cash', icon: 'cash', isArchived: 0, openingBalanceMinor: 0, balanceMinor: 0n, createdAtUtc: '2026-11-02T00:00:00.000Z', updatedAtUtc: '2026-11-02T00:00:00.000Z' };
const category: CategoryRow = { id: '30000000-0000-4000-8000-000000000001', name: 'Food', icon: 'food', type: 'expense', isArchived: 0, createdAtUtc: account.createdAtUtc, updatedAtUtc: account.updatedAtUtc };
const fake = {
  preferences: jest.fn(async () => preferences), accounts: jest.fn(async () => [account]), categories: jest.fn(async () => [category]), latestType: jest.fn(async () => 'expense' as const), transaction: jest.fn(),
  saveTransaction: jest.fn<Promise<unknown>, [string, string, TransactionInput, boolean]>(),
  records: jest.fn<ReturnType<LedgerRepository['records']>, [string]>(),
  page: jest.fn<Promise<RecordsPage>, Parameters<LedgerRepository['page']>>(),
};
function Providers({ children }: React.PropsWithChildren) { return <LedgerProvider><OverlayProvider>{children}</OverlayProvider></LedgerProvider>; }
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useLocalSearchParams).mockReturnValue({});
  jest.mocked(requireOptionalNativeModule).mockReturnValue({ impactAsync: Haptics.impactAsync, notificationAsync: Haptics.notificationAsync });
  jest.mocked(LedgerRepository).mockImplementation(() => fake as unknown as LedgerRepository);
  fake.saveTransaction.mockResolvedValue({});
});

test('TC-105/O1: saved record on a later page is revealed without duplicate headers or loading churn', async () => {
  const savedId = '40000000-0000-4000-8000-000000000002';
  jest.mocked(useLocalSearchParams).mockReturnValue({ savedId, savedMonth: '2026-11', savedOperation: account.id });
  const row: StoredRow = {
    id: '40000000-0000-4000-8000-000000000001', idempotencyToken: account.id, type: 'expense', expenseEffect: 'purchase', amountMinor: 12345,
    accountingDate: '2026-11-03', occurredAtUtc: account.createdAtUtc, createdTimeZoneId: 'Asia/Manila', createdUtcOffsetMinutes: 480,
    note: 'Lunch', accountId: account.id, categoryId: category.id, toAccountId: null, refundOfTransactionId: null,
    originOccurrenceId: null, originKind: 'manual', originRuleTitleSnapshot: null, originScheduleSnapshot: null, originOccurrenceDate: null,
    createdAtUtc: account.createdAtUtc, updatedAtUtc: account.updatedAtUtc, accountName: 'Cash', categoryName: 'Food', categoryIcon: 'food', accountIcon: 'cash', toAccountName: null,
  };
  fake.records.mockImplementation(async month => ({ month, hasAccounts: true, page: { rows: [row], next: row }, summary: { incomeMinor: 0n, expenseMinor: 24690n, days: { [row.accountingDate]: -24690n } } }));
  let finish: (page: RecordsPage) => void = () => { throw new Error('Page not requested'); };
  fake.page.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await render(<Providers><Records /></Providers>);
  await waitFor(() => expect(FlashList).toHaveBeenCalled());
  const initial = jest.mocked(FlashList).mock.calls.at(-1)?.[0];
  expect(initial?.data).toHaveLength(2);
  const item = initial?.data?.[1];
  const display = initial?.renderItem?.({ item, index: 1, target: 'Cell' });
  expect(display?.props).toMatchObject({ amount: '−₱123.45', subtitle: 'Cash · Lunch', title: 'Food' });
  await act(async () => { initial?.onEndReached?.(); });
  const loading = jest.mocked(FlashList).mock.calls.at(-1)?.[0];
  expect(loading?.data).toBe(initial?.data); expect(loading?.renderItem).toBe(initial?.renderItem);
  await act(async () => { finish({ rows: [{ ...row, id: savedId }], next: null }); });
  expect(jest.mocked(FlashList).mock.calls.at(-1)?.[0].data).toHaveLength(3);
  await act(async () => { jest.mocked(FlashList).mock.calls.at(-1)?.[0].onLoad?.({ elapsedTimeInMs: 1 }); });
  const { mockScrollToIndex } = jest.requireMock<{ mockScrollToIndex: jest.Mock }>('@shopify/flash-list');
  await waitFor(() => expect(mockScrollToIndex).toHaveBeenCalledWith({ index: 2, animated: false, viewPosition: 0 }));
  expect(fake.page).toHaveBeenCalledTimes(1);
});

test('single-client compatibility: missing haptics admits all events without calling unavailable APIs', async () => {
  jest.mocked(requireOptionalNativeModule).mockReturnValue(null);
  await act(async () => { for (const event of ['key', 'success', 'error', 'warning'] as const) haptic(event); });
  expect(requireOptionalNativeModule).toHaveBeenCalledWith('ExpoHaptics');
  expect(Haptics.impactAsync).not.toHaveBeenCalled(); expect(Haptics.notificationAsync).not.toHaveBeenCalled();
});

test('saved-row navigation stops at an exhausted cursor and offers a query retry', async () => {
  jest.mocked(useLocalSearchParams).mockReturnValue({ savedId: account.id, savedMonth: '2026-10', savedOperation: category.id });
  fake.records.mockImplementation(async month => ({ month, hasAccounts: true, page: { rows: [], next: null }, summary: { incomeMinor: 0n, expenseMinor: 0n, days: {} } }));
  await render(<Providers><Records /></Providers>);
  expect(await screen.findByText('This record could not be brought into view.')).toBeTruthy();
  expect(fake.page).not.toHaveBeenCalled(); expect(fake.records).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(fake.records).toHaveBeenCalledTimes(2));
  expect(fake.page).not.toHaveBeenCalled();
});

test('saved-row navigation rejects malformed route targets before querying a supplied month', async () => {
  jest.mocked(useLocalSearchParams).mockReturnValue({ savedId: 'invalid', savedMonth: '2026-99', savedOperation: category.id });
  fake.records.mockImplementation(async month => ({ month, hasAccounts: false, page: { rows: [], next: null }, summary: { incomeMinor: 0n, expenseMinor: 0n, days: {} } }));
  await render(<Providers><Records /></Providers>);
  expect(await screen.findByText('Create your first account')).toBeTruthy();
  expect(fake.records).not.toHaveBeenCalledWith('2026-99'); expect(fake.page).not.toHaveBeenCalled();
});

test('single-client compatibility: rejected optional haptics never rejects a user action', async () => {
  jest.mocked(Haptics.impactAsync).mockRejectedValueOnce(new Error('Engine unavailable'));
  await act(async () => haptic('key'));
  expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
});

test('A11Y keyboard: on Android (edge-to-edge, no window resize) entry and preference forms pad above the keyboard', async () => {
  const os = jest.replaceProperty(Platform, 'OS', 'android');
  const behaviors: unknown[] = [];
  const Real = KeyboardAvoidingView;
  function Recorder(props: React.ComponentProps<typeof KeyboardAvoidingView>) { behaviors.push(props.behavior); return <Real {...props} />; }
  const spy = jest.spyOn(jest.requireActual<typeof import('react-native')>('react-native'), 'KeyboardAvoidingView', 'get').mockReturnValue(Recorder as unknown as typeof KeyboardAvoidingView);
  try {
    const entry = await render(<Providers><TransactionEntry /></Providers>);
    await screen.findByRole('button', { name: 'Cash' });
    expect(behaviors.length).toBeGreaterThan(0); expect(new Set(behaviors)).toEqual(new Set(['padding']));
    await entry.unmount(); behaviors.length = 0;
    await render(<Providers><Preferences /></Providers>);
    expect(behaviors.length).toBeGreaterThan(0); expect(new Set(behaviors)).toEqual(new Set(['padding']));
  } finally { spy.mockRestore(); os.restore(); }
});

test('TC-04: compatible date/time entry rejects impossible values, supports cancellation and submits validated civil text', async () => {
  await render(<Providers><TransactionEntry /></Providers>);
  await fireEvent.press(await screen.findByRole('button', { name: 'Cash' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Food' }));
  await fireEvent.press(screen.getByRole('button', { name: '1' }));
  await fireEvent.press(screen.getByRole('button', { name: /^\d{4}-\d{2}-\d{2}$/ }));
  expect(screen.getByRole('button', { name: 'Save' }).props.accessibilityState.disabled).toBe(true);
  await fireEvent.changeText(screen.getByLabelText('Date (YYYY-MM-DD)'), '2026-02-30');
  await fireEvent.press(screen.getByRole('button', { name: 'Apply date' }));
  expect(screen.getByText(/Enter a real date/)).toBeTruthy(); expect(fake.saveTransaction).not.toHaveBeenCalled();
  await fireEvent.changeText(screen.getByLabelText('Date (YYYY-MM-DD)'), '2024-02-29');
  await fireEvent.press(screen.getByRole('button', { name: 'Apply date' }));
  expect(screen.getByRole('button', { name: '2024-02-29' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: '2024-02-29' }));
  await fireEvent.changeText(screen.getByLabelText('Date (YYYY-MM-DD)'), '2026-01-01');
  await fireEvent.press(screen.getByRole('button', { name: 'Cancel date/time change' }));
  expect(screen.getByRole('button', { name: '2024-02-29' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Noon (default)' }));
  await fireEvent.changeText(screen.getByLabelText('Time (HH:MM)'), '24:00');
  await fireEvent.press(screen.getByRole('button', { name: 'Apply time' }));
  expect(screen.getByText(/Enter a 24-hour time/)).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Time (HH:MM)'), '00:01');
  await fireEvent.press(screen.getByRole('button', { name: 'Apply time' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  expect(fake.saveTransaction.mock.calls[0]?.[2]).toMatchObject({ accountingDate: '2024-02-29', localTime: '00:01', correctDate: true, chosenOffsetMinutes: null });
});

test('FR-SET-002: native controls follow Dark, Light and System without changing the OS preference', async () => {
  const native = jest.spyOn(Appearance, 'setColorScheme');
  try {
    const result = await render(<AppearanceProvider uiMode="dark"><Text>Screen</Text></AppearanceProvider>); expect(native).toHaveBeenLastCalledWith('dark');
    await result.rerender(<AppearanceProvider uiMode="light"><Text>Screen</Text></AppearanceProvider>); expect(native).toHaveBeenLastCalledWith('light');
    await result.rerender(<AppearanceProvider uiMode="system"><Text>Screen</Text></AppearanceProvider>); expect(native).toHaveBeenLastCalledWith('unspecified');
  } finally { native.mockRestore(); }
});

test('TC-101: ten keys register in order; only the subscribed amount display commits', async () => {
  const amount = new AmountState(); const display = jest.fn(), keypad = jest.fn(), unrelated = jest.fn();
  await render(<OverlayProvider><Profiler id="display" onRender={display}><AmountDisplay state={amount} preferences={preferences} /></Profiler><Profiler id="keys" onRender={keypad}><AmountKeypad state={amount} disabled={false} /></Profiler><Profiler id="other" onRender={unrelated}><Text>Unrelated screen</Text></Profiler></OverlayProvider>);
  const keyCommits = keypad.mock.calls.length, otherCommits = unrelated.mock.calls.length, displayCommits = display.mock.calls.length;
  for (const key of '1234567890') await fireEvent.press(screen.getByRole('button', { name: key }));
  expect(amount.snapshot().expression).toBe('1234567890');
  expect(screen.getByLabelText('₱1234567890.00')).toBeTruthy();
  expect(Haptics.impactAsync).toHaveBeenCalledTimes(10);
  expect(keypad).toHaveBeenCalledTimes(keyCommits); expect(unrelated).toHaveBeenCalledTimes(otherCommits); expect(display.mock.calls.length).toBeGreaterThan(displayCommits);
});

test('TC-101: unfinished arithmetic has no error until Equals, and validation haptic fires once', async () => {
  const state = new AmountState();
  await render(<OverlayProvider><AmountDisplay state={state} preferences={preferences} /><AmountKeypad state={state} disabled={false} /></OverlayProvider>);
  for (const key of ['1', '÷', '0']) await fireEvent.press(screen.getByRole('button', { name: key }));
  expect(screen.queryByText(/cannot divide by zero/)).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Equals' }));
  expect(screen.getByText(/cannot divide by zero/)).toBeTruthy(); expect(Haptics.notificationAsync).toHaveBeenCalledWith('error');
  await fireEvent.press(screen.getByRole('button', { name: 'Backspace' })); expect(screen.queryByText(/cannot divide by zero/)).toBeNull();
});

test('TC-15: entry with no active account offers a working Accounts action', async () => {
  fake.accounts.mockResolvedValueOnce([]);
  await render(<Providers><TransactionEntry /></Providers>);
  await fireEvent.press(await screen.findByRole('button', { name: 'Accounts' })); expect(router.navigate).toHaveBeenCalledWith('/accounts');
});

test('TC-101/28: minimal Expense takes three activations and repeated Save stays blocked until commit', async () => {
  let finish: () => void = () => { throw new Error('Write not started'); };
  fake.saveTransaction.mockImplementationOnce(() => new Promise(resolve => { finish = () => resolve({}); }));
  await render(<Providers><TransactionEntry /></Providers>);
  await fireEvent.press(await screen.findByRole('button', { name: 'Cash' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Food' }));
  await fireEvent.press(screen.getByRole('button', { name: '1' }));
  const save = screen.getByRole('button', { name: 'Save' });
  await fireEvent.press(save); await fireEvent.press(save);
  expect(fake.saveTransaction).toHaveBeenCalledTimes(1); expect(save.props.accessibilityState.busy).toBe(true); expect(router.dismissTo).not.toHaveBeenCalled();
  await act(async () => finish());
  expect(Haptics.notificationAsync).toHaveBeenCalledWith('success'); expect(router.dismissTo).toHaveBeenCalledWith({ pathname: '/', params: { savedId: fake.saveTransaction.mock.calls[0]?.[1], savedMonth: expect.stringMatching(/^\d{4}-\d{2}$/), savedOperation: fake.saveTransaction.mock.calls[0]?.[0] } });
  expect(fake.saveTransaction.mock.calls[0]?.[2]).toMatchObject({ type: 'expense', amountExpression: '1', accountId: account.id, categoryId: category.id, toAccountId: null, note: null });
});

test('TC-79: storage exhaustion keeps the draft and unchanged Retry reuses the exact token and request', async () => {
  fake.saveTransaction.mockRejectedValueOnce(new AppError('INSUFFICIENT_STORAGE')).mockResolvedValueOnce({});
  await render(<Providers><TransactionEntry /></Providers>);
  await fireEvent.press(await screen.findByRole('button', { name: 'Cash' })); await fireEvent.press(screen.getByRole('button', { name: 'Food' })); await fireEvent.press(screen.getByRole('button', { name: '2' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText(/Your device is low on storage/)).toBeTruthy(); expect(screen.getByLabelText('₱2.00')).toBeTruthy();
  expect(router.dismissTo).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Save' })); expect(fake.saveTransaction.mock.calls[1]).toEqual(fake.saveTransaction.mock.calls[0]);
  expect(router.dismissTo).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/' }));
});

test('screen render failure is contained and Retry recovers without blanking the shell', async () => {
  let broken = true;
  function Child() { if (broken) throw new Error('private exception must not render'); return <Text>Recovered</Text>; }
  const silenceExpected = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    await render(<View><Text>Navigation shell</Text><ScreenBoundary><Child /></ScreenBoundary></View>);
    expect(screen.getByText('Navigation shell')).toBeTruthy(); expect(screen.queryByText('private exception must not render')).toBeNull();
    broken = false; await fireEvent.press(screen.getByRole('button', { name: 'Try again' })); expect(screen.getByText('Recovered')).toBeTruthy();
  } finally { silenceExpected.mockRestore(); }
});

test('TC-105: unrelated parent state does not rerender a transaction row; amount changes do', async () => {
  const icons = jest.spyOn(iconRegistry, 'iconForKey'); const open = jest.fn();
  function Parent({ other, amount }: { other: string; amount: string }) {
    return <><Text>{other}</Text><TransactionRow id="synthetic" identity={category.id} title="Food" icon="food" subtitle="Cash" amount={amount} type="expense" refund={false} recurring={false} onPress={open} /></>;
  }
  try {
    const result = await render(<Parent other="one" amount="−₱1.00" />); const calls = icons.mock.calls.length;
    await result.rerender(<Parent other="two" amount="−₱1.00" />); expect(icons).toHaveBeenCalledTimes(calls);
    await result.rerender(<Parent other="three" amount="−₱2.00" />); expect(icons.mock.calls.length).toBeGreaterThan(calls);
    expect(screen.getByLabelText('−₱2.00')).toBeTruthy();
  } finally { icons.mockRestore(); }
});

test('TC-103 popup leg: dialogs queue one at a time and each destructive open fires one warning', async () => {
  function Open() {
    const overlay = useOverlay();
    return <PopButton label="Open two dialogs" onPress={() => {
      for (const title of ['First dialog', 'Second dialog']) overlay.show({ title, kind: 'dialog', destructive: true, content: close => <GhostButton label="Cancel" onPress={close} /> });
    }} />;
  }
  await render(<OverlayProvider><Open /></OverlayProvider>);
  await fireEvent.press(screen.getByRole('button', { name: 'Open two dialogs' }));
  expect(await screen.findByText('First dialog')).toBeTruthy(); expect(screen.queryByText('Second dialog')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
  expect(await screen.findByText('Second dialog')).toBeTruthy();
  expect(jest.mocked(Haptics.notificationAsync).mock.calls.filter(([event]) => event === Haptics.NotificationFeedbackType.Warning)).toHaveLength(2);
});

test('opening and closing a sheet does not rerender the background overlay consumer', async () => {
  const renderBackground = jest.fn();
  function Background() {
    const overlay = useOverlay(); renderBackground();
    return <PopButton label="Open sheet" onPress={() => overlay.show({ title: 'Sheet', content: close => <GhostButton label="Close sheet" onPress={close} /> })} />;
  }
  await render(<OverlayProvider><Background /></OverlayProvider>);
  const calls = renderBackground.mock.calls.length;
  await fireEvent.press(screen.getByRole('button', { name: 'Open sheet' }));
  expect(await screen.findByText('Sheet')).toBeTruthy();
  expect(renderBackground).toHaveBeenCalledTimes(calls);
  await fireEvent.press(screen.getByRole('button', { name: 'Close sheet' }));
  await waitFor(() => expect(screen.queryByText('Sheet')).toBeNull());
  expect(renderBackground).toHaveBeenCalledTimes(calls);
});

test('sheet exit and queued requests preserve the active picker subtree', async () => {
  const content = jest.fn((close: () => void) => <GhostButton label="Close picker" onPress={close} />);
  function Open() {
    const overlay = useOverlay();
    return <PopButton label="Open picker" onPress={() => overlay.show({ title: 'Picker', content: close => <>
      {content(close)}
      <GhostButton label="Queue next" onPress={() => overlay.show({ title: 'Next picker', content: nextClose => <GhostButton label="Close next" onPress={nextClose} /> })} />
    </> })} />;
  }
  await render(<OverlayProvider><Open /></OverlayProvider>);
  await fireEvent.press(screen.getByRole('button', { name: 'Open picker' }));
  expect(await screen.findByText('Picker')).toBeTruthy();
  const renders = content.mock.calls.length;
  await fireEvent.press(screen.getByRole('button', { name: 'Queue next' }));
  expect(screen.queryByText('Next picker')).toBeNull();
  expect(content).toHaveBeenCalledTimes(renders);
  await fireEvent.press(screen.getByRole('button', { name: 'Close picker' }));
  expect(await screen.findByText('Next picker')).toBeTruthy();
  expect(content).toHaveBeenCalledTimes(renders);
  await fireEvent.press(screen.getByRole('button', { name: 'Close next' }));
  await waitFor(() => expect(screen.queryByText('Next picker')).toBeNull());
});

test('NFR-11(c): a sheet selection runs its screen update only after the exit animation finishes', async () => {
  const picked = jest.fn();
  function Open() {
    const overlay = useOverlay();
    return <PopButton label="Open choices" onPress={() => overlay.show({ title: 'Choices', content: close => <GhostButton label="Pick" onPress={() => close(picked)} /> })} />;
  }
  await render(<OverlayProvider><Open /></OverlayProvider>);
  await fireEvent.press(screen.getByRole('button', { name: 'Open choices' }));
  expect(await screen.findByText('Choices')).toBeTruthy();
  mockHeldTimings.callbacks = [];
  try {
    await fireEvent.press(screen.getByRole('button', { name: 'Pick' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Pick' }));
    expect(picked).not.toHaveBeenCalled(); expect(screen.getByText('Choices')).toBeTruthy();
    const held = mockHeldTimings.callbacks.splice(0); mockHeldTimings.callbacks = null;
    await act(async () => { for (const finish of held) finish(true); });
  } finally { mockHeldTimings.callbacks = null; }
  await waitFor(() => expect(screen.queryByText('Choices')).toBeNull());
  expect(picked).toHaveBeenCalledTimes(2);
});

test('hardware Back dismisses the in-window overlay and is consumed only while it is open', async () => {
  const handlers: Parameters<typeof BackHandler.addEventListener>[1][] = [];
  const listen = jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_, handler) => {
    handlers.push(handler);
    return { remove: () => { handlers.splice(handlers.indexOf(handler), 1); } };
  });
  try {
    function Open() {
      const overlay = useOverlay();
      return <PopButton label="Open choices" onPress={() => overlay.show({ title: 'Choices', content: () => null })} />;
    }
    await render(<OverlayProvider><Open /></OverlayProvider>);
    expect(handlers).toHaveLength(0);
    await fireEvent.press(screen.getByRole('button', { name: 'Open choices' }));
    expect(await screen.findByText('Choices')).toBeTruthy();
    expect(handlers).toHaveLength(1);
    await act(async () => { expect(handlers[handlers.length - 1]({ type: 'hardwareBackPress', timeStamp: 0 })).toBe(true); });
    await waitFor(() => expect(screen.queryByText('Choices')).toBeNull());
    expect(handlers).toHaveLength(0);
  } finally { listen.mockRestore(); }
});

test('a refocused screen reloads only after a write it missed while blurred', async () => {
  const { mockFocus: Focus } = jest.requireMock<{ mockFocus: Context<boolean> }>('expo-router');
  const load = jest.fn(async () => 'rows');
  const write = jest.fn(async () => undefined);
  function Consumer() { const query = useLedgerQuery(useCallback(load, [load])); return <Text>{query.data ?? 'waiting'}</Text>; }
  function Writer() { const mutation = useLedgerMutation(); return <PopButton label="Write" onPress={() => { void mutation.run(write); }} />; }
  const tree = (focused: boolean) => <Providers><Writer /><Focus.Provider value={focused}><Consumer /></Focus.Provider></Providers>;
  const result = await render(tree(true));
  expect(await screen.findByText('rows')).toBeTruthy(); expect(load).toHaveBeenCalledTimes(1);
  await result.rerender(tree(false)); await result.rerender(tree(true));
  expect(load).toHaveBeenCalledTimes(1);
  await result.rerender(tree(false));
  await fireEvent.press(screen.getByRole('button', { name: 'Write' }));
  await waitFor(() => expect(write).toHaveBeenCalledTimes(1)); expect(load).toHaveBeenCalledTimes(1);
  await result.rerender(tree(true));
  await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
  await fireEvent.press(screen.getByRole('button', { name: 'Write' }));
  await waitFor(() => expect(load).toHaveBeenCalledTimes(3));
});

test('NFR-11(c): a tab preloaded while hidden loads once; its first focus reuses the rows; a write it missed reloads on focus', async () => {
  const { mockFocus: Focus } = jest.requireMock<{ mockFocus: Context<boolean> }>('expo-router');
  const load = jest.fn(async () => 'rows');
  const write = jest.fn(async () => undefined);
  function Consumer() { const query = useLedgerQuery(useCallback(load, [load])); return <Text>{query.data ?? 'waiting'}</Text>; }
  function Writer() { const mutation = useLedgerMutation(); return <PopButton label="Write" onPress={() => { void mutation.run(write); }} />; }
  const tree = (focused: boolean) => <Providers><Writer /><Focus.Provider value={focused}><Consumer /></Focus.Provider></Providers>;
  const result = await render(tree(false));
  expect(await screen.findByText('rows')).toBeTruthy(); expect(load).toHaveBeenCalledTimes(1);
  await result.rerender(tree(true));
  expect(screen.getByText('rows')).toBeTruthy(); expect(load).toHaveBeenCalledTimes(1);
  await result.rerender(tree(false));
  await fireEvent.press(screen.getByRole('button', { name: 'Write' }));
  await waitFor(() => expect(write).toHaveBeenCalledTimes(1)); expect(load).toHaveBeenCalledTimes(1);
  await result.rerender(tree(true));
  await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
});

test('screen query ignores a late result after unmount; explicit mutation guard admits just one write', async () => {
  let finish: (value: string) => void = () => { throw new Error('Query not started'); };
  const load = jest.fn(() => new Promise<string>(resolve => { finish = resolve; }));
  const write = jest.fn(async () => undefined);
  function Consumer() {
    const query = useLedgerQuery(useCallback(load, [load])); const mutation = useLedgerMutation();
    return <><Text>{query.data ?? 'waiting'}</Text><PopButton label="Write" onPress={() => { void mutation.run(write); void mutation.run(write); }} /></>;
  }
  const result = await render(<Providers><Consumer /></Providers>);
  await fireEvent.press(await screen.findByRole('button', { name: 'Write' })); expect(write).toHaveBeenCalledTimes(1);
  await result.unmount(); await act(async () => finish('late'));
  expect(load).toHaveBeenCalledTimes(2);
});

test('NFR-11(a): tab indicator selects on press and the screen switch waits for the next frame', async () => {
  const frames: FrameRequestCallback[] = [];
  const request = jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(callback => frames.push(callback));
  const cancel = jest.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => undefined);
  try {
    const routes = [{ key: 'index-1', name: 'index' }, { key: 'accounts-1', name: 'accounts' }, { key: 'categories-1', name: 'categories' }];
    let prevented = false;
    const navigation = { navigate: jest.fn(), preload: jest.fn(), isFocused: () => true, emit: jest.fn(() => ({ defaultPrevented: prevented })) };
    const tree = (index: number) => <Providers><LedgerTabBar state={{ index, routes }} navigation={navigation} /></Providers>;
    const result = await render(tree(0));
    const selected = (label: string) => screen.getByRole('tab', { name: label }).props.accessibilityState?.selected;
    expect(selected('Records')).toBe(true);
    await fireEvent.press(screen.getByRole('tab', { name: 'Accounts' }));
    expect(selected('Accounts')).toBe(true); expect(selected('Records')).toBe(false);
    expect(navigation.navigate).not.toHaveBeenCalled(); expect(frames).toHaveLength(1);
    await act(async () => { frames[0](0); });
    expect(navigation.navigate).toHaveBeenCalledWith('accounts');
    await result.rerender(tree(1));
    expect(selected('Accounts')).toBe(true);
    await fireEvent.press(screen.getByRole('tab', { name: 'Accounts' }));
    prevented = true;
    await fireEvent.press(screen.getByRole('tab', { name: 'Categories' }));
    expect(navigation.emit).toHaveBeenCalledTimes(3); expect(frames).toHaveLength(1); expect(selected('Accounts')).toBe(true);
    prevented = false;
    await fireEvent.press(screen.getByRole('tab', { name: 'Categories' }));
    expect(frames).toHaveLength(2);
    await result.unmount();
    expect(cancel).toHaveBeenCalled(); expect(navigation.navigate).toHaveBeenCalledTimes(1);
  } finally { request.mockRestore(); cancel.mockRestore(); }
});

test('NFR-11(c): the tab bar mounts each unvisited tab in its own idle period and waits while a screen covers the tabs or after a touch', async () => {
  const routes = [{ key: 'index-1', name: 'index' }, { key: 'accounts-1', name: 'accounts' }, { key: 'categories-1', name: 'categories' }];
  let covered = true;
  const navigation = { navigate: jest.fn(), preload: jest.fn(), isFocused: () => !covered, emit: jest.fn(() => ({ defaultPrevented: false })) };
  const result = await render(<Providers><LedgerTabBar state={{ index: 0, routes }} navigation={navigation} /></Providers>);
  await act(async () => { flushIdle(); });
  expect(navigation.preload).not.toHaveBeenCalled();
  covered = false;
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 1100)); });
  await fireEvent(screen.getByRole('tab', { name: 'Records' }), 'touchStart');
  await act(async () => { flushIdle(); });
  expect(navigation.preload).not.toHaveBeenCalled();
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 1100)); });
  await act(async () => { flushIdle(); });
  expect(navigation.preload).toHaveBeenCalledTimes(1); expect(navigation.preload).toHaveBeenLastCalledWith('accounts');
  await act(async () => { flushIdle(); });
  expect(navigation.preload).toHaveBeenCalledTimes(2); expect(navigation.preload).toHaveBeenLastCalledWith('categories');
  await act(async () => { flushIdle(); });
  expect(navigation.preload).toHaveBeenCalledTimes(2); expect(navigation.navigate).not.toHaveBeenCalled();
  await result.unmount();
  expect(idleCallbacks.size).toBe(0);
});

test('A11Y: a toggle row is one labelled switch; the inner native Switch is not a second unlabelled focus stop', async () => {
  const change = jest.fn();
  await render(<Providers><ListRowToggle label="Show archived" value={false} onChange={change} /></Providers>);
  expect(screen.getAllByRole('switch')).toHaveLength(1);
  const row = screen.getByRole('switch', { name: 'Show archived' });
  expect(row.props.accessibilityState).toMatchObject({ checked: false });
  type Host = { type: unknown; props: Record<string, unknown>; children: readonly (Host | string)[] };
  const hosts = (node: Host): Host[] => [node, ...node.children.flatMap(child => typeof child === 'string' ? [] : hosts(child))];
  const inner = hosts(row as unknown as Host).filter(node => node.type === 'RCTSwitch');
  expect(inner).toHaveLength(1);
  expect(inner[0].props).toMatchObject({ accessible: false, focusable: false, importantForAccessibility: 'no-hide-descendants' });
  await fireEvent.press(row); expect(change).toHaveBeenCalledWith(true);
});

test('NFR-11: the month sheet steps the year without a native TextInput and stays within 1900-9999', async () => {
  const select = jest.fn();
  const view = await render(<Providers><MonthPicker value="2026-11" select={select} /></Providers>);
  type Host = { type: unknown; children: readonly (Host | string)[] };
  const hosts = (node: Host): Host[] => [node, ...node.children.flatMap(child => typeof child === 'string' ? [] : hosts(child))];
  const root = view.root as unknown as Host;
  expect(hosts(root).filter(node => typeof node.type === 'string' && node.type.includes('TextInput'))).toHaveLength(0);
  expect(screen.getByRole('header', { name: '2026' })).toBeTruthy();
  expect(screen.getByRole('button', { name: '11' }).props.accessibilityState).toMatchObject({ selected: true });
  await fireEvent.press(screen.getByRole('button', { name: 'Next year' }));
  expect(screen.getByRole('header', { name: '2027' })).toBeTruthy();
  expect(screen.getByRole('button', { name: '11' }).props.accessibilityState).toMatchObject({ selected: false });
  await fireEvent.press(screen.getByRole('button', { name: '3' }));
  expect(select).toHaveBeenLastCalledWith('2027-03');
  await view.rerender(<Providers><MonthPicker key="max" value="9999-12" select={select} /></Providers>);
  expect(screen.getByRole('button', { name: 'Next year' }).props.accessibilityState).toMatchObject({ disabled: true });
  await view.rerender(<Providers><MonthPicker key="min" value="1900-01" select={select} /></Providers>);
  expect(screen.getByRole('button', { name: 'Previous year' }).props.accessibilityState).toMatchObject({ disabled: true });
  await fireEvent.press(screen.getByRole('button', { name: 'Previous year' }));
  expect(screen.getByRole('header', { name: '1900' })).toBeTruthy();
});

test('NFR-11: one hidden animated view mounts at first idle and leaves after a frame; an earlier overlay skips it', async () => {
  function Open() {
    const overlay = useOverlay();
    return <PopButton label="Open early" onPress={() => overlay.show({ title: 'Early sheet', content: close => <GhostButton label="Close early" onPress={close} /> })} />;
  }
  const first = await render(<OverlayProvider><Text>Idle app</Text></OverlayProvider>);
  expect(screen.queryByTestId('animation-warmup', { includeHiddenElements: true })).toBeNull();
  await act(async () => { flushIdle(); });
  const warmup = screen.getByTestId('animation-warmup', { includeHiddenElements: true });
  expect(warmup.props).toMatchObject({ pointerEvents: 'none', accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' });
  await act(async () => { await new Promise(resolve => requestAnimationFrame(resolve)); });
  expect(screen.queryByTestId('animation-warmup', { includeHiddenElements: true })).toBeNull();
  await act(async () => { flushIdle(); });
  expect(screen.queryByTestId('animation-warmup', { includeHiddenElements: true })).toBeNull();
  await first.unmount();
  await render(<OverlayProvider><Open /></OverlayProvider>);
  await fireEvent.press(screen.getByRole('button', { name: 'Open early' }));
  expect(await screen.findByText('Early sheet')).toBeTruthy();
  await act(async () => { flushIdle(); });
  expect(screen.queryByTestId('animation-warmup', { includeHiddenElements: true })).toBeNull();
  expect(idleCallbacks.size).toBe(0);
});
