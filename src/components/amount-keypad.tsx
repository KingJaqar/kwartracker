import { memo, useMemo, useSyncExternalStore } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { AppText } from './foundation-screen';
import { InlineError, MoneyText, PopButton } from './ui';
import { amountFromExpression, formatMoney, type MoneyPreferences } from '@/domain/money';
import { errorMessage } from '@/domain/errors';
import { useAppTheme } from '@/theme/provider';
import { layout, metrics, radius, spacing } from '@/theme/tokens';
import { haptic } from '@/services/ledger/haptics';

export class AmountState {
  private value: { expression: string; submitted: boolean };
  private listeners = new Set<() => void>();
  readonly separator: string;
  constructor(expression = '', separator = '.') { this.value = { expression, submitted: false }; this.separator = separator; }
  snapshot = () => this.value;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private set(expression: string, submitted: boolean) { this.value = { expression, submitted }; for (const listener of this.listeners) listener(); }
  valid = () => { try { amountFromExpression(this.value.expression, { decimalSeparator: this.separator }); return true; } catch { return false; } };
  validate = () => { this.set(this.value.expression, true); return this.valid(); };
  key = (key: string) => {
    haptic('key');
    if (key === '=') { if (!this.validate()) haptic('error'); return; }
    const expression = key === '⌫' ? this.value.expression.slice(0, -1) : this.value.expression + key;
    if (expression.length <= 256) this.set(expression, false);
  };
}

export function AmountDisplay({ state, preferences }: { state: AmountState; preferences: MoneyPreferences }) {
  const { expression, submitted } = useSyncExternalStore(state.subscribe, state.snapshot, state.snapshot);
  const { colors } = useAppTheme();
  const result = useMemo(() => {
    try { return { value: formatMoney(amountFromExpression(expression, { decimalSeparator: state.separator }), preferences, state.separator), error: null }; }
    catch (error) { return { value: expression ? '—' : formatMoney(0n, preferences, state.separator), error }; }
  }, [expression, preferences, state.separator]);
  return <View style={styles.display}><ScrollView horizontal contentContainerStyle={styles.expression}><AppText variant="titleM" accessibilityLabel={`Calculation ${expression || 'empty'}`} style={{ color: colors.textSecondary, fontVariant: ['tabular-nums'] }}>{expression || '0'}</AppText></ScrollView>
    <MoneyText value={result.value} variant="displayXL" />
    {submitted && result.error ? <InlineError message={errorMessage(result.error)} /> : null}
  </View>;
}

const Key = memo(function Key({ value, onKey, compact, disabled }: { value: string; onKey: (key: string) => void; compact: boolean; disabled: boolean }) {
  const { colors } = useAppTheme();
  const operator = ['(', ')', '⌫', '÷', '×', '−', '+', '='].includes(value);
  return <Pressable accessibilityRole="button" accessibilityLabel={value === '⌫' ? 'Backspace' : value === '=' ? 'Equals' : value} accessibilityState={{ disabled }} disabled={disabled} onPress={() => onKey(value)} style={({ pressed }) => [styles.key, { minHeight: compact ? metrics.compactKey : metrics.key, backgroundColor: pressed || operator ? colors.surface3 : colors.surface2, borderColor: value === '=' ? colors.accent : colors.surface2 }]}>
    <AppText variant="titleM">{value}</AppText>
  </Pressable>;
});
export const AmountKeypad = memo(function AmountKeypad({ state, disabled }: { state: AmountState; disabled: boolean }) {
  const { height } = useWindowDimensions();
  const keys = useMemo(() => ['(', ')', '⌫', '÷', '7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+', state.separator, '0', '00', '='], [state.separator]);
  return <View style={styles.keys}>{keys.map(value => <Key key={value} value={value} onKey={state.key} compact={height < metrics.compactHeight} disabled={disabled} />)}</View>;
});

export function AmountSubmit({ state, formValid, pending, save }: { state: AmountState; formValid: boolean; pending: boolean; save: () => void }) {
  const valid = useSyncExternalStore(state.subscribe, state.valid, state.valid);
  return <PopButton label="Save" onPress={save} loading={pending} disabled={!formValid || !valid} />;
}
const styles = StyleSheet.create({
  display: { gap: spacing.s1, alignItems: 'flex-end', paddingVertical: spacing.s2 },
  expression: { flexGrow: 1, justifyContent: 'flex-end' },
  keys: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s1 },
  key: { flexBasis: `${100 / layout.keyColumns - 1}%`, flexGrow: 1, justifyContent: 'center', alignItems: 'center', borderRadius: radius.rMd, borderWidth: metrics.hairline },
});
