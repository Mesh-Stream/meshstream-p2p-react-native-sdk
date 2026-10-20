# React Native iOS Public CocoaPods Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete and verify the React Native iOS bridge against public `MeshStreamKit 1.0.2`, which already exposes the supported client shutdown API.

**Architecture:** Public `MeshStreamKit 1.0.2` publishes the client shutdown API in its Objective-C header and XCFramework CocoaPod. The React Native bridge pins that public ABI, owns native clients/sessions by JS UUID, removes its runtime-selector call, validates JS inputs like Android, and is compiled by the RN example through normal autolinking.

**Tech Stack:** Objective-C, XCTest, CocoaPods, React Native 0.76, TypeScript, Jest, Xcode simulator build.

**Spec:** `docs/superpowers/specs/2026-10-20-react-native-ios-public-cocoapods-design.md`

## Global Constraints

- Consume `MeshStreamKit` **1.0.2** from the public CocoaPods Specs CDN as a binary XCFramework; minimum iOS is **13.0**.
- `P2PClient.close` is public, idempotent, client-scoped, closes its sessions, and never invokes global `P2PSDK.shutdown`.
- The RN podspec depends on exactly `MeshStreamKit` **1.0.2**; no local pod path, vendored framework, private Specs source, selector probing, `objc_msgSend`, or global SDK shutdown.
- Preserve Android-equivalent JS methods, error codes, event names/payloads, bounded pre-registration event buffering, and CDN-safe playback behavior.
- Write every behavioral test before its production change and observe the expected failure.

---

## File structure

### Apple SDK repository: `/Users/zjq/Desktop/AI/Codex-项目/P2PCDN`

- `sdks/apple/Sources/MeshStreamKit/include/MeshStreamKit.h` — public `P2PClient` lifecycle contract.
- `sdks/apple/Sources/MeshStreamKit/MeshStreamKit.m` — existing lifecycle implementation; confirm `close` delegates to `shutdownClient`.
- `sdks/apple/Tests/MeshStreamKitTests/MeshStreamKitTests.m` — XCTest coverage for the public client close contract.
- `MeshStreamKit.podspec` — public 1.0.2 binary pod metadata, archive URL, and generated SHA-256.
- `sdks/apple/scripts/test_apple_packaging.sh` — release guard for the public close declaration.

### RN SDK repository: `/Users/zjq/Desktop/AI/Codex-项目/P2PCDN/.worktrees/meshstream-p2p-react-native-sdk`

- `MeshStreamP2P.podspec` — RN autolinking dependency pinned to public `MeshStreamKit 1.0.2`.
- `ios/MeshStreamP2P.m` — `RCTEventEmitter` bridge; public API invocation, validation, cleanup, event forwarding.
- `example/ios/MeshStreamRnDemoTests/MeshStreamRnDemoTests.m` — app-level bridge tests.
- `README.md`, `README.zh-CN.md` — public iOS installation guidance.
- `scripts/verify-ios-cocoapods.mjs` — static check of pod pin and docs.

---

### Task 1: Publish the `P2PClient.close` contract

**Files:**
- Modify: `/Users/zjq/Desktop/AI/Codex-项目/P2PCDN/sdks/apple/Sources/MeshStreamKit/include/MeshStreamKit.h:210-224`
- Verify: `/Users/zjq/Desktop/AI/Codex-项目/P2PCDN/sdks/apple/Sources/MeshStreamKit/MeshStreamKit.m:1593-1595,1678-1716`
- Modify: `/Users/zjq/Desktop/AI/Codex-项目/P2PCDN/sdks/apple/Tests/MeshStreamKitTests/MeshStreamKitTests.m`
- Modify: `/Users/zjq/Desktop/AI/Codex-项目/P2PCDN/sdks/apple/scripts/test_apple_packaging.sh:21-29`

**Interfaces:**
- Consumes: `-shutdownClient` and `P2PErrorClientShutdown`.
- Produces: `- (void)close` on public `P2PClient`; calls are idempotent and later session creation reports `P2PErrorClientShutdown`.

