# MeshStream React Native SDK

React Native binding for MeshStream P2P playback acceleration. It creates a CDN-safe local playback URL; use that URL with `react-native-video` or your existing player. The SDK does not include a player and does not control your player lifecycle.

> This is one cross-platform React Native package. It bridges to the MeshStream Android SDK on Android and MeshStreamKit on iOS. The JavaScript API and client/session lifecycle are identical on both platforms.

[中文文档](./README.zh-CN.md) | [Web SDK](https://github.com/Mesh-Stream/meshstream-p2p-web-sdk) | [Android SDK](https://github.com/Mesh-Stream/meshstream-p2p-android-sdk) | [iOS SDK](https://github.com/Mesh-Stream/meshstream-p2p-ios-sdk) | [Windows SDK](https://github.com/Mesh-Stream/meshstream-p2p-Windows-sdk) | [Online demo](https://demo.meshstream.net/)

## Requirements

- React Native `0.72+`
- Android API 24+ (Android 7.0+) or iOS 13+
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
        url = uri("https://pub-61830e1369904d19af505ff74fd55ba4.r2.dev/maven")
        content { includeGroup("io.meshstream") }
    }
}
```

For iOS, the bridge resolves the public `MeshStreamKit 1.0.2` CocoaPod. After installation, run `pod install --repo-update` from the app's `ios` directory and rebuild the native app. Do not add a local `MeshStreamKit` pod path or embed its XCFramework yourself.

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

Available event types: `peerCountChanged`, `playbackPrepared`, `p2pReady`, `p2pUnavailable`, `statistics`, `cdnFallback`, `trackerError`, and `peerConnectError`.

## Supported media

The binding forwards to the platform-native SDK. HLS (`m3u8`), DASH (`mpd`), MP4, and MP3 can be declared through `mimeType`; provide a stable `contentId` for any URL that rotates credentials. Your chosen React Native player must independently support the source format.

## Native dependencies

The package is a unified JavaScript layer, not an Android SDK repackaged for React Native:

### Versioning

- `react-native-meshstream` follows its own React Native package version. This release is `1.0.0`.
- The Android bridge keeps its independent native dependency: `io.meshstream:meshstream-android-sdk:1.0.2`.
- The iOS bridge keeps its independent native dependency: `MeshStreamKit >= 1.0.0`.

Updating the React Native package does not implicitly upgrade either native SDK.

- Android resolves `io.meshstream:meshstream-android-sdk:1.0.2` from the MeshStream Maven repository.
- iOS resolves the public `MeshStreamKit 1.0.2` CocoaPod.

Both bridges maintain client/session isolation. Closing a client only closes its own sessions and never interrupts another React Native player in the same process.
