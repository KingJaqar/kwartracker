import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { DbGate } from '../../src/db/db-gate';
import { AppError } from '../../src/domain/errors';
import { useAppTheme } from '../../src/theme/provider';
import type { OpenDatabase } from '../../src/db/native';
import { DatabaseCoordinator } from '../../src/db/coordinator';
import type { DatabaseConnection } from '../../src/db/connection';

jest.mock('../../src/db/native', () => ({ openAppDatabase: jest.fn() }));
jest.mock('expo-splash-screen', () => ({ hideAsync: jest.fn(() => Promise.resolve()) }));
jest.mock('expo-font', () => ({ isLoaded: jest.fn(() => false) }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View };
});

const unusedDatabase: DatabaseConnection = {
  execAsync: async () => undefined,
  runAsync: async () => ({ changes: 0, lastInsertRowId: 0 }),
  getFirstAsync: async () => null,
  getAllAsync: async () => [],
  withExclusiveTransactionAsync: async () => undefined,
  closeAsync: async () => undefined,
};
const ready: OpenDatabase = { coordinator: new DatabaseCoordinator(unusedDatabase), uiMode: 'dark' };
function FinancialNavigator() {
  const { appearance } = useAppTheme();
  return <Text>{`navigator:${appearance}`}</Text>;
}
beforeEach(() => jest.clearAllMocks());

test('does not mount the financial navigator or hide splash until database readiness', async () => {
  let finish: (value: OpenDatabase) => void = () => { throw new Error('Not opened'); };
  const open = jest.fn(() => new Promise<OpenDatabase>(resolve => { finish = resolve; }));
  await render(<DbGate open={open}><FinancialNavigator /></DbGate>);
  expect(screen.queryByText('navigator:dark')).toBeNull();
  expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
  await act(async () => { finish(ready); });
  expect(screen.getByText('navigator:dark')).toBeTruthy();
  expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
});

test('failure has a plain accessible explanation; rerender never retries; explicit Retry makes one attempt', async () => {
  const open = jest.fn<Promise<OpenDatabase>, [boolean?]>().mockRejectedValueOnce(new AppError('DATABASE_UNSUPPORTED')).mockResolvedValueOnce(ready);
  const result = await render(<DbGate open={open}><FinancialNavigator /></DbGate>);
  expect(screen.getByText(/compatible version of Kwartracker/)).toBeTruthy();
  expect(screen.queryByText('navigator:dark')).toBeNull();
  await result.rerender(<DbGate open={open}><FinancialNavigator /></DbGate>);
  expect(open).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(open).toHaveBeenCalledTimes(2);
  expect(open).toHaveBeenLastCalledWith(true);
  expect(screen.getByText('navigator:dark')).toBeTruthy();
});

test('unmount ignores late startup completion and does not schedule another attempt', async () => {
  let finish: (value: OpenDatabase) => void = () => { throw new Error('Not opened'); };
  const open = jest.fn(() => new Promise<OpenDatabase>(resolve => { finish = resolve; }));
  const result = await render(<DbGate open={open}><FinancialNavigator /></DbGate>);
  await result.unmount();
  await act(async () => { finish(ready); });
  expect(open).toHaveBeenCalledTimes(1);
  expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
});
