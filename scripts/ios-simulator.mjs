export function selectAvailableIOSSimulator(devicesByRuntime) {
  const availableDevices = Object.entries(devicesByRuntime)
    .filter(([runtime]) => runtime.includes('.iOS-'))
    .flatMap(([, runtimeDevices]) => runtimeDevices)
    .filter((device) => device.isAvailable);

  return availableDevices.find((device) => device.state === 'Booted') ?? availableDevices[0];
}
