# React Native iOS bridge via public CocoaPods

## Goal

Ship the iOS implementation of `@meshstream/react-native-p2p` using the
public, binary `MeshStreamKit` CocoaPod. Its JS API, lifecycle, events, and
telemetry must match the Android bridge while keeping CDN playback safe when
P2P setup is unavailable.

## Scope and release order

This spans two repositories and must be released in this order:

1. In the Apple SDK repository (`derek-anyRTC/P2PCDN`), release public
   `MeshStreamKit` **1.0.1**.
2. In this React Native SDK repository, depend on that released pod and ship
   the completed iOS bridge.

`MeshStreamKit 1.0.0` is publicly available but does not declare a
per-client close operation. Calling an undeclared selector from the RN bridge
is not an acceptable public-SDK integration and will be removed.

## Apple SDK 1.0.1

Add `- (void)close` to the public `P2PClient` API. The method is idempotent,
stops all playback sessions owned by that client, removes event delivery, and
returns without waiting for network teardown. It must not call global
`[P2PSDK shutdown]`, because an application can own multiple independent
clients.

Build the standard signed `MeshStreamKit.xcframework`, package it as the
versioned `1.0.1` archive, and publish a public CocoaPods trunk spec that:

- names the pod `MeshStreamKit` at version `1.0.1`;
- pins the archive URL and SHA-256;
- exposes the iOS 13.0 binary XCFramework;
- lists Foundation, Network, and Security frameworks.

The published framework header and binary must be generated from the same
revision, so the declared `close` method is linked at runtime.

## React Native bridge

The RN podspec will require `MeshStreamKit` exactly at `1.0.1`. This makes the
bridge's native ABI reproducible and lets CocoaPods resolve it from the public
Specs repository during normal React Native autolinking; no local pod path,
vendored XCFramework, or private spec repo is used.

`ios/MeshStreamP2P.m` remains a classic `RCTEventEmitter` module with the
same JS-facing methods and payloads as Android:

- client creation and status snapshots;
- playback-session creation, preload, per-session P2P toggle, player timing
  updates, statistics, diagnostics, and close;
- client close and React Native bridge invalidation;
- typed session events (`playbackPrepared`, readiness/unavailable, peer count,
  statistics, CDN fallback, tracker, and peer errors).

Each JS client/session identifier maps to exactly one native object. Event
callbacks use the native session ID to find that mapping. Events that arrive
before `createPlaybackSession` has returned are bounded and flushed once the
JS-visible session ID exists. Client/session registries and this pending-event
buffer are synchronized; close removes mappings before releasing native
objects so no stale event reaches JavaScript.

Input validation stays compatible with Android: key and URL are required,
optional strings are trimmed, durations/positions are clamped to zero, and
only string-valued origin headers are forwarded. Status, statistics, and
diagnostics are converted solely from documented `MeshStreamKit` properties.

`closeClient` and `invalidate` close every retained session, remove the
listener, and call the documented `[P2PClient close]`. The bridge will not use
`objc_msgSend`, selector probing, or global SDK shutdown.

## Example and documentation

The existing React Native example remains the integration target. A clean
`pod install --repo-update` must resolve `MeshStreamKit 1.0.1` from the public
CocoaPods Specs CDN through RN autolinking. The README will state the minimum
iOS version, the public pod requirement, and that consumers rebuild their iOS
app after installing/upgrading the npm package.

## Verification

Verification is staged to isolate failures:

1. Add behavior-focused bridge tests first for client/session cleanup, event
   routing/buffering, conversion helpers, and invalid input. Each must fail
   before the corresponding production change.
2. Run the package typecheck/build and the example's existing Jest tests.
3. From a clean example iOS directory, run `pod install --repo-update`; inspect
   `Podfile.lock` to confirm `MeshStreamKit (1.0.1)` comes from the public
   Specs source rather than a local path.
4. Build the generated iOS workspace for an iPhone simulator with code signing
   disabled, then run its XCTest target if the simulator is available.
5. Run `pod lib lint MeshStreamP2P.podspec --allow-warnings` against the
   released public pod.

Publication is successful only after the public `MeshStreamKit 1.0.1` pod is
resolvable and the RN example builds against it. If CocoaPods trunk credentials
or binary-release credentials are unavailable, the source and release metadata
can be prepared and locally validated, but the publication remains pending
those credentials.
