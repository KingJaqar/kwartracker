import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const source = readFileSync('documentation/Kwartracker-PRD-SRS-v1_11.md', 'utf8');
const plan = readFileSync('documentation/Kwartracker-PRD-SRS-v1_11-Execution-Phases.md', 'utf8');
const mapping = plan.slice(plan.indexOf('## 6. Test-to-phase map'), plan.indexOf('| Phase | Named artifacts |'));
const phases = new Map();
for (const row of mapping.split('\n')) {
  const match = /^\| ([0-8]) \| (TC-.*) \|/.exec(row);
  if (match) for (const id of match[2].match(/TC-\d+/g) ?? []) { assert.ok(!phases.has(id)); phases.set(id, Number(match[1])); }
}
const suiteRanges = {
  'AUTO-PR': [1,2,3,4,5,6,7,8,9,10,13,14,15,16,17,18,19,22,23,24,28,29,30,31,32,34,...Array.from({ length: 31 }, (_, i) => 38+i),79,80,...Array.from({ length: 9 }, (_, i) => 82+i),...Array.from({ length: 14 }, (_, i) => 92+i),107,...Array.from({ length: 14 }, (_, i) => 109+i)],
  NIGHTLY: [21,33,36,43,46,53,54,55,56,63,64,65,66,67,68,75,79,80,81,105,111,112,115,116,117],
  'RC-DEVICE': [11,12,25,26,27,33,35,36,37,62,...Array.from({ length: 14 }, (_, i) => 65+i),81,91,98,99,101,102,103,106,108,109,110,117,118,119,120,121,122],
};
const cases = [];
for (const row of source.split('\n')) {
  const match = /^\| (TC-(\d+))[^|]*\| (.+?) \| ([^|]+) \|\s*$/.exec(row);
  if (!match || Number(match[2]) === 20) continue;
  const id = match[1];
  assert.ok(phases.has(id), `No primary phase: ${id}`);
  const oracle = match[3].trim();
  const suites = Object.entries(suiteRanges).filter(([, ids]) => ids.includes(Number(match[2]))).map(([suite]) => ({ suite, owner: suite === 'AUTO-PR' ? 'Engineering Lead' : 'QA Lead' }));
  assert.ok(suites.length > 0, `No suite: ${id}`);
  // Preserve the complete normative oracle; clauses are checklist entries, not narrower substitutes.
  const assertions = oracle.split(/(?<=[.;])\s+(?=[A-Z])/).map((text, index) => ({ id: `${id}.${index+1}`, expected: text, result: 'pending', evidence: null }));
  cases.push({ id, firstCompletePassPhase: phases.get(id), requirements: match[4].trim(), oracle, assertions, suites, platform: 'Android; iOS-specific legs Deferred', procedure: 'Run the complete normative oracle in the listed suite/environment; Phase 0 prototype results never imply whole-case PASS.' });
}
assert.equal(cases.length, 121);
const ids = new Set(cases.map(row => row.id));
for (let number = 1; number <= 122; number++) if (number !== 20) assert.ok(ids.has(`TC-${number.toString().padStart(2, '0')}`));
const artifactRows = source.slice(source.indexOf('### Required inspections and release artifacts'), source.indexOf('## 16.')).split('\n');
const artifacts = artifactRows.flatMap(row => {
  const match = /^\| ([A-Z][A-Z0-9-]+-\d+) \| (.+?) \| (.+?) \|/.exec(row);
  return match ? [{ id: match[1], oracle: match[2], requirementsAndOwners: match[3], result: 'pending', evidence: null }] : [];
});
const result = { artifact: 'QA-PLAN-01', revision: '1.11.2', scope: 'Initial assertion checklist; later phases own executable feature procedures. All results remain pending unless separately attributed in Phase 0 results.', cases, artifacts };
writeFileSync('documentation/execution-context/phase0/qa-plan.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ activeCases: cases.length, assertions: cases.reduce((count, row) => count + row.assertions.length, 0), namedArtifacts: artifacts.length }));
