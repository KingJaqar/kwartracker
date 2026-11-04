import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { SCHEMA_SQL } from '../src/db/schema.ts';

const schema = JSON.parse(readFileSync(new URL('../documentation/contracts/backup-v6.schema.json', import.meta.url), 'utf8'));
const names = { payload: 'RecurringPayload', account: 'Account', category: 'Category', transaction: 'Transaction', budget: 'Budget', preferences: 'PreferencesPortable', rule: 'RecurringRule', revision: 'RecurringRuleRevision', pause: 'RecurringPausePeriod', occurrence: 'RecurringOccurrenceLedger', receipt: 'WriteReceipt' };
function typeOf(property) {
  if (property.$ref) return names[property.$ref.split('/').at(-1)];
  if (property.anyOf) return property.anyOf.map(typeOf).join(' | ');
  if (property.enum) return property.enum.map(value => JSON.stringify(value)).join(' | ');
  if (Object.hasOwn(property, 'const')) return JSON.stringify(property.const);
  return { integer: 'number', string: 'string', boolean: 'boolean', null: 'null' }[property.type];
}
const header = '// Generated from backup-v6.schema.json by scripts/generate-contracts.mjs.\n';
const types = header + Object.entries(names).map(([key, name]) => `export type ${name} = {\n${Object.entries(schema.$defs[key].properties).map(([field, property]) => `  ${field}: ${typeOf(property)};`).join('\n')}\n};\n`).join('\n') + `\nexport type PortableData = {\n${Object.values(names).filter(name => name !== 'RecurringPayload').map(name => `  ${name}: ${name}[];`).join('\n')}\n};\n`;
const database = new DatabaseSync(':memory:');
database.exec(SCHEMA_SQL);
const objects = database.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT GLOB 'sqlite_*' ORDER BY type,name").all();
const normalized = objects.map(row => ({ ...row, sql: row.sql?.replace(/\s+/g, ' ').trim() ?? null }));
const fingerprint = createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
database.close();
for (const [file, contents] of [
  ['src/domain/portable.ts', types],
  ['src/db/migrations/schema-v1.ts', `${header}export const SCHEMA_V1_FINGERPRINT = '${fingerprint}';\n`],
]) {
  const path = resolve(file);
  if (process.argv.includes('--check')) {
    if (readFileSync(path, 'utf8') !== contents) throw new Error(`${file} differs from its source. Run npm run generate:contracts.`);
  } else writeFileSync(path, contents);
}
