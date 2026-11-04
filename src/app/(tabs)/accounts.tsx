import { EntityList } from '@/screens/entities';
export { RouteFailure as ErrorBoundary } from '@/components/ledger-shell';
export default function Accounts() { return <EntityList kind="account" />; }
