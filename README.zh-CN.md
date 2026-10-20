# MeshStream React Native SDK

面向 React Native 的 MeshStream P2P 播放加速绑定。SDK 返回可直接交给播放器的本地代理播放地址；应用可继续使用 `react-native-video` 或现有播放器。SDK 不内置播放器，也不接管播放器生命周期。

> 这是一个统一的跨端 React Native 包：Android 运行时桥接 MeshStream Android SDK，iOS 运行时桥接 MeshStreamKit。两端使用相同的 JavaScript API、client/session 生命周期和事件模型。

[English](./README.md) | [Web SDK](https://github.com/Mesh-Stream/meshstream-p2p-web-sdk) | [Android SDK](https://github.com/Mesh-Stream/meshstream-p2p-android-sdk) | [iOS SDK](https://github.com/Mesh-Stream/meshstream-p2p-ios-sdk) | [Windows SDK](https://github.com/Mesh-Stream/meshstream-p2p-Windows-sdk) | [在线 Demo](https://demo.meshstream.net/)

## 环境要求

- React Native `0.72+`
- Android API 24+（Android 7.0+）或 iOS 13+
- 已启用对应目标平台的 MeshStream SDK Key

## 安装

```bash
npm install react-native-meshstream
```

在 React Native Android 工程的 `android/settings.gradle` 中，向 `dependencyResolutionManagement.repositories` 添加 MeshStream Maven 仓库：

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

如果接入 iOS，请在应用的 `ios` 目录执行 `pod install`。iOS 会独立解析 `MeshStreamKit` Pod，不使用 Android 产物。两个平台安装依赖后都需要重新编译原生工程。

## 基础接入

```tsx
import Video from 'react-native-video';
import { MeshStream } from 'react-native-meshstream';

const client = await MeshStream.create({ key: 'key_your_android_key' });
const session = await client.createPlaybackSession({
  url: 'https://cdn.example.com/live/playlist.m3u8',
  contentId: 'live-channel-42', // 签名 URL 轮换时保持稳定。
  mimeType: 'm3u8',
});

// 播放期间保持 session 存活。
<Video source={{ uri: session.playbackUrl }} controls />;

// 播放器销毁时：
await session.close();
await client.close();
```

`createPlaybackSession` 会立即返回 CDN 安全的播放地址；P2P 策略和网络初始化在后台执行。策略、Tracker 或对等连接不可用时会回源 CDN，不会主动硬中断正在播放的会话。

## 多播放器与预热

一个 client 可管理多个独立 session。每个 session 对应一个播放项，用完必须关闭。

```ts
const next = await client.createPlaybackSession({
  url: nextItem.url,
  contentId: nextItem.id,
  mimeType: 'mp4',
});

await next.preload();
// 仅在下一条真正播放时，将 next.playbackUrl 交给播放器。
```

应用侧不要调用 `P2pSdk.shutdown()`。本绑定只关闭它创建的 client 或 session，避免影响同一应用中的其他播放器实例。

## 播放器状态上报

从当前活跃播放器以低频更新状态。以下调用不会自行发起用量上报，原生 SDK 的统计上报仍由其内部控制。

```ts
await session.updateBufferedDurationMs(bufferedDurationMs);
await session.updateCurrentPositionMs(currentPositionMs);

// 仅直播场景：当前播放点到直播边缘的距离。
await session.updateLiveEdgeOffsetMs(liveEdgeOffsetMs);
```

## 事件、状态与诊断

所有事件都带有 `clientId`、`sessionId`，可安全用于多播放器场景。

```ts
import { addMeshStreamEventListener } from 'react-native-meshstream';

const subscription = addMeshStreamEventListener((event) => {
  if (event.type === 'p2pUnavailable') {
    console.info('当前会话 P2P 不可用：', event.reason);
  }
}, { clientId: client.clientId });

const status = await client.getStatus();
const stats = await session.getStats();
const diagnostics = await session.getDiagnostics();

subscription.remove();
```

事件类型包括：`peerCountChanged`、`playbackPrepared`、`p2pReady`、`p2pUnavailable`、`statistics`、`cdnFallback`、`trackerError`、`peerConnectError`。

## 支持的媒体格式

底层使用 Android SDK。可通过 `mimeType` 声明 HLS（`m3u8`）、DASH（`mpd`）、MP4、MP3；签名 URL 或播放地址会变化时，应传入稳定的 `contentId`。最终格式支持能力仍以所选 React Native 播放器为准。

## 原生依赖

这个包是统一的 JavaScript 层，不是将 Android SDK 重新打包：

### 版本说明

- `react-native-meshstream` 使用独立的 React Native 包版本；当前首发版本为 `1.0.0`。
- Android 桥接使用独立的原生依赖：`io.meshstream:meshstream-android-sdk:1.0.2`。
- iOS 桥接使用独立的原生依赖：`MeshStreamKit >= 1.0.0`。

升级 React Native 包不会隐式升级任一原生 SDK。

- Android 从 MeshStream Maven 仓库解析 `io.meshstream:meshstream-android-sdk:1.0.2`。
- iOS 通过 CocoaPods 解析 `MeshStreamKit >= 1.0.0`。

两个 bridge 都保证 client/session 隔离。关闭某一个 client 只会关闭其所属会话，不会中断同一进程中的其他 React Native 播放器。
