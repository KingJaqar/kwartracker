import { execFileSync, spawnSync } from 'node:child_process';

const all = ['tests/domain.test.ts', 'tests/database.test.ts', 'tests/guardrails.test.ts', 'tests/restore-probe.test.ts', 'tests/ledger.test.ts'];
let selected = new Set(all);
let components = true;
if (process.env.GITHUB_EVENT_NAME === 'pull_request' && /^[0-9a-f]{40}$/.test(process.env.BASE_SHA ?? '')) {
  const paths = execFileSync('git', ['diff', '--name-only', `${process.env.BASE_SHA}...HEAD`], { encoding: 'utf8', timeout: 10000 }).trim().split('\n');
  const shared = paths.some(path => /^(?:package(?:-lock)?\.json|.*config\.|scripts\/|\.github\/|documentation\/contracts\/|tests\/helpers\/|tests\/fixtures\/)/.test(path));
  if (!shared) {
    selected = new Set(['tests/guardrails.test.ts']);
    if (paths.some(path => /^(?:src\/domain\/|src\/theme\/|tests\/domain)/.test(path))) selected.add('tests/domain.test.ts');
    if (paths.some(path => /^(?:src\/(?:db|repositories|domain)\/|tests\/database)/.test(path))) selected.add('tests/database.test.ts');
    if (paths.some(path => /^(?:src\/(?:db|repositories|domain|services\/ledger)\/|tests\/ledger)/.test(path))) selected.add('tests/ledger.test.ts');
    if (paths.some(path => /^(?:src\/probes\/restore-|tests\/restore-probe)/.test(path))) selected.add('tests/restore-probe.test.ts');
    components = paths.some(path => /^(?:src\/|tests\/components\/)/.test(path));
  }
}
console.log(`Affected core suites: ${[...selected].join(', ')}; components: ${components}`);
const run = args => {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit', timeout: 180000, windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
};
run(['--test', '--test-timeout=30000', ...selected]);
if (components) run(['node_modules/jest/bin/jest.js', '--runInBand']);
