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
npm install @meshstream/react-native-p2p
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

For iOS, run `pod install` from the app's `ios` directory after installation. The pod bridge resolves `MeshStreamKit` independently; it does not use Android artifacts. Rebuild the native app after installing either platform dependency.

## Basic usage

```tsx
import Video from 'react-native-video';
import { MeshStream } from '@meshstream/react-native-p2p';

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

Do not call `P2pSdk.shutdown()` from an app integration. The binding closes only the client or session it owns, which keeps other React Native players isolated.

## Player telemetry

Forward state from the active player at a low frequency. These methods do not cause reporting by themselves; native SDK reporting remains internal.

```ts
await session.updateBufferedDurationMs(bufferedDurationMs);
await session.updateCurrentPositionMs(currentPositionMs);

// For live streams only: current distance from the live edge.
await session.updateLiveEdgeOffsetMs(liveEdgeOffsetMs);
```

## Events, status, and diagnostics

Events always include `clientId` and `sessionId`, which makes multiple players safe to observe.

```ts
import { MeshStream, addMeshStreamEventListener } from '@meshstream/react-native-p2p';

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

The binding proxies the Android SDK. HLS (`m3u8`), DASH (`mpd`), MP4, and MP3 can be declared through `mimeType`; provide a stable `contentId` for any URL that rotates credentials. Your chosen React Native player must independently support the source format.

## Native dependencies

The package is a unified JavaScript layer, not an Android SDK repackaged for React Native:

- Android resolves `io.meshstream:meshstream-android-sdk:1.0.2` from the MeshStream Maven repository.
- iOS resolves `MeshStreamKit >= 1.0.0` through CocoaPods.

Both bridges maintain client/session isolation. Closing a client only closes its own sessions and never interrupts another React Native player in the same process.
