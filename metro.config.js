const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
const probeOnly = process.env.KWARTRACKER_PROBE_ONLY === '1';
const existing = config.resolver.blockList;
config.resolver.blockList = [
  ...(Array.isArray(existing) ? existing : existing ? [existing] : []),
  ...(!probeOnly ? [/[/\\]src[/\\]app[/\\]_foundation[/\\].*/] : []),
];
// Metro excludes these files from its file map and Router context, not just navigation.
if (process.env.APP_VARIANT === 'validation' && !probeOnly) {
  config.resolver.blockList = [
    ...config.resolver.blockList,
    /[/\\]src[/\\]app[/\\]showcase\.tsx$/,
    /[/\\]src[/\\]probes[/\\].*/,
    /[/\\]tests[/\\].*/,
  ];
}
module.exports = config;
