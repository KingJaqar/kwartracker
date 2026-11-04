import { useCallback, useDeferredValue, useEffect, useRef, useState } from 'react';
import { router, Stack } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { Keyboard, KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/foundation-screen';
import { AmountDisplay, AmountKeypad, AmountState, AmountSubmit } from '@/components/amount-keypad';
import { BottomSheet, Card, Chip, Dialog, EmptyState, GhostButton, InlineError, Screen, SegmentedControl, Skeleton, TextField, useOverlay, ui } from '@/components/ui';
import { newId, useCommandIdentity, useLedger, useLedgerMutation, useLedgerQuery, usePreferences } from '@/services/ledger/provider';
import { goBack, useOverlayWriteGuard, useSaveNavigationGuard } from '@/services/ledger/navigation';
import { haptic } from '@/services/ledger/haptics';
import { AppError, errorMessage } from '@/domain/errors';
import { decimalSeparator, localDate, minorExpression } from '@/domain/ledger';
import { formatMoney } from '@/domain/money';
import { accountingDate, captureCreationMetadata, localTimeCandidates, localTimeCandidatesAsync } from '@/domain/dates';
import type { Transaction } from '@/domain/portable';
import type { AccountBalance, CategoryRow, RefundStatus, TransactionInput, TransactionRow } from '@/repositories/ledger';
import { layout, spacing } from '@/theme/tokens';

const types = [{ label: 'Income', value: 'income' }, { label: 'Expense', value: 'expense' }, { label: 'Transfer', value: 'transfer' }] as const;
const choiceKey = (item: { id: string }) => item.id;
/** `link` is the purchase a refund belongs to (or the edited purchase itself) with its exact refunded total. */
type EntryData = { accounts: AccountBalance[]; categories: CategoryRow[]; initial: TransactionRow | null; latest: Transaction['type']; link: { original: TransactionRow; status: RefundStatus } | null };

export default function TransactionEntry({ id, duplicateId, refundOfId }: { id?: string; duplicateId?: string; refundOfId?: string }) {
  const { repository } = useLedger();
  const query = useLedgerQuery(useCallback(async (): Promise<EntryData> => {
    const [accounts, categories, initial, latest] = await Promise.all([repository.accounts(), repository.categories(), id || duplicateId ? repository.transaction(id ?? duplicateId ?? '') : null, repository.latestType()]);
    if ((id || duplicateId) && !initial) throw new AppError('ENTITY_MISSING');
    const originalId = refundOfId ?? (id && initial?.expenseEffect === 'refund' ? initial.refundOfTransactionId : id && initial?.expenseEffect === 'purchase' ? initial.id : null);
    if (!originalId) return { accounts, categories, initial, latest, link: null };
    const [original, status] = await Promise.all([originalId === initial?.id ? initial : repository.transaction(originalId), repository.refundStatus(originalId)]);
    if (!original) throw new AppError('ENTITY_MISSING');
    return { accounts, categories, initial, latest, link: { original, status } };
  }, [repository, id, duplicateId, refundOfId]));
  if (!query.data) return <Screen title="Transaction" onBack={goBack}><View style={ui.content}>{query.error ? <InlineError error={query.error} retry={query.retry} /> : <Skeleton />}</View></Screen>;
  if (!query.data.accounts.some(account => !account.isArchived) && !id) return <Screen title="Transaction" onBack={goBack}><EmptyState title="An active account is needed" message="Create an account or restore an archived account before adding a transaction." action="Accounts" onPress={() => router.navigate('/accounts')} /></Screen>;
  return <EntryForm key={`${id ?? 'new'}:${duplicateId ?? ''}:${refundOfId ?? ''}`} data={query.data} editing={Boolean(id)} duplicating={Boolean(duplicateId)} refunding={Boolean(refundOfId)} />;
}

function EntryForm({ data, editing, duplicating, refunding }: { data: EntryData; editing: boolean; duplicating: boolean; refunding: boolean }) {
  const { repository } = useLedger(); const preferences = usePreferences(); const overlay = useOverlay(); const mutation = useLedgerMutation(); const identity = useCommandIdentity();
  const [old] = useState(data.initial);
  const [link] = useState(data.link);
  // BR-23: a refund is created only from its purchase, keeps that link and category, and credits a receiving account.
  const refundMode = Boolean(link) && (refunding || (editing && old?.expenseEffect === 'refund'));
  const original = refundMode ? link?.original ?? null : null;
  const refundable = link ? link.status.purchaseMinor - link.status.refundedMinor : 0n;
  // A refunded purchase keeps its type and category (FR-TRN-008); its amount cannot fall below the refunds.
  const linkedPurchase = editing && old?.expenseEffect === 'purchase' && Boolean(link && link.status.refundedMinor > 0n);
  const preparedMetadata = useRef<{ signature: string; value: TransactionInput['creationMetadata'] } | null>(null);
  const [id] = useState(() => editing && old ? old.id : newId());
  const [type, setType] = useState<Transaction['type']>(() => refundMode ? 'expense' : old?.type ?? data.latest);
  const [amount] = useState(() => new AmountState(old ? minorExpression(old.amountMinor).replace('.', decimalSeparator())
    : refundMode && refundable > 0n ? minorExpression(Number(refundable)).replace('.', decimalSeparator()) : '', decimalSeparator()));
  const [accountId, setAccountId] = useState(() => old && (editing || data.accounts.some(row => row.id === old.accountId && !row.isArchived)) ? old.accountId
    : original && data.accounts.some(row => row.id === original.accountId && !row.isArchived) ? original.accountId : '');
  const [categoryId, setCategoryId] = useState<string | null>(() => original ? original.categoryId
    : old?.categoryId && (editing || data.categories.some(row => row.id === old.categoryId && !row.isArchived)) ? old.categoryId : null);
  const [toAccountId, setToAccountId] = useState<string | null>(() => old?.toAccountId && (editing || data.accounts.some(row => row.id === old.toAccountId && !row.isArchived)) ? old.toAccountId : null);
  const [date, setDate] = useState(old?.accountingDate ?? localDate());
  const [time, setTime] = useState<string | null>(null);
  const [correctDate, setCorrectDate] = useState(false);
  const [offset, setOffset] = useState<number | null>(null);
  const [candidates, setCandidates] = useState<ReturnType<typeof localTimeCandidates>>([]);
  const [note, setNote] = useState(old?.note ?? ''); const [showNote, setShowNote] = useState(Boolean(old?.note));
  const [picker, setPicker] = useState<'date' | 'time' | null>(null);
  const [keyboard, setKeyboard] = useState(Keyboard.isVisible()); const [validation, setValidation] = useState<unknown>(null); const [committed, setCommitted] = useState<string | null>(null);
  const content = useRef<ScrollView>(null);
  const zone = globalThis.Intl.DateTimeFormat().resolvedOptions().timeZone;
  useSaveNavigationGuard(mutation.pending);
  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', () => { setKeyboard(true); content.current?.scrollToEnd({ animated: false }); }); const hidden = Keyboard.addListener('keyboardDidHide', () => setKeyboard(false));
    return () => { shown.remove(); hidden.remove(); };
  }, []);
  useEffect(() => { if (committed && !mutation.pending) router.dismissTo({ pathname: '/', params: { savedId: id, savedMonth: date.slice(0, 7), savedOperation: committed } }); }, [committed, mutation.pending, id, date]);
  const accounts = data.accounts.filter(row => !row.isArchived || (editing && (row.id === old?.accountId || row.id === old?.toAccountId)));
  // NFR-11(c): the segment answers at once; the type's account/category choices follow as a deferred, interruptible render.
  const shownType = useDeferredValue(type);
  const categories = data.categories.filter(row => row.type === shownType && (!row.isArchived || (editing && row.id === old?.categoryId)));
  const valid = Boolean(accountId && (refundMode ? categoryId : type === 'transfer' ? toAccountId && toAccountId !== accountId : data.categories.some(row => row.id === categoryId && row.type === type)));
  const money = (value: bigint) => formatMoney(value, preferences, amount.separator);
  function selectType(value: string) {
    if (value !== 'income' && value !== 'expense' && value !== 'transfer') return;
    if (value !== type) { setType(value); setCategoryId(null); setToAccountId(null); }
  }
  function chooseAccount(value: string) { setAccountId(value); if (toAccountId === value) setToAccountId(null); }
  function more(title: string, rows: { id: string; name: string; isArchived: number }[], selected: string | null, choose: (id: string) => void) {
    overlay.show({ title, content: close => <View style={styles.choices}><FlashList data={rows} keyExtractor={choiceKey} renderItem={({ item }) => <Chip label={`${item.name}${item.isArchived ? ' · Archived' : ''}`} selected={selected === item.id} onPress={() => close(() => choose(item.id))} />} /></View> });
  }
  function save() {
    const amountValid = amount.validate();
    if (!amountValid || !valid) { haptic('error'); if (!valid) setValidation(new AppError(type === 'transfer' ? 'TRANSFER_TARGET_REQUIRED' : !accountId ? 'ACTIVE_ACCOUNT_REQUIRED' : 'MATCHING_CATEGORY_REQUIRED')); return; }
    if (note.length > 4000) { haptic('error'); setValidation(new AppError('INVALID_NOTE')); return; }
    const draft: Omit<TransactionInput, 'creationMetadata'> = { type, amountExpression: amount.snapshot().expression, decimalSeparator: amount.separator, accountId, categoryId: type === 'transfer' ? null : categoryId, toAccountId: type === 'transfer' ? toAccountId : null,
      accountingDate: date, localTime: time, timeZoneId: zone, chosenOffsetMinutes: offset, note: note || null, correctDate, expectedUpdatedAtUtc: editing ? old?.updatedAtUtc ?? null : null,
      refundOfTransactionId: original?.id ?? null,
      retained: editing && old ? { idempotencyToken: old.idempotencyToken, accountingDate: old.accountingDate, occurredAtUtc: old.occurredAtUtc } : null };
    const signature = JSON.stringify(draft);
    try {
      if (preparedMetadata.current?.signature !== signature) preparedMetadata.current = { signature, value: editing && old
        ? { createdAtUtc: old.createdAtUtc, createdTimeZoneId: old.createdTimeZoneId, createdUtcOffsetMinutes: old.createdUtcOffsetMinutes }
        : captureCreationMetadata(new Date().toISOString(), zone) };
    } catch (error) { setValidation(error); haptic('error'); return; }
    const input: TransactionInput = { ...draft, creationMetadata: preparedMetadata.current.value };
    const token = identity.token(input);
    setValidation(null);
    void mutation.run(async () => {
      try { return await repository.saveTransaction(token, id, input, editing); }
      catch (error) {
        if (error instanceof AppError && error.code === 'AMBIGUOUS_LOCAL_TIME') setCandidates(await localTimeCandidatesAsync(date, zone, time ?? undefined));
        if (error instanceof AppError && ['INVALID_AMOUNT', 'DIVISION_BY_ZERO', 'NONEXISTENT_LOCAL_TIME', 'AMBIGUOUS_LOCAL_TIME', 'MATCHING_CATEGORY_REQUIRED', 'ACTIVE_ACCOUNT_REQUIRED', 'TRANSFER_TARGET_REQUIRED', 'REFUND_EXCEEDS_PURCHASE', 'LINKED_REFUNDS'].includes(error.code)) haptic('error');
        throw error;
      }
    }, () => { haptic('success'); setCommitted(token); });
  }
  function overflow() {
    const canRefund = old?.expenseEffect === 'purchase' && refundable > 0n;
    overlay.show({ title: 'Transaction actions', content: close => <BottomSheet><GhostButton label="Duplicate" onPress={() => close(() => router.push({ pathname: '/transaction/new', params: { duplicateId: id } }))} />
      {canRefund ? <GhostButton label="Refund" onPress={() => close(() => router.push({ pathname: '/transaction/new', params: { refundOfId: id } }))} /> : null}
      <GhostButton label="Delete" onPress={() => {
        close(); overlay.show({ title: refundMode ? 'Delete refund?' : 'Delete transaction?', kind: 'dialog', destructive: true, content: dismiss => <DeleteConfirmation transaction={old} refund={refundMode} close={dismiss} /> });
      }} /></BottomSheet> });
  }
  const noteError = validation instanceof AppError && validation.code === 'INVALID_NOTE' ? errorMessage(validation) : null;
  return <KeyboardAvoidingView style={ui.flex} behavior="padding"><Stack.Screen options={{ gestureEnabled: !mutation.pending }} /><Screen title={refundMode ? editing ? 'Edit refund' : 'Refund purchase' : editing ? 'Edit transaction' : duplicating ? 'Duplicate transaction' : 'New transaction'} onBack={() => { if (!mutation.pending) goBack(); }}
    dock={!keyboard ? <View style={styles.dock}><AmountKeypad state={amount} disabled={mutation.pending} /><AmountSubmit state={amount} formValid={valid && !picker} pending={mutation.pending} save={save} /></View> : undefined}>
    {/* The keyboard padding shrinks this viewport after keyboardDidShow, so the end is revealed again once it is resized. */}
    <ScrollView ref={content} style={ui.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets
      onLayout={() => { if (keyboard) content.current?.scrollToEnd({ animated: false }); }}>
      {editing ? <GhostButton label="Transaction actions" onPress={overflow} disabled={mutation.pending} /> : null}
      {original && link ? <Card><AppText variant="titleS">Refund of {original.categoryName ?? 'Category'} purchase</AppText>
        <AppText>{`Purchase ${money(link.status.purchaseMinor)} on ${original.accountingDate} · Refunded ${money(link.status.refundedMinor)}`}</AppText>
        <AppText variant="label">{editing ? `Still refundable beyond this refund: ${money(refundable)}` : refundable > 0n ? `Available to refund: ${money(refundable)}` : 'This purchase is fully refunded.'}</AppText>
        <AppText variant="caption">A refund credits the receiving account and reduces this category’s Expense in its own month. It is not Income.</AppText></Card>
        : <SegmentedControl options={types} value={type} onChange={selectType} disabled={mutation.pending || linkedPurchase} />}
      {linkedPurchase && link ? <AppText variant="caption">{`Refunded ${money(link.status.refundedMinor)} of ${money(link.status.purchaseMinor)}. Type and category stay fixed, and the amount cannot be lower than the refunds.`}</AppText> : null}
      <AmountDisplay state={amount} preferences={preferences} />
      <AppText variant="label">{refundMode ? 'Receiving account' : shownType === 'transfer' ? 'From account' : 'Account'}</AppText>
      <ScrollView horizontal contentContainerStyle={ui.inline} keyboardShouldPersistTaps="handled">{accounts.slice(0, layout.maximumInlineAccounts).map(row => <Chip key={row.id} label={`${row.name}${row.isArchived ? ' · Archived' : ''}`} selected={accountId === row.id} disabled={mutation.pending} onPress={() => chooseAccount(row.id)} />)}
        {accounts.length > layout.maximumInlineAccounts ? <Chip label={accounts.findIndex(row => row.id === accountId) >= layout.maximumInlineAccounts ? `Selected: ${accounts.find(row => row.id === accountId)?.name}` : 'More accounts'} disabled={mutation.pending} onPress={() => more('Choose account', accounts, accountId, chooseAccount)} /> : null}
      </ScrollView>
      {shownType === 'transfer' ? <><AppText variant="label">To account</AppText><ScrollView horizontal contentContainerStyle={ui.inline} keyboardShouldPersistTaps="handled">{accounts.filter(row => row.id !== accountId).slice(0, layout.maximumInlineAccounts).map(row => <Chip key={row.id} label={`${row.name}${row.isArchived ? ' · Archived' : ''}`} selected={toAccountId === row.id} disabled={mutation.pending} onPress={() => setToAccountId(row.id)} />)}
        {accounts.filter(row => row.id !== accountId).length > layout.maximumInlineAccounts ? <Chip label="More destinations" disabled={mutation.pending} onPress={() => more('Choose destination', accounts.filter(row => row.id !== accountId), toAccountId, setToAccountId)} /> : null}</ScrollView></>
        : refundMode ? <AppText variant="label">{`Category: ${original?.categoryName ?? 'Category'} (from the purchase)`}</AppText>
        : <><AppText variant="label">Category</AppText><View style={ui.inline}>{categories.slice(0, layout.maximumInlineCategories).map(row => <Chip key={row.id} label={`${row.name}${row.isArchived ? ' · Archived' : ''}`} selected={categoryId === row.id} disabled={mutation.pending || linkedPurchase} onPress={() => setCategoryId(row.id)} />)}
          {categories.length > layout.maximumInlineCategories ? <Chip label={categories.findIndex(row => row.id === categoryId) >= layout.maximumInlineCategories ? `Selected: ${categories.find(row => row.id === categoryId)?.name}` : 'More categories'} disabled={mutation.pending || linkedPurchase} onPress={() => more('Choose category', categories, categoryId, setCategoryId)} /> : null}</View>
          {!categories.length ? <GhostButton label="Create a category" disabled={mutation.pending} onPress={() => router.push('/category/new')} /> : null}</>}
      <View style={ui.inline}><Chip label={date} onPress={() => { Keyboard.dismiss(); setPicker('date'); }} disabled={mutation.pending} /><Chip label={editing && !correctDate ? 'Time unchanged' : time ?? 'Noon (default)'} onPress={() => { Keyboard.dismiss(); setPicker('time'); }} disabled={mutation.pending} />{time ? <GhostButton label="Use noon" onPress={() => { setTime(null); setCorrectDate(true); setOffset(null); setCandidates([]); }} disabled={mutation.pending} /> : null}</View>
      <AppText variant="caption">{editing && !correctDate ? 'Saved date and ordering time are kept until you choose a correction.' : `Local time in ${zone}. Saved dates stay fixed when you travel.`}</AppText>
      {picker ? <DateTimeEditor key={picker} mode={picker} initial={picker === 'date' ? date : time ?? '12:00'} cancel={() => { Keyboard.dismiss(); setPicker(null); }} apply={value => {
        if (picker === 'date') setDate(value); else setTime(value);
        Keyboard.dismiss(); setPicker(null); setCorrectDate(true); setOffset(null); setCandidates([]);
      }} /> : null}
      {candidates.length > 1 ? <View style={ui.gap}><AppText>This time occurs twice. Choose an offset:</AppText>{candidates.map(candidate => <Chip key={candidate.occurredAtUtc} label={`UTC${candidate.utcOffsetMinutes >= 0 ? '+' : '−'}${Math.abs(candidate.utcOffsetMinutes / 60)}`} selected={offset === candidate.utcOffsetMinutes} disabled={mutation.pending} onPress={() => setOffset(candidate.utcOffsetMinutes)} />)}</View> : null}
      {!showNote ? <GhostButton label="Add a note" disabled={mutation.pending} onPress={() => setShowNote(true)} /> : <TextField label="Note" value={note} onChangeText={setNote} multiline maxLength={4000} editable={!mutation.pending} error={noteError} onFocus={() => content.current?.scrollToEnd({ animated: false })} />}
      {validation && !noteError ? <InlineError error={validation} /> : null}{mutation.error ? <InlineError error={mutation.error} /> : null}
      {keyboard ? <GhostButton label="Done writing" onPress={() => Keyboard.dismiss()} /> : null}
    </ScrollView>
  </Screen></KeyboardAvoidingView>;
}

