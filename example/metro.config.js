const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const path = require('node:path');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */
const sdkRoot = path.resolve(__dirname, '..');

const config = {
  // The example consumes the SDK through its local file:.. dependency.
  watchFolders: [sdkRoot],
  resolver: {
    extraNodeModules: {
      'react-native-meshstream': sdkRoot,
    },
    disableHierarchicalLookup: true,
    nodeModulesPaths: [
      path.join(__dirname, 'node_modules'),
    ],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
