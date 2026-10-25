import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const podspec = read('../MeshStreamP2P.podspec');

assert.match(podspec, /s\.dependency 'MeshStreamKit', '= 1\.0\.4'/);
assert.doesNotMatch(podspec, /path\s*=>/);
assert.match(podspec, /s\.public_header_files = 'ios\/MeshStreamP2P\.h'/);
assert.match(podspec, /s\.private_header_files = 'ios\/MeshStreamP2PValidation\.h'/);
assert.match(podspec, /s\.test_spec 'Validation'/);
assert.match(read('../README.md'), /MeshStreamKit 1\.0\.4/);
assert.match(read('../README.zh-CN.md'), /MeshStreamKit 1\.0\.4/);
assert.doesNotMatch(
  read('../example/ios/MeshStreamRnDemoTests/MeshStreamRnDemoTests.m'),
  /MeshStreamP2PValidation/,
);
