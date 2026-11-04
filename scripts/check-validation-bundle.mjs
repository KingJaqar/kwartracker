import { readFileSync, readdirSync, statSync } from 'node:fs';
import assert from 'node:assert/strict';
import { join } from 'node:path';

const directory = process.argv[2] ?? 'dist/validation';
function files(path) { return readdirSync(path).flatMap(name => { const entry = join(path, name); return statSync(entry).isDirectory() ? files(entry) : [entry]; }); }
const maps = files(directory).filter(path => path.endsWith('.map'));
assert.ok(maps.length > 0, 'Export validation with --source-maps first.');
let count = 0;
for (const path of maps) {
  const map = JSON.parse(readFileSync(path, 'utf8'));
  assert.ok(Array.isArray(map.sources), `Missing source identities: ${path}`);
  for (const source of map.sources) {
    assert.doesNotMatch(source, /(?:src[/\\](?:app[/\\](?:showcase|_foundation[/\\])|probes[/\\])|tests[/\\])/i, `Synthetic tool leaked into validation: ${source}`);
    count++;
  }
}
console.log(JSON.stringify({ standaloneMetroExport: 'pass', sourceFilesChecked: count, developmentShowcaseAndProbes: 'absent', apkRuntime: 'not tested' }));
