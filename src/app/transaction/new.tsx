import { useLocalSearchParams } from 'expo-router';
import TransactionEntry from '@/screens/transaction';
export { RouteFailure as ErrorBoundary } from '@/components/ledger-shell';
export default function NewTransaction() { const { duplicateId } = useLocalSearchParams<{ duplicateId?: string }>(); return <TransactionEntry duplicateId={duplicateId} />; }
