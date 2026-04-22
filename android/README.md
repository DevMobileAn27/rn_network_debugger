# `rn_network_debugger/android`

Android implementation of the `rn_network_debugger` dev-only network capture library.

## What this folder contains

- `js/`
  - React Native JS instrumentation for `fetch` and `XMLHttpRequest`
- `src/main/java/com/reactnativeviewer/rnvnetwork`
  - Android native bridge module
  - Android React package
  - WebSocket transport client
- `build.gradle`
  - local Android library module configuration

## Current scope

- debug/dev only
- compatible with React Native `0.74`
- captures app-initiated requests that go through JS `fetch` / `XMLHttpRequest`
- sends structured network events to `React Native Viewer` over WebSocket

## Important limitations

- this is not a proxy and does not capture every native SDK request automatically
- release builds should not include this module
- host apps with custom variants should wire this module into every dev-like variant explicitly

## Integration overview

1. Add this folder as a local Android library module in the host RN app.
2. Use the Android module from the `rn_network_debugger` package in your debug/dev build.
3. Register `RNVNetworkDevPackage` only in dev/debug code paths.
4. Bootstrap `startRNVNetworkCapture(...)` once at app startup.

Package-level usage lives in [`../README.md`](../README.md).
