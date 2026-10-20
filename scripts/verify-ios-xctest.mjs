import {execFileSync} from 'node:child_process';

import {selectAvailableIOSSimulator} from './ios-simulator.mjs';

function run(command, args) {
  return execFileSync(command, args, {encoding: 'utf8'});
}

const podInstallArgs = ['install'];
if (process.argv.includes('--repo-update')) podInstallArgs.push('--repo-update');
execFileSync('pod', podInstallArgs, {cwd: 'example/ios', stdio: 'inherit'});

const devices = JSON.parse(run('xcrun', ['simctl', 'list', 'devices', 'available', '--json']));
const destination = selectAvailableIOSSimulator(devices.devices);

if (destination == null) {
  throw new Error('No available iOS Simulator device found for XCTest validation.');
}

if (destination.state !== 'Booted') {
  run('xcrun', ['simctl', 'boot', destination.udid]);
  run('xcrun', ['simctl', 'bootstatus', destination.udid, '-b']);
}

execFileSync(
  'xcodebuild',
  [
    '-workspace',
    'example/ios/MeshStreamRnDemo.xcworkspace',
    '-scheme',
    'MeshStreamRnDemo',
    '-destination',
    `platform=iOS Simulator,id=${destination.udid}`,
    '-only-testing:MeshStreamRnDemoTests/MeshStreamP2PValidationTests',
    'test',
  ],
  {stdio: 'inherit'},
);