- [ ] **Step 1: Write the failing public-contract XCTest**

  Add before `tearDown` in `MeshStreamKitTests.m`:

  ```objective-c
  - (void)testClientCloseIsIdempotentAndRejectsNewPlaybackSessions {
      P2PConfig *config = [[P2PConfig alloc] initWithKey:@"test-key"];
      P2PClient *client = [P2PSDK clientWithConfig:config error:nil];
      XCTAssertNotNil(client);
      [client close];
      [client close];
      NSError *error = nil;
      PlaybackSession *session = [client createPlaybackSessionWithURL:[NSURL URLWithString:@"https://example.com/live.m3u8"] error:&error];
      XCTAssertNil(session);
      XCTAssertEqualObjects(error.domain, P2PErrorDomain);
      XCTAssertEqual(error.code, P2PErrorClientShutdown);
  }
  ```

- [ ] **Step 2: Run the test and verify the header makes it fail**

  ```bash
  cd /Users/zjq/Desktop/AI/Codex-项目/P2PCDN
  swift test --package-path sdks/apple --filter MeshStreamKitTests.testClientCloseIsIdempotentAndRejectsNewPlaybackSessions
  ```

  Expected: compiler error that `P2PClient` does not declare `close`.

- [ ] **Step 3: Make the API public without changing its client-scoped implementation**

  Add before `createPlaybackSessionWithURL:` in the public `P2PClient` interface:

  ```objective-c
  /// Stops this client's sessions and native work. Safe to call repeatedly and
  /// returns without waiting for network teardown. It does not affect other clients.
  - (void)close;
  ```

  Confirm the existing implementation is retained:

  ```objective-c
  - (void)close {
      [self shutdownClient];
  }
  ```

- [ ] **Step 4: Verify green and make the packaging guard fail if the declaration disappears**

  Add after the existing create-session header check in `test_apple_packaging.sh`:

  ```bash
  if ! grep -Fq -- '- (void)close;' "$PUBLIC_HEADER"; then
    echo "P2PClient close entry is missing from the public header." >&2
    exit 1
  fi
  ```

  Run:

  ```bash
  cd /Users/zjq/Desktop/AI/Codex-项目/P2PCDN
  swift test --package-path sdks/apple --filter MeshStreamKitTests.testClientCloseIsIdempotentAndRejectsNewPlaybackSessions
  swift test --package-path sdks/apple
  bash sdks/apple/scripts/test_apple_packaging.sh
  ```

  Expected: all pass.

- [ ] **Step 5: Commit**

  ```bash
  cd /Users/zjq/Desktop/AI/Codex-项目/P2PCDN
  git add sdks/apple/Sources/MeshStreamKit/include/MeshStreamKit.h sdks/apple/Tests/MeshStreamKitTests/MeshStreamKitTests.m sdks/apple/scripts/test_apple_packaging.sh
  git commit -m "feat(apple): expose per-client close API"
  ```

### Task 2: Build and publish `MeshStreamKit 1.0.2`

**Files:**
- Modify: `/Users/zjq/Desktop/AI/Codex-项目/P2PCDN/MeshStreamKit.podspec`
- Modify: `/Users/zjq/Desktop/AI/Codex-项目/P2PCDN/scripts/repo-boundary.test.mjs`
- Generate: `/Users/zjq/Desktop/AI/Codex-项目/P2PCDN/sdks/apple/dist/meshstreamkit-apple-sdk-1.0.2.{zip,zip.sha256,json}`

**Interfaces:**
- Consumes: Task 1's public header.
- Produces: public `MeshStreamKit (1.0.2)` with a binary and header that agree on `close`.

- [ ] **Step 1: Write a failing release-spec test**

  Add beside the existing Apple release assertions in `scripts/repo-boundary.test.mjs`:

  ```javascript
  check("Apple CocoaPod declares the release archive checksum", () => {
    const podspec = read("MeshStreamKit.podspec");
    assert.match(podspec, /s\.version = '1\.0\.1'/);
    assert.match(podspec, /https:\/\/sdk\.meshstream\.net\/apple\/1\.0\.1\/MeshStreamKit\.zip/);
    assert.match(podspec, /:sha256 => '[0-9a-f]{64}'/);
  });
  ```

- [ ] **Step 2: Run the test to observe the 0.1.0 metadata failure**

  ```bash
  cd /Users/zjq/Desktop/AI/Codex-项目/P2PCDN
  node scripts/repo-boundary.test.mjs
  ```

  Expected: the new assertion fails because the root podspec says `0.1.0` and has no SHA-256.

