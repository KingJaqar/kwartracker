import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { KeyboardAvoidingView, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { AppText } from '@/components/foundation-screen';
import { Badge, BottomSheet, Card, Dialog, EmptyState, GhostButton, IconButton, IconTile, InlineError, PopButton, ProgressBar, Screen, Skeleton, TextField, useOverlay, ui } from '@/components/ui';
import { MonthSelector, useDrawer } from '@/components/ledger-shell';
import { MonthPicker } from '@/screens/records';
import { newId, useCommandIdentity, useLedger, useLedgerMutation, useLedgerQuery, usePreferences } from '@/services/ledger/provider';
import { goBack, useOverlayWriteGuard, useSaveNavigationGuard } from '@/services/ledger/navigation';
import { haptic } from '@/services/ledger/haptics';
import { decimalSeparator, localDate, minorExpression, monthValue, shiftedMonth, uuidValue } from '@/domain/ledger';
import { amountFromExpression, formatMoney } from '@/domain/money';
import { budgetStatus } from '@/domain/reports';
import { AppError, errorMessage } from '@/domain/errors';
import { icons } from '@/theme/icons';
import { useAppTheme } from '@/theme/provider';
import { layout, metrics, spacing } from '@/theme/tokens';
import type { BudgetRow, CategoryRow } from '@/repositories/ledger';

type CardProps = { id: string; categoryId: string; name: string; icon: string; archived: boolean; spent: string; status: string; fill: number; warning: boolean };
type Row = { kind: 'budget'; props: CardProps } | { kind: 'section'; title: string; note: string | null } | { kind: 'unbudgeted'; id: string; name: string; icon: string };
const keyExtractor = (row: Row) => row.kind === 'budget' ? row.props.id : row.kind === 'section' ? `section:${row.title}` : `category:${row.id}`;
const itemType = (row: Row) => row.kind;

function initialMonth(value: unknown) {
  try { return typeof value === 'string' ? monthValue(value) : localDate().slice(0, 7); } catch { return localDate().slice(0, 7); }
}

export default function Budgets() {
  const params = useLocalSearchParams<{ month?: string }>();
  const { repository } = useLedger(); const preferences = usePreferences(); const drawer = useDrawer(); const overlay = useOverlay();
  const [month, setMonth] = useState(() => initialMonth(params.month));
  // A month passed later (Categories → Open Budgets on an already-mounted tab) replaces the shown month once.
  const [routeMonth, setRouteMonth] = useState(params.month);
  if (routeMonth !== params.month) { setRouteMonth(params.month); if (typeof params.month === 'string') setMonth(initialMonth(params.month)); }
  const query = useLedgerQuery(useCallback(() => repository.budgets(month), [repository, month]));
  const data = query.data?.month === month ? query.data : null;
  const separator = decimalSeparator();
  const latest = useRef(data);
  useLayoutEffect(() => { latest.current = data; }, [data]);
  const rows = useMemo(() => {
    // No Budget and no active Expense category: the empty state offers to create a category instead of a bare header.
    if (!data || (!data.budgets.length && !data.unbudgeted.length)) return [];
    const money = (value: bigint) => formatMoney(value, preferences, separator);
    const result: Row[] = data.budgets.map(budget => ({ kind: 'budget', props: cardProps(budget, money) }));
    if (!data.budgets.length) result.push({ kind: 'section', title: 'No Budgets this month', note: data.unbudgeted.length ? 'Set a monthly limit for a category below.' : null });
    if (data.unbudgeted.length) {
      result.push({ kind: 'section', title: 'Categories without a Budget', note: null });
      for (const category of data.unbudgeted) result.push({ kind: 'unbudgeted', id: category.id, name: category.name, icon: category.icon });
    }
    return result;
  }, [data, preferences, separator]);
  const actions = useCallback((id: string) => {
    const budget = latest.current?.budgets.find(row => row.id === id);
    if (!budget) return;
    overlay.show({ title: `${budget.categoryName} Budget`, content: close => <BottomSheet>
      <GhostButton label="Edit limit" onPress={() => close(() => router.push({ pathname: '/budget/[id]', params: { id: budget.id, month: budget.month } }))} />
      <GhostButton label="Delete Budget" onPress={() => { close(); overlay.show({ title: 'Delete Budget?', kind: 'dialog', destructive: true, content: dismiss => <DeleteBudget budget={budget} close={dismiss} /> }); }} />
    </BottomSheet> });
  }, [overlay]);
  const renderItem = useCallback(({ item }: { item: Row }) => item.kind === 'budget' ? <BudgetCard {...item.props} onActions={actions} />
    : item.kind === 'section' ? <View style={styles.section}><AppText variant="titleS" accessibilityRole="header">{item.title}</AppText>{item.note ? <AppText variant="caption">{item.note}</AppText> : null}</View>
      : <UnbudgetedRow id={item.id} name={item.name} icon={item.icon} month={month} />, [actions, month]);
  const choose = () => {
    const categories = latest.current?.unbudgeted ?? [];
    overlay.show({ title: 'Add Budget', content: close => <BottomSheet>{categories.length
      ? categories.map(category => <GhostButton key={category.id} label={category.name} onPress={() => close(() => openNew(category.id, month))} />)
      : <AppText>Every active Expense category already has a Budget for {month}.</AppText>}</BottomSheet> });
  };
  return <Screen title="Budgets" menu={drawer}>
    <View style={styles.header}>
      <MonthSelector month={month} previous={() => setMonth(shiftedMonth(month, -1))} next={() => setMonth(shiftedMonth(month, 1))} select={() => overlay.show({ title: 'Choose month', content: close => <MonthPicker value={month} select={value => close(() => setMonth(value))} /> })} />
      {data && (data.budgets.length || data.unbudgeted.length) ? <PopButton label="Add Budget" variant="secondary" onPress={choose} /> : null}
      {query.error ? <InlineError error={query.error} retry={query.retry} /> : null}
    </View>
    {!data ? query.loading ? <View style={ui.content}><Skeleton /></View> : null
      : !rows.length ? <EmptyState title="No Expense categories" message="Create an Expense category to set a monthly Budget." action="Create category" onPress={() => router.push('/category/new')} />
        : <FlashList key={month} data={rows} renderItem={renderItem} keyExtractor={keyExtractor} getItemType={itemType} contentContainerStyle={styles.list} />}
  </Screen>;
}

function openNew(categoryId: string, month: string) { router.push({ pathname: '/budget/new', params: { categoryId, month } }); }

function cardProps(budget: BudgetRow, money: (value: bigint) => string): CardProps {
  const limit = BigInt(budget.limitMinor);
  const result = budgetStatus(limit, budget.spentMinor);
  const spent = result.state === 'net_refund' ? `Net refund +${money(-budget.spentMinor)} · Limit ${money(limit)}` : `Spent ${money(budget.spentMinor)} of ${money(limit)}`;
  const status = result.state === 'over' ? `Over by ${money(-result.remainingMinor)}` : result.state === 'reached' ? 'Limit reached' : `${money(result.remainingMinor)} left`;
  return { id: budget.id, categoryId: budget.categoryId, name: budget.categoryName, icon: budget.categoryIcon, archived: Boolean(budget.categoryArchived), spent, status, fill: result.fraction, warning: result.state === 'over' || result.state === 'reached' };
}

const BudgetCard = memo(function BudgetCard({ id, categoryId, name, icon, archived, spent, status, fill, warning, onActions }: CardProps & { onActions: (id: string) => void }) {
  const { colors } = useAppTheme(); const { fontScale } = useWindowDimensions(); const Warning = icons.warning;
  return <View style={styles.card}><Card>
    <View style={ui.inline}><IconTile id={categoryId} icon={icon} /><View style={ui.flex}><AppText variant="titleS" numberOfLines={fontScale >= layout.nameWrapScale ? 2 : 1}>{name}</AppText>{archived ? <Badge label="Archived" /> : null}</View>
      <IconButton label={`${name} Budget actions`} icon="more" onPress={() => onActions(id)} /></View>
    <AppText>{spent}</AppText>
    <ProgressBar fill={fill} over={warning} label={`${name}: ${spent}. ${status}`} />
    <View style={ui.inline}>{warning ? <Warning color={colors.expense} size={metrics.icon} strokeWidth={metrics.iconStroke} /> : null}<AppText variant="label" style={{ color: warning ? colors.expense : colors.textSecondary }}>{status}</AppText></View>
  </Card></View>;
});

/** One labelled target per category; the visible action stays short so long names keep their width. */
const UnbudgetedRow = memo(function UnbudgetedRow({ id, name, icon, month }: { id: string; name: string; icon: string; month: string }) {
  const { colors } = useAppTheme(); const { fontScale } = useWindowDimensions();
  return <Pressable accessibilityRole="button" accessibilityLabel={`Set ${name} Budget`} onPress={() => openNew(id, month)} style={({ pressed }) => [ui.row, { backgroundColor: pressed ? colors.surface2 : colors.surface1, borderBottomColor: colors.divider }]}>
    <IconTile id={id} icon={icon} /><AppText variant="titleS" style={ui.flex} numberOfLines={fontScale >= layout.nameWrapScale ? 2 : 1}>{name}</AppText>
    <AppText variant="label" style={{ color: colors.accent }}>Set Budget</AppText>
  </Pressable>;
});

function DeleteBudget({ budget, close }: { budget: BudgetRow; close: (then?: () => void) => void }) {
  const { repository } = useLedger(); const mutation = useLedgerMutation(); const identity = useCommandIdentity(); const [done, setDone] = useState(false);
  useOverlayWriteGuard(mutation.pending);
  useEffect(() => { if (done && !mutation.pending) close(); }, [done, mutation.pending, close]);
  return <View style={ui.gap}><Dialog message={`Delete the ${budget.categoryName} Budget for ${budget.month}? Transactions, balances and Analysis stay unchanged. You can create it again later.`} action="Delete Budget" busy={mutation.pending} close={close} onConfirm={() => {
    const token = identity.token({ id: budget.id, expected: budget.updatedAtUtc, action: 'delete' });
    void mutation.run(() => repository.deleteBudget(token, budget.id, budget.updatedAtUtc), () => setDone(true));
  }} />{mutation.error ? <InlineError error={mutation.error} /> : null}</View>;
}

type EditorData = { category: CategoryRow; budget: BudgetRow | null; month: string };
/** Create (category + month) or edit (id + month) one month's limit; the category and month never change (BR-11). */
export function BudgetEditor({ id, categoryId, month }: { id?: string; categoryId?: string; month?: string }) {
  const { repository } = useLedger();
  const query = useLedgerQuery(useCallback(async (): Promise<EditorData> => {
    const target = monthValue(month ?? '');
    const [view, categories] = await Promise.all([repository.budgets(target), repository.categories()]);
    const budget = id ? view.budgets.find(row => row.id === uuidValue(id)) ?? null : null;
    const category = categories.find(row => row.id === (budget?.categoryId ?? uuidValue(categoryId ?? '')));
    if ((id && !budget) || !category) throw new AppError('ENTITY_MISSING');
    return { category, budget, month: target };
  }, [repository, id, categoryId, month]));
  if (!query.data) return <Screen title="Budget" onBack={goBack}><View style={ui.content}>{query.error ? <InlineError error={query.error} retry={query.retry} /> : <Skeleton />}</View></Screen>;
  return <BudgetForm key={`${id ?? 'new'}:${query.data.category.id}:${query.data.month}`} data={query.data} />;
}

function BudgetForm({ data }: { data: EditorData }) {
  const [initial] = useState(data);
  const { repository } = useLedger(); const preferences = usePreferences(); const mutation = useLedgerMutation(); const identity = useCommandIdentity();
  const separator = decimalSeparator();
  const [id] = useState(() => initial.budget?.id ?? newId());
  const [limit, setLimit] = useState(() => initial.budget ? minorExpression(initial.budget.limitMinor).replace('.', separator) : '');
  const [error, setError] = useState<string | null>(null); const [done, setDone] = useState(false);
  useSaveNavigationGuard(mutation.pending);
  useEffect(() => { if (done && !mutation.pending) goBack(); }, [done, mutation.pending]);
  function validate() {
    try { amountFromExpression(limit, { decimalSeparator: separator }); setError(null); return true; }
    catch (cause) { setError(cause instanceof AppError && cause.code === 'INVALID_AMOUNT' ? 'Enter a monthly limit greater than zero.' : errorMessage(cause)); return false; }
  }
  function save() {
    if (!validate()) { haptic('error'); return; }
    const input = { categoryId: initial.category.id, month: initial.month, limitExpression: limit, decimalSeparator: separator, expectedUpdatedAtUtc: initial.budget?.updatedAtUtc ?? null };
    const token = identity.token(input);
    void mutation.run(() => repository.saveBudget(token, id, input, Boolean(initial.budget)), () => { haptic('success'); setDone(true); });
  }
  const spent = initial.budget ? initial.budget.spentMinor : null;
  return <KeyboardAvoidingView style={ui.flex} behavior="padding"><Screen title={initial.budget ? 'Edit Budget' : 'New Budget'} onBack={() => { if (!mutation.pending) goBack(); }} scroll>
    <View style={ui.inline}><IconTile id={initial.category.id} icon={initial.category.icon} /><View style={ui.flex}><AppText variant="titleS">{initial.category.name}</AppText><AppText variant="caption">{initial.month}</AppText></View></View>
    {spent !== null ? <AppText variant="caption">{spent < 0n ? `Net refund +${formatMoney(-spent, preferences, separator)} so far this month.` : `Spent ${formatMoney(spent, preferences, separator)} so far this month.`}</AppText> : null}
    <TextField label="Monthly limit" value={limit} onChangeText={setLimit} onBlur={validate} error={error} editable={!mutation.pending} keyboardType="decimal-pad" accessibilityHint="The limit applies to this month only and does not roll over." />
    <AppText variant="caption">A new limit replaces this month’s limit only. It never changes your transactions.</AppText>
    {mutation.error ? <InlineError error={mutation.error} /> : null}
    <PopButton label="Save Budget" onPress={save} loading={mutation.pending} />
  </Screen></KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.s4, gap: spacing.s2 },
  list: { paddingHorizontal: spacing.s4, paddingBottom: layout.listBottomPadding },
  card: { paddingVertical: spacing.s2 },
  section: { paddingTop: spacing.s4, paddingBottom: spacing.s2, gap: spacing.s1 },
});
