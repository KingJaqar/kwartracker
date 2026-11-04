import { act, fireEvent, render, screen } from '@testing-library/react-native';
import Showcase from '../../src/probes/showcase';
import { probePlatform } from '../../src/probes/platform';

jest.mock('../../src/probes/platform', () => ({ probePlatform: jest.fn() }));
jest.mock('../../src/probes/quick-kdf', () => ({ probeQuickKdf: jest.fn() }));
jest.mock('../../src/probes/native', () => ({}));
jest.mock('../../src/probes/ui-stack', () => ({ UiStackProbe: () => null }));
jest.mock('expo-font', () => ({ isLoaded: () => false }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View };
});

afterEach(() => { jest.useRealTimers(); jest.clearAllMocks(); });

test('expired native work shows its deadline and keeps admission closed until the original call returns', async () => {
  jest.useFakeTimers();
  let finish: (result: object) => void = () => { throw new Error('Probe was not started'); };
  jest.mocked(probePlatform).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  await render(<Showcase />);
  const action = screen.getByRole('button', { name: 'S2 native PBKDF2 candidate' });
  await fireEvent.press(action);
  await act(async () => { jest.advanceTimersByTime(30000); });
  expect(screen.getByText(/This check exceeded its time limit/)).toBeTruthy();
  expect(action.props.accessibilityState.disabled).toBe(true);
  await fireEvent.press(action);
  expect(probePlatform).toHaveBeenCalledTimes(1);
  await act(async () => { finish({ vectorMatches: true }); });
  expect(screen.getByText(/took too long and stopped safely/)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'S2 native PBKDF2 candidate' }).props.accessibilityState.disabled).toBe(false);
});

test('leaving and reopening a probe cannot overlap native work from its previous mount', async () => {
  let finish: (result: object) => void = () => { throw new Error('Probe was not started'); };
  jest.mocked(probePlatform).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const first = await render(<Showcase />);
  await fireEvent.press(screen.getByRole('button', { name: 'S2 native PBKDF2 candidate' }));
  await first.unmount();
  await render(<Showcase />);
  await fireEvent.press(screen.getByRole('button', { name: 'S2 native PBKDF2 candidate' }));
  expect(probePlatform).toHaveBeenCalledTimes(1);
  expect(screen.getByText(/A previous check is still finishing/)).toBeTruthy();
  await act(async () => { finish({ vectorMatches: true }); });
});