- [ ] **Step 3: Build the versioned archive and update the podspec with its actual digest**

  ```bash
  cd /Users/zjq/Desktop/AI/Codex-项目/P2PCDN
  npm run package:apple:sdk -- --version 1.0.2 --include-ios
  cat sdks/apple/dist/meshstreamkit-apple-sdk-1.0.2.zip.sha256
  ```

  Update the podspec to this form, inserting the actual digest output by the package script (never invent or reuse a prior release hash):

  ```ruby
  s.version = '1.0.2'
  s.source = {
    :http => 'https://sdk.meshstream.net/apple/1.0.2/MeshStreamKit.zip',
    :sha256 => 'ACTUAL_GENERATED_SHA256'
  }
  ```

  Keep the XCFramework, iOS 13.0, macOS 10.14, Foundation, Network, Security, and ARC fields unchanged.

- [ ] **Step 4: Verify artifact, release metadata, and local pod lint**

  ```bash
  cd /Users/zjq/Desktop/AI/Codex-项目/P2PCDN
  bash sdks/apple/scripts/test_apple_packaging.sh
  node scripts/repo-boundary.test.mjs
  grep -F -- '- (void)close;' sdks/apple/artifacts/MeshStreamKit.xcframework/ios-arm64/MeshStreamKit.framework/Headers/MeshStreamKit.h
  pod spec lint MeshStreamKit.podspec --allow-warnings --verbose
  ```

  Expected: all pass and the packaged public header declares `close`.

- [ ] **Step 5: Publish only the validated archive and pod**

  Upload `MeshStreamKit.zip` to `https://sdk.meshstream.net/apple/1.0.2/MeshStreamKit.zip`, then run:

  ```bash
  curl --fail --location --silent --show-error https://sdk.meshstream.net/apple/1.0.2/MeshStreamKit.zip -o /tmp/MeshStreamKit-1.0.2.zip
  shasum -a 256 /tmp/MeshStreamKit-1.0.2.zip
  pod trunk push MeshStreamKit.podspec --allow-warnings
  pod spec which MeshStreamKit --version=1.0.2
  ```

  Expected: remote SHA-256 matches the podspec, the trunk push succeeds, and 1.0.2 resolves from public Specs.

- [ ] **Step 6: Commit source-controlled release metadata**

  ```bash
  cd /Users/zjq/Desktop/AI/Codex-项目/P2PCDN
  git add MeshStreamKit.podspec scripts/repo-boundary.test.mjs
  git commit -m "release(apple): publish MeshStreamKit 1.0.2"
  ```

### Task 3: Complete the RN iOS bridge against 1.0.2

**Files:**
- Modify: `MeshStreamP2P.podspec:8-13`
- Modify: `ios/MeshStreamP2P.m:1-340`
- Create: `ios/MeshStreamP2PValidation.h`
- Create: `ios/MeshStreamP2PValidation.m`
- Modify: `example/ios/MeshStreamRnDemoTests/MeshStreamRnDemoTests.m`
- Create: `scripts/verify-ios-bridge-source.mjs`

**Interfaces:**
- Consumes: public `-[P2PClient close]` from `MeshStreamKit 1.0.2`.
- Produces: the existing `NativeMeshStreamP2P.ts` Promise/event API without private Objective-C runtime calls.

- [ ] **Step 1: Write failing XCTest coverage for native-value normalization**

  Replace the placeholder test implementation with an import for a not-yet-created bridge validation header and these pure behavior tests:

  ```objective-c
  #import <XCTest/XCTest.h>
  #import <MeshStreamP2P/MeshStreamP2PValidation.h>

  - (void)testValidationTrimsURLsAndFiltersNonStringHeaders {
      XCTAssertEqualObjects(MeshStreamTrimmedString(@"  content-42\n"), @"content-42");
      XCTAssertNil(MeshStreamTrimmedString(@42));
      XCTAssertEqualObjects(MeshStreamHTTPURLFromValue(@" https://example.com/live.m3u8 ").absoluteString, @"https://example.com/live.m3u8");
      XCTAssertNil(MeshStreamHTTPURLFromValue(@"ftp://example.com/live.m3u8"));
      XCTAssertEqualObjects(MeshStreamStringHeaders(@{ @"Authorization": @"Bearer token", @"retry": @1, @2: @"ignored" }), @{ @"Authorization": @"Bearer token" });
  }
  ```

