const path = require('node:path');

const config = require('../metro.config');

it('uses the app React Native runtime for the linked SDK', () => {
  expect(config.resolver.disableHierarchicalLookup).toBe(true);
  expect(config.resolver.nodeModulesPaths).toEqual([
    path.join(__dirname, '..', 'node_modules'),
  ]);
});
