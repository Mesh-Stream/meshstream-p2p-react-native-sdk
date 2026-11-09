# MeshStream P2P React Native SDK

[English](README.md) · [官网](https://meshstream.net/zh/) · [接入文档](https://meshstream.net/zh/docs/sdk/react-native-setup/) · [npm](https://www.npmjs.com/package/react-native-meshstream) · [在线 Demo](https://demo.meshstream.net/)

MeshStream 是面向 Android 和 iOS 的 React Native P2P 视频与音频流媒体 SDK。`react-native-meshstream` 通过统一的 JavaScript / TypeScript API 提供本地播放地址、Peer 事件与流量统计，并支持 HTTP/CDN 回退。可接入 `react-native-video` 或其他兼容播放器，播放与渲染由应用管理。

## 产品能力

- 通过原生 SDK 接入 HLS、MPEG-DASH 和支持 HTTP Range 的 MP4/MP3。
- Android 与 iOS 使用统一的 JavaScript / TypeScript client/session API。
- 支持预加载、播放位置与缓冲回传、Peer 事件和 P2P/CDN 统计。
- 通过 npm 安装，支持原生自动链接，提供 `react-native-video` 示例应用。

媒体解码与格式兼容性取决于所选播放器和平台；P2P 可用性取决于网络条件及持有相同内容的 Peer。

## 环境要求

Android 依赖包含 `armeabi-v7a`、`arm64-v8a`、`x86` 和 `x86_64`，可用于相应架构的真机与模拟器；应用仍需满足框架、基座及播放器的系统和架构要求。

- React Native `0.72+`
- 插件 Android 声明下限为 API 21，iOS 为 15+；应用还需满足 React Native 和播放器要求。示例使用 React Native 0.76.9，需要 Android API 24 及以上、iOS 15.1 及以上。
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
        url = uri("https://sdk.meshstream.net/maven")
        content { includeGroup("io.meshstream") }
    }
}
```

接入 iOS 时，bridge 会解析已发布的 `MeshStreamKit 1.0.10` CocoaPod。安装 npm 包后，请在应用的 `ios` 目录执行 `pod install --repo-update` 并重新编译原生工程。

## Android 本地播放代理

播放地址使用本机 HTTP 回环代理。在应用 Manifest 的 `<application>` 中添加 `android:networkSecurityConfig="@xml/meshstream_network_security_config"`，并创建 `res/xml/meshstream_network_security_config.xml`：

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

请关闭本绑定创建的 `MeshStream` client 或 session，而不是全局关闭原生 SDK；这样不会影响同一进程内的其他 React Native 播放器实例。

## 播放器状态上报

从当前活跃播放器以低频更新状态。以下调用不会自行发起用量上报，原生 SDK 的统计上报仍由其内部控制。

```ts
await session.updateBufferedDurationMs(bufferedDurationMs);
await session.updateCurrentPositionMs(currentPositionMs);
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

### 版本信息

创建客户端前即可读取版本信息。提交工单或诊断日志时，应同时记录 React Native 包版本和原生内核版本；两者独立发布。

```ts
const sdkVersion = await MeshStream.getSdkVersion();
const version = await MeshStream.getVersion();
// { packageVersion: '1.0.6', nativeSdkVersion: '1.0.10', platform: 'android' }
```

事件类型包括：`peerCountChanged`、`playbackPrepared`、`p2pReady`、`p2pUnavailable`、`statistics`、`cdnFallback`、`trackerError`、`peerConnectError`。

## 支持的媒体格式

底层调用平台原生 SDK。可通过 `mimeType` 声明 HLS（`m3u8`）、DASH（`mpd`）、MP4、MP3；签名 URL 或播放地址会变化时，应传入稳定的 `contentId`。最终格式支持能力仍以所选 React Native 播放器为准。

## 原生依赖

这个包是统一的 JavaScript 层，不是将 Android SDK 重新打包：

### 版本说明

- `react-native-meshstream` 使用独立的 React Native 包版本；当前版本为 `1.0.6`。
- Android 桥接使用独立的原生依赖：`io.meshstream:meshstream-android-sdk:1.0.10`。
- iOS 桥接使用独立的原生依赖：`MeshStreamKit 1.0.10`。

升级 React Native 包不会隐式升级任一原生 SDK。

- Android 从 MeshStream Maven 仓库解析 `io.meshstream:meshstream-android-sdk:1.0.10`。
- iOS 通过 CocoaPods 解析公开的 `MeshStreamKit 1.0.10`。

两个 bridge 都保证 client/session 隔离。关闭某一个 client 只会关闭其所属会话，不会中断同一进程中的其他 React Native 播放器。

## 其他 MeshStream SDK

- [Web](https://github.com/Mesh-Stream/meshstream-p2p-web-sdk): JavaScript / TypeScript、WebRTC 与浏览器播放器.
- [iOS / macOS](https://github.com/Mesh-Stream/meshstream-p2p-ios-sdk): MeshStreamKit、Swift / Objective-C、SPM 与 CocoaPods.
- [Android](https://github.com/Mesh-Stream/meshstream-p2p-android-sdk): Kotlin / Java、Maven 与 Media3 / ExoPlayer.
- [Windows](https://github.com/Mesh-Stream/meshstream-p2p-Windows-sdk): 面向 Windows 10 / 11 x64 的 C / C++ 接口.
- [uni-app](https://github.com/Mesh-Stream/meshstream-p2p-uniapp-sdk): 面向 iOS / Android App 的 UTS / JavaScript 插件.
- [Flutter](https://github.com/Mesh-Stream/meshstream-p2p-flutter-sdk): 面向 iOS / Android 的 Dart 插件及 video_player 示例.
