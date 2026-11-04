import { useLocalSearchParams } from 'expo-router';
import { BudgetEditor } from '@/screens/budgets';
export { RouteFailure as ErrorBoundary } from '@/components/ledger-shell';
export default function EditBudget() { const { id, month } = useLocalSearchParams<{ id: string; month: string }>(); return <BudgetEditor id={id} month={month} />; }
