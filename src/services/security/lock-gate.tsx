import type { PropsWithChildren } from 'react';

/** Phase 0 has no enrolled credentials; Phase 4 supplies the real unlock gate here. */
export function LockGate({ children }: PropsWithChildren) { return children; }
