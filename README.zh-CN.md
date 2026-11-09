# MeshStream P2P React Native SDK

[English](README.md) · [官网](https://meshstream.net/zh/) · [接入文档](https://meshstream.net/zh/docs/sdk/react-native-setup/) · [npm](https://www.npmjs.com/package/react-native-meshstream) · [在线 Demo](https://demo.meshstream.net/)

MeshStream 是面向 Android 和 iOS 的 React Native P2P 视频与音频流媒体 SDK。`react-native-meshstream` 通过统一的 JavaScript / TypeScript API 提供本地播放地址、Peer 事件与流量统计，并支持 HTTP/CDN 回退。可接入 `react-native-video` 或其他兼容播放器，播放与渲染由应用管理。

## 工作方式

把原始媒体地址交给 SDK 创建会话，再把会话的 `playbackUrl` 交给现有播放器：

```text
应用 → SDK 创建播放会话 → 本地播放地址 → 播放器
                            └─ SDK 从 Peer 或源站/CDN 获取媒体
```

播放器继续负责解码、画面和播放控制；SDK 负责媒体传输、缓存及 P2P 调度。服务配置与 P2P 准备在后台执行，不需要等到 Peer 连接后才开始播放。离开播放页或切换内容时，先停止使用旧播放地址，再关闭旧会话。

## 产品能力

- 通过原生 SDK 接入 HLS、MPEG-DASH 和支持 HTTP Range 的 MP4/MP3。
- Android 与 iOS 使用统一的 JavaScript / TypeScript client/session API。
- 支持预加载、播放位置与缓冲回传、Peer 事件和 P2P/CDN 统计。
- 通过 npm 安装，支持原生自动链接，提供 `react-native-video` 示例应用。

## 接入准备

- 在 [MeshStream 控制台](https://console.meshstream.net/)创建应用和对应平台的 SDK Key；启用身份校验时，登记与运行应用一致的包名或 Bundle ID。
- 准备一个可播放的 HLS `.m3u8`、DASH `.mpd`、支持 Range 的 MP4 或 MP3 地址，建议使用 HTTPS。
- 选择支持该媒体格式的播放器。SDK 提供传输能力，不增加播放器的解码能力；例如 AVPlayer 不原生支持 DASH。

希望先看效果？直接跳到[运行 Demo](#运行-demo)，再按下方步骤接入自己的应用。顶部的在线 Demo 是 Web 体验页，各端示例在本仓库中运行。

## 环境要求

Android 依赖包含 `armeabi-v7a`、`arm64-v8a`、`x86` 和 `x86_64`，可用于相应架构的真机与模拟器；应用仍需满足框架、基座及播放器的系统和架构要求。

- React Native `0.72+`
- 插件 Android 声明下限为 API 21，iOS 为 15+；应用还需满足 React Native 和播放器要求。示例使用 React Native 0.76.9，需要 Android API 24 及以上、iOS 15.1 及以上。
- 已启用对应目标平台的 MeshStream SDK Key

当前 npm 版本为 `1.0.6`；双端原生 SDK 均为 `1.0.10`。

## 安装

```bash
npm install --save-exact react-native-meshstream@1.0.6
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

以下示例使用 `react-native-video`；若工程尚未安装播放器，添加与当前 React Native 兼容的版本，再重新执行 iOS Pod 安装。

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

### iOS 本地播放网络配置

在应用的 `Info.plist` 中，将 `NSAllowsLocalNetworking = true` 合并到 `NSAppTransportSecurity` 字典。公网 HTTP 媒体源需要单独的 ATS 配置，建议使用 HTTPS。Android 的公网 HTTP 媒体源也需单独配置；不要因本地代理而放开所有域名。

## 基础接入

```tsx
import { MeshStream } from 'react-native-meshstream';

const client = await MeshStream.create({ key: 'key_your_platform_key' });
const session = await client.createPlaybackSession({
  url: 'https://cdn.example.com/live/playlist.m3u8',
  contentId: 'live-channel-42', // 签名 URL 轮换时保持稳定。
  mimeType: 'm3u8',
});

// 保存 session，在组件中使用 session.playbackUrl。
```

`createPlaybackSession` 返回播放地址后，服务配置与 P2P 准备继续在后台执行。P2P 不可用时，媒体请求通过源站/CDN 获取；加速状态变化时继续使用原会话地址。

将异步创建的会话保存到组件状态后，在组件渲染中使用：

```tsx
import Video from 'react-native-video';

// session 就绪后，在组件的 JSX 中：
<Video source={{ uri: session.playbackUrl }} controls style={{ width: '100%', height: 220 }} />
```

退出页面或切换视频时，先卸载旧播放器（使其停止读取旧地址），再移除事件订阅、执行 `await session.close()`。页面不再持有其他会话时执行 `await client.close()`。创建会话失败时由页面展示错误或处理回源；完整组件见 [`example/App.tsx`](example/App.tsx)。

## 运行 Demo

准备 Node.js 18+ 和对应平台的 React Native 开发环境。iOS 需要 macOS、Xcode 和 CocoaPods。

```bash
git clone https://github.com/Mesh-Stream/meshstream-p2p-react-native-sdk.git
cd meshstream-p2p-react-native-sdk/example
npm ci
npm start
```

保留 Metro 终端，在另一个终端进入同一 `example` 目录并选择一个平台：

```bash
# Android：先启动模拟器或连接 USB 调试设备
npm run android

# iOS：安装 Pods 后启动
cd ios
pod install --repo-update
cd ..
npm run ios
```

在应用中填写对应平台的 SDK Key 和媒体地址，开始播放后查看 Peer、上下行流量和诊断。真机 iOS 运行需配置签名 Team 与 Bundle ID。播放器完整流程见[示例说明](example/README.md)。

## 常用进阶 API

<details>
<summary>预加载、状态回传、事件与诊断（可展开）</summary>

### 多播放器与预热

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

### 播放器状态上报

从当前活跃播放器以低频更新状态。以下调用不会自行发起用量上报，原生 SDK 的统计上报仍由其内部控制。

```ts
await session.updateBufferedDurationMs(bufferedDurationMs);
await session.updateCurrentPositionMs(currentPositionMs);
```

### 事件、状态与诊断

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

#### 版本信息

创建客户端前即可读取版本信息。提交工单或诊断日志时，应同时记录 React Native 包版本和原生内核版本；两者独立发布。

```ts
const sdkVersion = await MeshStream.getSdkVersion();
const version = await MeshStream.getVersion();
// { packageVersion: '1.0.6', nativeSdkVersion: '1.0.10', platform: 'android' }
```

事件类型包括：`peerCountChanged`、`playbackPrepared`、`p2pReady`、`p2pUnavailable`、`statistics`、`cdnFallback`、`trackerError`、`peerConnectError`。

### 支持的媒体格式

底层调用平台原生 SDK。可通过 `mimeType` 声明 HLS（`m3u8`）、DASH（`mpd`）、MP4、MP3；签名 URL 或播放地址会变化时，应传入稳定的 `contentId`。最终格式支持能力仍以所选 React Native 播放器为准。

</details>

## 确认 P2P 生效

1. 在两台设备或两个可同时运行的实例中，用各自有效的 Key 播放同一内容，保持相同清晰度和相近播放进度。签名 URL 会变化时，为同一内容使用相同、稳定的内容 ID；不同内容不要共用 ID。
2. 查看 Demo 的 Peer 数和流量统计。Peer 大于 0 表示已连接节点；**P2P 下载或上传字节持续增加**才说明发生了媒体共享。
3. 关闭另一个实例，确认剩余实例仍能通过 HTTP/CDN 播放；然后测试拖动、切换内容和退出页面的释放流程。

只有一个观看者或没有可共享分片时，主要走 HTTP/CDN 属于正常情况。发现 Peer 及实际共享还取决于账户配置、网络连通性和双方缓存内容。

## 更多用法与支持

预加载、直播/点播调度、播放器状态回传、多会话及诊断，请参阅[高级用法](https://meshstream.net/zh/docs/sdk/react-native-advanced/)。更新记录见 [CHANGELOG](CHANGELOG.md)。接入问题请联系 support@meshstream.net，并附 SDK 版本、系统、播放器和脱敏日志。

## 其他 MeshStream SDK

- [Web](https://github.com/Mesh-Stream/meshstream-p2p-web-sdk): JavaScript / TypeScript、WebRTC 与浏览器播放器.
- [iOS / macOS](https://github.com/Mesh-Stream/meshstream-p2p-ios-sdk): MeshStreamKit、Swift / Objective-C、SPM 与 CocoaPods.
- [Android](https://github.com/Mesh-Stream/meshstream-p2p-android-sdk): Kotlin / Java、Maven 与 Media3 / ExoPlayer.
- [Windows](https://github.com/Mesh-Stream/meshstream-p2p-Windows-sdk): 面向 Windows 10 / 11 x64 的 C / C++ 接口.
- [uni-app](https://github.com/Mesh-Stream/meshstream-p2p-uniapp-sdk): 面向 iOS / Android App 的 UTS / JavaScript 插件.
- [Flutter](https://github.com/Mesh-Stream/meshstream-p2p-flutter-sdk): 面向 iOS / Android 的 Dart 插件及 video_player 示例.
