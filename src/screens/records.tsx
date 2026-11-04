import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/foundation-screen';
import { BottomSheet, Chip, EmptyState, GhostButton, HeroCard, IconButton, InlineError, MoneyText, Screen, Skeleton, TransactionRow, useOverlay, ui } from '@/components/ui';
import { MonthSelector, useDrawer } from '@/components/ledger-shell';
import { useLedger, useLedgerQuery, usePreferences } from '@/services/ledger/provider';
import { decimalSeparator, localDate, monthValue, shiftedMonth, transactionAmount, uuidValue } from '@/domain/ledger';
import { formatMoney } from '@/domain/money';
import { layout, spacing } from '@/theme/tokens';
import type { PageCursor, TransactionRow as StoredRow } from '@/repositories/ledger';
import { useAppTheme } from '@/theme/provider';

type Row = { kind: 'date'; date: string; net: string } | { kind: 'transaction'; props: Omit<ComponentProps<typeof TransactionRow>, 'onPress'> };
type SavedTarget = { id: string; month: string; operation: string };
const openEntry = (id: string) => router.push({ pathname: '/transaction/[id]', params: { id } });
const keyExtractor = (item: Row) => item.kind === 'date' ? `date:${item.date}` : item.props.id;
const itemType = (item: Row) => item.kind;
const renderItem = ({ item }: { item: Row }) => item.kind === 'date'
  ? <View style={styles.day}><AppText variant="label">{item.date}</AppText><MoneyText value={item.net} /></View>
  : <TransactionRow {...item.props} onPress={openEntry} />;

export default function Records() {
  const params = useLocalSearchParams<{ savedId?: string; savedMonth?: string; savedOperation?: string }>();
  const target = useMemo(() => {
    try {
      if (typeof params.savedId !== 'string' || typeof params.savedMonth !== 'string' || typeof params.savedOperation !== 'string') return null;
      return { id: uuidValue(params.savedId), month: monthValue(params.savedMonth), operation: uuidValue(params.savedOperation) };
    } catch { return null; }
  }, [params.savedId, params.savedMonth, params.savedOperation]);
  return <RecordsList key={target?.operation ?? 'browse'} target={target} />;
}

