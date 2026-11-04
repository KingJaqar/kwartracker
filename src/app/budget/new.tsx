import { useLocalSearchParams } from 'expo-router';
import { BudgetEditor } from '@/screens/budgets';
export { RouteFailure as ErrorBoundary } from '@/components/ledger-shell';
export default function NewBudget() { const { categoryId, month } = useLocalSearchParams<{ categoryId: string; month: string }>(); return <BudgetEditor categoryId={categoryId} month={month} />; }
