# Changelog

## 1.0.2

- Upgrade the public iOS dependency to MeshStreamKit 1.0.7 (iOS 15+).
- Upgrade the public Android dependency to meshstream-android-sdk 1.0.6.

## 1.0.1

- Pin the public Android and iOS native dependencies to 1.0.4.
- Add `MeshStream.getSdkVersion()` to read the loaded native SDK version before creating a client.
- Add `MeshStream.getVersion()` with the React Native package version, native SDK version, and current platform.
- Display both versions in the example and resolve its SDK from the installed npm package.
- Update the example for the local Android NDK and current Xcode/iOS scene lifecycle.

## 1.0.0

- Unified Android and iOS React Native bridges over the respective native MeshStream SDKs.
- Multi-client and multi-session lifecycle API.
- Playback URL, preload, player telemetry, status, statistics, diagnostics, and typed events.
- CDN-safe fallback semantics preserved from the native SDK.
