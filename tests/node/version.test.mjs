import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const packageVersion = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version;

function loadSdk(platform, getSdkVersion) {
  const modules = new Map();
  const runtime = {
    Platform: {OS: platform},
    NativeModules: {MeshStreamP2P: {getSdkVersion}},
  };
  function load(filename) {
    if (modules.has(filename)) return modules.get(filename).exports;
    const module = {exports: {}};
    modules.set(filename, module);
    vm.runInNewContext(readFileSync(filename, 'utf8'), {
      module,
      exports: module.exports,
      require(name) {
        if (name === 'react-native') return runtime;
        return load(path.resolve(path.dirname(filename), `${name}.js`));
      },
    }, {filename});
    return module.exports;
  }
  return load(path.join(root, 'lib/typescript/index.js')).MeshStream;
}

for (const platform of ['ios', 'android']) {
  test(`${platform} reports the loaded native version before client creation`, async () => {
    let nativeVersion = '1.0.6';
    let reads = 0;
    const sdk = loadSdk(platform, async () => { reads++; return nativeVersion; });
    assert.equal(await sdk.getSdkVersion(), '1.0.6');
    assert.deepEqual(JSON.parse(JSON.stringify(await sdk.getVersion())), {
      packageVersion,
      nativeSdkVersion: '1.0.6',
      platform,
    });
    nativeVersion = '1.0.5';
    assert.equal((await sdk.getVersion()).nativeSdkVersion, '1.0.5');
    assert.equal(reads, 3);
  });
}

test('propagates a native version lookup failure', async () => {
  const sdk = loadSdk('android', async () => { throw new Error('native load failed'); });
  await assert.rejects(sdk.getVersion(), /native load failed/);
});

test('rejects an unsupported platform without reading the native version', async () => {
  let reads = 0;
  const sdk = loadSdk('web', async () => { reads++; return '1.0.4'; });
  await assert.rejects(sdk.getVersion(), /does not support web/);
  assert.equal(reads, 0);
});
