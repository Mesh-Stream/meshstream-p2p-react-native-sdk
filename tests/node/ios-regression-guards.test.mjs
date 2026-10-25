import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import test from 'node:test';

import {selectAvailableIOSSimulator} from '../../scripts/ios-simulator.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const npmCommand = process.platform === 'win32' ? process.execPath : 'npm';
const npmPrefixArgs = process.platform === 'win32'
  ? [process.env.npm_execpath ?? path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')]
  : [];

for (const script of ['verify-ios-bridge-source.mjs', 'verify-ios-cocoapods.mjs']) {
  test(`${script} validates the iOS release contract`, () => {
    const result = spawnSync(process.execPath, [path.join(root, 'scripts', script)], {
      cwd: root,
      encoding: 'utf8',
    });

    assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
  });
}

test('ships the Pod XCTest source in the npm package', () => {
  const result = spawnSync(npmCommand, [...npmPrefixArgs, 'pack', '--dry-run', '--json', '--ignore-scripts'], {
    cwd: root,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  const [pack] = JSON.parse(result.stdout);
  assert.ok(pack.files.some((file) => file.path === 'tests/ios/MeshStreamP2PValidationTests.m'));
});

test('runs iOS guards and the XCTest suite from package scripts', () => {
  const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  const xcodeProject = readFileSync(path.join(root, 'example/ios/MeshStreamRnDemo.xcodeproj/project.pbxproj'), 'utf8');
  const xcodeVerifier = readFileSync(path.join(root, 'scripts/verify-ios-xctest.mjs'), 'utf8');
  const packageVerifier = readFileSync(path.join(root, 'scripts/verify-ios-package.mjs'), 'utf8');

  assert.equal(packageJson.scripts['test:ios'], 'node --test tests/node/ios-regression-guards.test.mjs');
  assert.match(packageJson.scripts['verify:ios'], /npm run test:ios/);
  assert.match(packageJson.scripts['verify:ios'], /node scripts\/verify-ios-package\.mjs/);
  assert.match(packageJson.scripts['verify:ios'], /node scripts\/verify-ios-xctest\.mjs/);
  assert.doesNotMatch(packageJson.scripts['verify:ios'], /--repo-update/);
  assert.match(packageJson.scripts['verify:ios:public'], /node scripts\/verify-ios-xctest\.mjs --repo-update/);
  assert.match(xcodeProject, /tests\/ios\/MeshStreamP2PValidationTests\.m/);
  assert.match(xcodeVerifier, /process\.argv\.includes\('--repo-update'\)/);
  assert.match(packageVerifier, /npmCommand/);
  assert.match(packageVerifier, /\.\.\.npmPrefixArgs, 'pack', '--json', '--ignore-scripts', '--pack-destination'/);
  assert.match(packageVerifier, /execFileSync\('tar', \['-xzf'/);
  assert.match(packageVerifier, /execFileSync\('pod', \['install'\]/);
  assert.match(packageVerifier, /execFileSync\(\s*'xcodebuild'/);
  assert.match(packageVerifier, /package\/tests\/ios\/MeshStreamP2PValidationTests\.m/);
  assert.match(packageVerifier, /symlinkSync\(installedReactNativePath, temporaryReactNativePath, 'dir'\)/);
  assert.match(packageVerifier, /const podReactNativePath = '\.\.\/node_modules\/react-native';/);
  assert.match(packageVerifier, /pod 'MeshStreamP2P', :path =>/);
  assert.doesNotMatch(packageVerifier, /use_native_modules!/);
  assert.match(packageVerifier, /'-derivedDataPath'/);
});

test('selects an iOS Simulator when another platform is booted', () => {
  const destination = selectAvailableIOSSimulator({
    'com.apple.CoreSimulator.SimRuntime.watchOS-11-0': [
      {udid: 'watch-booted', isAvailable: true, state: 'Booted'},
    ],
    'com.apple.CoreSimulator.SimRuntime.iOS-18-2': [
      {udid: 'ios-shutdown', isAvailable: true, state: 'Shutdown'},
    ],
  });

  assert.equal(destination?.udid, 'ios-shutdown');
});
