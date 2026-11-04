const { AndroidConfig, withAndroidManifest, withDangerousMod } = require('expo/config-plugins');
const { mkdir, writeFile } = require('node:fs/promises');
const path = require('node:path');

const domains = ['root', 'file', 'database', 'sharedpref', 'external', 'device_root', 'device_file', 'device_database', 'device_sharedpref'];
const excludes = domains.map(domain => `    <exclude domain="${domain}" path="." />`).join('\n');
const backupRules = `<?xml version="1.0" encoding="utf-8"?>\n<full-backup-content>\n${excludes}\n</full-backup-content>\n`;
const extractionRules = `<?xml version="1.0" encoding="utf-8"?>\n<data-extraction-rules>\n  <cloud-backup>\n${excludes}\n  </cloud-backup>\n  <device-transfer>\n${excludes}\n  </device-transfer>\n</data-extraction-rules>\n`;

module.exports = function withBackupExclusions(config) {
  config = withAndroidManifest(config, result => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(result.modResults);
    application.$['android:allowBackup'] = 'false';
    application.$['android:fullBackupContent'] = '@xml/kwartracker_backup_rules';
    application.$['android:dataExtractionRules'] = '@xml/kwartracker_extraction_rules';
    result.modResults.manifest['supports-screens'] = [{ $: { 'android:smallScreens': 'true', 'android:normalScreens': 'true', 'android:largeScreens': 'false', 'android:xlargeScreens': 'false' } }];
    return result;
  });
  return withDangerousMod(config, ['android', async result => {
    const directory = path.join(result.modRequest.platformProjectRoot, 'app/src/main/res/xml');
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, 'kwartracker_backup_rules.xml'), backupRules);
    await writeFile(path.join(directory, 'kwartracker_extraction_rules.xml'), extractionRules);
    return result;
  }]);
};
module.exports.backupRules = backupRules;
module.exports.extractionRules = extractionRules;
