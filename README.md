# MeshStream P2P React Native SDK

[简体中文](README.zh-CN.md) · [Website](https://meshstream.net/) · [Documentation](https://meshstream.net/docs/sdk/react-native-setup/) · [npm](https://www.npmjs.com/package/react-native-meshstream) · [Live demo](https://demo.meshstream.net/)

MeshStream is a React Native P2P video and audio streaming SDK for Android and iOS. The `react-native-meshstream` package provides a shared JavaScript / TypeScript API for local playback URLs, peer events and traffic statistics, with HTTP/CDN fallback. Use it with `react-native-video` or another compatible player; your application owns playback and rendering.

## Features

- HLS, MPEG-DASH and HTTP Range MP4/MP3 through the native SDKs.
- A shared JavaScript / TypeScript client/session API for Android and iOS.
- Preload, playback position/buffer updates, peer events and P2P/CDN statistics.
- npm installation, native autolinking and a `react-native-video` example app.

Media decoding and format support depend on your chosen player and platform. P2P availability depends on network conditions and peers with matching content.

## Requirements

The Android dependency includes `armeabi-v7a`, `arm64-v8a`, `x86`, and `x86_64` for matching devices and emulators. Your app must also meet the OS and architecture requirements of its framework and player.

- React Native `0.72+`
- Plugin Android declaration: API 21+; iOS: 15+. The host must also meet its React Native and player requirements. The bundled example uses React Native 0.76.9 and requires Android API 24+ and iOS 15.1+.
- MeshStream SDK key enabled for the target platform

## Install

```bash
npm install react-native-meshstream
```

For Android, add the MeshStream Maven repository to `android/settings.gradle` in the app's `dependencyResolutionManagement.repositories` block:

```kotlin
repositories {
    google()
    mavenCentral()
    maven {
        url = uri("https://sdk.meshstream.net/maven")
        content { includeGroup("io.meshstream") }
    }
}
```

For iOS, the bridge resolves the published `MeshStreamKit 1.0.10` CocoaPod. After installation, run `pod install --repo-update` from the app's `ios` directory and rebuild the native app.

## Android local playback proxy

The playback URL uses an HTTP loopback proxy. In your app manifest, add `android:networkSecurityConfig="@xml/meshstream_network_security_config"` to `<application>` and create `res/xml/meshstream_network_security_config.xml` with:

```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="false" />
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="false">127.0.0.1</domain>
        <domain includeSubdomains="false">localhost</domain>
    </domain-config>
</network-security-config>
```

## Basic usage

```tsx
import Video from 'react-native-video';
import { MeshStream } from 'react-native-meshstream';

const client = await MeshStream.create({ key: 'key_your_android_key' });
const session = await client.createPlaybackSession({
  url: 'https://cdn.example.com/live/playlist.m3u8',
  contentId: 'live-channel-42', // Stable across rotating signed URLs.
  mimeType: 'm3u8',
});

// Keep the session alive while the player uses this URL.
<Video source={{ uri: session.playbackUrl }} controls />;

// On player teardown:
await session.close();
await client.close();
```

`createPlaybackSession` returns promptly with a CDN-safe URL. P2P policy/bootstrap work proceeds in the background. A policy, tracker, or peer issue falls back to your origin/CDN and does not intentionally stop an already running player.

## Multiple players and preload

One client can host several sessions. A session is independent and must be closed when its player is no longer using the URL.

```ts
const next = await client.createPlaybackSession({
  url: nextItem.url,
  contentId: nextItem.id,
  mimeType: 'mp4',
});

await next.preload();
// Give next.playbackUrl to the player only when it becomes active.
```

Close the `MeshStream` client or session created by this binding instead of shutting down a native SDK globally. This keeps other React Native players in the same process isolated.

## Player telemetry

Forward state from the active player at a low frequency. These methods do not cause reporting by themselves; native SDK reporting remains internal.

```ts
await session.updateBufferedDurationMs(bufferedDurationMs);
await session.updateCurrentPositionMs(currentPositionMs);
```

## Events, status, and diagnostics

Events always include `clientId` and `sessionId`, which makes multiple players safe to observe.

```ts
import { MeshStream, addMeshStreamEventListener } from 'react-native-meshstream';

const subscription = addMeshStreamEventListener((event) => {
  if (event.type === 'p2pUnavailable') {
    console.info('P2P unavailable for this session:', event.reason);
  }
}, { clientId: client.clientId });

const status = await client.getStatus();
const stats = await session.getStats();
const diagnostics = await session.getDiagnostics();

subscription.remove();
```

### Version information

Read version information before creating a client when attaching diagnostics to a support request. The React Native package and the native engine are versioned independently, so record both fields.

```ts
const sdkVersion = await MeshStream.getSdkVersion();
const version = await MeshStream.getVersion();
// { packageVersion: '1.0.6', nativeSdkVersion: '1.0.10', platform: 'android' }
```

Available event types: `peerCountChanged`, `playbackPrepared`, `p2pReady`, `p2pUnavailable`, `statistics`, `cdnFallback`, `trackerError`, and `peerConnectError`.

## Supported media

The binding forwards to the platform-native SDK. HLS (`m3u8`), DASH (`mpd`), MP4, and MP3 can be declared through `mimeType`; provide a stable `contentId` for any URL that rotates credentials. Your chosen React Native player must independently support the source format.

## Native dependencies

The package is a unified JavaScript layer, not an Android SDK repackaged for React Native:

### Versioning

- `react-native-meshstream` follows its own React Native package version. This release is `1.0.6`.
- The Android bridge keeps its independent native dependency: `io.meshstream:meshstream-android-sdk:1.0.10`.
- The iOS bridge keeps its independent native dependency: `MeshStreamKit 1.0.10`.

Updating the React Native package does not implicitly upgrade either native SDK.

- Android resolves `io.meshstream:meshstream-android-sdk:1.0.10` from the MeshStream Maven repository.
- iOS resolves the public `MeshStreamKit 1.0.10` CocoaPod.

Both bridges maintain client/session isolation. Closing a client only closes its own sessions and never interrupts another React Native player in the same process.

## Other MeshStream SDKs

- [Web](https://github.com/Mesh-Stream/meshstream-p2p-web-sdk): JavaScript / TypeScript, WebRTC and browser players.
- [iOS / macOS](https://github.com/Mesh-Stream/meshstream-p2p-ios-sdk): MeshStreamKit, Swift / Objective-C, SPM and CocoaPods.
- [Android](https://github.com/Mesh-Stream/meshstream-p2p-android-sdk): Kotlin / Java, Maven and Media3 / ExoPlayer.
- [Windows](https://github.com/Mesh-Stream/meshstream-p2p-Windows-sdk): C / C++ API for Windows 10 / 11 x64.
- [uni-app](https://github.com/Mesh-Stream/meshstream-p2p-uniapp-sdk): UTS / JavaScript plugin for iOS and Android apps.
- [Flutter](https://github.com/Mesh-Stream/meshstream-p2p-flutter-sdk): Dart plugin for iOS / Android with video_player examples.
