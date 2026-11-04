import { useLocalSearchParams } from 'expo-router';
import TransactionEntry from '@/screens/transaction';
export { RouteFailure as ErrorBoundary } from '@/components/ledger-shell';
export default function EditTransaction() { const { id } = useLocalSearchParams<{ id: string }>(); return <TransactionEntry id={id} />; }
