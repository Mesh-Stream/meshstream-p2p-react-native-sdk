import {execFileSync} from 'node:child_process';
import {cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {selectAvailableIOSSimulator} from './ios-simulator.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporaryDirectory = mkdtempSync(path.join(tmpdir(), 'meshstream-p2p-package-'));
const iosDirectory = path.join(temporaryDirectory, 'example', 'ios');
const packageDirectory = path.join(temporaryDirectory, 'package');
const installedReactNativePath = path.join(root, 'example', 'node_modules', 'react-native');
const podReactNativePath = '../node_modules/react-native';

function rubyString(value) {
  return `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
}

function run(command, args) {
  return execFileSync(command, args, {encoding: 'utf8'});
}

try {
  const packOutput = execFileSync(
    'npm',
    ['pack', '--json', '--ignore-scripts', '--pack-destination', temporaryDirectory],
    {cwd: root, encoding: 'utf8'},
  );
  const [pack] = JSON.parse(packOutput);
  const archive = path.join(temporaryDirectory, pack.filename);

  execFileSync('tar', ['-xzf', archive, '-C', temporaryDirectory], {stdio: 'inherit'});
  for (const entry of ['MeshStreamRnDemo.xcodeproj', 'MeshStreamRnDemo', 'MeshStreamRnDemoTests']) {
    cpSync(path.join(root, 'example', 'ios', entry), path.join(iosDirectory, entry), {recursive: true});
  }
  const temporaryReactNativePath = path.join(temporaryDirectory, 'example', 'node_modules', 'react-native');
  mkdirSync(path.dirname(temporaryReactNativePath), {recursive: true});
  symlinkSync(installedReactNativePath, temporaryReactNativePath, 'dir');

  const projectPath = path.join(iosDirectory, 'MeshStreamRnDemo.xcodeproj', 'project.pbxproj');
  const project = readFileSync(projectPath, 'utf8');
  const packageTestPath = '../../package/tests/ios/MeshStreamP2PValidationTests.m';
  if (!project.includes('path = ../../tests/ios/MeshStreamP2PValidationTests.m;')) {
    throw new Error('Unable to replace the XCTest source path in the temporary project.');
  }
  writeFileSync(
    projectPath,
    project.replace('path = ../../tests/ios/MeshStreamP2PValidationTests.m;', `path = ${packageTestPath};`),
  );

  writeFileSync(
    path.join(iosDirectory, 'Podfile'),
    `require File.join(${rubyString(podReactNativePath)}, 'scripts/react_native_pods.rb')

platform :ios, min_ios_version_supported
prepare_react_native_project!

target 'MeshStreamRnDemo' do
  use_react_native!(
    :path => ${rubyString(podReactNativePath)},
    :app_path => ${rubyString(path.join(root, 'example'))}
  )
  pod 'MeshStreamP2P', :path => ${rubyString(packageDirectory)}

  target 'MeshStreamRnDemoTests' do
    inherit! :complete
  end

  post_install do |installer|
    react_native_post_install(
      installer,
      ${rubyString(podReactNativePath)},
      :mac_catalyst_enabled => false
    )
  end
end
`,
  );

  execFileSync('pod', ['install'], {cwd: iosDirectory, stdio: 'inherit'});

  const devices = JSON.parse(run('xcrun', ['simctl', 'list', 'devices', 'available', '--json']));
  const destination = selectAvailableIOSSimulator(devices.devices);
  if (destination == null) {
    throw new Error('No available iOS Simulator device found for package XCTest validation.');
  }
  if (destination.state !== 'Booted') {
    run('xcrun', ['simctl', 'boot', destination.udid]);
    run('xcrun', ['simctl', 'bootstatus', destination.udid, '-b']);
  }

  execFileSync(
    'xcodebuild',
    [
      '-workspace',
      path.join(iosDirectory, 'MeshStreamRnDemo.xcworkspace'),
      '-derivedDataPath',
      path.join(temporaryDirectory, 'DerivedData'),
      '-scheme',
      'MeshStreamRnDemo',
      '-destination',
      `platform=iOS Simulator,id=${destination.udid}`,
      '-only-testing:MeshStreamRnDemoTests/MeshStreamP2PValidationTests',
      'test',
    ],
    {stdio: 'inherit'},
  );
} finally {
  rmSync(temporaryDirectory, {force: true, recursive: true});
}
