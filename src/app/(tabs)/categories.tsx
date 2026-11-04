import { EntityList } from '@/screens/entities';
export { RouteFailure as ErrorBoundary } from '@/components/ledger-shell';
export default function Categories() { return <EntityList kind="category" />; }
