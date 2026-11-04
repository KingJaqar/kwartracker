import { useCallback, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/foundation-screen';
import { Chip, EmptyState, HeroCard, InlineError, MoneyText, RankedBarRow, RankedListRow, Screen, Skeleton, ui } from '@/components/ui';
import { useDrawer } from '@/components/ledger-shell';
import { DateTimeEditor } from '@/screens/transaction';
import { useLedger, useLedgerQuery, usePreferences } from '@/services/ledger/provider';
import { decimalSeparator, localDate, transactionAmount } from '@/domain/ledger';
import { formatMoney, type MoneyPreferences } from '@/domain/money';
import { chartShares, shareLabel } from '@/domain/reports';
import { AppError } from '@/domain/errors';
import { layout, spacing } from '@/theme/tokens';

type Row = { kind: 'section'; title: string } | { kind: 'chartEmpty' }
  | { kind: 'bar'; id: string; icon: string; name: string; amount: string; share: string; width: number }
  | { kind: 'item'; id: string; icon: string; name: string; amount: string; netRefund: boolean; archived: boolean };
const keyExtractor = (row: Row) => row.kind === 'section' ? `section:${row.title}` : row.kind === 'chartEmpty' ? 'chart-empty' : `${row.kind}:${row.id}`;
const itemType = (row: Row) => row.kind;
const addTransaction = () => router.push('/transaction/new');
const renderItem = ({ item }: { item: Row }) => item.kind === 'section' ? <View style={styles.section}><AppText variant="titleS" accessibilityRole="header">{item.title}</AppText></View>
  : item.kind === 'chartEmpty' ? <EmptyState title="No positive spending" message="No Expense category has a positive net amount in this range, so there is no largest category." action="Add a transaction" onPress={addTransaction} />
    : item.kind === 'bar' ? <RankedBarRow id={item.id} icon={item.icon} name={item.name} amount={item.amount} share={item.share} width={item.width} />
      : <RankedListRow id={item.id} icon={item.icon} name={item.name} amount={item.amount} netRefund={item.netRefund} archived={item.archived} />;

/** The default range is the current calendar month (SCR-02). */
function currentMonth() {
  const today = localDate(); const year = Number(today.slice(0, 4)); const month = Number(today.slice(5, 7));
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from: `${today.slice(0, 7)}-01`, to: `${today.slice(0, 7)}-${String(last).padStart(2, '0')}` };
}

function netAmount(value: bigint, preferences: MoneyPreferences, separator: string) {
  return value < 0n ? transactionAmount(-value, 'expense', 'refund', preferences, separator) : value > 0n ? transactionAmount(value, 'expense', 'purchase', preferences, separator) : formatMoney(0n, preferences, separator);
}

export default function Analysis() {
  const { repository } = useLedger(); const preferences = usePreferences(); const drawer = useDrawer();
  const [range, setRange] = useState(currentMonth);
  const [editing, setEditing] = useState<'from' | 'to' | null>(null);
  const [rangeError, setRangeError] = useState<unknown>(null);
  const query = useLedgerQuery(useCallback(() => repository.analysis(range.from, range.to), [repository, range]));
  const data = query.data?.from === range.from && query.data.to === range.to ? query.data : null;
  const separator = decimalSeparator();
  const view = useMemo(() => {
    if (!data) return null;
    const shares = chartShares(data.categories);
    const rows: Row[] = [{ kind: 'section', title: 'Spending by category' }];
    if (shares.length) for (const { row, tenths } of shares) rows.push({ kind: 'bar', id: row.id, icon: row.icon, name: row.name, amount: netAmount(row.netMinor, preferences, separator), share: shareLabel(tenths), width: Number(tenths) / 10 });
    else rows.push({ kind: 'chartEmpty' });
    rows.push({ kind: 'section', title: 'All Expense categories' });
    for (const row of data.categories) rows.push({ kind: 'item', id: row.id, icon: row.icon, name: row.name, amount: netAmount(row.netMinor, preferences, separator), netRefund: row.netMinor < 0n, archived: Boolean(row.isArchived) });
    return { rows, largest: shares[0]?.row.name ?? null, empty: !data.categories.length };
  }, [data, preferences, separator]);
  function apply(value: string) {
    const next = editing === 'from' ? { from: value, to: range.to } : { from: range.from, to: value };
    setEditing(null);
    if (next.from > next.to) { setRangeError(new AppError('INVALID_DATE_RANGE')); return; }
    setRangeError(null); setRange(next);
  }
  return <Screen title="Analysis" menu={drawer}>
    <View style={styles.header}>
      <View style={ui.inline}><Chip label={`From ${range.from}`} selected={editing === 'from'} onPress={() => setEditing('from')} /><Chip label={`To ${range.to}`} selected={editing === 'to'} onPress={() => setEditing('to')} /></View>
      {editing ? <DateTimeEditor key={editing} mode="date" initial={editing === 'from' ? range.from : range.to} apply={apply} cancel={() => setEditing(null)} /> : null}
      {rangeError ? <InlineError error={rangeError} /> : null}
      <HeroCard><View style={ui.inline}>
        <View style={ui.flex}><AppText variant="caption">Income</AppText>{data ? <MoneyText value={transactionAmount(data.incomeMinor, 'income', null, preferences, separator)} tone="income" /> : <AppText>—</AppText>}</View>
        <View style={ui.flex}><AppText variant="caption">{data && data.expenseMinor < 0n ? 'Net refund' : 'Net Expense'}</AppText>{data ? <MoneyText value={netAmount(data.expenseMinor, preferences, separator)} /> : <AppText>—</AppText>}</View>
      </View>{view?.largest ? <AppText variant="label">Largest Expense category: {view.largest}</AppText> : null}</HeroCard>
      {query.error ? <InlineError error={query.error} retry={query.retry} /> : null}
    </View>
    {!view ? query.loading ? <View style={ui.content}><Skeleton /></View> : null
      : view.empty ? <EmptyState title="No Expense categories" message="Create an Expense category to see spending by category." action="Create category" onPress={() => router.push('/category/new')} />
        : <FlashList data={view.rows} renderItem={renderItem} keyExtractor={keyExtractor} getItemType={itemType} contentContainerStyle={styles.list} />}
  </Screen>;
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.s4, gap: spacing.s2 },
  section: { paddingTop: spacing.s4, paddingBottom: spacing.s2 },
  list: { paddingHorizontal: spacing.s4, paddingBottom: layout.listBottomPadding },
});
