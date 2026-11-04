import { useLocalSearchParams } from 'expo-router';
import { EntityEditor } from '@/screens/entities';
export { RouteFailure as ErrorBoundary } from '@/components/ledger-shell';
export default function EditCategory() { const { id } = useLocalSearchParams<{ id: string }>(); return <EntityEditor kind="category" id={id} />; }
