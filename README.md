# MeshStream P2P React Native SDK

[简体中文](README.zh-CN.md) · [Website](https://meshstream.net/) · [Documentation](https://meshstream.net/docs/sdk/react-native-setup/) · [npm](https://www.npmjs.com/package/react-native-meshstream) · [Live demo](https://demo.meshstream.net/)

MeshStream is a React Native P2P video and audio streaming SDK for Android and iOS. The `react-native-meshstream` package provides a shared JavaScript / TypeScript API for local playback URLs, peer events and traffic statistics, with HTTP/CDN fallback. Use it with `react-native-video` or another compatible player; your application owns playback and rendering.

## How it works

Create a session from your media URL, then give its `playbackUrl` to your existing player:

```text
App → SDK playback session → Local playback URL → Player
                              └─ SDK fetches from peers or origin/CDN
```

Your player handles decoding, rendering and playback controls. The SDK handles media delivery, caching and P2P scheduling. Configuration and P2P preparation run in the background; playback need not wait for a peer connection. Stop using the old playback URL before closing its session when leaving the page or switching content.

## Features

- HLS, MPEG-DASH and HTTP Range MP4/MP3 through the native SDKs.
- A shared JavaScript / TypeScript client/session API for Android and iOS.
- Preload, playback position/buffer updates, peer events and P2P/CDN statistics.
- npm installation, native autolinking and a `react-native-video` example app.

## Before you start

- Create an application and a platform-specific SDK Key in the [MeshStream console](https://console.meshstream.net/). If application identity validation is enabled, register the package name or Bundle ID of the app you run.
- Have a playable HLS `.m3u8`, DASH `.mpd`, or HTTP Range-capable MP4 / MP3 URL. Prefer HTTPS.
- Choose a player that supports your source format. The SDK adds delivery capabilities, not codecs; AVPlayer, for example, does not natively play DASH.

To try it first, jump to [Run the demo](#run-the-demo). The online demo linked above is a Web experience; run this repository's example for this platform.

## Requirements

The Android dependency includes `armeabi-v7a`, `arm64-v8a`, `x86`, and `x86_64` for matching devices and emulators. Your app must also meet the OS and architecture requirements of its framework and player.

- React Native `0.72+`
- Plugin Android declaration: API 21+; iOS: 15+. The host must also meet its React Native and player requirements. The bundled example uses React Native 0.76.9 and requires Android API 24+ and iOS 15.1+.
- MeshStream SDK key enabled for the target platform

Current npm version: `1.1.0`; both native SDK versions: `1.1.0`.

## Install

```bash
npm install --save-exact react-native-meshstream@1.1.0
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

For iOS, the bridge resolves the published `MeshStreamKit 1.1.0` CocoaPod. After installation, run `pod install --repo-update` from the app's `ios` directory and rebuild the native app.

The example below uses `react-native-video`. If your app has no player dependency yet, install a version compatible with your React Native release, then repeat iOS Pod installation.

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

### iOS local playback configuration

In your app's `Info.plist`, merge `NSAllowsLocalNetworking = true` into the `NSAppTransportSecurity` dictionary. Public HTTP media origins need their own ATS configuration; prefer HTTPS. Android public HTTP origins also need explicit rules; loopback access does not require allowing every domain.

## Basic usage

```tsx
import { MeshStream } from 'react-native-meshstream';

const client = await MeshStream.create({ key: 'key_your_platform_key' });
const session = await client.createPlaybackSession({
  url: 'https://cdn.example.com/live/playlist.m3u8',
  contentId: 'live-channel-42', // Stable across rotating signed URLs.
  mimeType: 'm3u8',
});

// Retain session and use session.playbackUrl in your component.
```

`createPlaybackSession` returns a playback URL while configuration and P2P preparation continue in the background. Media requests use origin/CDN delivery when P2P is unavailable; keep using the session URL as acceleration state changes.

Store the asynchronously created session in component state, then render it:

```tsx
import Video from 'react-native-video';

// Inside your component's JSX, once session is ready:
<Video source={{ uri: session.playbackUrl }} controls style={{ width: '100%', height: 220 }} />
```

When leaving or switching media, unmount the old player so it stops reading the URL, remove event listeners, then `await session.close()`. Call `await client.close()` when the owner no longer needs its other sessions. Handle session creation errors in your UI. See [`example/App.tsx`](example/App.tsx) for a complete component.

## Run the demo

Use Node.js 18+ and the React Native environment for your target platform. iOS requires macOS, Xcode and CocoaPods.

```bash
git clone https://github.com/Mesh-Stream/meshstream-p2p-react-native-sdk.git
cd meshstream-p2p-react-native-sdk/example
npm ci
npm start
```

Leave Metro running. In a second terminal, enter the same `example` directory and choose one platform:

```bash
# Android: start an emulator or connect a USB debugging device first
npm run android

# iOS: install Pods, then launch
cd ios
pod install --repo-update
cd ..
npm run ios
```

Enter the platform's SDK Key and media URL in the app. Start playback and inspect peers, traffic and diagnostics. For an iOS device, configure a signing team and Bundle ID. See the [example guide](example/README.md).

## Common advanced APIs

<details>
<summary>Preload, player feedback, events and diagnostics (expand)</summary>

### Multiple players and preload

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

### Player telemetry

Forward state from the active player at a low frequency. These methods do not cause reporting by themselves; native SDK reporting remains internal.

```ts
await session.updateBufferedDurationMs(bufferedDurationMs);
await session.updateCurrentPositionMs(currentPositionMs);
```

### Events, status, and diagnostics

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

#### Version information

Read version information before creating a client when attaching diagnostics to a support request. The React Native package and the native engine are versioned independently, so record both fields.

```ts
const sdkVersion = await MeshStream.getSdkVersion();
const version = await MeshStream.getVersion();
// { packageVersion: '1.1.0', nativeSdkVersion: '1.1.0', platform: 'android' }
```

Available event types: `peerCountChanged`, `playbackPrepared`, `p2pReady`, `p2pUnavailable`, `statistics`, `cdnFallback`, `trackerError`, and `peerConnectError`.

### Supported media

The binding forwards to the platform-native SDK. HLS (`m3u8`), DASH (`mpd`), MP4, and MP3 can be declared through `mimeType`; provide a stable `contentId` for any URL that rotates credentials. Your chosen React Native player must independently support the source format.

</details>

## Verify P2P delivery

1. Play the same content in two devices or independently running instances, each with a valid Key. Use the same rendition and nearby playback positions. For rotating signed URLs, use the same stable content ID for the same content, and different IDs for different content.
2. Watch peers and traffic in the demo. A nonzero peer count means a connection exists; **increasing P2P download or upload bytes** confirms media sharing.
3. Close the other instance and check that HTTP/CDN playback continues. Also check seeking, switching content and cleanup when leaving playback.

HTTP/CDN delivery is normal with one viewer or no shareable segments. Discovery and sharing also depend on account configuration, network connectivity and the content cached by both viewers.

## More examples and support

See [advanced usage](https://meshstream.net/docs/sdk/react-native-advanced/) for preload, live/VOD scheduling, player feedback, multiple sessions and diagnostics. See [CHANGELOG](CHANGELOG.md) for updates. Contact support@meshstream.net with the SDK version, OS, player and redacted logs.

## Other MeshStream SDKs

- [Web](https://github.com/Mesh-Stream/meshstream-p2p-web-sdk): JavaScript / TypeScript, WebRTC and browser players.
- [iOS / macOS](https://github.com/Mesh-Stream/meshstream-p2p-ios-sdk): MeshStreamKit, Swift / Objective-C, SPM and CocoaPods.
- [Android](https://github.com/Mesh-Stream/meshstream-p2p-android-sdk): Kotlin / Java, Maven and Media3 / ExoPlayer.
- [Windows](https://github.com/Mesh-Stream/meshstream-p2p-Windows-sdk): C / C++ API for Windows 10 / 11 x64.
- [uni-app](https://github.com/Mesh-Stream/meshstream-p2p-uniapp-sdk): UTS / JavaScript plugin for iOS and Android apps.
- [Flutter](https://github.com/Mesh-Stream/meshstream-p2p-flutter-sdk): Dart plugin for iOS / Android with video_player examples.
