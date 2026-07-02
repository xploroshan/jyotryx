// Monorepo-aware Metro config + NativeWind.
// @myastro360/shared is consumed as TypeScript source from packages/shared, so
// Metro must watch the repo root and resolve the hoisted node_modules.
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files in the monorepo (so edits to packages/shared hot-reload).
config.watchFolders = [workspaceRoot];

// 2. Resolve modules from both the app and the hoisted root node_modules.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. Don't let a package resolve to two copies of React/RN in the monorepo.
config.resolver.disableHierarchicalLookup = true;

module.exports = withNativeWind(config, { input: './global.css' });