- [ ] **Step 2: Verify red after Task 2 has published the public pod**

  ```bash
  cd /Users/zjq/Desktop/AI/Codex-项目/P2PCDN/.worktrees/meshstream-p2p-react-native-sdk/example/ios
  pod install --repo-update
  xcodebuild -workspace MeshStreamRnDemo.xcworkspace -scheme MeshStreamRnDemoTests -sdk iphonesimulator -configuration Debug CODE_SIGNING_ALLOWED=NO test
  ```

  Expected: compilation fails because `MeshStreamP2PValidation.h` does not exist. If the public 1.0.2 pod does not resolve, return to Task 2; do not add a local path workaround.

- [ ] **Step 3: Implement and consume the tested validation helpers**

  Create `ios/MeshStreamP2PValidation.h`:

  ```objective-c
  #import <Foundation/Foundation.h>
  FOUNDATION_EXPORT NSString * _Nullable MeshStreamTrimmedString(id _Nullable value);
  FOUNDATION_EXPORT NSURL * _Nullable MeshStreamHTTPURLFromValue(id _Nullable value);
  FOUNDATION_EXPORT NSDictionary<NSString *, NSString *> *MeshStreamStringHeaders(id _Nullable value);
  ```

  Create `ios/MeshStreamP2PValidation.m`:

  ```objective-c
  #import "MeshStreamP2PValidation.h"
  NSString *MeshStreamTrimmedString(id value) {
      return [value isKindOfClass:NSString.class] ? [(NSString *)value stringByTrimmingCharactersInSet:NSCharacterSet.whitespaceAndNewlineCharacterSet] : nil;
  }
  NSURL *MeshStreamHTTPURLFromValue(id value) {
      NSURL *url = [NSURL URLWithString:MeshStreamTrimmedString(value)];
      return [@[@"http", @"https"] containsObject:url.scheme.lowercaseString] ? url : nil;
  }
  NSDictionary<NSString *, NSString *> *MeshStreamStringHeaders(id value) {
      if (![value isKindOfClass:NSDictionary.class]) return @{};
      NSMutableDictionary<NSString *, NSString *> *headers = [NSMutableDictionary dictionary];
      [(NSDictionary *)value enumerateKeysAndObjectsUsingBlock:^(id key, id item, BOOL *stop) {
          if ([key isKindOfClass:NSString.class] && [item isKindOfClass:NSString.class]) headers[key] = item;
      }];
      return headers;
  }
  ```

  Import that header from `MeshStreamP2P.m`. Use `MeshStreamHTTPURLFromValue` for playback URLs, `MeshStreamTrimmedString` for optional `contentId`/`mimeType`, and `MeshStreamStringHeaders` for `originHeaders`.

- [ ] **Step 4: Write the failing public-API-only source check**

  Create `scripts/verify-ios-bridge-source.mjs` before deleting the runtime call:

  ```javascript
  import assert from 'node:assert/strict';
  import {readFileSync} from 'node:fs';
  const source = readFileSync(new URL('../ios/MeshStreamP2P.m', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /#import <objc\/message\.h>/);
  assert.doesNotMatch(source, /objc_msgSend|NSSelectorFromString\(@"close"\)/);
  assert.match(source, /\[bridgeClient\.client close\]/);
  ```

  Run `node scripts/verify-ios-bridge-source.mjs`; expected failure because the legacy runtime selector is still present.

- [ ] **Step 5: Pin the public API and delete runtime selector probing**

  Set the RN dependency exactly:

  ```ruby
  s.dependency 'MeshStreamKit', '= 1.0.2'
  ```

  Delete `#import <objc/message.h>` and `closeNativeClient:`. In both existing callers, use the documented method:

  ```objective-c
  [bridgeClient.client close];
  ```

  Keep ordering: remove JS mapping, remove listener, close retained sessions, close client, clear strong reference. In `sessionForClient:sessionId:reject:`, reject a missing client before accessing `bridgeClient.sessions`. Preserve bounded event buffering, event names, and error codes.

