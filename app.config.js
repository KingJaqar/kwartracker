const { colors } = require('./src/theme/tokens.ts');

/** Preserve the existing base identity; owner-provided native IDs are required for an EAS job. */
module.exports = ({ config }) => {
  const variant = process.env.APP_VARIANT ?? 'development';
  const probeOnly = process.env.KWARTRACKER_PROBE_ONLY === '1';
  if (!['development', 'validation'].includes(variant)) throw new Error('APP_VARIANT must be development or validation.');
  const basePackage = process.env.KWARTRACKER_ANDROID_PACKAGE ?? config.android?.package;
  if (basePackage && !/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(basePackage)) throw new Error('KWARTRACKER_ANDROID_PACKAGE must be a valid owner-selected Android base package.');
  if (process.env.EAS_BUILD === 'true' && (!basePackage || !config.extra?.eas?.projectId)) {
    throw new Error('Confirm the Android base package and link the intended EAS project before building.');
  }
  const fonts = ['400Regular/Inter_400Regular.ttf', '500Medium/Inter_500Medium.ttf', '600SemiBold/Inter_600SemiBold.ttf', '700Bold/Inter_700Bold.ttf']
    .map(file => `./node_modules/@expo-google-fonts/inter/${file}`);
  const plugins = (config.plugins ?? []).filter(plugin => !['expo-font', 'expo-dev-client', 'expo-secure-store', 'expo-splash-screen', 'expo-router', 'react-native-quick-crypto', '@react-native-community/datetimepicker', './plugins/with-backup-exclusions'].includes(typeof plugin === 'string' ? plugin : plugin[0]));
  return {
    ...config, orientation: 'portrait', userInterfaceStyle: 'automatic',
    name: probeOnly ? `${config.name} Foundation Probe` : config.name,
    scheme: `${typeof config.scheme === 'string' ? config.scheme : 'kwartracker'}-${variant}${probeOnly ? '-probe' : ''}`,
    ios: { ...config.ios, supportsTablet: false },
    android: { ...config.android, allowBackup: false, ...(basePackage ? { package: `${basePackage}.${variant}${probeOnly ? '.probe' : ''}` } : {}) },
    updates: { ...config.updates, enabled: false },
    extra: { ...config.extra, variant, foundationProbe: probeOnly },
    plugins: [...plugins,
      probeOnly ? ['expo-router', { root: './src/app/_foundation' }] : 'expo-router',
      ['expo-font', { fonts }],
      ['expo-dev-client', { addGeneratedScheme: variant === 'development' }],
      ['expo-secure-store', { configureAndroidBackup: false }],
      '@react-native-community/datetimepicker',
      'react-native-quick-crypto',
      ['expo-splash-screen', { backgroundColor: colors.light.bg, dark: { backgroundColor: colors.dark.bg }, image: './assets/images/splash-icon.png', imageWidth: 76 }],
      './plugins/with-backup-exclusions',
    ],
  };
};
