import { memo, useCallback, useEffect, useState } from 'react';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { KeyboardAvoidingView, Pressable, View, useWindowDimensions } from 'react-native';
import { AppText } from '@/components/foundation-screen';
import { Badge, BottomSheet, Card, Chip, Dialog, EmptyState, GhostButton, IconTile, InlineError, ListRowToggle, MoneyText, PopButton, Screen, SegmentedControl, Skeleton, TextField, useOverlay, ui } from '@/components/ui';
import { useDrawer } from '@/components/ledger-shell';
import { newId, useCommandIdentity, useLedger, useLedgerMutation, useLedgerQuery, usePreferences } from '@/services/ledger/provider';
import { goBack, useOverlayWriteGuard, useSaveNavigationGuard } from '@/services/ledger/navigation';
import { decimalSeparator, minorExpression, shortText } from '@/domain/ledger';
import { amountFromExpression, formatMoney } from '@/domain/money';
import { AppError, errorMessage } from '@/domain/errors';
import { icons } from '@/theme/icons';
import { layout } from '@/theme/tokens';
import { useAppTheme } from '@/theme/provider';
import type { AccountBalance, AccountRow, CategoryRow, ReferenceCounts } from '@/repositories/ledger';
import { haptic } from '@/services/ledger/haptics';
type Kind = 'account' | 'category';
const types = [{ label: 'Income', value: 'income' }, { label: 'Expense', value: 'expense' }] as const;
const openAccount = (id: string) => router.push({ pathname: '/account/[id]', params: { id } });
const openCategory = (id: string) => router.push({ pathname: '/category/[id]', params: { id } });
const rowKey = (row: { id: string }) => row.id;

const EntityRow = memo(function EntityRow({ id, name, icon, archived, amount, onPress }: { id: string; name: string; icon: string; archived: boolean; amount?: string; onPress: (id: string) => void }) {
  const { colors } = useAppTheme(); const { fontScale } = useWindowDimensions();
  return <Pressable accessibilityRole="button" accessibilityLabel={`${name}${archived ? ', Archived' : ''}${amount ? `, ${amount}` : ''}`} onPress={() => onPress(id)} style={({ pressed }) => [ui.row, { backgroundColor: pressed ? colors.surface2 : colors.surface1, borderBottomColor: colors.divider }]}>
    <IconTile id={id} icon={icon} /><View style={ui.flex}><AppText variant="titleS" numberOfLines={fontScale >= layout.nameWrapScale ? 2 : 1}>{name}</AppText>{archived ? <Badge label="Archived" /> : null}{amount ? <MoneyText value={amount} variant="displayL" /> : null}</View>
  </Pressable>;
});

export function EntityList({ kind }: { kind: Kind }) {
  const { repository } = useLedger(); const preferences = usePreferences(); const drawer = useDrawer();
  const [showArchived, setShowArchived] = useState(false); const [type, setType] = useState<'income' | 'expense'>('expense');
  const query = useLedgerQuery(useCallback(async () => ({ accounts: kind === 'account' ? await repository.accounts() : [], categories: kind === 'category' ? await repository.categories() : [] }), [kind, repository]));
  const separator = decimalSeparator();
  const renderAccount = useCallback(({ item }: { item: AccountBalance }) => <EntityRow id={item.id} name={item.name} icon={item.icon} archived={Boolean(item.isArchived)} amount={formatMoney(item.balanceMinor, preferences, separator)} onPress={openAccount} />, [preferences, separator]);
  const renderCategory = useCallback(({ item }: { item: CategoryRow }) => <EntityRow id={item.id} name={item.name} icon={item.icon} archived={Boolean(item.isArchived)} onPress={openCategory} />, []);
  const create = () => router.push(kind === 'account' ? '/account/new' : '/category/new');
  const content = query.data;
  const accountRows = content?.accounts.filter(row => showArchived || !row.isArchived) ?? [];
  const categoryRows = content?.categories.filter(row => row.type === type && (showArchived || !row.isArchived)) ?? [];
  return <Screen title={kind === 'account' ? 'Accounts' : 'Categories'} menu={drawer}>
    <View style={ui.content}>
      {kind === 'account' && content ? <Card><AppText variant="caption">All Accounts · includes archived</AppText><MoneyText value={formatMoney(content.accounts.reduce((sum, row) => sum + row.balanceMinor, 0n), preferences, separator)} variant="displayXL" /></Card> : null}
      {kind === 'category' ? <SegmentedControl options={types} value={type} onChange={value => { if (value === 'income' || value === 'expense') setType(value); }} /> : null}
      <ListRowToggle label="Show archived" value={showArchived} onChange={setShowArchived} />
      <PopButton label={kind === 'account' ? 'Create account' : 'Create category'} onPress={create} />
      {query.error ? <InlineError error={query.error} retry={query.retry} /> : null}
      {!content && query.loading ? <Skeleton /> : null}
      {content ? kind === 'account' ? <FlashList data={accountRows} renderItem={renderAccount} keyExtractor={rowKey} ListEmptyComponent={<EmptyState title="No accounts here" message="Create an account or show archived accounts." action="Create account" onPress={create} />} />
        : <FlashList data={categoryRows} renderItem={renderCategory} keyExtractor={rowKey} ListEmptyComponent={<EmptyState title="No categories here" message="Create a category or show archived categories." action="Create category" onPress={create} />} /> : null}
    </View>
  </Screen>;
}

