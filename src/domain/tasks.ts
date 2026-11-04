/** Yield between finite batches; callers retain their transaction, cursor and exact result. */
export function yieldTask(): Promise<void> { return new Promise(resolve => setTimeout(resolve, 0)); }
