# Changelog

## 1.0.6 - 2026-11-09

- Fix iOS event subscriptions to register and release native listeners.

- Upgrade both iOS MeshStreamKit and the Android native SDK to 1.0.10.
- Retain Android API 21+, iOS 15+, and all four Android ABIs.
- Update native version checks and integration guidance.

## 1.0.5 - 2026-11-01

- Upgrade Android to meshstream-android-sdk 1.0.9 with armeabi-v7a, arm64-v8a, x86, and x86_64.
- Retain iOS MeshStreamKit 1.0.8 and the plugin minimums of Android API 21 and iOS 15.
- Update installation guidance, emulator architecture requirements, and examples.

## 1.0.4 - 2026-11-01

- Upgrade the public Android dependency to meshstream-android-sdk 1.0.8; retain iOS MeshStreamKit 1.0.8.
- Lower the plugin Android declaration from API 24 to API 21; the app must still meet its framework and player requirements.
- Document plugin requirements separately from example targets and device acceptance.

## 1.0.3 - 2026-10-31

- Updates the iOS dependency to MeshStreamKit 1.0.8 and Android dependency to meshstream-android-sdk 1.0.7.
- Includes the native proxy shutdown fix while preserving the existing React Native lifecycle API.

## 1.0.2

- Upgrade the public iOS dependency to MeshStreamKit 1.0.7 (iOS 15+).
- Upgrade the public Android dependency to meshstream-android-sdk 1.0.6.
- Use the public sdk.meshstream.net Maven endpoint in the example and installation guides.

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
