import { EntityEditor } from '@/screens/entities';
export { RouteFailure as ErrorBoundary } from '@/components/ledger-shell';
export default function NewCategory() { return <EntityEditor kind="category" />; }