- [ ] **Step 6: Verify green, public resolution, and iOS build**

  ```bash
  cd /Users/zjq/Desktop/AI/Codex-项目/P2PCDN/.worktrees/meshstream-p2p-react-native-sdk/example/ios
  pod deintegrate
  rm -rf Pods Podfile.lock
  pod install --repo-update
  grep -A2 -F 'MeshStreamKit (1.0.2)' Podfile.lock
  xcodebuild -workspace MeshStreamRnDemo.xcworkspace -scheme MeshStreamRnDemo -sdk iphonesimulator -configuration Debug CODE_SIGNING_ALLOWED=NO build
  node ../../scripts/verify-ios-bridge-source.mjs
  xcodebuild -workspace MeshStreamRnDemo.xcworkspace -scheme MeshStreamRnDemoTests -sdk iphonesimulator -configuration Debug CODE_SIGNING_ALLOWED=NO test
  ```

  Expected: lockfile uses public Specs (not a path); app and XCTest target pass.

- [ ] **Step 7: Commit**

  ```bash
  cd /Users/zjq/Desktop/AI/Codex-项目/P2PCDN/.worktrees/meshstream-p2p-react-native-sdk
  git add MeshStreamP2P.podspec ios/MeshStreamP2P.m ios/MeshStreamP2PValidation.h ios/MeshStreamP2PValidation.m example/ios/MeshStreamRnDemoTests/MeshStreamRnDemoTests.m scripts/verify-ios-bridge-source.mjs
  git commit -m "feat(ios): use public MeshStreamKit client lifecycle"
  ```

### Task 4: Document and lint the RN package

**Files:**
- Modify: `README.md`, `README.zh-CN.md`
- Create: `scripts/verify-ios-cocoapods.mjs`

**Interfaces:**
- Consumes: Task 3's exact pod pin.
- Produces: installation instructions that require npm install, `pod install --repo-update`, and an iOS rebuild only.

- [ ] **Step 1: Write a failing public-dependency documentation check**

  Create `scripts/verify-ios-cocoapods.mjs`:

  ```javascript
  import assert from 'node:assert/strict';
  import {readFileSync} from 'node:fs';
  const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
  const podspec = read('../MeshStreamP2P.podspec');
  assert.match(podspec, /s\.dependency 'MeshStreamKit', '= 1\.0\.1'/);
  assert.match(read('../README.md'), /MeshStreamKit 1\.0\.1/);
  assert.match(read('../README.zh-CN.md'), /MeshStreamKit 1\.0\.1/);
  assert.doesNotMatch(podspec, /path\s*=>/);
  ```

- [ ] **Step 2: Run it before docs change**

  ```bash
  cd /Users/zjq/Desktop/AI/Codex-项目/P2PCDN/.worktrees/meshstream-p2p-react-native-sdk
  node scripts/verify-ios-cocoapods.mjs
  ```

  Expected: fails until the podspec and both READMEs document public 1.0.2.

- [ ] **Step 3: Document normal public CocoaPods installation**

  In both READMEs state: the iOS bridge uses public `MeshStreamKit 1.0.2`; run `cd ios && pod install --repo-update` after npm install; rebuild the app; do not add a local pod path or embed the XCFramework; iOS 13.0+ is required. Translate the same operational guidance naturally in Chinese.

- [ ] **Step 4: Verify package and pod lint**

  ```bash
  cd /Users/zjq/Desktop/AI/Codex-项目/P2PCDN/.worktrees/meshstream-p2p-react-native-sdk
  npm ci && npm run typecheck && npm run build
  node scripts/verify-ios-cocoapods.mjs
  cd example && npm ci && npm test -- --runInBand
  cd .. && pod lib lint MeshStreamP2P.podspec --allow-warnings --verbose
  ```

  Expected: all commands pass through public dependency resolution.

- [ ] **Step 5: Commit and record release evidence**

  ```bash
  cd /Users/zjq/Desktop/AI/Codex-项目/P2PCDN/.worktrees/meshstream-p2p-react-native-sdk
  git add README.md README.zh-CN.md scripts/verify-ios-cocoapods.mjs
  git commit -m "docs(ios): document public CocoaPods setup"
  ```

  Completion note must include the public pod version, artifact SHA-256, `pod trunk push` result, RN iOS build/test results, and TypeScript/Jest results.
