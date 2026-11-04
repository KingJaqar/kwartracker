import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import type { DatabaseCoordinator } from '../db/coordinator.ts';
import { canonicalJson } from '../domain/canonical.ts';
import { uuidValue } from '../domain/ledger.ts';

export const SEED_CATEGORIES = [
  { type: 'expense', name: 'Food', icon: 'food' },
  { type: 'expense', name: 'Transport', icon: 'transport' },
  { type: 'expense', name: 'Bills', icon: 'bills' },
  { type: 'expense', name: 'Shopping', icon: 'shopping' },
  { type: 'expense', name: 'Health', icon: 'health' },
  { type: 'expense', name: 'Other', icon: 'other' },
  { type: 'income', name: 'Salary', icon: 'salary' },
] as const;

/** Retained receipts distinguish a fresh ledger from one whose user deleted every category. */
export async function seedFirstLedger(db: DatabaseCoordinator, uuid: () => string, now: () => string = () => new Date().toISOString()) {
  await db.write(async tx => {
    const existing = await tx.getFirstAsync<{ used: number }>(`SELECT EXISTS(SELECT 1 FROM Category) OR EXISTS(SELECT 1 FROM Account)
      OR EXISTS(SELECT 1 FROM "Transaction") OR EXISTS(SELECT 1 FROM WriteReceipt) AS used`);
    if (existing?.used !== 0) return;
    const stamp = now();
    for (const seed of SEED_CATEGORIES) {
      const id = uuidValue(uuid()), operationToken = uuidValue(uuid());
      const input = { id, ...seed, isArchived: false };
      const requestHash = bytesToHex(sha256(utf8ToBytes(canonicalJson({ operation: 'create', entityType: 'category', entityId: id, input }))));
      await tx.runAsync('INSERT INTO Category VALUES(?,?,?,?,0,?,?)', id, seed.type, seed.name, seed.icon, stamp, stamp);
      await tx.runAsync('INSERT INTO WriteReceipt VALUES(?,?,?,?,?,?)', operationToken, requestHash, 'create', 'category', id, stamp);
    }
  });
}
