import { EntityEditor } from '@/screens/entities';
export { RouteFailure as ErrorBoundary } from '@/components/ledger-shell';
export default function NewAccount() { return <EntityEditor kind="account" />; }