function RecordsList({ target }: { target: SavedTarget | null }) {
  const list = useRef<FlashListRef<Row>>(null);
  const [listLoad, setListLoad] = useState(0);
  const [focusError, setFocusError] = useState<unknown>(null);
  const [focusCancelled, setFocusCancelled] = useState(false);
  const { repository } = useLedger(); const preferences = usePreferences(); const drawer = useDrawer(); const overlay = useOverlay(); const { colors } = useAppTheme();
  const [month, setMonth] = useState(() => target?.month ?? localDate().slice(0, 7));
  const query = useLedgerQuery(useCallback(() => repository.records(month), [repository, month]));
  const [tail, setTail] = useState<{ base: typeof query.data; rows: StoredRow[]; next: PageCursor | null } | null>(null);
  const [paging, setPaging] = useState(false); const [pageError, setPageError] = useState<{ base: typeof query.data; error: unknown } | null>(null);
  const pageLock = useRef(false); const failedPage = useRef(false); const current = useRef(query.data);
  useLayoutEffect(() => { current.current = query.data; failedPage.current = false; }, [query.data]);
  const data = query.data?.month === month ? query.data : null;
  const extra = tail?.base === data ? tail : null;
  const cursor = extra ? extra.next : data?.page.next;
  const loadMore = useCallback(async (explicit = false) => {
    if (!data || !cursor || pageLock.current || query.loading || (failedPage.current && !explicit)) return;
    pageLock.current = true; failedPage.current = false; setPaging(true); setPageError(null);
    try {
      const page = await repository.page(month, cursor);
      if (current.current === data) setTail(previous => ({ base: data, rows: [...(previous?.base === data ? previous.rows : []), ...page.rows], next: page.next }));
    } catch (error) { if (current.current === data) { failedPage.current = true; setPageError({ base: data, error }); } }
    finally { pageLock.current = false; setPaging(false); }
  }, [data, cursor, query.loading, repository, month]);
  const separator = decimalSeparator();
  const rows = useMemo(() => {
    const result: Row[] = [];
    let date: string | null = null;
    for (const row of [...(data?.page.rows ?? []), ...(extra?.rows ?? [])]) {
      if (date !== row.accountingDate) {
        date = row.accountingDate; result.push({ kind: 'date', date, net: formatMoney(data?.summary.days[date] ?? 0n, preferences, separator) });
      }
      result.push({ kind: 'transaction', props: {
        id: row.id, title: row.type === 'transfer' ? 'Transfer' : row.categoryName ?? 'Category',
        identity: row.categoryId ?? row.accountId, icon: row.categoryIcon ?? row.accountIcon, type: row.type,
        subtitle: [row.toAccountName ? `${row.accountName} → ${row.toAccountName}` : row.accountName, preferences.notesVisibleInList ? row.note : null].filter(Boolean).join(' · '),
        amount: transactionAmount(BigInt(row.amountMinor), row.type, row.expenseEffect, preferences, separator),
        refund: row.expenseEffect === 'refund', recurring: row.originKind === 'recurring',
      } });
    }
    return result;
  }, [data, extra, preferences, separator]);
  useEffect(() => {
    if (!target || focusCancelled || month !== target.month || !data || query.loading || query.error || paging || pageError?.base === data || focusError) return;
    const index = rows.findIndex(row => row.kind === 'transaction' && row.props.id === target.id);
    if (index < 0) {
      let active = true;
      if (cursor) void Promise.resolve().then(() => { if (active) return loadMore(); });
      return () => { active = false; };
    }
    if (!list.current || !listLoad) return;
    let active = true;
    void list.current.scrollToIndex({ index, animated: false, viewPosition: 0 }).then(() => {
      if (active) setFocusCancelled(true);
    }, error => { if (active) setFocusError(error); });
    return () => { active = false; };
  }, [target, focusCancelled, month, data, query.loading, query.error, paging, pageError, focusError, rows, cursor, loadMore, listLoad]);
  const missingTarget = target && !focusCancelled && data && !query.loading && !paging && !cursor && !rows.some(row => row.kind === 'transaction' && row.props.id === target.id);
  function changeMonth(value: string) { setFocusCancelled(true); setFocusError(null); setMonth(value); failedPage.current = false; setPageError(null); }
  return <Screen title="Records" menu={drawer}>
    <View style={styles.summary}>
      <MonthSelector month={month} previous={() => changeMonth(shiftedMonth(month, -1))} next={() => changeMonth(shiftedMonth(month, 1))} select={() => overlay.show({ title: 'Choose month', content: close => <MonthPicker value={month} select={value => close(() => changeMonth(value))} /> })} />
      <HeroCard><View style={ui.inline}><View style={ui.flex}><AppText variant="caption">Income</AppText>{data ? <MoneyText value={transactionAmount(data.summary.incomeMinor, 'income', null, preferences, separator)} tone="income" /> : <AppText>—</AppText>}</View><View style={ui.flex}><AppText variant="caption">{data && data.summary.expenseMinor < 0n ? 'Net refund' : 'Expense'}</AppText>{data ? <MoneyText value={transactionAmount(data.summary.expenseMinor < 0n ? -data.summary.expenseMinor : data.summary.expenseMinor, 'expense', data.summary.expenseMinor < 0n ? 'refund' : 'purchase', preferences, separator)} /> : <AppText>—</AppText>}</View></View></HeroCard>
      {query.error ? <InlineError error={query.error} retry={query.retry} /> : null}
      {focusError || missingTarget ? <InlineError message="This record could not be brought into view." retry={() => { setFocusError(null); query.retry(); }} /> : null}
    </View>
    {!data ? query.loading ? <View style={ui.content}><Skeleton /></View> : null : !data.hasAccounts ?
      <EmptyState title="Create your first account" message="Add a cash or bank account, then record your first income or expense. Everything stays on this device." action="Create account" onPress={() => router.push('/account/new')} /> :
      <FlashList ref={list} onLoad={() => setListLoad(value => value + 1)} key={month} data={rows} renderItem={renderItem} keyExtractor={keyExtractor} getItemType={itemType} contentContainerStyle={styles.list} onEndReached={() => { void loadMore(); }} onEndReachedThreshold={layout.moneyMinScale}
        ListEmptyComponent={<EmptyState title="A fresh month" message="No records for this month yet." action="Add a transaction" onPress={() => router.push('/transaction/new')} />}
        ListFooterComponent={paging ? <Skeleton /> : pageError?.base === data ? <InlineError error={pageError.error} retry={() => { void loadMore(true); }} /> : null} />}
    {data?.hasAccounts ? <View style={[styles.fab, { backgroundColor: colors.accent }]}><IconButton label="Add transaction" icon="plus" onAccent onPress={() => router.push('/transaction/new')} /></View> : null}
  </Screen>;
}

/** The year is stepped, not typed: a TextInput here made the first sheet open after launch miss NFR-11 (first native TextInput in the process). */
export function MonthPicker({ value, select }: { value: string; select: (month: string) => void }) {
  const [year, setYear] = useState(() => Number(value.slice(0, 4)));
  return <BottomSheet>
    <View style={ui.inline}>
      <IconButton label="Previous year" icon="back" disabled={year <= MIN_YEAR} onPress={() => setYear(current => Math.max(MIN_YEAR, current - 1))} />
      <AppText variant="titleS" accessibilityRole="header" accessibilityLiveRegion="polite" style={styles.year}>{String(year)}</AppText>
      <IconButton label="Next year" icon="next" disabled={year >= MAX_YEAR} onPress={() => setYear(current => Math.min(MAX_YEAR, current + 1))} />
    </View>
    <View style={ui.inline}>{Array.from({ length: 12 }, (_, index) => { const month = `${year}-${String(index + 1).padStart(2, '0')}`; return <Chip key={index} label={String(index + 1)} selected={month === value} onPress={() => select(monthValue(month))} />; })}</View>
    <GhostButton label="Current month" onPress={() => select(localDate().slice(0, 7))} />
  </BottomSheet>;
}
const MIN_YEAR = 1900; const MAX_YEAR = 9999;
const styles = StyleSheet.create({
  summary: { paddingHorizontal: spacing.s4, gap: spacing.s2 },
  day: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.s2, paddingVertical: spacing.s3 },
  list: { paddingHorizontal: spacing.s4, paddingBottom: layout.listBottomPadding },
  year: { flex: 1, textAlign: 'center' },
  fab: { position: 'absolute', right: spacing.s4, bottom: spacing.s4, width: layout.fab, height: layout.fab, borderRadius: layout.fab, alignItems: 'center', justifyContent: 'center' },
});
