import { AppError } from '../../domain/errors.ts';
import type { DatabaseConnection, SqlConnection } from '../connection.ts';
import { APP_SCHEMA_VERSION, SCHEMA_SQL } from '../schema.ts';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { SCHEMA_V1_FINGERPRINT } from './schema-v1.ts';
import { runMigrationChain } from './chain.ts';

export type FaultPoint = (point: string) => void | Promise<void>;
type SchemaObject = { type: string; name: string; tbl_name: string; sql: string | null };
export async function schemaObjects(database: SqlConnection): Promise<SchemaObject[]> {
  return database.getAllAsync<SchemaObject>("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT GLOB 'sqlite_*' ORDER BY type,name");
}

export async function migrate(database: DatabaseConnection, fault: FaultPoint = () => undefined): Promise<'initialized' | 'current'> {
  const version = (await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version;
  if (version === APP_SCHEMA_VERSION) {
    const objects = (await schemaObjects(database)).map(row => ({ ...row, sql: row.sql?.replace(/\s+/g, ' ').trim() ?? null }));
    const fingerprint = bytesToHex(sha256(utf8ToBytes(JSON.stringify(objects))));
    if (fingerprint !== SCHEMA_V1_FINGERPRINT) throw new AppError('DATABASE_UNSUPPORTED');
    return 'current';
  }
  if (version !== 0 || (await schemaObjects(database)).length !== 0) throw new AppError('DATABASE_UNSUPPORTED');
  // No real historical layout is invented. Test-only older chains exercise the shared framework.
  await runMigrationChain(database, APP_SCHEMA_VERSION, [{
    from: 0, to: 1,
    recognizes: async connection => (await schemaObjects(connection)).length === 0,
    apply: async (transaction, inject) => {
      await inject('migration:before-schema');
      await transaction.execAsync(SCHEMA_SQL);
      await inject('migration:after-schema');
    },
  }], fault);
  return 'initialized';
}
