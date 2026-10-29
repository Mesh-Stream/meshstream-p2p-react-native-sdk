const path = require('node:path');

const config = require('../metro.config');

it('uses the installed SDK and the app React Native runtime', () => {
  expect(config.resolver.extraNodeModules?.['react-native-meshstream']).toBeUndefined();
  expect(config.resolver.disableHierarchicalLookup).toBe(true);
  expect(config.resolver.nodeModulesPaths).toEqual([
    path.join(__dirname, '..', 'node_modules'),
  ]);
});
