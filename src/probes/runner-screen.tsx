import { useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { FoundationScreen, AppText } from '../components/foundation-screen';
import { AppError } from '../domain/errors';
import { useAppTheme } from '../theme/provider';
import { metrics, radius, spacing } from '../theme/tokens';
import { useFiniteProbe } from './use-finite-probe';
import { inspectMigrationFixture, pauseNativeMigration, prepareMigrationFixture } from './migration-native';
import { probeQuickKdf } from './quick-kdf';
import { probeColdStartup } from './startup-native';
import { probePlatform } from './platform';
import { corruptRestoreCase, listRestoreCases, recoverRestoreCase, startRestoreCase } from './restore-runner';
import { inspectAndCancelRebootProbe, inspectBackupMarkers, prepareBackupMarkers, probeNotificationCancel, probeStartup, scheduleRebootProbe, seedStartupFixture } from './native';

/** A deep link selects a finite case; only an explicit press runs it. Excluded from normal APKs. */
export default function RunnerScreen() {
  const params = useLocalSearchParams();
  const { colors } = useAppTheme();
  const { busy, run, display, progress } = useFiniteProbe();
  const parameter = (key: string) => typeof params[key] === 'string' ? params[key] : '';
  const action = parameter('action');
  async function selected(signal: AbortSignal): Promise<unknown> {
    switch (action) {
      case 'restore-points': return listRestoreCases();
      case 'restore-start': return startRestoreCase(parameter('point'), signal);
      case 'restore-recover': return recoverRestoreCase(parameter('operation'), parameter('fail'), signal);
      case 'restore-corrupt': return corruptRestoreCase(parameter('operation'));
      case 'migration-pause': return pauseNativeMigration(parameter('point'), signal, progress);
      case 'migration-prepare': return prepareMigrationFixture(parameter('kind'));
      case 'migration-inspect': return inspectMigrationFixture(parameter('operation'));
      case 'durable-io': return probePlatform('probeDurableIo', signal);
      case 'pbkdf2': return probePlatform('probePbkdf2', signal);
      case 'pbkdf2-fast': return probeQuickKdf(signal);
      case 'notification-cancel': return probeNotificationCancel();
      case 'notification-reboot': return scheduleRebootProbe();
      case 'notification-inspect': return inspectAndCancelRebootProbe();
      case 'backup-prepare': return prepareBackupMarkers();
      case 'backup-inspect': return inspectBackupMarkers();
      case 'startup-seed': return seedStartupFixture(signal);
      case 'startup-timing': return probeStartup();
      case 'startup-prepare': return startRestoreCase(parameter('point'), signal, 'perf');
      case 'startup-cold': return probeColdStartup(parameter('operation'));
      default: throw new AppError('INVALID_COMMAND');
    }
  }
  return <FoundationScreen title="One foundation check" message="Isolated synthetic sandbox. No automatic start or retry.">
    <AppText>{`Selected: ${action || 'none'}`}</AppText>
    <Pressable accessibilityRole="button" accessibilityLabel="Run selected check" accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => { void run(selected, action === 'startup-prepare' ? 180000 : 30000); }} style={[styles.action, { borderColor: colors.controlBorder, backgroundColor: colors.surface2 }]}><AppText>Run selected check</AppText></Pressable>
    <ScrollView><AppText accessibilityLiveRegion="polite" testID="probe-result">{display}</AppText></ScrollView>
  </FoundationScreen>;
}
const styles = StyleSheet.create({ action: { minHeight: metrics.minTouch, borderWidth: metrics.hairline, borderRadius: radius.rMd, padding: spacing.s3, justifyContent: 'center' } });
