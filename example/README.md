# MeshStream React Native Demo

This application demonstrates the `react-native-meshstream` SDK with a
playback URL input, runtime P2P controls, event output, statistics, and
diagnostics.

## Prerequisites

- Node.js 18 or later
- React Native development environment for Android or iOS
- An Android or iOS SDK key created in the MeshStream console

For Android testing, use an ARM64 physical device. The current Android native
artifact is published for `arm64-v8a`; x86 and x86_64 emulators require an ABI
compatible build.

## Run

Install dependencies from this directory:

```bash
npm install
```

Start Metro in one terminal:

```bash
npm start
```

Then launch the Android demo from a second terminal:

```bash
npm run android
```

For iOS, install Pods on macOS before launching the app:

```bash
cd ios
bundle install
bundle exec pod install
cd ..
npm run ios
```

Enter a matching platform key and a playable media URL in the application. The
demo prints lifecycle events, P2P statistics, and diagnostics on screen.

## Notes

- Use separate Android and iOS keys when platform restrictions are enabled.
- The SDK returns a playback URL and does not replace the application's media
  player.
- See the repository root README for the complete integration API and platform
  support details.
