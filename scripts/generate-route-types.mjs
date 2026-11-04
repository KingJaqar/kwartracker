import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

// Regenerate from disk, rather than a stale Metro watcher (SDK57's watcher misclassifies Windows ../ paths).
// This is the same versioned generator used by the installed Expo CLI; no application routing is implemented here.
process.env.EXPO_ROUTER_APP_ROOT = resolve('src/app');
const require = createRequire(import.meta.url);
const expoRequire = createRequire(require.resolve('expo/package.json'));
const cliRequire = createRequire(expoRequire.resolve('@expo/cli/package.json'));
const { regenerateDeclarations } = cliRequire('@expo/router-server/build/typed-routes');
mkdirSync('.expo/types', { recursive: true });
regenerateDeclarations(resolve('.expo/types'));
