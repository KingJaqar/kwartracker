import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { pbkdf2Sync } from 'node:crypto';
import { Linter, type Rule } from 'eslint';
import { generatePerfFixture } from './fixtures/perf.ts';
import { checkBuildActions, checkBuildConfig, checkBuildProfiles } from '../scripts/check-build-config.mjs';
import { colors, categoryPalette, opacity } from '../src/theme/tokens.ts';
import { categoryColor } from '../src/theme/appearance.ts';
import { equalVerifier, probePbkdf2 } from '../src/probes/kdf.ts';
const require = createRequire(import.meta.url);

test('TC-120 static legs: only internal EAS APKs, distinct identities, fail-closed missing identity', () => {
  assert.equal(checkBuildConfig().staticProfiles, 'pass');
});

test('TC-120 rejects nested platform overrides and unreviewed variant environment values', () => {
  const profiles = JSON.parse(readFileSync('eas.json', 'utf8')) as typeof import('../eas.json');
  for (const override of [{ gradleCommand: ':app:bundleRelease' }, { distribution: 'store' }, { environment: 'production' }, { config: 'publish.yml' }, { env: { APP_VARIANT: 'development' } }]) {
    const changed = structuredClone(profiles);
    Object.assign(changed.build.validation.android, override);
    assert.throws(() => checkBuildProfiles(changed), /Unreviewed Android override/);
  }
  for (const [variant, value] of [['development', '1'], ['validation', '0']] as const) {
    const changed = structuredClone(profiles);
    Object.assign(changed.build[variant].env, { KWARTRACKER_PROBE_ONLY: value });
    assert.throws(() => checkBuildProfiles(changed), /Only validation/);
  }
  const probe = structuredClone(profiles);
  Object.assign(probe.build.validation.env, { KWARTRACKER_PROBE_ONLY: '1' });
  assert.doesNotThrow(() => checkBuildProfiles(probe));
  Object.assign(probe.build.validation.env, { KWARTRACKER_ANDROID_PACKAGE: 'different.identity' });
  assert.throws(() => checkBuildProfiles(probe));
});

test('TC-120 catches versioned publishing commands and declarative EAS publication jobs', () => {
  for (const command of ['npx eas-cli@latest submit --platform android', 'bunx eas-cli@26.0.0 update', 'eas deploy', 'npx expo@57.0.31 run:android', 'eas build --auto-submit']) {
    assert.throws(() => checkBuildActions(command, 'synthetic hook'), /Forbidden action/);
  }
  for (const kind of ['submit', 'update', 'deploy', 'testflight']) {
    for (const value of [kind, `'${kind}'`, `"${kind}"`]) assert.throws(() => checkBuildActions(`jobs:\n  publish:\n    type: ${value}`, 'synthetic workflow', true), /Forbidden publication job/);
  }
  assert.doesNotThrow(() => checkBuildActions('npx eas-cli@latest build --platform android --profile validation', 'internal build'));
  assert.doesNotThrow(() => checkBuildActions('jobs:\n  check:\n    type: build', 'internal workflow', true));
});

test('literal-ban rule rejects hex colors, numeric spacing/type/motion and icon barrel imports', () => {
  const rule: Rule.RuleModule = require('../scripts/eslint/design-tokens.js');
  const linter = new Linter();
  const config: Linter.Config[] = [{ plugins: { design: { rules: { tokens: rule } } }, rules: { 'design/tokens': 'error' }, languageOptions: { ecmaVersion: 'latest', sourceType: 'module', parserOptions: { ecmaFeatures: { jsx: true } } } }];
  for (const source of ["const style={color:'#fff'};", 'const style={padding:16};', 'const style={fontSize:20};', 'const animation={duration:200};', "import { Wallet } from 'lucide-react-native';", '<View style={{borderRadius:12}} />']) {
    assert.ok(linter.verify(source, config).some(message => message.ruleId === 'design/tokens'), source);
  }
  assert.equal(linter.verify('const style={padding:spacing.s4,color:theme.accent};', config).length, 0);
});

function contrast(a: string, b: string): number {
  const luminance = (value: string) => {
    const channels = [1, 3, 5].map(index => Number.parseInt(value.slice(index, index + 2), 16) / 255).map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const first = luminance(a); const second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}
test('TC-97 token legs: both appearances meet text/control/palette contrast from source values', () => {
  for (const appearance of ['dark', 'light'] as const) {
    const palette = colors[appearance];
    for (const surface of ['bg', 'surface1', 'surface2'] as const) {
      for (const text of ['textPrimary', 'textSecondary', 'textTertiary', 'accent', 'income', 'expense', 'warning', 'danger'] as const) assert.ok(contrast(palette[text], palette[surface]) >= 4.5, `${appearance}/${surface}/${text}`);
      assert.ok(contrast(palette.controlBorder, palette[surface]) >= 3);
      for (const category of categoryPalette[appearance]) assert.ok(contrast(category, palette[surface]) >= 3.4);
    }
    for (let index = 0; index < 12; index++) {
      const category = categoryPalette[appearance][index];
      const tile = '#' + [1, 3, 5].map(channel => Math.round(Number.parseInt(category.slice(channel, channel + 2), 16) * opacity.categoryTile + Number.parseInt(palette.surface1.slice(channel, channel + 2), 16) * (1 - opacity.categoryTile)).toString(16).padStart(2, '0')).join('');
      assert.ok(contrast(category, tile) >= 3.1, `${appearance}/tinted-tile/${index}`);
      const id = `${index.toString(16).padStart(8, '0')}-0000-4000-8000-000000000000`;
      assert.equal(categoryColor(id, appearance), category);
      assert.equal(categoryColor(id, appearance), categoryColor(id, appearance));
    }
    assert.ok(contrast(palette.onAccent, palette.accent) >= 4.5);
    assert.ok(contrast(palette.onDanger, palette.danger) >= 4.5);
  }
});

test('PERF-01 fixture is deterministic and pins its complete data identity and required counts', () => {
  const first = generatePerfFixture();
  const second = generatePerfFixture();
  assert.equal(first.seedHash, second.seedHash);
  const expected = JSON.parse(readFileSync(new URL('./fixtures/perf-manifest.json', import.meta.url), 'utf8')) as { seedHash: string };
  assert.equal(first.seedHash, expected.seedHash);
  for (const [table, count] of Object.entries({ Account: 500, Category: 200, Transaction: 10000, Budget: 120, RecurringRule: 50, RecurringOccurrenceLedger: 500, WriteReceipt: 10000 })) assert.equal(first.data[table as keyof typeof first.data].length, count, table);
  assert.equal(new Set(first.data.Transaction.map(row => row.accountingDate.slice(0, 7))).size, 36);
  assert.ok(first.data.Account.some(row => row.isArchived));
});

test('S2 candidate matches independently computed PBKDF2/OpenSSL vector, fixed-length comparison and mismatch', async () => {
  const expected = pbkdf2Sync('246813', Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex'), 600000, 32, 'sha256');
  assert.equal(expected.toString('hex'), 'a0616cdcf5c1d42284c556043fb6aebb9ae3e161802b53a9e0ba1508aed5ec6b');
  assert.equal(equalVerifier(expected, Uint8Array.from(expected)), true);
  const changed = Uint8Array.from(expected); changed[31] ^= 1;
  assert.equal(equalVerifier(expected, changed), false);
  assert.throws(() => equalVerifier(new Uint8Array(1), expected));
  assert.equal((await probePbkdf2()).vectorMatches, true);
});
