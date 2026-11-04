import { readFileSync, readdirSync, existsSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

export function checkBuildProfiles(profiles) {
  assert.deepEqual(Object.keys(profiles).sort(), ['build']);
  assert.deepEqual(Object.keys(profiles.build).sort(), ['development', 'validation']);
  for (const [name, profile] of Object.entries(profiles.build)) {
    assert.equal(profile.developmentClient, name === 'development');
    assert.equal(profile.distribution, 'internal');
    assert.equal(profile.environment, 'development');
    assert.equal(profile.android.buildType, 'apk');
    assert.equal(profile.env.APP_VARIANT, name);
    assert.deepEqual(Object.keys(profile).sort(), ['android', 'developmentClient', 'distribution', 'env', 'environment']);
    // Platform options override common options, including buildType/developmentClient.
    assert.deepEqual(Object.keys(profile.android), ['buildType'], `Unreviewed Android override in ${name}`);
    const probe = profile.env.KWARTRACKER_PROBE_ONLY;
    assert.deepEqual(Object.keys(profile.env).sort(), probe === undefined ? ['APP_VARIANT'] : ['APP_VARIANT', 'KWARTRACKER_PROBE_ONLY']);
    if (probe !== undefined) assert.ok(name === 'validation' && probe === '1', 'Only validation may select the isolated probe');
  }
}

export function checkBuildActions(text, source, workflow = false) {
  const forbidden = /(?:\beas(?:-cli)?(?:@[^\s"'`]+)?\s+(?:submit|update|deploy)\b|--auto-submit|\bexpo(?:@[^\s"'`]+)?\s+(?:publish|run:android|run:ios)\b|(?:play|testflight)\s+upload)/i;
  assert.equal(forbidden.test(text), false, `Forbidden action in ${source}`);
  if (workflow) assert.equal(/\btype\s*:\s*["']?(?:submit|update|deploy|testflight)\b/i.test(text), false, `Forbidden publication job in ${source}`);
}

export function checkBuildConfig() {
  checkBuildProfiles(JSON.parse(readFileSync('eas.json', 'utf8')));
  const base = JSON.parse(readFileSync('app.json', 'utf8')).expo;
  const nativeExclusions = JSON.parse(readFileSync('package.json', 'utf8')).expo?.autolinking?.exclude;
  assert.ok(Array.isArray(nativeExclusions) && ['kwartracker-foundation-probes', 'react-native-quick-crypto', 'react-native-nitro-modules', 'react-native-quick-base64'].every(name => nativeExclusions.includes(name)), 'Normal APKs must exclude nonshipping native probes and unselected KDF candidates from autolinking');
  const configure = require('../app.config.js');
  const priorVariant = process.env.APP_VARIANT;
  const priorPackage = process.env.KWARTRACKER_ANDROID_PACKAGE;
  const priorBuild = process.env.EAS_BUILD;
  const priorProbe = process.env.KWARTRACKER_PROBE_ONLY;
  try {
    delete process.env.EAS_BUILD;
    delete process.env.KWARTRACKER_PROBE_ONLY;
    process.env.KWARTRACKER_ANDROID_PACKAGE = 'test.kwartracker.synthetic';
    const outputs = ['development', 'validation'].map(variant => {
      process.env.APP_VARIANT = variant;
      const value = configure({ config: base });
      assert.equal(value.orientation, 'portrait');
      assert.equal(value.userInterfaceStyle, 'automatic');
      assert.equal(value.ios.supportsTablet, false);
      assert.equal(value.android.allowBackup, false);
      assert.equal(value.updates.enabled, false);
      assert.equal(value.slug, base.slug);
      assert.equal(value.name, base.name);
      assert.equal(value.android.package, `test.kwartracker.synthetic.${variant}`);
      return value;
    });
    assert.notEqual(outputs[0].scheme, outputs[1].scheme);
    assert.notEqual(outputs[0].android.package, outputs[1].android.package);
    process.env.KWARTRACKER_PROBE_ONLY = '1';
    const isolated = configure({ config: base });
    assert.equal(isolated.extra.foundationProbe, true);
    assert.equal(isolated.android.package, 'test.kwartracker.synthetic.validation.probe');
    assert.notEqual(isolated.name, outputs[1].name);
    delete process.env.KWARTRACKER_PROBE_ONLY;
    process.env.EAS_BUILD = 'true';
    delete process.env.KWARTRACKER_ANDROID_PACKAGE;
    const unlinked = { ...base, extra: { ...base.extra, eas: undefined } };
    assert.throws(() => configure({ config: unlinked }), /Confirm the Android base package/);
    const unidentified = { ...base, android: { ...base.android, package: undefined } };
    assert.throws(() => configure({ config: unidentified }), /Confirm the Android base package/);
    if (base.android?.package && base.extra?.eas?.projectId) {
      const configured = configure({ config: base });
      assert.equal(configured.android.package, `${base.android.package}.validation`);
      assert.equal(configured.extra.eas.projectId, base.extra.eas.projectId);
    }
  } finally {
    for (const [key, value] of [['APP_VARIANT', priorVariant], ['KWARTRACKER_ANDROID_PACKAGE', priorPackage], ['EAS_BUILD', priorBuild], ['KWARTRACKER_PROBE_ONLY', priorProbe]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
  for (const [name, command] of Object.entries(packageJson.scripts)) checkBuildActions(command, name);
  for (const directory of ['.eas/workflows', '.github/workflows']) if (existsSync(directory)) {
    for (const file of readdirSync(directory)) {
      const text = readFileSync(`${directory}/${file}`, 'utf8');
      checkBuildActions(text, `${directory}/${file}`, true);
    }
  }
  return { staticProfiles: 'pass', variants: 'pass with synthetic ID', publicationHooks: 'none', realProjectAndPackages: base.android?.package && base.extra?.eas?.projectId ? 'configured and checked' : 'not configured' };
}
if (process.argv[1]?.endsWith('check-build-config.mjs')) console.log(JSON.stringify(checkBuildConfig()));