export function EntityEditor({ kind, id }: { kind: Kind; id?: string }) {
  const { repository } = useLedger();
  const query = useLedgerQuery(useCallback(async () => {
    if (!id) return { row: null, counts: null };
    const [rows, counts] = await Promise.all([kind === 'account' ? repository.accounts() : repository.categories(), repository.references(kind, id)]);
    const row = rows.find(item => item.id === id);
    if (!row) throw new AppError('ENTITY_MISSING');
    return { row, counts };
  }, [kind, id, repository]));
  if (!query.data) return <Screen title={kind === 'account' ? 'Account' : 'Category'} onBack={goBack}><View style={ui.content}>{query.error ? <InlineError error={query.error} retry={query.retry} /> : <Skeleton />}</View></Screen>;
  return <EntityForm key={`${kind}:${id ?? 'new'}`} kind={kind} initial={query.data.row} counts={query.data.counts} />;
}

function EntityForm({ kind, initial: incoming, counts }: { kind: Kind; initial: AccountRow | CategoryRow | null; counts: ReferenceCounts | null }) {
  const [initial] = useState(incoming);
  const { repository } = useLedger(); const overlay = useOverlay(); const mutation = useLedgerMutation(); const identity = useCommandIdentity();
  const [id] = useState(() => initial?.id ?? newId()); const [name, setName] = useState(initial?.name ?? ''); const [icon, setIcon] = useState(initial?.icon ?? (kind === 'account' ? 'wallet' : 'other'));
  const [type, setType] = useState<'income' | 'expense'>(initial && 'type' in initial ? initial.type : 'expense');
  const separator = decimalSeparator();
  const [opening, setOpening] = useState(() => initial && 'openingBalanceMinor' in initial ? minorExpression(initial.openingBalanceMinor).replace('.', separator) : '0');
  const [nameError, setNameError] = useState<string | null>(null); const [amountError, setAmountError] = useState<string | null>(null); const [done, setDone] = useState(false);
  useSaveNavigationGuard(mutation.pending);
  useEffect(() => { if (done && !mutation.pending) goBack(); }, [done, mutation.pending]);
  function validateName() { try { shortText(name); setNameError(null); return true; } catch (error) { setNameError(errorMessage(error)); return false; } }
  function validateOpening() { try { amountFromExpression(opening, { openingBalance: true, decimalSeparator: separator }); setAmountError(null); return true; } catch (error) { setAmountError(error instanceof AppError && error.code === 'INVALID_AMOUNT' ? 'Enter a valid opening balance. Zero and negative balances are allowed.' : errorMessage(error)); return false; } }
  function save() {
    const validName = validateName(); const validAmount = kind !== 'account' || validateOpening();
    if (!validName || !validAmount) { haptic('error'); return; }
    const common = { name, icon, expectedUpdatedAtUtc: initial?.updatedAtUtc ?? null, isArchived: Boolean(initial?.isArchived) };
    const input = kind === 'account' ? { ...common, openingExpression: opening, decimalSeparator: separator } : { ...common, type };
    const token = identity.token(input);
    void mutation.run(() => kind === 'account' && 'openingExpression' in input ? repository.saveAccount(token, id, input, Boolean(initial))
      : 'type' in input ? repository.saveCategory(token, id, input, Boolean(initial)) : Promise.reject(new Error('Invalid form')), () => setDone(true));
  }
  function lifecycle(action: 'archive' | 'restore' | 'delete') {
    if (!initial) return;
    const references = counts ? Object.entries(counts).filter(([, count]) => count > 0).map(([label, count]) => `${count} ${label}`).join(', ') : '';
    overlay.show({ title: `${action === 'delete' ? 'Delete' : action === 'archive' ? 'Archive' : 'Restore'} ${kind}?`, kind: 'dialog', destructive: action !== 'restore', content: close => <EntityConfirmation kind={kind} initial={initial} action={action} close={close} finished={() => setDone(true)} message={action === 'delete'
      ? references ? `Used by ${references}. This item cannot be deleted. Archive it to keep its history.` : `Delete “${initial.name}”? This cannot be undone.`
      : action === 'archive' ? `Hide “${initial.name}” from new-entry pickers? Saved history and balances stay available.` : `Make “${initial.name}” selectable again? Saved history stays unchanged.`} blocked={action === 'delete' && Boolean(references)} /> });
  }
  return <KeyboardAvoidingView style={ui.flex} behavior="padding"><Screen title={`${initial ? 'Edit' : 'Create'} ${kind}`} onBack={() => { if (!mutation.pending) goBack(); }} scroll>
    <TextField label="Name" value={name} maxLength={120} onChangeText={setName} onBlur={validateName} error={nameError} editable={!mutation.pending} />
    <GhostButton label={`Icon: ${icon}`} disabled={mutation.pending} onPress={() => overlay.show({ title: 'Choose an icon', content: close => <BottomSheet><View style={ui.inline}>{Object.keys(icons).slice(0, 29).map(key => <Chip key={key} label={key} selected={key === icon} onPress={() => close(() => setIcon(key))} />)}</View></BottomSheet> })} />
    <IconTile id={id} icon={icon} />
    {kind === 'account' ? <TextField label="Opening balance" value={opening} onChangeText={setOpening} onBlur={validateOpening} error={amountError} editable={!mutation.pending} accessibilityHint="Zero and negative opening balances are allowed." /> : <SegmentedControl options={types} value={type} disabled={Boolean(initial) || mutation.pending} onChange={value => { if (value === 'income' || value === 'expense') setType(value); }} />}
    {initial && kind === 'category' ? <AppText variant="caption">Category type stays fixed. You can edit its name and icon.</AppText> : null}
    {mutation.error ? <InlineError error={mutation.error} /> : null}
    <PopButton label="Save" onPress={save} loading={mutation.pending} />
    {initial ? <><GhostButton label={initial.isArchived ? 'Restore' : 'Archive'} disabled={mutation.pending} onPress={() => lifecycle(initial.isArchived ? 'restore' : 'archive')} /><GhostButton label="Delete" disabled={mutation.pending} onPress={() => lifecycle('delete')} /></> : null}
  </Screen></KeyboardAvoidingView>;
}

function EntityConfirmation({ kind, initial, action, close, finished, message, blocked }: { kind: Kind; initial: AccountRow | CategoryRow; action: 'archive' | 'restore' | 'delete'; close: (then?: () => void) => void; finished: () => void; message: string; blocked: boolean }) {
  const { repository } = useLedger(); const mutation = useLedgerMutation(); const identity = useCommandIdentity(); const [committed, setCommitted] = useState(false);
  useOverlayWriteGuard(mutation.pending);
  useEffect(() => { if (committed && !mutation.pending) close(finished); }, [committed, mutation.pending, close, finished]);
  if (blocked) return <View style={ui.gap}><AppText>{message}</AppText><GhostButton label="Cancel" onPress={close} /></View>;
  return <View style={ui.gap}><Dialog message={message} action={action === 'archive' ? 'Archive' : action === 'restore' ? 'Restore' : 'Delete'} busy={mutation.pending} close={close} onConfirm={() => {
    const token = identity.token({ kind, id: initial.id, action, expected: initial.updatedAtUtc });
    void mutation.run(() => repository.lifecycle(token, kind, initial.id, action, initial.updatedAtUtc), () => setCommitted(true));
  }} />{mutation.error ? <InlineError error={mutation.error} /> : null}</View>;
}