/** Civil text is validated before acceptance; Save still resolves DST gaps/folds in the repository. */
export function DateTimeEditor({ mode, initial, apply, cancel }: { mode: 'date' | 'time'; initial: string; apply: (value: string) => void; cancel: () => void }) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  function confirm() {
    try {
      if (mode === 'date') accountingDate(value);
      else if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new AppError('INVALID_DATE');
      apply(value);
    } catch {
      setError(mode === 'date' ? 'Enter a real date from 1900-01-02 to 9999-12-30 as YYYY-MM-DD.' : 'Enter a 24-hour time as HH:MM, from 00:00 to 23:59.');
      haptic('error');
    }
  }
  return <View style={ui.gap}>
    <TextField label={mode === 'date' ? 'Date (YYYY-MM-DD)' : 'Time (HH:MM)'} value={value} onChangeText={setValue} error={error}
      autoCapitalize="none" autoCorrect={false} maxLength={mode === 'date' ? 10 : 5} returnKeyType="done" onSubmitEditing={confirm} />
    <View style={ui.inline}><GhostButton label={mode === 'date' ? 'Apply date' : 'Apply time'} onPress={confirm} /><GhostButton label="Cancel date/time change" onPress={cancel} /></View>
  </View>;
}

function DeleteConfirmation({ transaction, refund, close }: { transaction: TransactionRow | null; refund: boolean; close: (then?: () => void) => void }) {
  const { repository } = useLedger(); const mutation = useLedgerMutation(); const identity = useCommandIdentity(); const [done, setDone] = useState(false);
  useOverlayWriteGuard(mutation.pending);
  useEffect(() => { if (done && !mutation.pending) close(() => router.dismissTo('/')); }, [done, mutation.pending, close]);
  return <View style={ui.gap}><Dialog message={refund ? 'Delete this refund? Its account credit and Expense reduction are removed together, and the amount can be refunded again. This cannot be undone.' : 'Delete this transaction? Its balance and month effects will be removed together. This cannot be undone.'} action={refund ? 'Delete refund' : 'Delete transaction'} busy={mutation.pending} close={close} onConfirm={() => {
    if (!transaction) return;
    const token = identity.token({ id: transaction.id, expected: transaction.updatedAtUtc, action: 'delete' });
    void mutation.run(() => repository.deleteTransaction(token, transaction.id, transaction.updatedAtUtc), () => setDone(true));
  }} />{mutation.error ? <InlineError error={mutation.error} /> : null}</View>;
}
const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.s4, paddingBottom: spacing.s4, gap: spacing.s2 },
  dock: { paddingHorizontal: spacing.s4, paddingTop: spacing.s2, gap: spacing.s2 },
  choices: { height: layout.drawerWidth },
});
