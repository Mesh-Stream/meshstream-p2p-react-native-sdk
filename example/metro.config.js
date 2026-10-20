const path = require('path');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */
const sdkRoot = path.resolve(__dirname, '..');

const config = {
  // The example consumes the SDK through "file:.." during local development.
  // Metro must watch the symlink target and resolve the package from that root.
  watchFolders: [sdkRoot],
  resolver: {
    extraNodeModules: {
      '@meshstream/react-native-p2p': sdkRoot,
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
