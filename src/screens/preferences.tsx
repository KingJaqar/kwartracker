import { useState } from 'react';
import { KeyboardAvoidingView, View } from 'react-native';
import { AppText } from '@/components/foundation-screen';
import { Card, InlineError, ListRowToggle, PopButton, Screen, SegmentedControl, TextField, Toast, ui } from '@/components/ui';
import { newId, useCommandIdentity, useLedger, useLedgerMutation, usePreferences } from '@/services/ledger/provider';
import { goBack, useSaveNavigationGuard } from '@/services/ledger/navigation';
import type { DisplayPreferences } from '@/repositories/ledger';
import { haptic } from '@/services/ledger/haptics';

const appearances = [{ label: 'System', value: 'system' }, { label: 'Light', value: 'light' }, { label: 'Dark', value: 'dark' }] as const;
const decimals = [{ label: '0', value: '0' }, { label: '2', value: '2' }] as const;
const positions = [{ label: 'Before', value: 'prefix' }, { label: 'After', value: 'suffix' }] as const;

export default function Preferences() {
  const initial = usePreferences(); const { repository } = useLedger(); const mutation = useLedgerMutation(); const identity = useCommandIdentity();
  const [entityId] = useState(newId);
  const [values, setValues] = useState<DisplayPreferences>(() => ({ currencySign: initial.currencySign, currencyPosition: initial.currencyPosition, displayDecimalPlaces: initial.displayDecimalPlaces, notesVisibleInList: initial.notesVisibleInList, uiMode: initial.uiMode, dailyReminderTime: initial.dailyReminderTime }));
  const [signError, setSignError] = useState<string | null>(null); const [saved, setSaved] = useState(false);
  useSaveNavigationGuard(mutation.pending);
  function validateSign() { const valid = values.currencySign.trim().length > 0 && [...values.currencySign].length <= 12; setSignError(valid ? null : 'Enter a currency sign with 1 to 12 characters.'); return valid; }
  function save() {
    if (!validateSign()) { haptic('error'); return; }
    const token = identity.token(values);
    void mutation.run(() => repository.savePreferences(token, entityId, values), () => { identity.reset(); setSaved(true); });
  }
  return <KeyboardAvoidingView style={ui.flex} behavior="padding"><Screen title="Preferences" onBack={() => { if (!mutation.pending) goBack(); }} scroll>
    <Card><AppText variant="titleM">Display</AppText><TextField label="Currency sign" value={values.currencySign} maxLength={12} onChangeText={currencySign => setValues(old => ({ ...old, currencySign }))} onBlur={validateSign} error={signError} editable={!mutation.pending} />
      <AppText variant="label">Currency position</AppText><SegmentedControl options={positions} value={values.currencyPosition} disabled={mutation.pending} onChange={value => { if (value === 'prefix' || value === 'suffix') setValues(old => ({ ...old, currencyPosition: value })); }} />
      <AppText variant="label">Decimal places</AppText><SegmentedControl options={decimals} value={String(values.displayDecimalPlaces)} disabled={mutation.pending} onChange={value => { if (value === '0' || value === '2') setValues(old => ({ ...old, displayDecimalPlaces: value === '0' ? 0 : 2 })); }} />
      <AppText variant="caption">Display rounding keeps every stored cent unchanged.</AppText><ListRowToggle label="Show notes in Records" value={values.notesVisibleInList} disabled={mutation.pending} onChange={notesVisibleInList => setValues(old => ({ ...old, notesVisibleInList }))} />
    </Card>
    <Card><AppText variant="titleM">Appearance</AppText><SegmentedControl options={appearances} value={values.uiMode} disabled={mutation.pending} onChange={value => { if (value === 'system' || value === 'light' || value === 'dark') setValues(old => ({ ...old, uiMode: value })); }} /></Card>
    {mutation.error ? <InlineError error={mutation.error} /> : null}<PopButton label="Save preferences" onPress={save} loading={mutation.pending} />
    {saved ? <View><Toast message="Preferences saved" onFinish={() => setSaved(false)} /></View> : null}
  </Screen></KeyboardAvoidingView>;
}
