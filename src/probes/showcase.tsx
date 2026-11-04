import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { FoundationScreen, AppText } from '@/components/foundation-screen';
import { metrics, radius, spacing } from '@/theme/tokens';
import { useAppTheme } from '@/theme/provider';
import { probePlatform } from './platform';
import { inspectAndCancelRebootProbe, inspectBackupMarkers, prepareBackupMarkers, probeNotificationCancel, probeSqliteSwap, probeStartup, scheduleRebootProbe, seedStartupFixture } from './native';
import { UiStackProbe } from './ui-stack';
import { useFiniteProbe } from './use-finite-probe';
import { probeQuickKdf } from './quick-kdf';

export default function Showcase() {
  const { colors } = useAppTheme();
  const { busy, run, display } = useFiniteProbe();
  const [ui, setUi] = useState(false);
  const actions = [
    ['S1 storage primitives', () => probeSqliteSwap()],
    ['S1 native durable I/O candidate', (signal: AbortSignal) => probePlatform('probeDurableIo', signal)],
    ['S2 native PBKDF2 candidate', (signal: AbortSignal) => probePlatform('probePbkdf2', signal)],
    ['S2 fast native PBKDF2 candidate', probeQuickKdf],
    ['S4 notification permission and cancel', () => probeNotificationCancel()],
    ['S4 schedule reboot/timezone probe', () => scheduleRebootProbe()],
    ['S4 inspect/cancel reboot probe', () => inspectAndCancelRebootProbe()],
    ['S5 prepare backup markers', () => prepareBackupMarkers()],
    ['S5 inspect backup markers', () => inspectBackupMarkers()],
    ['S6 seed PERF-01', (signal: AbortSignal) => seedStartupFixture(signal)],
    ['S6 startup timing', () => probeStartup()],
  ] as const;
  if (ui) return <FoundationScreen title="UI stack probe" message="Synthetic rows; frame measurements require recorded emulator and build identities.">
    <Pressable accessibilityRole="button" onPress={() => setUi(false)} style={[styles.action, { borderColor: colors.controlBorder, backgroundColor: colors.surface2 }]}><AppText>Back to foundation checks</AppText></Pressable>
    <UiStackProbe />
  </FoundationScreen>;
  return <FoundationScreen title="Foundation checks" message="Development tools. Results require device and build provenance.">
    <ScrollView contentContainerStyle={styles.content}>
      {actions.map(([label, operation]) => <Pressable key={label} accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => { void run(operation); }} style={[styles.action, { borderColor: colors.controlBorder, backgroundColor: colors.surface2 }]}><AppText>{label}</AppText></Pressable>)}
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => setUi(value => !value)} style={[styles.action, { borderColor: colors.controlBorder, backgroundColor: colors.surface2 }]}><AppText>S3 toggle UI stack</AppText></Pressable>
      <AppText accessibilityLiveRegion="polite">{display}</AppText>
    </ScrollView>
  </FoundationScreen>;
}
const styles = StyleSheet.create({ content: { gap: spacing.s3 }, action: { minHeight: metrics.minTouch, borderWidth: metrics.hairline, borderRadius: radius.rMd, padding: spacing.s3, justifyContent: 'center' } });
