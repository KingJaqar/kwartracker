import { useLocalSearchParams } from 'expo-router';
import { EntityEditor } from '@/screens/entities';
export { RouteFailure as ErrorBoundary } from '@/components/ledger-shell';
export default function EditAccount() { const { id } = useLocalSearchParams<{ id: string }>(); return <EntityEditor kind="account" id={id} />; }
