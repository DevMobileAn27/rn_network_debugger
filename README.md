# `rn_network_debugger`

`rn_network_debugger` is a dev-only React Native library extracted from `rnv_network_sdk`.
It captures `fetch` and `XMLHttpRequest` traffic inside a React Native app, then forwards
those events to React Native Viewer through the local ingest endpoint `ws://<mac-ip>:38940/rnv/network`.

## Exports

The package keeps the original SDK API for compatibility:

- `startRNVNetworkCapture`
- `stopRNVNetworkCapture`
- `createRNVNetworkCaptureController`
- `addRNVNetworkListener`

It also exposes aliases that match the npm package name:

- `startRNNetworkDebugger`
- `stopRNNetworkDebugger`
- `createRNNetworkDebuggerController`
- `addRNNetworkDebuggerListener`

And it now includes a bootstrap/config layer so the React Native app does not need
its own `startRNVNetworkCapture.ts` file:

- `defineRNNetworkDebuggerConfig`
- `bootRNNetworkDebugger`
- `stopRNNetworkDebuggerBootstrap`
- `resolveRNNetworkDebuggerViewerHost`
- `resolveRNNetworkDebuggerViewerURL`

## Usage

Create one config file in the React Native app:

```ts
// src/devtools/rnNetworkDebugger.config.ts
import {
  DEFAULT_VIEWER_PORT,
  defineRNNetworkDebuggerConfig,
} from '@quocandev27/rn_network_debugger';

export default defineRNNetworkDebuggerConfig({
  VIEWER_PORT: DEFAULT_VIEWER_PORT,
});
```

Then bootstrap the debugger with package actions:

```ts
import {
  bootRNNetworkDebugger,
  stopRNNetworkDebuggerBootstrap,
} from '@quocandev27/rn_network_debugger';
import rnNetworkDebuggerConfig from './src/devtools/rnNetworkDebugger.config';

if (__DEV__) {
  bootRNNetworkDebugger(rnNetworkDebuggerConfig);
}

// Later, if needed:
stopRNNetworkDebuggerBootstrap();
```

`bootRNNetworkDebugger(...)` will:

- resolve the correct host from `NativeModules.SourceCode.scriptURL` when Metro is running
- fall back to `127.0.0.1` on iOS and `10.0.2.2` on Android
- build `ws://<host>:<VIEWER_PORT>/rnv/network`
- call `startRNVNetworkCapture(...)` for you

### Config type

`defineRNNetworkDebuggerConfig(...)` accepts either the uppercase config keys:

- `VIEWER_HOST`
- `VIEWER_PATH`
- `VIEWER_PORT`
- `VIEWER_URL`
- `MAX_BODY_PREVIEW_CHARACTERS`
- `MASK_HEADERS`

or the camelCase equivalents:

- `viewerHost`
- `viewerPath`
- `viewerPort`
- `viewerURL`
- `maxBodyPreviewCharacters`
- `maskHeaders`

Advanced low-level capture options are also supported:

- `captureFetch`
- `captureXMLHttpRequest`
- `maxBatchSize`
- `flushIntervalMs`

## Package layout

- `android/`: Android library module
- `bootstrapRuntime.js`: shared bootstrap/config runtime
- `ios/`: iOS native sources and JavaScript bridge
- `index.d.ts`: exported TypeScript types
- `RNNetworkDebugger.podspec`: iOS CocoaPods entry point
- `react-native.config.js`: React Native autolinking metadata

## Notes

- The native bridge names remain compatible with the original SDK internals.
- This package is intended for debug/dev workflows only.
