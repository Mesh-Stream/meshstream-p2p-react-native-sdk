import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

for (const platform of ['ios', 'android']) {
  test(`${platform} routes filtered events and releases listeners`, () => {
    const events = new EventEmitter();
    let nativeListeners = 0;
    const native = {
      addListener: () => { nativeListeners++; },
      removeListeners: count => { nativeListeners -= count; },
    };
    const deviceEmitter = {
      addListener(name, listener) {
        events.on(name, listener);
        return {remove: () => events.off(name, listener)};
      },
    };
    const runtime = {
      Platform: {OS: platform},
      NativeModules: {MeshStreamP2P: native},
      DeviceEventEmitter: deviceEmitter,
      NativeEventEmitter: class {
        constructor(module) { assert.equal(module, native); this.module = module; }
        addListener(name, listener) {
          this.module.addListener(name);
          const subscription = deviceEmitter.addListener(name, listener);
          let removed = false;
          return {remove: () => {
            if (removed) return;
            removed = true;
            this.module.removeListeners(1);
            subscription.remove();
          }};
        }
      },
    };
    const modules = new Map();
    function load(filename) {
      if (modules.has(filename)) return modules.get(filename).exports;
      const module = {exports: {}};
      modules.set(filename, module);
      vm.runInNewContext(readFileSync(filename, 'utf8'), {
        module, exports: module.exports,
        require: name => name === 'react-native' ? runtime : load(path.resolve(path.dirname(filename), `${name}.js`)),
      }, {filename});
      return module.exports;
    }
    const sdk = load(path.join(root, 'lib/typescript/index.js'));
    let delivered = 0;
    const subscription = sdk.addMeshStreamEventListener(() => { delivered++; }, {sessionId: 'active'});
    assert.equal(nativeListeners, platform === 'ios' ? 1 : 0);
    const emit = sessionId => {
      if (platform !== 'ios' || nativeListeners > 0) events.emit('MeshStreamP2P:event', {sessionId});
    };
    emit('other');
    emit('active');
    assert.equal(delivered, 1);
    subscription.remove();
    emit('active');
    assert.equal(delivered, 1);
    assert.equal(nativeListeners, 0);
    assert.equal(events.listenerCount('MeshStreamP2P:event'), 0);
  });
}
