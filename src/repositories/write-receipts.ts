import { canonicalJson, type CanonicalValue } from '../domain/canonical.ts';
import { AppError } from '../domain/errors.ts';
import type { WriteReceipt } from '../domain/portable.ts';
import type { DatabaseCoordinator } from '../db/coordinator.ts';
import type { SqlConnection } from '../db/connection.ts';

export type WriteCommand = Pick<WriteReceipt, 'operationToken' | 'operation' | 'entityType' | 'entityId'> & { input: CanonicalValue };
export type ReceiptResult = Pick<WriteReceipt, 'operationToken' | 'entityType' | 'entityId' | 'committedAtUtc'>;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function portableWrite(
  coordinator: DatabaseCoordinator, command: WriteCommand,
  hash: (canonicalRequest: string) => Promise<string>,
  mutate: (transaction: SqlConnection) => Promise<void>,
  now: () => string = () => new Date().toISOString(),
): Promise<ReceiptResult> {
  if (!uuid.test(command.operationToken) || !uuid.test(command.entityId)) throw new AppError('INVALID_COMMAND');
  const requestHash = await hash(canonicalJson({ operation: command.operation, entityType: command.entityType, entityId: command.entityId, input: command.input }));
  if (!/^[0-9a-f]{64}$/.test(requestHash)) throw new AppError('INVALID_COMMAND');
  return coordinator.write(async transaction => {
    const previous = await transaction.getFirstAsync<WriteReceipt>('SELECT * FROM WriteReceipt WHERE operationToken=?', command.operationToken);
    if (previous) {
      if (previous.requestHash !== requestHash) throw new AppError('IDEMPOTENCY_CONFLICT');
      return projection(previous);
    }
    const receipt: WriteReceipt = { ...command, requestHash, committedAtUtc: now() };
    await transaction.runAsync('INSERT INTO WriteReceipt(operationToken,requestHash,operation,entityType,entityId,committedAtUtc) VALUES(?,?,?,?,?,?)',
      receipt.operationToken, receipt.requestHash, receipt.operation, receipt.entityType, receipt.entityId, receipt.committedAtUtc);
    await mutate(transaction);
    return projection(receipt);
  });
}

function projection(receipt: WriteReceipt): ReceiptResult {
  return { operationToken: receipt.operationToken, entityType: receipt.entityType, entityId: receipt.entityId, committedAtUtc: receipt.committedAtUtc };
}
