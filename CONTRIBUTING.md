# Contributing to MeshStream React Native SDK

## Demo Dependency Policy

The committed demo is a consumer of the published npm package. This makes the
repository's integration build representative of what application developers
install.

- Commit `example/package.json` and `example/package-lock.json` with an exact
  published version of `react-native-meshstream` (for example, `1.0.2`). Do not
  use `latest`, a semver range, or `file:..` in committed demo dependencies.
- For local SDK development, temporarily replace the demo dependency with the
  working tree:

  ```bash
  cd example
  npm install react-native-meshstream@file:.. --save-exact
  ```

- Before a release is pushed to GitHub, restore the exact npm version that was
  published and commit the resulting lockfile:

  ```bash
  cd example
  npm install react-native-meshstream@1.0.2 --save-exact --registry=https://registry.npmjs.org
  ```

  Replace `1.0.2` with the release version being verified.

## Release Verification

After restoring the published dependency, reinstall iOS Pods and verify both
native platforms before pushing:

```bash
cd example/ios
pod install --repo-update
cd ..
npm run ios
npm run android
```

The iOS and Android builds must resolve `react-native-meshstream` from npm, not
from the repository working tree. Commit the updated `example/package.json` and
`example/package-lock.json` only after this published-package verification
succeeds.
